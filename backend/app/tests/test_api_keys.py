import unittest
from datetime import datetime, timezone, timedelta
from sqlalchemy.exc import IntegrityError
from fastapi.testclient import TestClient
from app.main import app
from app.core.database import SessionLocal
from app.core.security import get_current_approved_user, validate_api_key, hash_api_key
from app.system.models import User, APIKey
from app.core.config import get_settings

settings = get_settings()

class TestAPIKeyManagement(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.db = SessionLocal()
        # Create a test user in the database
        cls.test_user_id = "user_test_merchant_123"
        cls.test_user = cls.db.query(User).filter(User.id == cls.test_user_id).first()
        if not cls.test_user:
            cls.test_user = User(
                id=cls.test_user_id,
                email="test_merchant@razorpay.com",
                store_name="Test Merchant Store",
                status="approved"
            )
            cls.db.add(cls.test_user)
            cls.db.commit()
            cls.db.refresh(cls.test_user)
        else:
            cls.test_user.status = "approved"
            cls.db.commit()

        # Setup dependency overrides for TestClient
        def override_get_current_approved_user():
            return cls.test_user

        app.dependency_overrides[get_current_approved_user] = override_get_current_approved_user
        cls.client = TestClient(app)

    @classmethod
    def tearDownClass(cls):
        # Cleanup test data
        cls.db.query(APIKey).filter(APIKey.customer_id == cls.test_user_id).delete()
        cls.db.query(User).filter(User.id == cls.test_user_id).delete()
        cls.db.commit()
        cls.db.close()
        app.dependency_overrides.clear()

    def setUp(self):
        # Clear keys for test user before each test to ensure a clean slate
        self.db.query(APIKey).filter(APIKey.customer_id == self.test_user_id).delete()
        self.db.commit()

    def test_create_and_list_api_keys(self):
        # 1. Create API key
        response = self.client.post("/api/dashboard/keys", json={"name": "Production Key"})
        self.assertEqual(response.status_code, 200)
        data = response.json()
        self.assertIn("api_key", data)
        self.assertIn("key_prefix", data)
        self.assertEqual(data["name"], "Production Key")
        self.assertEqual(data["status"], "active")
        
        raw_key = data["api_key"]
        prefix = data["key_prefix"]
        self.assertTrue(raw_key.startswith("sk_live_"))
        self.assertEqual(raw_key[8:14], prefix)

        # Ensure key_hash is not returned in create response
        self.assertNotIn("key_hash", data)

        # 2. List API keys
        list_response = self.client.get("/api/dashboard/keys")
        self.assertEqual(list_response.status_code, 200)
        list_data = list_response.json()
        self.assertEqual(list_data["total_count"], 1)
        self.assertEqual(list_data["active_count"], 1)
        self.assertEqual(list_data["max_keys"], 5)
        
        # Verify the list does NOT contain the raw key or key_hash
        keys = list_data["keys"]
        self.assertEqual(len(keys), 1)
        self.assertEqual(keys[0]["name"], "Production Key")
        self.assertNotIn("api_key", keys[0])
        self.assertNotIn("key_hash", keys[0])
        self.assertNotIn("revoked_at", keys[0])

    def test_name_uniqueness_constraint_and_conflict(self):
        # Create first key
        r1 = self.client.post("/api/dashboard/keys", json={"name": "Duplicate Name"})
        self.assertEqual(r1.status_code, 200)

        # Attempt to create key with same name
        r2 = self.client.post("/api/dashboard/keys", json={"name": "Duplicate Name"})
        self.assertEqual(r2.status_code, 409)
        self.assertEqual(r2.json()["error"]["code"], "duplicate_key_name")

    def test_max_limit_five_keys(self):
        # Create 5 keys
        for i in range(5):
            r = self.client.post("/api/dashboard/keys", json={"name": f"Key {i}"})
            self.assertEqual(r.status_code, 200)

        # Try creating the 6th key
        r_fail = self.client.post("/api/dashboard/keys", json={"name": "Key 5"})
        self.assertEqual(r_fail.status_code, 403)
        self.assertEqual(r_fail.json()["error"]["code"], "key_limit_reached")

    def test_direct_deletion_frees_slot_and_name(self):
        # Create key
        r = self.client.post("/api/dashboard/keys", json={"name": "Delete Me"})
        self.assertEqual(r.status_code, 200)
        key_id = r.json()["id"]
        raw_key = r.json()["api_key"]

        # Verify key works for authentication
        user = validate_api_key(authorization=f"Bearer {raw_key}", db=self.db)
        self.assertEqual(user.id, self.test_user_id)

        # Delete the key
        r_del = self.client.delete(f"/api/dashboard/keys/{key_id}")
        self.assertEqual(r_del.status_code, 200)
        self.assertEqual(r_del.json()["status"], "success")

        # Verify key is deleted from database
        db_key = self.db.query(APIKey).filter(APIKey.id == key_id).first()
        self.assertIsNone(db_key)

        # Verify key fails authentication immediately
        with self.assertRaises(Exception) as ctx:
            validate_api_key(authorization=f"Bearer {raw_key}", db=self.db)
        self.assertEqual(ctx.exception.status_code, 401)
        self.assertEqual(ctx.exception.detail, "Invalid API Key")

        # Deleting again should return 404
        r_del_again = self.client.delete(f"/api/dashboard/keys/{key_id}")
        self.assertEqual(r_del_again.status_code, 404)

        # Verify the deleted key name can be reused
        r_reuse = self.client.post("/api/dashboard/keys", json={"name": "Delete Me"})
        self.assertEqual(r_reuse.status_code, 200)

    def test_pausing_and_continuing_api_keys(self):
        # Create a key
        r = self.client.post("/api/dashboard/keys", json={"name": "Pausable Key"})
        self.assertEqual(r.status_code, 200)
        key_id = r.json()["id"]
        raw_key = r.json()["api_key"]

        # Pause the key
        r_pause = self.client.patch(f"/api/dashboard/keys/{key_id}/pause")
        self.assertEqual(r_pause.status_code, 200)
        self.assertEqual(r_pause.json()["status"], "paused")

        # Verify authentication fails with a specific "API Key is paused" error
        with self.assertRaises(Exception) as ctx:
            validate_api_key(authorization=f"Bearer {raw_key}", db=self.db)
        self.assertEqual(ctx.exception.status_code, 401)
        self.assertEqual(ctx.exception.detail, "API Key is paused")

        # Paused keys still count toward the limit (total keys = 1)
        # Verify paused keys' names still violate uniqueness
        r_dup = self.client.post("/api/dashboard/keys", json={"name": "Pausable Key"})
        self.assertEqual(r_dup.status_code, 409)

        # Continue the key
        r_continue = self.client.patch(f"/api/dashboard/keys/{key_id}/continue")
        self.assertEqual(r_continue.status_code, 200)
        self.assertEqual(r_continue.json()["status"], "active")

        # Verify authentication succeeds again
        user = validate_api_key(authorization=f"Bearer {raw_key}", db=self.db)
        self.assertEqual(user.id, self.test_user_id)

    def test_passive_expiration(self):
        # Create key
        r = self.client.post("/api/dashboard/keys", json={"name": "Expiry Key"})
        self.assertEqual(r.status_code, 200)
        key_id = r.json()["id"]
        raw_key = r.json()["api_key"]

        # Modify database to expire the key
        key_record = self.db.query(APIKey).filter(APIKey.id == key_id).first()
        key_record.expires_at = datetime.now(timezone.utc) - timedelta(minutes=10)
        self.db.commit()

        # Verify authentication fails (Expired API Key)
        with self.assertRaises(Exception) as ctx:
            validate_api_key(authorization=f"Bearer {raw_key}", db=self.db)
        
        self.assertEqual(ctx.exception.status_code, 401)
        self.assertEqual(ctx.exception.detail, "Expired API Key")

    def test_debounced_last_used_at(self):
        # Create key
        r = self.client.post("/api/dashboard/keys", json={"name": "Debounce Key"})
        self.assertEqual(r.status_code, 200)
        raw_key = r.json()["api_key"]
        key_id = r.json()["id"]

        # 1st authentication
        user = validate_api_key(authorization=f"Bearer {raw_key}", db=self.db)
        self.assertEqual(user.id, self.test_user_id)
        
        key_record = self.db.query(APIKey).filter(APIKey.id == key_id).first()
        t1 = key_record.last_used_at
        self.assertIsNotNone(t1)

        # 2nd authentication immediately (debounce)
        validate_api_key(authorization=f"Bearer {raw_key}", db=self.db)
        self.db.refresh(key_record)
        t2 = key_record.last_used_at
        self.assertEqual(t1, t2)

        # Manually backdate last_used_at
        key_record.last_used_at = datetime.now(timezone.utc) - timedelta(seconds=120)
        self.db.commit()
        t3_initial = key_record.last_used_at

        # 3rd authentication
        validate_api_key(authorization=f"Bearer {raw_key}", db=self.db)
        self.db.refresh(key_record)
        t3_final = key_record.last_used_at
        self.assertNotEqual(t3_initial, t3_final)
        self.assertTrue(t3_final > t3_initial)

    def test_backward_compatibility_with_hex_key(self):
        # Generate an old-style 64-char hex key: sk_live_ followed by 64 hex characters
        old_random = "a" * 64
        old_raw_key = f"sk_live_{old_random}"
        old_prefix = old_random[:6] # "aaaaaa"
        old_hash = hash_api_key(old_raw_key, settings.API_KEY_HMAC_SECRET)

        # Insert directly into DB
        old_key_record = APIKey(
            customer_id=self.test_user_id,
            name="Old Hex Key",
            key_prefix=old_prefix,
            key_hash=old_hash,
            status="active"
        )
        self.db.add(old_key_record)
        self.db.commit()

        try:
            # Verify that validate_api_key successfully authenticates the old hex key
            user = validate_api_key(authorization=f"Bearer {old_raw_key}", db=self.db)
            self.assertEqual(user.id, self.test_user_id)
        finally:
            # Clean up key
            self.db.delete(old_key_record)
            self.db.commit()

    def test_db_level_unique_constraint(self):
        # Insert a key directly bypassing API layer
        k1 = APIKey(
            customer_id=self.test_user_id,
            name="SQL Unique Test",
            key_prefix="123456",
            key_hash="some_hash",
            status="active"
        )
        self.db.add(k1)
        self.db.commit()

        # Insert a duplicate key name directly
        k2 = APIKey(
            customer_id=self.test_user_id,
            name="SQL Unique Test",
            key_prefix="654321",
            key_hash="another_hash",
            status="active"
        )
        self.db.add(k2)
        
        with self.assertRaises(IntegrityError):
            self.db.commit()
        
        self.db.rollback()

if __name__ == "__main__":
    unittest.main()

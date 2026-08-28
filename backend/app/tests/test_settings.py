import unittest
from unittest.mock import patch
from fastapi.testclient import TestClient
from app.main import app
from app.core.database import SessionLocal
from app.core.security import get_current_user
from app.system.models import User, Onboarding

class TestMerchantSettingsAPIs(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.db = SessionLocal()
        cls.test_user_id = "user_test_settings_merchant_999"
        cls.test_user = cls.db.query(User).filter(User.id == cls.test_user_id).first()
        if not cls.test_user:
            cls.test_user = User(
                id=cls.test_user_id,
                email="test_settings_merchant@razorpay.com",
                store_name="Test Settings Store",
                status="approved"  # Needs to be approved for dashboard endpoints
            )
            cls.db.add(cls.test_user)
            cls.db.commit()
            cls.db.refresh(cls.test_user)

        # Override dependency for TestClient
        def override_get_current_user():
            return cls.test_user

        app.dependency_overrides[get_current_user] = override_get_current_user
        cls.client = TestClient(app)

    @classmethod
    def tearDownClass(cls):
        # Cleanup test data
        cls.db.query(Onboarding).filter(Onboarding.user_id == cls.test_user_id).delete()
        cls.db.query(User).filter(User.id == cls.test_user_id).delete()
        cls.db.commit()
        cls.db.close()
        app.dependency_overrides.clear()

    def setUp(self):
        # Clean onboarding row before each test to start with empty settings
        self.db.query(Onboarding).filter(Onboarding.user_id == self.test_user_id).delete()
        self.db.commit()

    @patch("botocore.client.BaseClient._make_api_call")
    def test_presign_logo_upload_success(self, mock_make_api_call):
        # Mock generate_presigned_url internally so it doesn't try to connect to AWS
        with patch("botocore.signers.RequestSigner.generate_presigned_url") as mock_presign:
            mock_presign.return_value = "https://mock-s3-upload-url.com/upload"
            
            payload = {
                "fileName": "my_brand_logo.png",
                "fileType": "image/png"
            }
            response = self.client.post("/api/dashboard/settings/logo/presign", json=payload)
            self.assertEqual(response.status_code, 200)
            data = response.json()
            
            self.assertEqual(data["uploadUrl"], "https://mock-s3-upload-url.com/upload")
            self.assertTrue(data["publicUrl"].startswith("https://shopagent-razorpay.s3.us-east-1.amazonaws.com/merchant-logo/"))
            self.assertTrue(data["key"].startswith(f"merchant-logo/{self.test_user_id}/"))
            self.assertTrue(data["key"].endswith(".png"))
            self.assertNotIn("my_brand_logo.png", data["key"])  # S3 key should not contain raw user filename

    def test_presign_logo_upload_invalid_mime(self):
        payload = {
            "fileName": "exploit.exe",
            "fileType": "application/octet-stream"
        }
        response = self.client.post("/api/dashboard/settings/logo/presign", json=payload)
        self.assertEqual(response.status_code, 400)
        self.assertIn("Unsupported file type", response.json()["detail"])

    def test_get_and_patch_settings_success(self):
        # 1. Fetch initial settings (should be empty/null defaults)
        response = self.client.get("/api/dashboard/settings")
        self.assertEqual(response.status_code, 200)
        data = response.json()
        self.assertIsNone(data["logo_url"])
        self.assertIsNone(data["brand_color"])

        # 2. Patch settings
        save_payload = {
            "logo_url": "https://shopagent-razorpay.s3.us-east-1.amazonaws.com/merchant-logo/user_test_settings_merchant_999/some-uuid.png",
            "brand_color": "#FF5733",
            "accent_color": "#00FF00",
            "display_name": "Acme Widgets",
            "confirmation_limit": 1000,
            "toggles": {
                "historyLookup": True,
                "cartNegotiation": False
            }
        }
        patch_response = self.client.patch("/api/dashboard/settings", json=save_payload)
        self.assertEqual(patch_response.status_code, 200)
        patch_data = patch_response.json()
        
        self.assertEqual(patch_data["logo_url"], save_payload["logo_url"])
        self.assertEqual(patch_data["brand_color"], save_payload["brand_color"])
        self.assertEqual(patch_data["accent_color"], save_payload["accent_color"])
        self.assertEqual(patch_data["display_name"], save_payload["display_name"])
        self.assertEqual(patch_data["confirmation_limit"], 1000)
        self.assertEqual(patch_data["toggles"], save_payload["toggles"])

        # 3. Retrieve settings again to ensure persistence
        get_response = self.client.get("/api/dashboard/settings")
        self.assertEqual(get_response.status_code, 200)
        get_data = get_response.json()
        self.assertEqual(get_data["logo_url"], save_payload["logo_url"])
        self.assertEqual(get_data["brand_color"], save_payload["brand_color"])

    def test_patch_settings_invalid_hex_color(self):
        save_payload = {
            "brand_color": "not-a-hex-color"
        }
        response = self.client.patch("/api/dashboard/settings", json=save_payload)
        self.assertEqual(response.status_code, 400)
        self.assertIn("Invalid brand_color format", response.json()["detail"])

    def test_patch_settings_invalid_logo_url(self):
        save_payload = {
            "logo_url": "https://malicious-bucket.s3.amazonaws.com/merchant-logo/malicious.png"
        }
        response = self.client.patch("/api/dashboard/settings", json=save_payload)
        self.assertEqual(response.status_code, 400)
        self.assertIn("Invalid logo_url", response.json()["detail"])

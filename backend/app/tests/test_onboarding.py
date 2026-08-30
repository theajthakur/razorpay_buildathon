import unittest
from fastapi.testclient import TestClient
from app.main import app
from app.core.database import SessionLocal
from app.core.security import get_current_user
from app.system.models import User, Onboarding

class TestOnboardingAPIs(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.db = SessionLocal()
        cls.test_user_id = "user_test_onboarding_merchant_123"
        cls.test_user = cls.db.query(User).filter(User.id == cls.test_user_id).first()
        if not cls.test_user:
            cls.test_user = User(
                id=cls.test_user_id,
                email="test_onboarding_merchant@razorpay.com",
                store_name="Test Onboarding Store",
                status="pending"
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
        # Clean onboarding row
        self.db.query(Onboarding).filter(Onboarding.user_id == self.test_user_id).delete()
        self.db.commit()

    def test_onboarding_upsert_and_fetch(self):
        payload = {
            "base_url": "https://api.teststore.com/v1",
            "auth_enabled": True,
            "auth_disabled_ack": False,
            "auth_config": {
                "auth_url": "https://api.teststore.com/v1/login",
                "method": "POST",
                "identifier_field": "email",
                "identifier_type": "Email",
                "password_field": "password",
                "token_path": "token",
                "token_delivery": {
                    "method": "header",
                    "header_name": "Authorization",
                    "bearer_prefix": True
                }
            },
            "products_config": {
                "path": "products",
                "method": "GET",
                "payload_key": "query",
                "response_key": "products"
            },
            "addresses_config": {
                "supports_creation": False,
                "fetch": {
                    "path": "addresses",
                    "method": "GET",
                    "response_key": "addresses"
                },
                "create": None
            },
            "create_order_config": {
                "path": "orders",
                "method": "POST",
                "cart_key": "cart",
                "item_id_field": "product_id",
                "price_field": "price",
                "quantity_field": "quantity",
                "address_id_field": "address_id",
                "additional_fields": [
                    {"key": "source", "value": "shopagent"}
                ]
            },
            "bank_account": "123456789012",
            "ifsc": "HDFC0000261",
            "branch_name": "Test Branch HDFC",
            "branding_config": {
                "brand_color": "#FF5733",
                "logo_url": "https://teststore.com/images/logo.png"
            },
            "webhook_url": "https://api.teststore.com/v1/webhook"
        }

        # 1. Upsert onboarding configuration
        response = self.client.post("/system/onboarding", json=payload)
        self.assertEqual(response.status_code, 200)
        data = response.json()
        
        self.assertEqual(data["base_url"], "https://api.teststore.com/v1")
        self.assertEqual(data["webhook_url"], "https://api.teststore.com/v1/webhook")
        self.assertIsNotNone(data["branding_config"])
        self.assertEqual(data["branding_config"]["brand_color"], "#FF5733")
        self.assertEqual(data["branding_config"]["logo_url"], "https://teststore.com/images/logo.png")

        self.assertEqual(data["create_order_config"]["address_id_field"], "address_id")
        self.assertEqual(data["create_order_config"]["additional_fields"], [{"key": "source", "value": "shopagent"}])
        self.assertFalse(data["addresses_config"]["supports_creation"])
        self.assertIsNone(data["addresses_config"]["create"])

        # 2. Fetch onboarding details
        get_response = self.client.get("/system/onboarding")
        self.assertEqual(get_response.status_code, 200)
        get_data = get_response.json()
        self.assertEqual(get_data["base_url"], "https://api.teststore.com/v1")
        self.assertEqual(get_data["webhook_url"], "https://api.teststore.com/v1/webhook")
        self.assertEqual(get_data["branding_config"]["brand_color"], "#FF5733")
        self.assertEqual(get_data["create_order_config"]["address_id_field"], "address_id")
        
        # Verify the user status was transitioned to approved upon completing setup
        user_row = self.db.query(User).filter(User.id == self.test_user_id).first()
        self.db.refresh(user_row)
        self.assertEqual(user_row.status, "approved")

    def test_legacy_create_order_config_deserialization(self):
        # Delete any existing test onboarding row
        self.db.query(Onboarding).filter(Onboarding.user_id == self.test_user_id).delete()
        self.db.commit()

        # Insert a legacy Onboarding DB row where create_order_config lacks address_id_field
        legacy_onboarding = Onboarding(
            user_id=self.test_user_id,
            base_url="https://api.legacy.com/v1",
            auth_enabled=False,
            auth_disabled_ack=True,
            auth_config=None,
            products_config=None,
            order_history_config=None,
            customer_profile_config=None,
            addresses_config=None,
            create_order_config={
                "path": "user/order/merchant-os",
                "method": "POST",
                "cart_key": "cart",
                "item_id_field": "product_id",
                "price_field": "price",
                "quantity_field": "quantity"
            }
        )
        self.db.add(legacy_onboarding)
        self.db.commit()

        # Fetch via endpoint to ensure response validation succeeds with default address_id_field
        get_response = self.client.get("/system/onboarding")
        self.assertEqual(get_response.status_code, 200)
        data = get_response.json()
        self.assertIsNotNone(data["create_order_config"])
        self.assertEqual(data["create_order_config"]["address_id_field"], "address_id")

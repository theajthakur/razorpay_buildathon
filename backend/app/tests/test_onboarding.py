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
            "bank_account": "123456789012",
            "ifsc": "HDFC0000261",
            "branch_name": "Test Branch HDFC",
            "branding_config": {
                "colorTheme": "#FF5733",
                "logoUrl": "https://teststore.com/images/logo.png"
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
        self.assertEqual(data["branding_config"]["colorTheme"], "#FF5733")
        self.assertEqual(data["branding_config"]["logoUrl"], "https://teststore.com/images/logo.png")

        # 2. Fetch onboarding details
        get_response = self.client.get("/system/onboarding")
        self.assertEqual(get_response.status_code, 200)
        get_data = get_response.json()
        self.assertEqual(get_data["base_url"], "https://api.teststore.com/v1")
        self.assertEqual(get_data["webhook_url"], "https://api.teststore.com/v1/webhook")
        self.assertEqual(get_data["branding_config"]["colorTheme"], "#FF5733")
        
        # Verify the user status was transitioned to approved upon completing setup
        user_row = self.db.query(User).filter(User.id == self.test_user_id).first()
        self.db.refresh(user_row)
        self.assertEqual(user_row.status, "approved")

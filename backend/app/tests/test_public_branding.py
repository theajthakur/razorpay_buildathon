import unittest
from fastapi.testclient import TestClient
from app.main import app
from app.core.database import SessionLocal
from app.system.models import User, Onboarding, DomainMapping

class TestPublicBrandingAPI(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.db = SessionLocal()
        cls.client = TestClient(app)
        
        # Cleanup first in case a previous run crashed
        cls.test_user_id = "user_test_public_branding_999"
        cls.db.query(DomainMapping).filter(DomainMapping.slug == "test-public-slug").delete()
        cls.db.query(DomainMapping).filter(DomainMapping.slug == "test-public-slug-missing").delete()
        cls.db.query(Onboarding).filter(Onboarding.user_id == cls.test_user_id).delete()
        cls.db.query(User).filter(User.id == cls.test_user_id).delete()
        cls.db.commit()
        
        # Create a test user
        cls.test_user = User(
            id=cls.test_user_id,
            email="public_branding_test@razorpay.com",
            store_name="Test Public Store",
            status="approved"
        )
        cls.db.add(cls.test_user)
        cls.db.commit()


    @classmethod
    def tearDownClass(cls):
        # Cleanup test user and database state
        cls.db.query(DomainMapping).filter(DomainMapping.slug == "test-public-slug").delete()
        cls.db.query(Onboarding).filter(Onboarding.user_id == cls.test_user_id).delete()
        cls.db.query(User).filter(User.id == cls.test_user_id).delete()
        cls.db.commit()
        cls.db.close()

    def setUp(self):
        # Clear domain mappings and onboardings for our test slug
        self.db.query(DomainMapping).filter(DomainMapping.slug == "test-public-slug").delete()
        self.db.query(Onboarding).filter(Onboarding.user_id == self.test_user_id).delete()
        self.db.commit()

    def test_get_branding_success(self):
        # 1. Create onboarding with branding config and slug
        onboarding = Onboarding(
            user_id=self.test_user_id,
            base_url="https://api.teststore.com/v1",
            auth_enabled=True,
            slug="test-public-slug",
            branding_config={
                "brand_color": "#FF5733",
                "logo_url": "https://shopagent-razorpay.s3.amazonaws.com/merchant-logo/test.png",
                "display_name": "Test Public Store UI"
            }
        )
        self.db.add(onboarding)
        self.db.commit()

        # 2. Create domain mapping
        mapping = DomainMapping(
            domain="test-brand-domain.com",
            slug="test-public-slug"
        )
        self.db.add(mapping)
        self.db.commit()

        # 3. Call endpoint with Host header matching mapping
        response = self.client.get("/api/public/branding", headers={"Host": "test-brand-domain.com"})
        self.assertEqual(response.status_code, 200)
        data = response.json()
        self.assertEqual(data["brand_color"], "#FF5733")
        self.assertEqual(data["display_name"], "Test Public Store UI")

    def test_get_branding_via_origin_header(self):
        # 1. Create onboarding with branding config and slug
        onboarding = Onboarding(
            user_id=self.test_user_id,
            base_url="https://api.teststore.com/v1",
            auth_enabled=True,
            slug="test-public-slug",
            branding_config={
                "brand_color": "#00FF00",
                "logo_url": "https://shopagent-razorpay.s3.amazonaws.com/merchant-logo/test.png",
                "display_name": "Test Origin Store"
            }
        )
        self.db.add(onboarding)
        self.db.commit()

        # 2. Create domain mapping for localhost:3002
        mapping = DomainMapping(
            domain="localhost:3002",
            slug="test-public-slug"
        )
        self.db.add(mapping)
        self.db.commit()

        # 3. Call endpoint with Host = localhost:8000 but Origin = http://localhost:3002
        response = self.client.get(
            "/api/public/branding",
            headers={
                "Host": "localhost:8000",
                "Origin": "http://localhost:3002"
            }
        )
        self.assertEqual(response.status_code, 200)
        data = response.json()
        self.assertEqual(data["brand_color"], "#00FF00")
        self.assertEqual(data["display_name"], "Test Origin Store")


    def test_get_branding_unmapped_host_404(self):
        # Call endpoint with host that does not exist in domain_mappings
        response = self.client.get("/api/public/branding", headers={"Host": "not-real-domain.com"})
        self.assertEqual(response.status_code, 404)
        self.assertIn("No merchant mapping found", response.json()["detail"])

    def test_get_branding_missing_config_404(self):
        # 1. Create onboarding config but with empty branding_config
        onboarding = Onboarding(
            user_id=self.test_user_id,
            base_url="https://api.teststore.com/v1",
            auth_enabled=True,
            slug="test-public-slug-missing",
            branding_config={}
        )
        self.db.add(onboarding)
        self.db.commit()

        # 2. Create domain mapping pointing to this slug
        mapping = DomainMapping(
            domain="test-brand-domain-missing.com",
            slug="test-public-slug-missing"
        )
        self.db.add(mapping)
        self.db.commit()

        try:
            # 3. Call endpoint - should return 404 due to empty/missing branding_config
            response = self.client.get("/api/public/branding", headers={"Host": "test-brand-domain-missing.com"})
            self.assertEqual(response.status_code, 404)
            self.assertIn("Branding configuration not found", response.json()["detail"])
        finally:
            # Cleanup
            self.db.query(DomainMapping).filter(DomainMapping.domain == "test-brand-domain-missing.com").delete()
            self.db.query(Onboarding).filter(Onboarding.slug == "test-public-slug-missing").delete()
            self.db.commit()

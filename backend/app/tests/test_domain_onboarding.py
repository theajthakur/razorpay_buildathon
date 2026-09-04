import unittest
from unittest.mock import patch, MagicMock
from fastapi.testclient import TestClient
import uuid

from app.main import app
from app.core.database import Base, engine, SessionLocal
from app.system.models import User, Onboarding, DomainMapping
from app.core.security import get_current_approved_user
from app.services.vercel import VercelDomainConflictError, VercelServiceUnavailableError, VercelAPIError


class TestDomainOnboardingAPIs(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        Base.metadata.create_all(bind=engine)
        cls.db = SessionLocal()
        cls.client = TestClient(app)

        # Create Merchant A
        cls.merchant_a_id = "user_test_domain_merchant_a"
        cls.user_a = User(
            id=cls.merchant_a_id,
            email="merchant_a@domaintest.com",
            store_name="Merchant A Store",
            status="approved"
        )

        # Create Merchant B
        cls.merchant_b_id = "user_test_domain_merchant_b"
        cls.user_b = User(
            id=cls.merchant_b_id,
            email="merchant_b@domaintest.com",
            store_name="Merchant B Store",
            status="approved"
        )

        cls.db.merge(cls.user_a)
        cls.db.merge(cls.user_b)
        cls.db.commit()

        # Create Onboarding for Merchant A
        cls.onboarding_a = Onboarding(
            user_id=cls.merchant_a_id,
            base_url="https://shopagent-backend.vijstack.com",
            auth_enabled=True,
            branding_config={}
        )
        # Create Onboarding for Merchant B
        cls.onboarding_b = Onboarding(
            user_id=cls.merchant_b_id,
            base_url="https://shopagent-backend.vijstack.com",
            auth_enabled=True,
            branding_config={}
        )
        cls.db.add(cls.onboarding_a)
        cls.db.add(cls.onboarding_b)
        cls.db.commit()
        cls.db.refresh(cls.onboarding_a)
        cls.db.refresh(cls.onboarding_b)

    @classmethod
    def tearDownClass(cls):
        cls.db.query(DomainMapping).delete()
        cls.db.query(Onboarding).filter(Onboarding.user_id.in_([cls.merchant_a_id, cls.merchant_b_id])).delete()
        cls.db.query(User).filter(User.id.in_([cls.merchant_a_id, cls.merchant_b_id])).delete()
        cls.db.commit()
        cls.db.close()

    def setUp(self):
        # Override auth dependency to default to Merchant A
        def override_get_current_approved_user():
            return self.user_a

        app.dependency_overrides[get_current_approved_user] = override_get_current_approved_user

    def tearDown(self):
        app.dependency_overrides.clear()
        self.db.query(DomainMapping).delete()
        self.db.commit()

    @patch("app.onboarding.router.add_domain_to_vercel")
    def test_add_domain_success(self, mock_add_vercel):
        mock_add_vercel.return_value = {
            "name": "agent.merchant-a.com",
            "verified": False,
            "verification": [
                {
                    "type": "CNAME",
                    "domain": "agent.merchant-a.com",
                    "value": "cname.vercel-dns.com"
                }
            ]
        }

        response = self.client.post("/onboarding/domains", json={"domain": "agent.merchant-a.com"})
        self.assertEqual(response.status_code, 201)
        data = response.json()
        self.assertEqual(data["domain"], "agent.merchant-a.com")
        self.assertEqual(data["status"], "PENDING")
        self.assertIsNotNone(data["dns_details"])
        self.assertEqual(data["dns_details"]["verification"][0]["value"], "cname.vercel-dns.com")

        # Verify DB entry
        mapping = self.db.query(DomainMapping).filter(DomainMapping.id == data["id"]).first()
        self.assertIsNotNone(mapping)
        self.assertEqual(mapping.onboarding_id, self.onboarding_a.id)

    def test_unauthenticated_request_fails(self):
        app.dependency_overrides.clear()
        response = self.client.post("/onboarding/domains", json={"domain": "agent.test.com"})
        self.assertEqual(response.status_code, 401)

    def test_invalid_domain_formats_rejected(self):
        invalid_domains = ["", "   ", "not-a-domain", "http://invalid space.com", "http://", "127.0.0.1"]
        for inv in invalid_domains:
            response = self.client.post("/onboarding/domains", json={"domain": inv})
            self.assertEqual(response.status_code, 400, f"Expected 400 for '{inv}', got {response.status_code}")

    @patch("app.onboarding.router.add_domain_to_vercel")
    def test_duplicate_domain_rejected_local(self, mock_add_vercel):
        mock_add_vercel.return_value = {"verified": False, "verification": []}
        
        # Add initial domain
        r1 = self.client.post("/onboarding/domains", json={"domain": "dup.merchant.com"})
        self.assertEqual(r1.status_code, 201)

        # Attempt to add duplicate domain
        r2 = self.client.post("/onboarding/domains", json={"domain": "dup.merchant.com"})
        self.assertEqual(r2.status_code, 409)

    @patch("app.onboarding.router.add_domain_to_vercel")
    def test_vercel_conflict_error_handled(self, mock_add_vercel):
        mock_add_vercel.side_effect = VercelDomainConflictError("Domain already taken on Vercel")
        response = self.client.post("/onboarding/domains", json={"domain": "vercel-dup.com"})
        self.assertEqual(response.status_code, 409)

    @patch("app.onboarding.router.add_domain_to_vercel")
    def test_vercel_service_unavailable_handled(self, mock_add_vercel):
        mock_add_vercel.side_effect = VercelServiceUnavailableError("Vercel offline")
        response = self.client.post("/onboarding/domains", json={"domain": "down.com"})
        self.assertEqual(response.status_code, 502)

    @patch("app.onboarding.router.add_domain_to_vercel")
    def test_list_domains_merchant_isolation(self, mock_add_vercel):
        mock_add_vercel.return_value = {"verified": False, "verification": []}

        # Create domain for Merchant A
        self.client.post("/onboarding/domains", json={"domain": "a.merchant.com"})

        # Switch auth context to Merchant B
        def override_merchant_b():
            return self.user_b
        app.dependency_overrides[get_current_approved_user] = override_merchant_b

        # Merchant B lists domains - should see 0
        r_b = self.client.get("/onboarding/domains")
        self.assertEqual(r_b.status_code, 200)
        self.assertEqual(r_b.json()["total_count"], 0)

        # Merchant B creates a domain
        self.client.post("/onboarding/domains", json={"domain": "b.merchant.com"})
        r_b2 = self.client.get("/onboarding/domains")
        self.assertEqual(r_b2.json()["total_count"], 1)
        self.assertEqual(r_b2.json()["domains"][0]["domain"], "b.merchant.com")

    @patch("app.onboarding.router.add_domain_to_vercel")
    def test_merchant_cannot_access_or_delete_other_merchant_domain(self, mock_add_vercel):
        mock_add_vercel.return_value = {"verified": False, "verification": []}

        # Merchant A creates domain
        r_a = self.client.post("/onboarding/domains", json={"domain": "private.merchant-a.com"})
        domain_id = r_a.json()["id"]

        # Switch auth to Merchant B
        def override_merchant_b():
            return self.user_b
        app.dependency_overrides[get_current_approved_user] = override_merchant_b

        # Merchant B GET domain -> 404
        r_get = self.client.get(f"/onboarding/domains/{domain_id}")
        self.assertEqual(r_get.status_code, 404)

        # Merchant B DELETE domain -> 404
        r_del = self.client.delete(f"/onboarding/domains/{domain_id}")
        self.assertEqual(r_del.status_code, 404)

        # Merchant B VERIFY domain -> 404
        r_ver = self.client.post(f"/onboarding/domains/{domain_id}/verify")
        self.assertEqual(r_ver.status_code, 404)

    @patch("app.onboarding.router.verify_domain_on_vercel")
    @patch("app.onboarding.router.add_domain_to_vercel")
    def test_verify_domain_transitions(self, mock_add_vercel, mock_verify_vercel):
        mock_add_vercel.return_value = {"verified": False, "verification": []}
        r_add = self.client.post("/onboarding/domains", json={"domain": "verify-test.com"})
        domain_id = r_add.json()["id"]
        self.assertEqual(r_add.json()["status"], "PENDING")

        # Mock verification success
        mock_verify_vercel.return_value = {
            "verified": True,
            "dns_details": {"verified": True, "verification": []}
        }
        r_ver = self.client.post(f"/onboarding/domains/{domain_id}/verify")
        self.assertEqual(r_ver.status_code, 200)
        self.assertEqual(r_ver.json()["status"], "ACTIVE")

    @patch("app.onboarding.router.delete_domain_from_vercel")
    @patch("app.onboarding.router.add_domain_to_vercel")
    def test_delete_domain_success(self, mock_add_vercel, mock_delete_vercel):
        mock_add_vercel.return_value = {"verified": False, "verification": []}
        mock_delete_vercel.return_value = True

        r_add = self.client.post("/onboarding/domains", json={"domain": "to-delete.com"})
        domain_id = r_add.json()["id"]

        r_del = self.client.delete(f"/onboarding/domains/{domain_id}")
        self.assertEqual(r_del.status_code, 200)

        # Ensure deleted from DB
        mapping = self.db.query(DomainMapping).filter(DomainMapping.id == domain_id).first()
        self.assertIsNone(mapping)


if __name__ == "__main__":
    unittest.main()

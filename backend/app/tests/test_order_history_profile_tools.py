import unittest
import asyncio
from unittest.mock import patch, MagicMock
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from app.core.database import Base
from app.system.models import User, Onboarding
from app.agentic.router import (
    build_tools_for_merchant,
    execute_get_order_history,
    execute_get_customer_profile,
    get_order_history_func,
    get_customer_profile_func,
)

# In-memory SQLite database setup for unit tests
engine = create_engine("sqlite:///:memory:", connect_args={"check_same_thread": False})
TestingSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

class TestOrderHistoryProfileTools(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        Base.metadata.create_all(bind=engine)

    def setUp(self):
        self.db = TestingSessionLocal()

        self.test_user_id = "user_test_order_profile_111"
        self.test_merchant = User(
            id=self.test_user_id,
            email="merchant_order_profile@example.com",
            store_name="ShopAgent Order Store",
            status="approved"
        )
        self.db.add(self.test_merchant)

        self.onboarding = Onboarding(
            user_id=self.test_user_id,
            base_url="https://api.merchant-os.com",
            auth_enabled=True,
            order_history_config={
                "path": "user/orders",
                "method": "GET",
                "response_key": "data.orders"
            },
            customer_profile_config={
                "path": "user/profile",
                "method": "GET",
                "response_key": "data.user"
            }
        )
        self.db.add(self.onboarding)
        self.db.commit()

        self.session_data = {
            "session_id": "sess_111",
            "merchant_id": self.test_user_id,
            "customer_ref": "customer_test@example.com"
        }

    def tearDown(self):
        self.db.query(Onboarding).delete()
        self.db.query(User).delete()
        self.db.commit()
        self.db.close()

    def test_build_tools_conditional_registration(self):
        # Case A: Onboarding has order_history_config and customer_profile_config
        tools = asyncio.run(build_tools_for_merchant(self.test_user_id, self.db))
        tool_dict = tools.to_dict()
        func_names = [f["name"] for f in tool_dict.get("function_declarations", [])]
        self.assertIn("get_order_history", func_names)
        self.assertIn("get_customer_profile", func_names)

        # Case B: Order history and profile configs missing
        self.onboarding.order_history_config = None
        self.onboarding.customer_profile_config = None
        self.db.commit()

        tools_empty = asyncio.run(build_tools_for_merchant(self.test_user_id, self.db))
        tool_dict_empty = tools_empty.to_dict()
        func_names_empty = [f["name"] for f in tool_dict_empty.get("function_declarations", [])]
        self.assertNotIn("get_order_history", func_names_empty)
        self.assertNotIn("get_customer_profile", func_names_empty)

    @patch("app.agentic.router.get_merchant_auth_headers")
    @patch("httpx.AsyncClient.request")
    def test_execute_get_order_history_nested_response_key(self, mock_request, mock_auth):
        mock_auth.return_value = {"Authorization": "Bearer mock_token"}
        mock_resp = MagicMock()
        mock_resp.status_code = 200
        mock_resp.json.return_value = {
            "status": "success",
            "data": {
                "orders": [
                    {
                        "order_id": "ord_99001",
                        "status": "Delivered",
                        "total": 1299.50,
                        "created_at": "2026-08-30T10:00:00Z",
                        "items": [{"id": "item1", "qty": 2}]
                    },
                    {
                        "id": "ord_99002",
                        "order_status": "Processing",
                        "amount": 450.00,
                        "date": "2026-08-31T01:00:00Z"
                    }
                ]
            }
        }
        mock_request.return_value = mock_resp

        res = asyncio.run(execute_get_order_history(self.test_user_id, self.session_data, self.db))
        self.assertNotIn("error", res)
        self.assertEqual(res["count"], 2)
        self.assertEqual(len(res["orders"]), 2)
        self.assertEqual(res["orders"][0]["order_id"], "ord_99001")
        self.assertEqual(res["orders"][0]["status"], "Delivered")
        self.assertEqual(res["orders"][0]["total"], 1299.50)
        self.assertEqual(res["orders"][1]["order_id"], "ord_99002")

    @patch("app.agentic.router.get_merchant_auth_headers")
    @patch("httpx.AsyncClient.request")
    def test_execute_get_order_history_explicit_mapping(self, mock_request, mock_auth):
        onboarding = self.db.query(Onboarding).filter(Onboarding.user_id == self.test_user_id).first()
        onboarding.order_history_config = {
            "path": "user/orders",
            "method": "GET",
            "array_path": "data.orders",
            "field_mapping": {
                "id": "product_id",
                "name": "product.itemName",
                "price": "amount",
                "quantity": "qty"
            }
        }
        from sqlalchemy.orm.attributes import flag_modified
        flag_modified(onboarding, "order_history_config")
        self.db.add(onboarding)
        self.db.commit()

        mock_auth.return_value = {"Authorization": "Bearer mock_token"}
        mock_resp = MagicMock()
        mock_resp.status_code = 200
        mock_resp.json.return_value = {
            "status": "success",
            "data": {
                "orders": [
                    {
                        "product_id": "p101",
                        "product": {"itemName": "Headphones"},
                        "amount": 1299.50,
                        "qty": 1
                    }
                ]
            }
        }
        mock_request.return_value = mock_resp

        res = asyncio.run(execute_get_order_history(self.test_user_id, self.session_data, self.db))
        self.assertNotIn("error", res)
        self.assertEqual(res["count"], 1)
        self.assertEqual(res["orders"][0]["order_id"], "p101")
        self.assertEqual(res["orders"][0]["name"], "Headphones")

    @patch("app.agentic.router.get_merchant_auth_headers")
    @patch("httpx.AsyncClient.request")
    def test_execute_get_customer_profile_field_normalization(self, mock_request, mock_auth):
        mock_auth.return_value = {"Authorization": "Bearer mock_token"}
        mock_resp = MagicMock()
        mock_resp.status_code = 200
        mock_resp.json.return_value = {
            "status": "success",
            "data": {
                "user": {
                    "full_name": "ShopAgent Customer",
                    "customer_email": "customer_test@example.com",
                    "membership_tier": "Gold VIP",
                    "joined_at": "2025-01-15T00:00:00Z"
                }
            }
        }
        mock_request.return_value = mock_resp

        res = asyncio.run(execute_get_customer_profile(self.test_user_id, self.session_data, self.db))
        self.assertNotIn("error", res)
        profile = res.get("profile")
        self.assertIsNotNone(profile)
        self.assertEqual(profile.get("name"), "ShopAgent Customer")
        self.assertEqual(profile.get("email"), "customer_test@example.com")
        self.assertEqual(profile.get("loyalty_tier"), "Gold VIP")
        self.assertEqual(profile.get("member_since"), "2025-01-15T00:00:00Z")

    @patch("app.agentic.router.get_merchant_auth_headers")
    @patch("httpx.AsyncClient.request")
    def test_execute_get_customer_profile_missing_optional_fields(self, mock_request, mock_auth):
        mock_auth.return_value = {"Authorization": "Bearer mock_token"}
        mock_resp = MagicMock()
        mock_resp.status_code = 200
        mock_resp.json.return_value = {
            "data": {
                "user": {
                    "name": "Jane Doe"
                }
            }
        }
        mock_request.return_value = mock_resp

        res = asyncio.run(execute_get_customer_profile(self.test_user_id, self.session_data, self.db))
        profile = res.get("profile")
        self.assertIsNotNone(profile)
        self.assertEqual(profile.get("name"), "Jane Doe")
        self.assertNotIn("loyalty_tier", profile)
        self.assertNotIn("member_since", profile)

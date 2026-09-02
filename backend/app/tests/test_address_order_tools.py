import unittest
from unittest.mock import patch, AsyncMock, MagicMock
from datetime import datetime, timezone
import httpx
from fastapi.testclient import TestClient

from app.main import app
from app.core.database import SessionLocal
from app.core.security import get_current_user
from app.system.models import User, Onboarding, CartItem, AgentOrder, AgentOrderStatus
from app.agentic.router import (
    build_tools_for_merchant,
    execute_fetch_addresses,
    execute_create_address,
    execute_create_order
)

class TestAddressOrderTools(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.db = SessionLocal()
        cls.test_user_id = "user_test_tools_merchant_999"
        cls.test_user = cls.db.query(User).filter(User.id == cls.test_user_id).first()
        if not cls.test_user:
            cls.test_user = User(
                id=cls.test_user_id,
                email="test_tools_merchant@razorpay.com",
                store_name="Test Tools Store",
                status="approved"
            )
            cls.db.add(cls.test_user)
            cls.db.commit()
            cls.db.refresh(cls.test_user)

        def override_get_current_user():
            return cls.test_user

        app.dependency_overrides[get_current_user] = override_get_current_user
        cls.client = TestClient(app)

    @classmethod
    def tearDownClass(cls):
        cls.db.query(CartItem).filter(CartItem.merchant_id == cls.test_user_id).delete()
        cls.db.query(AgentOrder).filter(AgentOrder.merchant_id == cls.test_user_id).delete()
        cls.db.query(Onboarding).filter(Onboarding.user_id == cls.test_user_id).delete()
        cls.db.query(User).filter(User.id == cls.test_user_id).delete()
        cls.db.commit()
        cls.db.close()
        app.dependency_overrides.clear()

    def setUp(self):
        self.db.query(CartItem).filter(CartItem.merchant_id == self.test_user_id).delete()
        self.db.query(AgentOrder).filter(AgentOrder.merchant_id == self.test_user_id).delete()
        self.db.query(Onboarding).filter(Onboarding.user_id == self.test_user_id).delete()
        self.db.commit()

        self.session_data = {
            "merchant_id": self.test_user_id,
            "customer_ref": "customer_test@example.com"
        }

    def test_dynamic_tool_building(self):
        # Case 1: supports_creation is False -> create_address absent
        onboarding_false = Onboarding(
            user_id=self.test_user_id,
            base_url="https://api.teststore.com/v1",
            addresses_config={
                "supports_creation": False,
                "fetch": {"path": "addresses", "method": "GET", "response_key": "addresses"}
            }
        )
        self.db.add(onboarding_false)
        self.db.commit()

        tool = self.db.query(Onboarding).filter(Onboarding.user_id == self.test_user_id).first()
        import asyncio
        tool_obj = asyncio.run(build_tools_for_merchant(self.test_user_id, self.db))
        tool_dict = tool_obj.to_dict()
        names = [f["name"] for f in tool_dict.get("function_declarations", [])]
        self.assertIn("fetch_addresses", names)
        self.assertIn("create_order", names)
        self.assertNotIn("create_address", names)

        # Case 2: supports_creation is True -> create_address present
        onboarding_false.addresses_config = {
            "supports_creation": True,
            "fetch": {"path": "addresses", "method": "GET", "response_key": "data.addresses"},
            "create": {"path": "addresses", "method": "POST", "field_mapping": ["flatNo", "street", "city", "district", "state", "pincode"]}
        }
        self.db.commit()

        tool_obj2 = asyncio.run(build_tools_for_merchant(self.test_user_id, self.db))
        tool_dict2 = tool_obj2.to_dict()
        names2 = [f["name"] for f in tool_dict2.get("function_declarations", [])]
        self.assertIn("create_address", names2)

    @patch("httpx.AsyncClient.request")
    def test_execute_fetch_addresses(self, mock_request):
        onboarding = Onboarding(
            user_id=self.test_user_id,
            base_url="https://api.teststore.com/v1",
            auth_enabled=False,
            addresses_config={
                "supports_creation": False,
                "fetch": {"path": "user/addresses", "method": "GET", "response_key": "data.addresses"}
            }
        )
        self.db.add(onboarding)
        self.db.commit()

        # Mock HTTP GET response with nested response_key ("data.addresses"), 1 valid address item and 1 malformed item
        mock_response = MagicMock()
        mock_response.status_code = 200
        mock_response.json.return_value = {
            "data": {
                "addresses": [
                    {
                        "address_id": "addr_101",
                        "flatNo": "Flat 202",
                        "street": "123 Main St",
                        "city": "Bengaluru",
                        "district": "Bengaluru Urban",
                        "state": "Karnataka",
                        "pincode": "560001"
                    },
                    "malformed_non_dict_string"
                ]
            }
        }
        mock_request.return_value = mock_response

        import asyncio
        res = asyncio.run(execute_fetch_addresses(self.test_user_id, self.session_data, self.db))
        self.assertEqual(res["count"], 1)
        addr = res["addresses"][0]
        self.assertEqual(addr["id"], "addr_101")
        self.assertEqual(addr["flat_no"], "Flat 202")
        self.assertEqual(addr["street"], "123 Main St")
        self.assertEqual(addr["city"], "Bengaluru")
        self.assertEqual(addr["district"], "Bengaluru Urban")
        self.assertEqual(addr["state"], "Karnataka")
        self.assertEqual(addr["pincode"], "560001")

    @patch("httpx.AsyncClient.request")
    def test_execute_fetch_addresses_explicit_id_field_and_skipping(self, mock_request):
        onboarding = Onboarding(
            user_id=self.test_user_id,
            base_url="https://api.teststore.com/v1",
            auth_enabled=False,
            addresses_config={
                "supports_creation": False,
                "fetch": {
                    "path": "user/addresses",
                    "method": "GET",
                    "response_key": "data.addresses",
                    "id_field": "_id"
                }
            }
        )
        self.db.add(onboarding)
        self.db.commit()

        # Mock response: Item 1 has "_id", Item 2 lacks "_id" (only has "id")
        mock_response = MagicMock()
        mock_response.status_code = 200
        mock_response.json.return_value = {
            "data": {
                "addresses": [
                    {
                        "_id": "507f1f77bcf86cd799439011",
                        "line1": "Suite 500",
                        "city": "Mumbai",
                        "pincode": "400001"
                    },
                    {
                        "id": "guessed_wrong_id",
                        "line1": "No mongo _id field",
                        "city": "Pune"
                    }
                ]
            }
        }
        mock_request.return_value = mock_response

        import asyncio
        res = asyncio.run(execute_fetch_addresses(self.test_user_id, self.session_data, self.db))
        # Item 2 should be skipped because it lacks configured _id
        self.assertEqual(res["count"], 1)
        self.assertEqual(res["addresses"][0]["id"], "507f1f77bcf86cd799439011")
        self.assertEqual(res["addresses"][0]["flat_no"], "Suite 500")

    @patch("httpx.AsyncClient.request")
    def test_execute_create_address(self, mock_request):
        onboarding = Onboarding(
            user_id=self.test_user_id,
            base_url="https://api.teststore.com/v1",
            auth_enabled=False,
            addresses_config={
                "supports_creation": True,
                "create": {
                    "path": "user/addresses",
                    "method": "POST",
                    "field_mapping": ["flatNo", "street", "city", "district", "state", "pincode"]
                }
            }
        )
        self.db.add(onboarding)
        self.db.commit()

        mock_response = MagicMock()
        mock_response.status_code = 200
        mock_response.json.return_value = {"id": "addr_999", "status": "success"}
        mock_request.return_value = mock_response

        import asyncio
        args = {
            "flat_no": "Flat 202",
            "street": "123 Main St",
            "city": "Bengaluru",
            "district": "Bengaluru Urban",
            "state": "Karnataka",
            "pincode": "560001"
        }
        res = asyncio.run(execute_create_address(self.test_user_id, self.session_data, args, self.db))
        self.assertEqual(res["status"], "created")

        # Verify posted JSON matches 6-field field_mapping positionally
        mock_request.assert_called_once()
        call_kwargs = mock_request.call_args.kwargs
        self.assertEqual(call_kwargs["json"], {
            "flatNo": "Flat 202",
            "street": "123 Main St",
            "city": "Bengaluru",
            "district": "Bengaluru Urban",
            "state": "Karnataka",
            "pincode": "560001"
        })

    @patch("httpx.AsyncClient.request")
    def test_execute_search_products_nested_response_key(self, mock_request):
        from app.agentic.router import execute_search_products
        onboarding = Onboarding(
            user_id=self.test_user_id,
            base_url="https://api.teststore.com/v1",
            auth_enabled=False,
            products_config={
                "path": "catalog/search",
                "method": "GET",
                "payload_key": "q",
                "response_key": "data.products"
            }
        )
        self.db.add(onboarding)
        self.db.commit()

        mock_response = MagicMock()
        mock_response.status_code = 200
        mock_response.json.return_value = {
            "status": "success",
            "data": {
                "products": [
                    {
                        "id": "p_ponion_1",
                        "name": "Ponion Chai Mix",
                        "price": 299.00,
                        "description": "Authentic instant chai mix"
                    }
                ]
            }
        }
        mock_request.return_value = mock_response

        import asyncio
        res = asyncio.run(execute_search_products(self.test_user_id, {"query": "chai"}, self.session_data, self.db))
        self.assertEqual(res["count"], 1)
        self.assertEqual(res["products"][0]["id"], "p_ponion_1")
        self.assertEqual(res["products"][0]["name"], "Ponion Chai Mix")

    def test_execute_create_order_empty_cart(self):
        onboarding = Onboarding(
            user_id=self.test_user_id,
            base_url="https://api.teststore.com/v1",
            create_order_config={
                "path": "orders",
                "method": "POST",
                "cart_key": "cart",
                "item_id_field": "product_id",
                "price_field": "price",
                "quantity_field": "quantity",
                "address_id_field": "address_id"
            }
        )
        self.db.add(onboarding)
        self.db.commit()

        import asyncio
        res = asyncio.run(execute_create_order(self.test_user_id, self.session_data, None, {"address_id": "addr_1"}, self.db))
        self.assertEqual(res["error"], "cart_empty")
        count = self.db.query(AgentOrder).filter(AgentOrder.merchant_id == self.test_user_id).count()
        self.assertEqual(count, 0)

    @patch("razorpay.Client")
    @patch("app.agentic.router.execute_fetch_addresses")
    @patch("httpx.AsyncClient.request")
    def test_execute_create_order_success(self, mock_request, mock_fetch_addresses, mock_rzp_client):
        mock_rzp_instance = MagicMock()
        mock_rzp_instance.order.create.return_value = {"id": "order_rzp_mock_123"}
        mock_rzp_client.return_value = mock_rzp_instance

        mock_fetch_addresses.return_value = {
            "addresses": [{"id": "addr_777", "city": "Bengaluru"}]
        }
        onboarding = Onboarding(
            user_id=self.test_user_id,
            base_url="https://api.teststore.com/v1",
            auth_enabled=False,
            create_order_config={
                "path": "orders",
                "method": "POST",
                "cart_key": "items",
                "item_id_field": "sku",
                "price_field": "unit_price",
                "quantity_field": "qty",
                "address_id_field": "delivery_address_id",
                "additional_fields": [{"key": "channel", "value": "shopagent"}]
            }
        )
        self.db.add(onboarding)

        item = CartItem(
            merchant_id=self.test_user_id,
            customer_email="customer_test@example.com",
            product_id="prod_shoe_1",
            name="Running Shoes",
            price=1999.00,
            quantity=2
        )
        self.db.add(item)
        self.db.commit()

        mock_response = MagicMock()
        mock_response.status_code = 200
        mock_response.json.return_value = {
            "merchant_order_id": "m_order_555",
            "order_total": 3998.00,
            "currency": "INR"
        }
        mock_request.return_value = mock_response

        import asyncio
        res = asyncio.run(execute_create_order(self.test_user_id, self.session_data, None, {"address_id": "addr_777"}, self.db))
        self.assertEqual(res["status"], "order_created")
        self.assertEqual(res["merchant_order_id"], "m_order_555")
        self.assertEqual(res["amount"], 3998.00)
        self.assertIn("payment_metadata", res)
        self.assertEqual(res["payment_metadata"]["action"], "initiate_payment")

        # Verify DB AgentOrder record created
        agent_order = self.db.query(AgentOrder).filter(AgentOrder.merchant_id == self.test_user_id).first()
        self.assertIsNotNone(agent_order)
        self.assertEqual(agent_order.merchant_order_id, "m_order_555")
        self.assertEqual(agent_order.status, AgentOrderStatus.AWAITING_PAYMENT.value)
        self.assertEqual(len(agent_order.items), 1)
        self.assertEqual(agent_order.items[0]["product_id"], "prod_shoe_1")

        # Verify CartItem cleared
        cart_count = self.db.query(CartItem).filter(CartItem.merchant_id == self.test_user_id).count()
        self.assertEqual(cart_count, 0)

        # Verify HTTP request sent to merchant
        mock_request.assert_called_once()
        posted_json = mock_request.call_args.kwargs["json"]
        self.assertEqual(posted_json["delivery_address_id"], "addr_777")
        self.assertEqual(posted_json["channel"], "shopagent")
        self.assertEqual(posted_json["items"][0]["sku"], "prod_shoe_1")
        self.assertEqual(posted_json["items"][0]["unit_price"], 1999.0)
        self.assertEqual(posted_json["items"][0]["qty"], 2)

    @patch("app.agentic.router.execute_fetch_addresses")
    @patch("httpx.AsyncClient.request")
    def test_execute_create_order_invalid_address_rejection(self, mock_request, mock_fetch_addresses):
        mock_fetch_addresses.return_value = {
            "addresses": [
                {"id": "addr_101", "city": "Bengaluru", "pincode": "560001"}
            ]
        }
        onboarding = Onboarding(
            user_id=self.test_user_id,
            base_url="https://api.teststore.com/v1",
            auth_enabled=False,
            create_order_config={
                "path": "orders",
                "method": "POST",
                "cart_key": "cart",
                "item_id_field": "product_id",
                "price_field": "price",
                "quantity_field": "quantity",
                "address_id_field": "address_id"
            }
        )
        self.db.add(onboarding)

        item = CartItem(
            merchant_id=self.test_user_id,
            customer_email="customer_test@example.com",
            product_id="prod_shoe_1",
            name="Running Shoes",
            price=1999.00,
            quantity=1
        )
        self.db.add(item)
        self.db.commit()

        import asyncio
        # Model calls create_order with fabricated address_id "560001" (pincode or random number)
        res = asyncio.run(execute_create_order(self.test_user_id, self.session_data, None, {"address_id": "560001"}, self.db))
        
        self.assertEqual(res["error"], "invalid_address")
        self.assertIn("couldn't match that to one of your saved addresses", res["message"])
        self.assertEqual(len(res["addresses"]), 1)
        self.assertEqual(res["addresses"][0]["id"], "addr_101")

        # Zero merchant API requests dispatched
        mock_request.assert_not_called()

        # Zero AgentOrder rows created
        agent_order_count = self.db.query(AgentOrder).filter(AgentOrder.merchant_id == self.test_user_id).count()
        self.assertEqual(agent_order_count, 0)

        # Cart item remains intact
        cart_count = self.db.query(CartItem).filter(CartItem.merchant_id == self.test_user_id).count()
        self.assertEqual(cart_count, 1)

    @patch("httpx.AsyncClient.request")
    def test_execute_fetch_addresses_is_default_handling(self, mock_request):
        onboarding = Onboarding(
            user_id=self.test_user_id,
            base_url="https://api.teststore.com/v1",
            auth_enabled=False,
            addresses_config={
                "supports_creation": False,
                "fetch": {"path": "addresses", "method": "GET", "response_key": "addresses"}
            }
        )
        self.db.add(onboarding)
        self.db.commit()

        mock_response = MagicMock()
        mock_response.status_code = 200
        mock_response.json.return_value = {
            "addresses": [
                {
                    "id": "addr_1",
                    "city": "Bengaluru",
                    "isDefault": True
                },
                {
                    "id": "addr_2",
                    "city": "Mumbai"
                    # No isDefault field present
                }
            ]
        }
        mock_request.return_value = mock_response

        import asyncio
        res = asyncio.run(execute_fetch_addresses(self.test_user_id, self.session_data, self.db))
        self.assertEqual(res["count"], 2)
        
        # Present on addr_1 as True
        self.assertIn("is_default", res["addresses"][0])
        self.assertTrue(res["addresses"][0]["is_default"])

        # Absent (not defaulted to false) on addr_2
        self.assertNotIn("is_default", res["addresses"][1])


import unittest
import asyncio
import jwt
from datetime import datetime, timezone, timedelta
from fastapi.testclient import TestClient
from app.main import app
from app.core.database import SessionLocal
from app.core.config import get_settings
from app.system.models import User, Onboarding, MerchantUserSession, CartItem
from app.agentic.router import (
    execute_add_to_cart,
    execute_get_cart_items,
    execute_update_cart_item,
    execute_remove_from_cart,
    MAX_CART_ITEMS
)

class TestCartTools(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.db = SessionLocal()
        cls.client = TestClient(app)
        cls.settings = get_settings()

        cls.merchant_id = "user_test_cart_merchant_999"
        cls.cust_email_1 = "shopper1@example.com"
        cls.cust_email_2 = "shopper2@example.com"

        # Cleanup existing records
        cls.db.query(CartItem).filter(CartItem.merchant_id == cls.merchant_id).delete()
        cls.db.query(MerchantUserSession).filter(MerchantUserSession.merchant_id == cls.merchant_id).delete()
        cls.db.query(Onboarding).filter(Onboarding.user_id == cls.merchant_id).delete()
        cls.db.query(User).filter(User.id == cls.merchant_id).delete()
        cls.db.commit()

        # Create Merchant & Onboarding
        cls.merchant = User(
            id=cls.merchant_id,
            email="cart_merchant@example.com",
            store_name="Cart Test Store",
            status="approved"
        )
        cls.db.add(cls.merchant)

        cls.onboarding = Onboarding(
            user_id=cls.merchant_id,
            base_url="https://api.cartstore.com",
            auth_enabled=True,
            slug="cart-test-slug"
        )
        cls.db.add(cls.onboarding)
        cls.db.commit()

    def setUp(self):
        # Clean cart items before each test
        self.db.query(CartItem).filter(CartItem.merchant_id == self.merchant_id).delete()
        self.db.commit()

    @classmethod
    def tearDownClass(cls):
        cls.db.query(CartItem).filter(CartItem.merchant_id == cls.merchant_id).delete()
        cls.db.query(MerchantUserSession).filter(MerchantUserSession.merchant_id == cls.merchant_id).delete()
        cls.db.query(Onboarding).filter(Onboarding.user_id == cls.merchant_id).delete()
        cls.db.query(User).filter(User.id == cls.merchant_id).delete()
        cls.db.commit()
        cls.db.close()

    def test_add_to_cart_and_increment_quantity(self):
        # 1. Add new product
        args_1 = {
            "product_id": "prod_shoes_01",
            "name": "Running Shoes",
            "price": 1999.50,
            "thumbnail_url": "https://img.com/shoes.jpg",
            "quantity": 1
        }
        res_1 = asyncio.run(
            execute_add_to_cart(self.merchant_id, self.cust_email_1, args_1, self.db)
        )
        self.assertEqual(res_1["status"], "added")
        self.assertEqual(res_1["quantity"], 1)

        # 2. Add same product again (increments quantity)
        args_2 = {
            "product_id": "prod_shoes_01",
            "name": "Running Shoes",
            "price": 1999.50,
            "quantity": 2
        }
        res_2 = asyncio.run(
            execute_add_to_cart(self.merchant_id, self.cust_email_1, args_2, self.db)
        )
        self.assertEqual(res_2["status"], "updated")
        self.assertEqual(res_2["quantity"], 3)

        # Verify DB state
        items = asyncio.run(
            execute_get_cart_items(self.merchant_id, self.cust_email_1, self.db)
        )
        self.assertEqual(items["count"], 1)
        self.assertEqual(items["items"][0]["quantity"], 3)
        self.assertEqual(items["subtotal"], 5998.50)

    def test_5_distinct_items_limit(self):
        # Add 5 distinct items
        for i in range(1, 6):
            args = {
                "product_id": f"prod_item_0{i}",
                "name": f"Item {i}",
                "price": 100.0 * i,
                "quantity": 1
            }
            res = asyncio.run(
                execute_add_to_cart(self.merchant_id, self.cust_email_1, args, self.db)
            )
            self.assertEqual(res["status"], "added")

        # Attempt to add 6th distinct item -> must fail with cart_full
        args_6 = {
            "product_id": "prod_item_06",
            "name": "Item 6",
            "price": 600.0,
            "quantity": 1
        }
        res_6 = asyncio.run(
            execute_add_to_cart(self.merchant_id, self.cust_email_1, args_6, self.db)
        )
        self.assertEqual(res_6["error"], "cart_full")

        # Verify total rows count is still 5
        items = asyncio.run(
            execute_get_cart_items(self.merchant_id, self.cust_email_1, self.db)
        )
        self.assertEqual(items["count"], 5)

    def test_update_cart_item_and_zero_quantity_removal(self):
        # Add product
        asyncio.run(
            execute_add_to_cart(
                self.merchant_id,
                self.cust_email_1,
                {"product_id": "prod_watch", "name": "Smart Watch", "price": 4999.00, "quantity": 1},
                self.db
            )
        )

        # Update quantity to 4
        res_update = asyncio.run(
            execute_update_cart_item(
                self.merchant_id,
                self.cust_email_1,
                {"product_id": "prod_watch", "quantity": 4},
                self.db
            )
        )
        self.assertEqual(res_update["status"], "updated")
        self.assertEqual(res_update["quantity"], 4)

        # Update quantity to 0 -> removes item
        res_zero = asyncio.run(
            execute_update_cart_item(
                self.merchant_id,
                self.cust_email_1,
                {"product_id": "prod_watch", "quantity": 0},
                self.db
            )
        )
        self.assertEqual(res_zero["status"], "removed")

        # Verify cart is empty
        items = asyncio.run(
            execute_get_cart_items(self.merchant_id, self.cust_email_1, self.db)
        )
        self.assertEqual(items["count"], 0)

    def test_remove_from_cart(self):
        # Add product
        asyncio.run(
            execute_add_to_cart(
                self.merchant_id,
                self.cust_email_1,
                {"product_id": "prod_bag", "name": "Travel Bag", "price": 1299.00, "quantity": 1},
                self.db
            )
        )

        # Remove product
        res_remove = asyncio.run(
            execute_remove_from_cart(
                self.merchant_id,
                self.cust_email_1,
                {"product_id": "prod_bag"},
                self.db
            )
        )
        self.assertEqual(res_remove["status"], "removed")

    def test_session_isolation(self):
        # Customer 1 adds item
        asyncio.run(
            execute_add_to_cart(
                self.merchant_id,
                self.cust_email_1,
                {"product_id": "prod_secret", "name": "Private Item", "price": 500.0, "quantity": 1},
                self.db
            )
        )

        # Customer 2 checks cart -> gets 0 items
        items_c2 = asyncio.run(
            execute_get_cart_items(self.merchant_id, self.cust_email_2, self.db)
        )
        self.assertEqual(items_c2["count"], 0)

        # Customer 1 checks cart -> gets 1 item
        items_c1 = asyncio.run(
            execute_get_cart_items(self.merchant_id, self.cust_email_1, self.db)
        )
        self.assertEqual(items_c1["count"], 1)

    def test_get_cart_rest_endpoint(self):
        # Add item to Customer 1's cart directly
        asyncio.run(
            execute_add_to_cart(
                self.merchant_id,
                self.cust_email_1,
                {"product_id": "prod_shirt", "name": "Cotton Shirt", "price": 799.00, "quantity": 2},
                self.db
            )
        )

        now = datetime.now(timezone.utc)
        exp = now + timedelta(hours=1)

        # Create DB session for token validation
        db_session = MerchantUserSession(
            id="session_cart_test_123",
            merchant_id=self.merchant_id,
            customer_ref=self.cust_email_1,
            email=self.cust_email_1,
            merchant_token_encrypted="encrypted_mock_token",
            expires_at=exp
        )
        self.db.add(db_session)
        self.db.commit()

        # Create session token for Customer 1
        payload = {
            "sub": "session_cart_test_123",
            "merchant_id": self.merchant_id,
            "customer_ref": self.cust_email_1,
            "iat": int(now.timestamp()),
            "exp": int(exp.timestamp())
        }
        token = jwt.encode(payload, self.settings.JWT_SECRET, algorithm="HS256")

        # Make GET request to /api/agentic/cart
        response = self.client.get(
            "/agentic/cart",
            headers={"Authorization": f"Bearer {token}"}
        )
        self.assertEqual(response.status_code, 200)
        data = response.json()
        self.assertEqual(data["count"], 1)
        self.assertEqual(data["items"][0]["product_id"], "prod_shirt")
        self.assertEqual(data["subtotal"], 1598.00)

    def test_status_stage_and_label_mapping(self):
        from app.agentic.router import TOOL_TO_STAGE, STAGE_LABELS, get_status_payload

        # Mapped tool status check
        payload_add = get_status_payload(TOOL_TO_STAGE["add_to_cart"])
        self.assertEqual(payload_add["type"], "status")
        self.assertEqual(payload_add["stage"], "adding_to_cart")
        self.assertEqual(payload_add["label"], "Adding to your cart…")

        # Unmapped tool status check -> fallback to thinking
        unmapped_stage = TOOL_TO_STAGE.get("hypothetical_future_tool", "thinking")
        payload_fallback = get_status_payload(unmapped_stage)
        self.assertEqual(payload_fallback["stage"], "thinking")
        self.assertEqual(payload_fallback["label"], "Thinking…")

if __name__ == "__main__":
    unittest.main()

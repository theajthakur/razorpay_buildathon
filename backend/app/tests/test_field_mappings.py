import unittest
from app.agentic.field_mappings import (
    resolve_path,
    resolve_array_at,
    extract_order_history,
    extract_addresses,
    extract_customer_profile,
)


class TestFieldMappings(unittest.TestCase):
    def test_resolve_path(self):
        source = {
            "product": {
                "itemName": "Wireless Mouse",
                "nested": {"deepKey": 42},
            },
            "status": "active",
        }
        self.assertEqual(resolve_path(source, "product.itemName"), "Wireless Mouse")
        self.assertEqual(resolve_path(source, "product.nested.deepKey"), 42)
        self.assertEqual(resolve_path(source, "status"), "active")
        self.assertEqual(resolve_path(source, " product.itemName "), "Wireless Mouse")

        # Missing keys or non-dict return None
        self.assertIsNone(resolve_path(source, "product.nonExistent"))
        self.assertIsNone(resolve_path(source, "missing"))
        self.assertIsNone(resolve_path(source, ""))
        self.assertIsNone(resolve_path(None, "product.itemName"))
        self.assertIsNone(resolve_path("not a dict", "product.itemName"))

    def test_resolve_array_at(self):
        source = {
            "data": {
                "orders": [{"id": "1"}, {"id": "2"}],
                "single": {"id": "3"},
            }
        }
        self.assertEqual(resolve_array_at(source, "data.orders"), [{"id": "1"}, {"id": "2"}])
        self.assertIsNone(resolve_array_at(source, "data.single"))
        self.assertIsNone(resolve_array_at(source, "data.nonExistent"))

        # No path given, source itself is a list
        raw_list = [1, 2, 3]
        self.assertEqual(resolve_array_at(raw_list, None), [1, 2, 3])
        self.assertIsNone(resolve_array_at({"a": 1}, None))

    def test_extract_order_history(self):
        response = {
            "data": {
                "orders": [
                    {
                        "product_id": "p101",
                        "product": {"itemName": "Headphones"},
                        "amount": 99.99,
                        "qty": 1,
                    },
                    {
                        "product_id": "p102",
                        "product": {"itemName": "Keyboard"},
                        "amount": 49.99,
                        "qty": 2,
                    },
                ]
            }
        }
        config = {
            "arrayPath": "data.orders",
            "fields": {
                "id": "product_id",
                "name": "product.itemName",
                "price": "amount",
                "quantity": "qty",
            },
        }
        extracted = extract_order_history(response, config)
        self.assertEqual(len(extracted), 2)
        self.assertEqual(
            extracted[0],
            {
                "id": "p101",
                "name": "Headphones",
                "price": 99.99,
                "quantity": 1,
            },
        )
        self.assertEqual(
            extracted[1],
            {
                "id": "p102",
                "name": "Keyboard",
                "price": 49.99,
                "quantity": 2,
            },
        )

    def test_extract_addresses(self):
        response = {
            "data": {
                "addresses": [
                    {"_id": "addr_1", "formattedAddress": "123 Main St, New York"},
                    {"_id": "addr_2", "formattedAddress": "456 Oak Ave, California"},
                ]
            }
        }
        config = {
            "arrayPath": "data.addresses",
            "idField": "_id",
            "displayField": "formattedAddress",
        }
        extracted = extract_addresses(response, config)
        self.assertEqual(len(extracted), 2)
        self.assertEqual(
            extracted[0],
            {"address_id": "addr_1", "address_string": "123 Main St, New York"},
        )
        self.assertEqual(
            extracted[1],
            {"address_id": "addr_2", "address_string": "456 Oak Ave, California"},
        )

    def test_extract_customer_profile(self):
        response = {
            "data": {
                "name": "Jane Doe",
                "email": "jane@example.com",
                "phone": "+1234567890",
            }
        }
        config = {
            "fields": {
                "name": "data.name",
                "email": "data.email",
                "phone": "data.phone",
            }
        }
        extracted = extract_customer_profile(response, config)
        self.assertEqual(
            extracted,
            {
                "name": "Jane Doe",
                "email": "jane@example.com",
                "phone": "+1234567890",
            },
        )

        # Omitted / blank fields
        partial_config = {"fields": {"name": "data.name", "email": ""}}
        partial_extracted = extract_customer_profile(response, partial_config)
        self.assertEqual(partial_extracted, {"name": "Jane Doe"})


if __name__ == "__main__":
    unittest.main()

"""
Dot-path resolution used by order_history_config, addresses_config, and
customer_profile_config field mappings.

Mirrors resolvePath() in EndpointFieldMapping.tsx exactly, so a value the
merchant sees in the onboarding "live preview" is guaranteed to be what the
agent actually extracts at runtime — same traversal rules, same behavior on
a missing key.
"""

from typing import Any, Optional


def resolve_path(source: Any, path: str) -> Any:
    """Resolve dot notation like 'product.itemName' against a dict.

    Returns None if any segment is missing or the value isn't traversable.
    """
    if not path or not isinstance(source, dict):
        return None

    current: Any = source
    for segment in (s.strip() for s in path.split(".") if s.strip()):
        if not isinstance(current, dict) or segment not in current:
            return None
        current = current[segment]
    return current


def resolve_array_at(source: Any, path: Optional[str]) -> Optional[list]:
    """Resolve `path` (or the source itself, if no path given) to a list."""
    value = resolve_path(source, path) if path else source
    return value if isinstance(value, list) else None


def extract_order_history(response: dict, config: dict) -> list[dict]:
    """
    config = {
        "arrayPath": "data.orders",
        "fields": {"id": "product_id", "name": "product.itemName",
                   "price": "amount", "quantity": "qty"},
    }
    """
    orders = resolve_array_at(response, config.get("arrayPath")) or []
    fields = config.get("fields", {})
    extracted = []
    for item in orders:
        extracted.append(
            {
                "id": resolve_path(item, fields.get("id", "")),
                "name": resolve_path(item, fields.get("name", "")),
                "price": resolve_path(item, fields.get("price", "")),
                "quantity": resolve_path(item, fields.get("quantity", "")),
            }
        )
    return extracted


def extract_addresses(response: dict, config: dict) -> list[dict]:
    """
    config = {
        "arrayPath": "data.addresses",
        "idField": "_id",
        "displayField": "formattedAddress",
    }
    """
    addresses = resolve_array_at(response, config.get("arrayPath")) or []
    id_field = config.get("idField", "")
    display_field = config.get("displayField", "")
    return [
        {
            "address_id": resolve_path(item, id_field),
            "address_string": resolve_path(item, display_field),
        }
        for item in addresses
    ]


def extract_customer_profile(response: dict, config: dict) -> dict:
    """
    config = {"fields": {"name": "data.name", "email": "data.email", "phone": "data.phone"}}
    Every field is optional — omitted/blank paths simply resolve to None
    and are left out rather than enforced.
    """
    fields = config.get("fields", {})
    result = {}
    for key in ("name", "email", "phone"):
        path = fields.get(key, "")
        if path:
            result[key] = resolve_path(response, path)
    return result

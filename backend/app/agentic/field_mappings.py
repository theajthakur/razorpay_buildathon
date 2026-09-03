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


def parse_address_response_path(response_path: str) -> tuple[str, str]:
    """
    Parses a combined response path like 'data.addresses._id' into:
    array_path = 'data.addresses'
    id_field = '_id'
    """
    trimmed = (response_path or "").strip()
    last_dot = trimmed.rfind(".")
    if last_dot <= 0 or last_dot == len(trimmed) - 1:
        return "", trimmed
    return trimmed[:last_dot], trimmed[last_dot + 1:]


def extract_order_history(response: dict, config: dict) -> list[dict]:
    """
    config = {
        "array_path": "data.orders",
        "field_mapping": {
            "id": "product_id",
            "name": "product.itemName",
            "price": "amount",
            "quantity": "qty"
        },
        "additional_fields": ["discount", "product.category", "metadata.delivery_type"]
    }
    """
    array_path = config.get("array_path") or config.get("arrayPath") or config.get("response_key")
    orders = resolve_array_at(response, array_path) or []
    fields = config.get("field_mapping") or config.get("fields") or {}
    additional = config.get("additional_fields") or config.get("additionalFields") or []

    extracted = []
    for item in orders:
        if not isinstance(item, dict):
            continue
        order_obj = {}

        # 1. Apply fixed normalized mappings (id, name, price, quantity)
        if fields and isinstance(fields, dict):
            for k in ["id", "name", "price", "quantity"]:
                p = fields.get(k)
                if p and isinstance(p, str) and p.strip():
                    val = resolve_path(item, p.strip())
                    if val is not None:
                        order_obj[k] = val
        else:
            # Fallback for unconfigured legacy records: preserve item dictionary
            order_obj = dict(item)
            order_obj["id"] = (
                resolve_path(item, "id")
                or item.get("id")
                or item.get("_id")
                or item.get("order_id")
                or item.get("product_id")
            )
            order_obj["name"] = (
                resolve_path(item, "name")
                or item.get("name")
                or item.get("itemName")
                or item.get("title")
            )
            order_obj["price"] = resolve_path(item, "price") or item.get("price") or item.get("amount")
            order_obj["quantity"] = resolve_path(item, "quantity") or item.get("quantity") or item.get("qty")

        # 2. Apply additional fields (merchant-defined keys/paths)
        if additional and isinstance(additional, list):
            for add_path in additional:
                if isinstance(add_path, str) and add_path.strip():
                    clean_path = add_path.strip()
                    val = resolve_path(item, clean_path)
                    if val is not None:
                        order_obj[clean_path] = val

        extracted.append(order_obj)
    return extracted


def extract_addresses(response: dict, config: dict) -> list[dict]:
    """
    config = {
        "response_path": "data.addresses._id",
        "display_field": "formattedAddress",
    }
    """
    response_path = config.get("response_path")
    if response_path:
        array_path, id_field = parse_address_response_path(response_path)
    else:
        array_path = config.get("array_path") or config.get("arrayPath") or config.get("response_key") or ""
        id_field = config.get("id_field") or config.get("idField") or ""

    addresses = resolve_array_at(response, array_path) if array_path else (response if isinstance(response, list) else None)
    if addresses is None and not array_path and isinstance(response, dict):
        for k in ["addresses", "data", "items"]:
            if isinstance(response.get(k), list):
                addresses = response[k]
                break

    addresses = addresses or []
    display_field = config.get("display_field") or config.get("displayField") or ""

    extracted = []
    for item in addresses:
        if not isinstance(item, dict):
            continue
        addr_id = resolve_path(item, id_field) if id_field else None
        if addr_id is None and not id_field:
            addr_id = item.get("id") or item.get("_id") or item.get("address_id")
        display_str = resolve_path(item, display_field) if display_field else None
        extracted.append({
            "address_id": addr_id,
            "address_string": display_str,
            "item": item,
        })
    return extracted


def extract_customer_profile(response: dict, config: dict) -> dict:
    """
    config = {
        "response_object_path": "data",
        "field_mapping": {"name": "name", "email": "email", "phone": "phone"}
    }
    Every field is optional — omitted/blank paths simply resolve to None
    and are left out rather than enforced.
    """
    response_obj_path = config.get("response_object_path") or config.get("response_key")
    source_obj = resolve_path(response, response_obj_path) if response_obj_path else response
    if not isinstance(source_obj, dict):
        source_obj = response if isinstance(response, dict) else {}

    fields = config.get("field_mapping") or config.get("fields") or {}
    result = {}
    if fields:
        for key, path in fields.items():
            if path:
                val = resolve_path(source_obj, path)
                if val is None:
                    val = resolve_path(response, path)
                if val is not None:
                    result[key] = val
    return result

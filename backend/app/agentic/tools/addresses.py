import sys
import re
from sqlalchemy.orm import Session
from app.system.models import Onboarding
from app.agentic.auth_utils import extract_by_path
from app.agentic.field_mappings import extract_addresses, parse_address_response_path
from app.agentic.deps import get_merchant_auth_headers as default_get_merchant_auth_headers
from app.agentic.merchant_api import call_merchant_api as default_call_merchant_api
from app.agentic.tools.products import _pick
from app.core.logging_config import get_logger

default_agent_logger = get_logger("agent")

def _getattr(name, default):
    mod = sys.modules.get("app.agentic.router")
    return getattr(mod, name, default) if mod else default

ADDRESS_FIELD_CANDIDATES = {
    "flat_no": ["flatNo", "flat_no", "houseNo", "house_no", "line1"],
    "street": ["street", "address_line1", "line2"],
    "city": ["city"],
    "district": ["district"],
    "state": ["state"],
    "pincode": ["pincode", "zip", "postal_code"],
    "is_default": ["isDefault", "is_default", "default"],
}

ADDRESS_CONCEPT_ORDER = ["flat_no", "street", "city", "district", "state", "pincode"]

def resolve_address(supplied_id: str, addresses: list) -> dict | None:
    """
    Robust multi-strategy matcher that maps any supplied address identifier
    (real ID, alias 'a1', 'a2', index '1', '2', keyword 'default'/'home', or text match)
    to a valid address dictionary from the merchant's saved addresses.
    """
    if not addresses:
        return None

    s = (supplied_id or "").strip()
    s_lower = s.lower()

    # Strategy 1: Exact match on real merchant 'id'
    for addr in addresses:
        if str(addr.get("id")) == s:
            return addr

    # Strategy 2: Match on 'alias_id' (e.g. "a1", "a2") or 'index_id' ("1", "2")
    for addr in addresses:
        if str(addr.get("alias_id")).lower() == s_lower or str(addr.get("index_id")) == s:
            return addr

    # Strategy 3: Handle index strings like "a1", "a2", "1", "2", "address 1", "#1", "opt 1", "option 1"
    digits = re.findall(r'\d+', s)
    if digits:
        try:
            idx = int(digits[0]) - 1  # 1-based index to 0-based
            if 0 <= idx < len(addresses):
                return addresses[idx]
        except Exception:
            pass

    # Strategy 4: Handle keywords like "default", "primary", "saved", "current", "my_address", "my address", "first", "home", ""
    if s_lower in ["default", "primary", "saved", "current", "my_address", "my address", "first", "home", ""]:
        for addr in addresses:
            if addr.get("is_default") is True:
                return addr
        return addresses[0]

    if s_lower in ["second", "next"]:
        if len(addresses) > 1:
            return addresses[1]

    # Strategy 5: Text / City / Street / Label match (ignoring pure numbers to prevent pincode false matches)
    if len(s_lower) >= 2 and not s_lower.isdigit():
        for addr in addresses:
            text_blob = " ".join([
                str(addr.get("city", "")),
                str(addr.get("street", "")),
                str(addr.get("flat_no", "")),
                str(addr.get("state", "")),
                str(addr.get("label", ""))
            ]).lower()
            if s_lower in text_blob or any(part in text_blob for part in s_lower.split() if len(part) >= 3):
                return addr

    # Strategy 6: Single address fallback — if customer has only 1 saved address and supplied_id is empty or an alias/keyword
    if len(addresses) == 1 and (not s or s_lower in ["a1", "1", "default", "primary", "home", "my_address", "my address", "first"]):
        return addresses[0]

    return None


async def execute_fetch_addresses(merchant_id: str, session: dict, db: Session) -> dict:
    agent_logger = _getattr("agent_logger", default_agent_logger)
    get_merchant_auth_headers = _getattr("get_merchant_auth_headers", default_get_merchant_auth_headers)
    call_merchant_api = _getattr("call_merchant_api", default_call_merchant_api)

    agent_logger.info(f"Fetching addresses: merchant={merchant_id}, customer={session.get('customer_ref')}")
    onboarding = db.query(Onboarding).filter(Onboarding.user_id == merchant_id).first()
    if not onboarding or not onboarding.addresses_config:
        agent_logger.warning(f"Address fetch aborted: onboarding config missing for merchant={merchant_id}")
        return {"error": "onboarding_config_not_found", "addresses": [], "count": 0}

    cfg = onboarding.addresses_config
    if isinstance(cfg, dict) and "fetch" in cfg and isinstance(cfg["fetch"], dict):
        fetch_cfg = cfg["fetch"]
    elif isinstance(cfg, dict) and "fetch_path" in cfg:
        fetch_cfg = {"path": cfg.get("fetch_path"), "method": cfg.get("fetch_method", "GET"), "response_key": cfg.get("fetch_response_key")}
    else:
        agent_logger.warning(f"Address fetch aborted: fetch config missing for merchant={merchant_id}")
        return {"error": "addresses_fetch_config_missing", "addresses": [], "count": 0}

    path = fetch_cfg.get("path", "")
    method = fetch_cfg.get("method", "GET")

    url = f"{onboarding.base_url.rstrip('/')}/{path.lstrip('/')}"
    headers = {}
    if onboarding.auth_enabled:
        try:
            headers = get_merchant_auth_headers(session=session, db=db)
        except Exception as e:
            agent_logger.warning(f"Failed to resolve auth headers for fetch_addresses: {e}")

    resp = await call_merchant_api(
        method, url,
        headers=headers,
        context="fetch_addresses",
    )
    resp.raise_for_status()

    json_data = resp.json()
    extracted_addrs = extract_addresses(json_data, fetch_cfg)

    id_field_cfg = fetch_cfg.get("id_field")
    if not id_field_cfg and fetch_cfg.get("response_path"):
        _, id_field_cfg = parse_address_response_path(fetch_cfg["response_path"])

    addresses = []
    if extracted_addrs:
        for idx, ext in enumerate(extracted_addrs):
            raw_id = ext.get("address_id")
            item_raw = ext.get("item") or {}
            if raw_id is None and isinstance(item_raw, dict):
                if id_field_cfg and id_field_cfg in item_raw and item_raw[id_field_cfg] is not None:
                    raw_id = item_raw[id_field_cfg]
                elif not id_field_cfg:
                    for cand in ["id", "_id", "address_id", "addressId"]:
                        if cand in item_raw and item_raw[cand] is not None:
                            raw_id = item_raw[cand]
                            break

            if raw_id is None:
                if id_field_cfg:
                    agent_logger.warning(f"fetch_addresses: item missing configured id_field '{id_field_cfg}', skipping: {item_raw!r}")
                    continue
                else:
                    raw_id = f"addr_{len(addresses) + 1}"

            addr = {
                "id": str(raw_id),
                "alias_id": f"a{idx + 1}",
                "index_id": str(idx + 1),
            }
            if isinstance(item_raw, dict):
                for field, candidates in ADDRESS_FIELD_CANDIDATES.items():
                    try:
                        addr[field] = _pick(item_raw, candidates, field)
                    except KeyError:
                        if field != "is_default":
                            addr[field] = ""

            display_str = ext.get("address_string")
            if display_str:
                addr["address_string"] = str(display_str)
                addr["label"] = f"Address {idx + 1} ({display_str})"
            else:
                city_or_flat = addr.get("city") or addr.get("flat_no") or "Saved Address"
                addr["label"] = f"Address {idx + 1} ({city_or_flat})"
            addresses.append(addr)

    if not addresses:
        response_key = fetch_cfg.get("response_key", "addresses")
        id_field = fetch_cfg.get("id_field")
        raw_items = extract_by_path(json_data, response_key, default=[])
        if not isinstance(raw_items, list):
            if isinstance(json_data, list):
                raw_items = json_data
            else:
                raw_items = []

        for item in raw_items:
            if not isinstance(item, dict):
                continue
            raw_id = None
            if id_field:
                if id_field in item and item[id_field] is not None:
                    raw_id = item[id_field]
            else:
                for cand in ["id", "_id", "address_id", "addressId"]:
                    if cand in item and item[cand] is not None:
                        raw_id = item[cand]
                        break
            if raw_id is None:
                if id_field:
                    agent_logger.warning(f"fetch_addresses: item missing configured id_field '{id_field}', skipping: {item!r}")
                    continue
                else:
                    raw_id = f"addr_{len(addresses) + 1}"

            try:
                addr = {
                    "id": str(raw_id),
                    "alias_id": f"a{len(addresses) + 1}",
                    "index_id": str(len(addresses) + 1),
                }
                for field, candidates in ADDRESS_FIELD_CANDIDATES.items():
                    try:
                        addr[field] = _pick(item, candidates, field)
                    except KeyError:
                        if field != "is_default":
                            addr[field] = ""
                city_or_flat = addr.get("city") or addr.get("flat_no") or "Saved Address"
                addr["label"] = f"Address {len(addresses) + 1} ({city_or_flat})"
                addresses.append(addr)
            except Exception as e:
                agent_logger.debug(f"Skipping malformed address item: {e}")
                continue

    agent_logger.info(f"Addresses fetched: merchant={merchant_id}, count={len(addresses)}")
    return {"addresses": addresses, "count": len(addresses)}


async def execute_create_address(merchant_id: str, session: dict, args: dict, db: Session) -> dict:
    agent_logger = _getattr("agent_logger", default_agent_logger)
    get_merchant_auth_headers = _getattr("get_merchant_auth_headers", default_get_merchant_auth_headers)
    call_merchant_api = _getattr("call_merchant_api", default_call_merchant_api)

    agent_logger.info(f"Creating address: merchant={merchant_id}, customer={session.get('customer_ref')}")
    onboarding = db.query(Onboarding).filter(Onboarding.user_id == merchant_id).first()
    if not onboarding or not onboarding.addresses_config:
        agent_logger.warning(f"Address creation aborted: onboarding config missing for merchant={merchant_id}")
        return {"error": "onboarding_config_not_found"}

    cfg = onboarding.addresses_config
    if isinstance(cfg, dict) and "create" in cfg and isinstance(cfg["create"], dict):
        create_cfg = cfg["create"]
    else:
        agent_logger.warning(f"Address creation rejected: merchant={merchant_id} does not support creation")
        return {"error": "address_creation_not_supported", "message": "This merchant does not support agent address creation."}

    path = create_cfg.get("path", "")
    method = create_cfg.get("method", "POST")
    field_mapping = create_cfg.get("field_mapping", [])

    body = {}
    if isinstance(field_mapping, list):
        for concept, json_key in zip(ADDRESS_CONCEPT_ORDER, field_mapping):
            val = args.get(concept)
            if val is not None and json_key:
                body[json_key] = val

    url = f"{onboarding.base_url.rstrip('/')}/{path.lstrip('/')}"
    headers = {}
    if onboarding.auth_enabled:
        try:
            headers = get_merchant_auth_headers(session=session, db=db)
        except Exception as e:
            agent_logger.warning(f"Failed to resolve auth headers for create_address: {e}")

    resp = await call_merchant_api(
        method, url,
        json_body=body,
        headers=headers,
        context="create_address",
    )
    resp.raise_for_status()

    agent_logger.info(f"Address created successfully for merchant={merchant_id}")
    return {"status": "created", "response": resp.json()}

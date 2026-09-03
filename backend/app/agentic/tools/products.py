import sys
from sqlalchemy.orm import Session
from app.system.models import Onboarding
from app.agentic.auth_utils import find_list_in_dict
from app.agentic.deps import get_merchant_auth_headers as default_get_merchant_auth_headers
from app.agentic.merchant_api import call_merchant_api as default_call_merchant_api
from app.core.logging_config import get_logger

default_agent_logger = get_logger("agent")

def _getattr(name, default):
    mod = sys.modules.get("app.agentic.router")
    return getattr(mod, name, default) if mod else default

FIELD_CANDIDATES = {
    "id": ["id", "_id", "product_id", "itemId", "item_id"],
    "name": ["name", "title", "itemName", "item_name", "product_name", "productName"],
    "description": ["description", "desc", "summary", "itemDescription", "details"],
    "price": ["price", "unit_price", "amount", "cost", "mrp", "final_price"],
    "thumbnail": ["thumbnail", "thumbnailUrl", "image", "imageUrl", "image_url", "photo", "banner"],
}

def _pick(item: dict, candidates: list[str], field_label: str):
    for key in candidates:
        if key in item and item[key] is not None:
            return item[key]
    raise KeyError(f"none of {candidates} found for '{field_label}' in product item: {item!r}")

async def execute_search_products(merchant_id: str, args: dict, session: dict, db: Session) -> dict:
    agent_logger = _getattr("agent_logger", default_agent_logger)
    call_merchant_api = _getattr("call_merchant_api", default_call_merchant_api)
    get_merchant_auth_headers = _getattr("get_merchant_auth_headers", default_get_merchant_auth_headers)
    query = args.get("query", "")
    agent_logger.info(f"Product search requested: merchant={merchant_id}, query='{query}'")
    onboarding = db.query(Onboarding).filter(Onboarding.user_id == merchant_id).first()
    if not onboarding or not onboarding.products_config:
        agent_logger.warning(f"Product search aborted: onboarding config missing for merchant={merchant_id}")
        return {"error": "onboarding_config_not_found", "products": [], "count": 0}

    config = onboarding.products_config  # {"path": "products", "method": "GET", "payload_key": "query", "response_key": "products"}
    method = (config.get("method") or "GET").upper()
    path = config.get("path", "")
    url = f"{onboarding.base_url.rstrip('/')}/{path.lstrip('/')}"
    payload_key = config.get("payload_key", "query")
    response_key = config.get("response_key", "products")

    params = None
    json_body = None
    if method == "GET":
        params = {payload_key: query}
    else:
        json_body = {payload_key: query}

    agent_logger.info(
        f"Product search HTTP dispatch details:\n"
        f"  Target URL: {method} {url}\n"
        f"  Params/Payload: {params or json_body}\n"
        f"  Expected Response Key: '{response_key}'"
    )

    headers = {}
    if onboarding.auth_enabled:
        try:
            headers = get_merchant_auth_headers(session=session, db=db)
        except Exception as e:
            agent_logger.warning(f"Failed to resolve auth headers for product search: {e}")

    resp = await call_merchant_api(
        method, url,
        params=params,
        json_body=json_body,
        headers=headers,
        context="search_products",
    )
    resp.raise_for_status()

    json_data = resp.json()
    agent_logger.info(f"Product search raw HTTP response body: {resp.text[:3000]}")

    # Robust list extraction using find_list_in_dict (handles nested keys like data.products)
    raw_items = find_list_in_dict(json_data, target_key=response_key) or []

    agent_logger.info(
        f"Product search extraction summary: extracted raw_items count={len(raw_items)} "
        f"using response_key='{response_key}'"
    )

    products = []
    skipped_count = 0
    for item in raw_items:
        try:
            # ID and Name are essential
            prod_id = str(_pick(item, FIELD_CANDIDATES["id"], "id"))
            prod_name = str(_pick(item, FIELD_CANDIDATES["name"], "name"))

            # Description, price, and thumbnail can fall back gracefully
            try:
                prod_desc = str(_pick(item, FIELD_CANDIDATES["description"], "description"))
            except KeyError:
                prod_desc = ""

            try:
                prod_price = float(_pick(item, FIELD_CANDIDATES["price"], "price"))
            except KeyError:
                prod_price = 0.0

            try:
                prod_thumb = str(_pick(item, FIELD_CANDIDATES["thumbnail"], "thumbnail"))
            except KeyError:
                prod_thumb = ""

            products.append({
                "id": prod_id,
                "name": prod_name,
                "description": prod_desc,
                "price": prod_price,
                "thumbnailUrl": prod_thumb,
                "currency": "INR",  # default
            })
        except KeyError as e:
            skipped_count += 1
            agent_logger.warning(f"Skipping malformed product item: {e} | item={item!r}")
            continue

    # Client-side filters
    if args.get("max_price") is not None:
        try:
            max_price = float(args["max_price"])
            products = [p for p in products if p["price"] <= max_price]
        except Exception:
            pass

    agent_logger.info(
        f"Product search completed: merchant={merchant_id}, query='{query}', "
        f"final_count={len(products)}, skipped={skipped_count}"
    )

    return {"products": products, "count": len(products)}

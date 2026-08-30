import asyncio
from datetime import datetime, timezone
import enum
from enum import Enum as PyEnum
import json
import httpx
import jwt
from pydantic import BaseModel, ConfigDict
from typing import Optional, List
from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session
from app.core.database import get_db
from app.core.config import get_settings
from app.system.models import User, Onboarding, MerchantUserSession, Conversation, ConversationMessage, MessageSender, CartItem, AgentOrder, AgentOrderStatus
import vertexai
from vertexai.generative_models import GenerativeModel, Part, Content, FunctionDeclaration, Tool
from app.agentic.dependencies import resolve_merchant_by_host
from app.agentic.crypto import encrypt_merchant_token
from app.agentic.auth_utils import resolve_session_expiry, get_value_by_path, extract_by_path
from app.agentic.deps import get_current_session, get_merchant_token, get_merchant_auth_headers
from app.agentic.merchant_api import call_merchant_api
from app.core.logging_config import get_logger

agent_logger = get_logger("agent")
cart_logger = get_logger("cart")
orders_logger = get_logger("orders")
auth_logger = get_logger("auth")

router = APIRouter()
public_router = APIRouter()

class LoginRequest(BaseModel):
    merchant_id: str
    email: str
    password: str

class LoginResponse(BaseModel):
    token: str
    expires_at: datetime


class LoginResponse(BaseModel):
    token: str
    expires_at: datetime


class MessageSenderEnum(str, PyEnum):
    USER = "user"
    AGENT = "agent"


class MessageCreateRequest(BaseModel):
    sender: MessageSenderEnum
    message: str


class ProductSchema(BaseModel):
    id: str
    thumbnailUrl: str
    name: str
    description: str
    price: float
    currency: str


class MessageResponse(BaseModel):
    message_id: str
    conversation_id: str
    sender: MessageSenderEnum
    message: str
    created_at: datetime
    products: Optional[List[ProductSchema]] = None
    metadata: Optional[dict] = None

    model_config = ConfigDict(from_attributes=True)


class MessageListResponse(BaseModel):
    title: str
    messages: List[MessageResponse]


class ConversationListEntry(BaseModel):
    id: str
    title: str
    created_at: datetime
    updated_at: Optional[datetime] = None


class ConversationListResponse(BaseModel):
    conversations: List[ConversationListEntry]


class SendMessageRequest(BaseModel):
    message: str


class AgentStage(str, enum.Enum):
    THINKING = "thinking"
    SEARCHING_PRODUCTS = "searching_products"
    FINAL_TOUCHES = "final_touches"


TOOL_TO_STAGE = {
    "search_products": "searching_products",
    "add_to_cart": "adding_to_cart",
    "get_cart_items": "checking_cart",
    "update_cart_item": "updating_cart",
    "remove_from_cart": "removing_from_cart",
    "create_conversation_title": "setting_title",
    "fetch_addresses": "fetching_addresses",
    "create_address": "saving_address",
    "create_order": "creating_order",
    "get_order_history": "checking_orders",
    "get_customer_profile": "fetching_profile",
}

STAGE_LABELS = {
    "thinking": "Thinking…",
    "searching_products": "Searching products…",
    "adding_to_cart": "Adding to your cart…",
    "checking_cart": "Checking your cart…",
    "updating_cart": "Updating your cart…",
    "removing_from_cart": "Removing item…",
    "setting_title": "Naming this chat…",
    "fetching_addresses": "Fetching addresses…",
    "saving_address": "Saving address…",
    "creating_order": "Processing checkout…",
    "checking_orders": "Looking up your orders…",
    "fetching_profile": "Retrieving account details…",
    "final_touches": "Putting it together…",
}

def get_status_payload(stage_id: str) -> dict:
    return {
        "type": "status",
        "stage": stage_id,
        "label": STAGE_LABELS.get(stage_id, "Working on it…")
    }


search_products_func = FunctionDeclaration(
    name="search_products",
    description=(
        "Search the merchant's product catalog. Use this whenever the customer "
        "asks about products, wants recommendations, or wants to compare options. "
        "Do not guess or invent product details — always call this function rather "
        "than answering from general knowledge."
    ),
    parameters={
        "type": "object",
        "properties": {
            "query": {
                "type": "string",
                "description": "Search terms describing what the customer is looking for.",
            },
            "max_price": {
                "type": "number",
                "description": "Optional upper price bound, if the customer mentioned a budget.",
            },
            "category": {
                "type": "string",
                "description": "Optional category filter, if evident from the conversation.",
            },
        },
        "required": ["query"],
    },
)

create_conversation_title_func = FunctionDeclaration(
    name="create_conversation_title",
    description=(
        "Set or change the conversation's title. Only call this when the user explicitly "
        "asks to rename, retitle, or change the name of this conversation — do not call it "
        "on your own initiative or in response to the content of a normal message; initial "
        "titling is handled automatically elsewhere."
    ),
    parameters={
        "type": "object",
        "properties": {
            "title": {
                "type": "string",
                "description": "The new title, max 6 words, no quotes or trailing punctuation.",
            },
        },
        "required": ["title"],
    },
)

add_to_cart_func = FunctionDeclaration(
    name="add_to_cart",
    description=(
        "Add a product to the customer's cart, or increase its quantity if it's "
        "already in the cart. Use the product details (id, name, thumbnail, price) "
        "exactly as returned by a prior search_products call — never invent these values."
    ),
    parameters={
        "type": "object",
        "properties": {
            "product_id": {"type": "string"},
            "name": {"type": "string"},
            "thumbnail_url": {"type": "string"},
            "price": {"type": "number"},
            "quantity": {"type": "integer", "description": "Defaults to 1 if not specified."},
        },
        "required": ["product_id", "name", "price"],
    },
)

get_cart_func = FunctionDeclaration(
    name="get_cart_items",
    description="Fetch the customer's current cart contents. Use this whenever the customer asks what's in their cart, or before confirming a checkout.",
    parameters={"type": "object", "properties": {}},
)

update_cart_item_func = FunctionDeclaration(
    name="update_cart_item",
    description="Set the quantity of a product already in the cart to an exact value. Setting quantity to 0 removes it.",
    parameters={
        "type": "object",
        "properties": {
            "product_id": {"type": "string"},
            "quantity": {"type": "integer"},
        },
        "required": ["product_id", "quantity"],
    },
)

remove_from_cart_func = FunctionDeclaration(
    name="remove_from_cart",
    description="Remove a product from the cart entirely.",
    parameters={
        "type": "object",
        "properties": {"product_id": {"type": "string"}},
        "required": ["product_id"],
    },
)

fetch_addresses_func = FunctionDeclaration(
    name="fetch_addresses",
    description="Fetch the customer's saved delivery addresses. Call this before create_order if the customer hasn't specified an address, or when they ask to see their saved addresses.",
    parameters={"type": "object", "properties": {}},
)

create_address_func = FunctionDeclaration(
    name="create_address",
    description="Save a new delivery address for the customer. Only available if the merchant supports agent-created addresses — if this tool isn't in your available tools, tell the customer to add the address on the merchant's own site instead.",
    parameters={
        "type": "object",
        "properties": {
            "flat_no": {"type": "string", "description": "Flat/house/building number."},
            "street": {"type": "string"},
            "city": {"type": "string"},
            "district": {"type": "string"},
            "state": {"type": "string"},
            "pincode": {"type": "string"},
        },
        "required": ["flat_no", "street", "city", "district", "state", "pincode"],
    },
)

create_order_func = FunctionDeclaration(
    name="create_order",
    description=(
        "Place an order using the customer's current cart and a delivery address. "
        "Call fetch_addresses first if you don't already know a valid address_id from "
        "this conversation. Only call this when the customer has explicitly confirmed "
        "they want to complete the purchase — never place an order without clear confirmation."
    ),
    parameters={
        "type": "object",
        "properties": {
            "address_id": {"type": "string", "description": "A valid address ID from a prior fetch_addresses call."},
        },
        "required": ["address_id"],
    },
)

get_order_history_func = FunctionDeclaration(
    name="get_order_history",
    description="Fetch the customer's past and active orders. Use this when the customer asks about order status, tracking, or their order history.",
    parameters={"type": "object", "properties": {}},
)

get_customer_profile_func = FunctionDeclaration(
    name="get_customer_profile",
    description="Fetch the customer's profile details (such as name, loyalty tier, or membership status). Use this when the customer asks about their account details or profile.",
    parameters={"type": "object", "properties": {}},
)

async def build_tools_for_merchant(merchant_id: str, db: Session) -> Tool:
    onboarding = db.query(Onboarding).filter(Onboarding.user_id == merchant_id).first()
    
    function_declarations = [
        search_products_func,
        create_conversation_title_func,
        add_to_cart_func,
        get_cart_func,
        update_cart_item_func,
        remove_from_cart_func,
        fetch_addresses_func,
        create_order_func,
    ]

    if onboarding and onboarding.addresses_config and isinstance(onboarding.addresses_config, dict):
        if onboarding.addresses_config.get("supports_creation"):
            function_declarations.append(create_address_func)

    if onboarding and onboarding.order_history_config and isinstance(onboarding.order_history_config, dict) and onboarding.order_history_config.get("path"):
        function_declarations.append(get_order_history_func)

    if onboarding and onboarding.customer_profile_config and isinstance(onboarding.customer_profile_config, dict) and onboarding.customer_profile_config.get("path"):
        function_declarations.append(get_customer_profile_func)

    return Tool(function_declarations=function_declarations)

FIELD_CANDIDATES = {
    "id": ["id", "_id", "product_id"],
    "name": ["name", "title", "itemName"],
    "description": ["description", "desc", "summary"],
    "price": ["price", "unit_price", "amount"],
    "thumbnail": ["thumbnail", "thumbnailUrl", "image", "imageUrl", "image_url"],
}

def _pick(item: dict, candidates: list[str], field_label: str):
    for key in candidates:
        if key in item and item[key] is not None:
            return item[key]
    raise KeyError(f"none of {candidates} found for '{field_label}' in product item: {item!r}")

async def execute_search_products(merchant_id: str, args: dict, session: dict, db: Session) -> dict:
    agent_logger.info(f"Product search requested: merchant={merchant_id}, query='{args.get('query')}'")
    onboarding = db.query(Onboarding).filter(Onboarding.user_id == merchant_id).first()
    if not onboarding or not onboarding.products_config:
        agent_logger.warning(f"Product search aborted: onboarding config missing for merchant={merchant_id}")
        return {"error": "onboarding_config_not_found", "products": [], "count": 0}

    config = onboarding.products_config  # {"path": "products", "method": "GET", "payload_key": "query", "response_key": "products"}

    url = f"{onboarding.base_url.rstrip('/')}/{config['path'].lstrip('/')}"
    params = {config["payload_key"]: args["query"]}

    headers = {}
    if onboarding.auth_enabled:
        try:
            from app.agentic.deps import get_merchant_auth_headers
            headers = get_merchant_auth_headers(session=session, db=db)
        except Exception as e:
            agent_logger.warning(f"Failed to resolve auth headers for product search: {e}")

    resp = await call_merchant_api(
        config["method"], url,
        params=params,
        headers=headers,
        context="search_products",
    )
    resp.raise_for_status()

    json_data = resp.json()
    response_key = config.get("response_key", "products")

    # Extract product list via dot-notation path extractor
    raw_items = extract_by_path(json_data, response_key, default=[])
    if not isinstance(raw_items, list):
        if isinstance(json_data, list):
            raw_items = json_data
        else:
            raw_items = []

    products = []
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
            agent_logger.debug(f"Skipping malformed product item: {e}")
            continue

    # Client-side filters
    if args.get("max_price") is not None:
        try:
            max_price = float(args["max_price"])
            products = [p for p in products if p["price"] <= max_price]
        except Exception:
            pass

    agent_logger.info(f"Product search completed: merchant={merchant_id}, count={len(products)}")

    return {"products": products, "count": len(products)}

MAX_CART_ITEMS = 5
MAX_LINE_QUANTITY = 20

async def execute_add_to_cart(merchant_id: str, customer_email: str, args: dict, db: Session) -> dict:
    product_id = str(args.get("product_id", "")).strip()
    name = str(args.get("name", "")).strip()
    thumbnail_url = args.get("thumbnail_url")

    try:
        price = float(args.get("price", 0.0))
    except (TypeError, ValueError):
        price = 0.0

    try:
        quantity = int(args.get("quantity", 1))
    except (TypeError, ValueError):
        quantity = 1

    if not product_id or not name:
        cart_logger.warning(f"Cart add rejected (invalid data): customer={customer_email}")
        return {"error": "invalid_product_data", "message": "product_id and name are required."}

    if quantity < 1:
        cart_logger.warning(f"Cart add rejected (non-positive quantity): customer={customer_email}")
        return {"error": "quantity_must_be_positive"}

    existing = db.query(CartItem).filter(
        CartItem.merchant_id == merchant_id,
        CartItem.customer_email == customer_email,
        CartItem.product_id == product_id
    ).first()

    if existing:
        new_quantity = existing.quantity + quantity
        if new_quantity > MAX_LINE_QUANTITY:
            cart_logger.warning(f"Cart add rejected (limit reached): product={product_id}, customer={customer_email}")
            return {"error": "max_line_quantity_exceeded", "message": f"Maximum quantity per item is {MAX_LINE_QUANTITY}."}
        existing.quantity = new_quantity
        existing.updated_at = datetime.now(timezone.utc)
        db.commit()
        cart_logger.info(f"Item quantity updated in cart: product={product_id}, new_quantity={new_quantity}, customer={customer_email}")
        return {"status": "updated", "product_id": product_id, "quantity": new_quantity}

    current_count = db.query(CartItem).filter(
        CartItem.merchant_id == merchant_id,
        CartItem.customer_email == customer_email
    ).count()

    if current_count >= MAX_CART_ITEMS:
        cart_logger.warning(f"Cart add rejected (cart full): customer={customer_email}")
        return {"error": "cart_full", "message": f"Cart is full (max {MAX_CART_ITEMS} items). Remove something before adding more."}

    if quantity > MAX_LINE_QUANTITY:
        cart_logger.warning(f"Cart add rejected (limit reached): product={product_id}, customer={customer_email}")
        return {"error": "max_line_quantity_exceeded", "message": f"Maximum quantity per item is {MAX_LINE_QUANTITY}."}

    new_item = CartItem(
        merchant_id=merchant_id,
        customer_email=customer_email,
        product_id=product_id,
        name=name,
        thumbnail_url=thumbnail_url,
        price=price,
        quantity=quantity
    )
    db.add(new_item)
    db.commit()
    cart_logger.info(f"Item added to cart: product={product_id}, quantity={quantity}, customer={customer_email}")
    return {"status": "added", "product_id": product_id, "quantity": quantity}


async def execute_get_cart_items(merchant_id: str, customer_email: str, db: Session) -> dict:
    rows = db.query(CartItem).filter(
        CartItem.merchant_id == merchant_id,
        CartItem.customer_email == customer_email
    ).order_by(CartItem.created_at.asc()).all()

    items = [
        {
            "product_id": r.product_id,
            "name": r.name,
            "thumbnail_url": r.thumbnail_url,
            "price": float(r.price),
            "quantity": r.quantity,
        }
        for r in rows
    ]
    subtotal = sum(float(r.price) * r.quantity for r in rows)
    cart_logger.debug(f"Cart fetched: items={len(items)}, subtotal={subtotal}, customer={customer_email}")
    return {"items": items, "count": len(items), "subtotal": round(subtotal, 2)}


async def execute_update_cart_item(merchant_id: str, customer_email: str, args: dict, db: Session) -> dict:
    product_id = str(args.get("product_id", "")).strip()
    try:
        quantity = int(args.get("quantity", 0))
    except (TypeError, ValueError):
        quantity = 0

    existing = db.query(CartItem).filter(
        CartItem.merchant_id == merchant_id,
        CartItem.customer_email == customer_email,
        CartItem.product_id == product_id
    ).first()

    if not existing:
        return {"error": "not_in_cart"}

    if quantity <= 0:
        db.delete(existing)
        db.commit()
        cart_logger.info(f"Item removed from cart via update (quantity 0): product={product_id}, customer={customer_email}")
        return {"status": "removed", "product_id": product_id}

    if quantity > MAX_LINE_QUANTITY:
        cart_logger.warning(f"Cart update rejected (limit reached): product={product_id}, customer={customer_email}")
        return {"error": "max_line_quantity_exceeded", "message": f"Maximum quantity per item is {MAX_LINE_QUANTITY}."}

    existing.quantity = quantity
    existing.updated_at = datetime.now(timezone.utc)
    db.commit()
    cart_logger.info(f"Cart item updated: product={product_id}, quantity={quantity}, customer={customer_email}")
    return {"status": "updated", "product_id": product_id, "quantity": quantity}


async def execute_remove_from_cart(merchant_id: str, customer_email: str, args: dict, db: Session) -> dict:
    product_id = str(args.get("product_id", "")).strip()

    existing = db.query(CartItem).filter(
        CartItem.merchant_id == merchant_id,
        CartItem.customer_email == customer_email,
        CartItem.product_id == product_id
    ).first()

    if not existing:
        return {"error": "not_in_cart"}

    db.delete(existing)
    db.commit()
    cart_logger.info(f"Cart item removed: product={product_id}, customer={customer_email}")
    return {"status": "removed", "product_id": product_id}

ADDRESS_FIELD_CANDIDATES = {
    "flat_no": ["flatNo", "flat_no", "houseNo", "house_no", "line1"],
    "street": ["street", "address_line1", "line2"],
    "city": ["city"],
    "district": ["district"],
    "state": ["state"],
    "pincode": ["pincode", "zip", "postal_code"],
}

async def execute_fetch_addresses(merchant_id: str, session: dict, db: Session) -> dict:
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
    response_key = fetch_cfg.get("response_key", "addresses")
    id_field = fetch_cfg.get("id_field")

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
    raw_items = extract_by_path(json_data, response_key, default=[])
    if not isinstance(raw_items, list):
        if isinstance(json_data, list):
            raw_items = json_data
        else:
            raw_items = []

    addresses = []
    for item in raw_items:
        if not isinstance(item, dict):
            continue

        raw_id = None
        if id_field:
            if id_field in item and item[id_field] is not None:
                raw_id = item[id_field]
        else:
            for cand in ["id", "_id", "address_id"]:
                if cand in item and item[cand] is not None:
                    raw_id = item[cand]
                    break

        if raw_id is None:
            agent_logger.warning(f"fetch_addresses: item missing configured id_field '{id_field or 'id/_id/address_id'}', skipping: {item!r}")
            continue

        try:
            addr = {"id": str(raw_id)}
            for field, candidates in ADDRESS_FIELD_CANDIDATES.items():
                try:
                    addr[field] = _pick(item, candidates, field)
                except KeyError:
                    addr[field] = ""
            addresses.append(addr)
        except Exception as e:
            agent_logger.debug(f"Skipping malformed address item: {e}")
            continue

    agent_logger.info(f"Addresses fetched: merchant={merchant_id}, count={len(addresses)}")
    return {"addresses": addresses, "count": len(addresses)}


ADDRESS_CONCEPT_ORDER = ["flat_no", "street", "city", "district", "state", "pincode"]

async def execute_create_address(merchant_id: str, session: dict, args: dict, db: Session) -> dict:
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


async def execute_create_order(merchant_id: str, session: dict, conversation_id: str, args: dict, db: Session) -> dict:
    customer_email = session["customer_ref"]
    address_id = str(args.get("address_id", "")).strip()

    orders_logger.info(f"Checkout initiated: merchant={merchant_id}, customer={customer_email}, address_id={address_id}")

    # 1. Load cart items
    cart_items = db.query(CartItem).filter(
        CartItem.merchant_id == merchant_id,
        CartItem.customer_email == customer_email
    ).order_by(CartItem.created_at.asc()).all()

    if not cart_items:
        orders_logger.warning(f"Checkout aborted (cart empty): merchant={merchant_id}, customer={customer_email}")
        return {"error": "cart_empty", "message": "Your cart is empty. Please add products before checking out."}

    onboarding = db.query(Onboarding).filter(Onboarding.user_id == merchant_id).first()
    if not onboarding or not onboarding.create_order_config:
        orders_logger.error(f"Checkout failed (config missing): merchant={merchant_id}")
        return {"error": "create_order_config_not_found"}

    config = onboarding.create_order_config
    cart_key = config.get("cart_key", "cart")
    item_id_field = config.get("item_id_field", "product_id")
    price_field = config.get("price_field", "price")
    quantity_field = config.get("quantity_field", "quantity")
    address_id_field = config.get("address_id_field", "address_id")
    additional_fields = config.get("additional_fields", [])

    # Step 1 — Create local agent_orders record (status: INITIATED)
    items_snapshot = [
        {
            "product_id": item.product_id,
            "name": item.name,
            "thumbnail_url": item.thumbnail_url,
            "price": float(item.price),
            "quantity": item.quantity
        }
        for item in cart_items
    ]

    agent_order = AgentOrder(
        merchant_id=merchant_id,
        customer_ref=customer_email,
        conversation_id=conversation_id,
        items=items_snapshot,
        status=AgentOrderStatus.INITIATED.value
    )
    db.add(agent_order)
    db.commit()
    db.refresh(agent_order)
    orders_logger.info(f"Agent order row created: agent_order_id={agent_order.id}, items_count={len(cart_items)}")

    # Step 2 — Construct merchant payload & call merchant API
    payload = {
        cart_key: [
            {
                item_id_field: item.product_id,
                price_field: float(item.price),
                quantity_field: item.quantity
            }
            for item in cart_items
        ],
        address_id_field: address_id
    }

    if isinstance(additional_fields, list):
        for field in additional_fields:
            if isinstance(field, dict) and "key" in field and "value" in field:
                payload[field["key"]] = field["value"]

    url = f"{onboarding.base_url.rstrip('/')}/{config['path'].lstrip('/')}"
    method = config.get("method", "POST")
    headers = {}
    if onboarding.auth_enabled:
        try:
            headers = get_merchant_auth_headers(session=session, db=db)
        except Exception as e:
            orders_logger.warning(f"Failed to resolve auth headers for create_order: {e}")

    try:
        resp = await call_merchant_api(
            method, url,
            json_body=payload,
            headers=headers,
            context="create_order",
        )
        
        if resp.status_code >= 400:
            agent_order.status = AgentOrderStatus.FAILED.value
            agent_order.failure_reason = f"merchant_api_error_{resp.status_code}: {resp.text[:200]}"
            db.commit()
            orders_logger.error(f"Order failed (merchant API {resp.status_code}): agent_order_id={agent_order.id}")
            return {
                "error": "merchant_order_failed",
                "message": "The merchant's checkout service returned an error. Your cart remains intact."
            }

        merchant_data = resp.json()
    except Exception as e:
        agent_order.status = AgentOrderStatus.FAILED.value
        agent_order.failure_reason = f"merchant_api_exception: {str(e)[:200]}"
        db.commit()
        orders_logger.error(f"Order failed (merchant API exception): agent_order_id={agent_order.id}, error={e}")
        return {
            "error": "merchant_api_exception",
            "message": "Failed to connect to the merchant's checkout service. Your cart remains intact."
        }

    # Extract merchant_order_id and order_total from merchant response
    merchant_order_id = str(merchant_data.get("merchant_order_id") or merchant_data.get("order_id") or merchant_data.get("id") or f"m_{agent_order.id[:8]}")
    try:
        order_total = float(merchant_data.get("order_total") or merchant_data.get("total") or merchant_data.get("amount") or sum(float(i.price) * i.quantity for i in cart_items))
    except (TypeError, ValueError):
        order_total = sum(float(i.price) * i.quantity for i in cart_items)

    currency = str(merchant_data.get("currency", "INR")).upper()

    agent_order.merchant_order_id = merchant_order_id
    agent_order.order_total = order_total
    agent_order.currency = currency
    agent_order.status = AgentOrderStatus.MERCHANT_ORDER_CREATED.value
    db.commit()
    orders_logger.info(f"Merchant order API succeeded: merchant_order_id={merchant_order_id}, order_total={order_total}")

    # Step 3 — Create Razorpay Order
    settings = get_settings()
    razorpay_order_id = None
    if settings.RAZORPAY_CLIENT_ID and settings.RAZORPAY_CLIENT_SECRET:
        try:
            import razorpay
            rzp_client = razorpay.Client(auth=(settings.RAZORPAY_CLIENT_ID, settings.RAZORPAY_CLIENT_SECRET))
            rzp_order = rzp_client.order.create(data={
                "amount": int(round(order_total * 100)),
                "currency": currency,
                "receipt": agent_order.id,
                "notes": {
                    "agent_order_id": agent_order.id,
                    "merchant_order_id": merchant_order_id,
                    "merchant_id": merchant_id
                }
            })
            razorpay_order_id = rzp_order.get("id")
        except Exception as e:
            orders_logger.warning(f"Razorpay order creation fallback: {e}")
            razorpay_order_id = f"order_mock_{agent_order.id[:12]}"
    else:
        razorpay_order_id = f"order_mock_{agent_order.id[:12]}"

    agent_order.razorpay_order_id = razorpay_order_id
    agent_order.status = AgentOrderStatus.AWAITING_PAYMENT.value
    db.commit()
    orders_logger.info(f"Razorpay order created: razorpay_order_id={razorpay_order_id}, amount={order_total}")

    # Step 4 — Clear customer's cart
    db.query(CartItem).filter(
        CartItem.merchant_id == merchant_id,
        CartItem.customer_email == customer_email
    ).delete()
    db.commit()
    orders_logger.info(f"Checkout completed awaiting payment: agent_order_id={agent_order.id}, merchant_order_id={merchant_order_id}")

    payment_metadata = {
        "action": "initiate_payment",
        "agent_order_id": agent_order.id,
        "merchant_order_id": merchant_order_id,
        "razorpay_order_id": razorpay_order_id,
        "amount": order_total,
        "currency": currency,
        "key_id": settings.RAZORPAY_CLIENT_ID
    }

    return {
        "status": "order_created",
        "agent_order_id": agent_order.id,
        "merchant_order_id": merchant_order_id,
        "razorpay_order_id": razorpay_order_id,
        "amount": order_total,
        "currency": currency,
        "payment_metadata": payment_metadata,
        "message": "Order successfully created! Please proceed to payment to complete your order."
    }

ORDER_FIELD_CANDIDATES = {
    "order_id": ["order_id", "id", "_id"],
    "status": ["status", "order_status"],
    "total": ["total", "amount", "order_total"],
    "created_at": ["created_at", "date", "placed_at"],
    "items": ["items", "products", "line_items"],
}

async def execute_get_order_history(merchant_id: str, session: dict, db: Session) -> dict:
    agent_logger.info(f"Fetching order history: merchant={merchant_id}, customer={session.get('customer_ref')}")
    onboarding = db.query(Onboarding).filter(Onboarding.user_id == merchant_id).first()
    if not onboarding or not onboarding.order_history_config:
        agent_logger.warning(f"Order history fetch aborted: onboarding config missing for merchant={merchant_id}")
        return {"error": "onboarding_config_not_found", "orders": [], "count": 0}

    config = onboarding.order_history_config
    path = config.get("path", "")
    method = (config.get("method") or "GET").upper()
    response_key = config.get("response_key", "orders")

    if not path:
        return {"error": "order_history_config_invalid", "orders": [], "count": 0}

    url = f"{onboarding.base_url.rstrip('/')}/{path.lstrip('/')}"
    headers = {}
    if onboarding.auth_enabled:
        try:
            headers = get_merchant_auth_headers(session=session, db=db)
        except Exception as e:
            agent_logger.warning(f"Failed to resolve auth headers for get_order_history: {e}")

    resp = await call_merchant_api(
        method, url,
        headers=headers,
        context="get_order_history",
    )
    resp.raise_for_status()

    json_data = resp.json()
    raw_orders = extract_by_path(json_data, response_key, default=[])
    if not isinstance(raw_orders, list):
        if isinstance(json_data, list):
            raw_orders = json_data
        else:
            raw_orders = []

    orders = []
    for item in raw_orders:
        if not isinstance(item, dict):
            continue
        try:
            order_data = {}
            for field, candidates in ORDER_FIELD_CANDIDATES.items():
                try:
                    order_data[field] = _pick(item, candidates, field)
                except KeyError:
                    if field == "items":
                        order_data[field] = []
                    elif field == "total":
                        order_data[field] = 0.0
                    else:
                        order_data[field] = "N/A" if field != "order_id" else f"ord_{len(orders)+1}"
            orders.append(order_data)
        except Exception as e:
            agent_logger.debug(f"Skipping malformed order item: {e}")
            continue

    agent_logger.info(f"Order history fetched: merchant={merchant_id}, count={len(orders)}")
    return {"orders": orders, "count": len(orders)}


PROFILE_FIELD_CANDIDATES = {
    "name": ["name", "full_name", "user_name", "customer_name"],
    "email": ["email", "customer_email"],
    "loyalty_tier": ["loyalty_tier", "tier", "membership_tier", "level"],
    "member_since": ["member_since", "created_at", "joined_at", "registration_date"],
}

async def execute_get_customer_profile(merchant_id: str, session: dict, db: Session) -> dict:
    agent_logger.info(f"Fetching customer profile: merchant={merchant_id}, customer={session.get('customer_ref')}")
    onboarding = db.query(Onboarding).filter(Onboarding.user_id == merchant_id).first()
    if not onboarding or not onboarding.customer_profile_config:
        agent_logger.warning(f"Customer profile fetch aborted: onboarding config missing for merchant={merchant_id}")
        return {"error": "onboarding_config_not_found", "profile": None}

    config = onboarding.customer_profile_config
    path = config.get("path", "")
    method = (config.get("method") or "GET").upper()
    response_key = config.get("response_key", "profile")

    if not path:
        return {"error": "customer_profile_config_invalid", "profile": None}

    url = f"{onboarding.base_url.rstrip('/')}/{path.lstrip('/')}"
    headers = {}
    if onboarding.auth_enabled:
        try:
            headers = get_merchant_auth_headers(session=session, db=db)
        except Exception as e:
            agent_logger.warning(f"Failed to resolve auth headers for get_customer_profile: {e}")

    resp = await call_merchant_api(
        method, url,
        headers=headers,
        context="get_customer_profile",
    )
    resp.raise_for_status()

    json_data = resp.json()
    raw_profile = extract_by_path(json_data, response_key, default=json_data)
    if not isinstance(raw_profile, dict):
        raw_profile = json_data if isinstance(json_data, dict) else {}

    profile = {}
    for field, candidates in PROFILE_FIELD_CANDIDATES.items():
        try:
            val = _pick(raw_profile, candidates, field)
            if val is not None and str(val).strip():
                profile[field] = val
        except KeyError:
            pass

    if "email" not in profile and session.get("customer_ref"):
        profile["email"] = session.get("customer_ref")

    agent_logger.info(f"Customer profile fetched: merchant={merchant_id}")
    return {"profile": profile}

def build_system_instruction(merchant_name: str) -> str:
    return f"""You are the sales representative and shopping assistant for {merchant_name}. 

Your primary goal is to help customers find products, enthusiastically promote our catalog, and drive sales. You should never respond neutrally or say you "cannot offer personal opinions" or refer to yourself as "an AI assistant" or say "as an AI...". You represent {merchant_name} directly and are biased toward highlighting how amazing, delicious, or valuable our products are.

Rules:
- Act like a passionate salesperson: if a customer asks if a product is "worth it" or is good, speak highly of its qualities, describe its taste/appeal/utility enthusiastically, and encourage them to try it!
- Always use the search_products function to find real products — never invent product names, prices, or descriptions.
- When customers ask to add, check, update, or remove items in their cart, call the appropriate cart function (add_to_cart, get_cart_items, update_cart_item, remove_from_cart).
- When customers ask about their past or active orders, order status, or tracking, call get_order_history.
- When customers ask about their account details, membership, or profile, call get_customer_profile.
- When you mention specific products in your reply, don't repeat their full details in text (name, price, description) — the product cards render separately below your message. Just reference them naturally, e.g. "You'll love these options:".
- If a search returns no results, say so plainly and suggest the customer try different terms — don't fabricate alternatives.
- ADDRESS & CHECKOUT RULES:
  1. Call fetch_addresses first if the customer asks to place an order or see their addresses, and you don't already have a valid address_id.
  2. If the merchant supports saving addresses (create_address is available), you can offer to save a new address for them. If create_address is not available, ask them to add their address on the store's website.
  3. CRITICAL: Never call create_order without explicit customer confirmation (e.g., "Yes, buy now", "Place my order", "Confirm checkout"). Do not place an order on ambiguous messages like "these look nice" or "tell me more".
- Keep replies conversational, persuasive, and short. A sentence or two of high-energy framing is usually enough; let the product cards do the rest.
"""

def _extract_function_call(response):
    if not response.candidates:
        return None
    content = response.candidates[0].content
    for part in content.parts:
        if part.function_call:
            return part.function_call
    return None


async def set_conversation_title(conversation_id: str, title: str, db: Session) -> str:
    title = title.strip().strip('"').strip("'")[:80]
    if not title:
        title = "Untitled"
    convo = db.query(Conversation).filter(Conversation.id == conversation_id).first()
    if convo:
        convo.title = title
        convo.updated_at = datetime.now(timezone.utc)
        db.commit()
    return title

async def maybe_generate_initial_title(conversation_id: str, user_message: str, is_first_message: bool, db: Session) -> str | None:
    if not is_first_message:
        return None

    settings = get_settings()
    vertexai.init(project=settings.GCP_PROJECT_ID, location=settings.GCP_LOCATION)

    model = GenerativeModel(
        settings.GEMINI_MODEL,
        system_instruction=(
            "Generate a short, descriptive title summarizing what this message is about. "
            "Maximum 6 words. No quotation marks, no trailing punctuation, no preamble — "
            "reply with only the title text itself."
        ),
    )
    try:
        response = await model.generate_content_async(user_message)
        title_text = response.text
    except Exception as e:
        print(f"Failed to generate title: {e}")
        title_text = "Untitled"

    return await set_conversation_title(conversation_id, title_text, db)

@router.get("/conversations", response_model=ConversationListResponse)
def list_conversations(
    session: dict = Depends(get_current_session),
    db: Session = Depends(get_db)
):
    """
    List all conversations belonging to the logged-in customer for the current merchant.
    """
    convos = db.query(Conversation).filter(
        Conversation.user_email == session["customer_ref"],
        Conversation.merchant_id == session["merchant_id"]
    ).order_by(Conversation.created_at.desc()).all()

    return {
        "conversations": [
            {
                "id": c.id,
                "title": c.title,
                "created_at": c.created_at,
                "updated_at": c.updated_at
            }
            for c in convos
        ]
    }


class CartItemResponse(BaseModel):
    product_id: str
    name: str
    thumbnail_url: Optional[str] = None
    price: float
    quantity: int

class CartResponse(BaseModel):
    items: List[CartItemResponse]
    count: int
    subtotal: float

@router.get("/cart", response_model=CartResponse)
async def get_cart(
    session: dict = Depends(get_current_session),
    db: Session = Depends(get_db)
):
    """
    Fetch the customer's current cart contents for the current merchant session.
    """
    return await execute_get_cart_items(session["merchant_id"], session["customer_ref"], db)


async def message_event_stream(conversation_id: str, user_message: str, session: dict, db: Session):
    agent_logger.info(f"Agent loop started: conversation_id={conversation_id}, customer={session.get('customer_ref')}")
    start_time = datetime.now(timezone.utc)
    tool_call_count = 0

    # 1. Fetch previous history messages from DB for the model (before inserting the new user message)
    previous_messages = db.query(ConversationMessage).filter(
        ConversationMessage.conversation_id == conversation_id
    ).order_by(ConversationMessage.created_at.asc()).all()

    is_first_message = len(previous_messages) == 0

    # Convert to Vertex Content format
    history = []
    for msg in previous_messages:
        role = "user" if msg.sender == MessageSender.USER else "model"
        history.append(Content(role=role, parts=[Part.from_text(msg.message)]))

    # 2. Persist user message in DB immediately
    user_msg_row = ConversationMessage(
        conversation_id=conversation_id,
        sender=MessageSender.USER,
        message=user_message
    )
    db.add(user_msg_row)
    
    # Bump conversations.updated_at
    convo = db.query(Conversation).filter(Conversation.id == conversation_id).first()
    if convo:
        convo.updated_at = datetime.now(timezone.utc)
    db.commit()
    db.refresh(user_msg_row)

    # Start title task concurrently in the background if it's the first message
    title_task = None
    if is_first_message:
        title_task = asyncio.create_task(
            maybe_generate_initial_title(conversation_id, user_message, is_first_message, db)
        )

    # Yield Thinking state
    yield json.dumps(get_status_payload("thinking")) + "\n"
    await asyncio.sleep(0.1)

    # Await and yield the auto-generated title if available
    if title_task:
        try:
            new_title = await title_task
            if new_title:
                yield json.dumps({"type": "title", "title": new_title}) + "\n"
        except Exception as e:
            agent_logger.warning(f"Error generating initial title: {e}")

    settings = get_settings()
    vertexai.init(project=settings.GCP_PROJECT_ID, location=settings.GCP_LOCATION)

    merchant = db.query(User).filter(User.id == session["merchant_id"]).first()
    merchant_name = merchant.store_name if (merchant and merchant.store_name) else "the Merchant"

    merchant_tools = await build_tools_for_merchant(session["merchant_id"], db)

    model = GenerativeModel(
        settings.GEMINI_MODEL,
        system_instruction=build_system_instruction(merchant_name),
        tools=[merchant_tools],
    )

    chat = model.start_chat(history=history)
    collected_products = []
    payment_metadata_to_attach = None
    
    try:
        agent_logger.debug(f"Calling Gemini model {settings.GEMINI_MODEL} for conversation={conversation_id}")
        response = await chat.send_message_async(user_message)
    except Exception as e:
        agent_logger.error(f"Error calling Gemini: {e}")
        response = None

    max_iterations = 4
    for iteration in range(max_iterations):
        if not response:
            break
            
        function_call = _extract_function_call(response)
        if not function_call:
            break

        tool_call_count += 1
        agent_logger.info(f"Tool call dispatched: function={function_call.name}, conversation_id={conversation_id}")
        stage = TOOL_TO_STAGE.get(function_call.name, "thinking")
        yield json.dumps(get_status_payload(stage)) + "\n"

        if function_call.name == "search_products":
            
            try:
                args = dict(function_call.args)
                result = await execute_search_products(session["merchant_id"], args, session, db)
                collected_products.extend(result.get("products", []))
            except Exception as e:
                agent_logger.error(f"Search products failed: {e}")
                result = {"error": "search_failed", "products": [], "count": 0}

            try:
                response = await chat.send_message_async(
                    Part.from_function_response(name="search_products", response=result)
                )
            except Exception as e:
                agent_logger.error(f"Error calling Gemini with tool response: {e}")
                response = None
                break

        elif function_call.name == "create_conversation_title":
            try:
                args = dict(function_call.args)
                new_title = await set_conversation_title(conversation_id, args["title"], db)
                yield json.dumps({"type": "title", "title": new_title}) + "\n"
                result = {"status": "ok", "title": new_title}
            except Exception as e:
                agent_logger.error(f"Rename conversation failed: {e}")
                result = {"status": "error", "message": str(e)}

            try:
                response = await chat.send_message_async(
                    Part.from_function_response(name="create_conversation_title", response=result)
                )
            except Exception as e:
                agent_logger.error(f"Error calling Gemini with rename response: {e}")
                response = None
                break

        elif function_call.name in ("add_to_cart", "get_cart_items", "update_cart_item", "remove_from_cart"):
            try:
                args = dict(function_call.args) if function_call.args else {}
                m_id = session["merchant_id"]
                c_email = session["customer_ref"]

                if function_call.name == "add_to_cart":
                    result = await execute_add_to_cart(m_id, c_email, args, db)
                elif function_call.name == "get_cart_items":
                    result = await execute_get_cart_items(m_id, c_email, db)
                elif function_call.name == "update_cart_item":
                    result = await execute_update_cart_item(m_id, c_email, args, db)
                elif function_call.name == "remove_from_cart":
                    result = await execute_remove_from_cart(m_id, c_email, args, db)

                # Stream event when cart is modified (add/update/remove, NOT plain get_cart_items fetch)
                if function_call.name != "get_cart_items":
                    cart_state = await execute_get_cart_items(m_id, c_email, db)
                    yield json.dumps({
                        "type": "cart_updated",
                        "items": cart_state["items"],
                        "count": cart_state["count"],
                        "subtotal": cart_state["subtotal"]
                    }) + "\n"

            except Exception as e:
                agent_logger.error(f"Cart tool {function_call.name} failed: {e}")
                result = {"error": "cart_operation_failed", "message": str(e)}

            try:
                response = await chat.send_message_async(
                    Part.from_function_response(name=function_call.name, response=result)
                )
            except Exception as e:
                agent_logger.error(f"Error calling Gemini with cart tool response: {e}")
                response = None
                break

        elif function_call.name == "fetch_addresses":
            try:
                result = await execute_fetch_addresses(session["merchant_id"], session, db)
            except Exception as e:
                agent_logger.error(f"fetch_addresses failed: {e}")
                result = {"error": "fetch_addresses_failed", "addresses": [], "count": 0}

            try:
                response = await chat.send_message_async(
                    Part.from_function_response(name="fetch_addresses", response=result)
                )
            except Exception as e:
                agent_logger.error(f"Error calling Gemini with fetch_addresses response: {e}")
                response = None
                break

        elif function_call.name == "create_address":
            try:
                args = dict(function_call.args) if function_call.args else {}
                result = await execute_create_address(session["merchant_id"], session, args, db)
            except Exception as e:
                agent_logger.error(f"create_address failed: {e}")
                result = {"error": "create_address_failed", "message": str(e)}

            try:
                response = await chat.send_message_async(
                    Part.from_function_response(name="create_address", response=result)
                )
            except Exception as e:
                agent_logger.error(f"Error calling Gemini with create_address response: {e}")
                response = None
                break

        elif function_call.name == "create_order":
            try:
                args = dict(function_call.args) if function_call.args else {}
                m_id = session["merchant_id"]
                result = await execute_create_order(m_id, session, conversation_id, args, db)
                if result.get("payment_metadata"):
                    payment_metadata_to_attach = result["payment_metadata"]
                
                # Stream cart cleared event
                yield json.dumps({
                    "type": "cart_updated",
                    "items": [],
                    "count": 0,
                    "subtotal": 0.0
                }) + "\n"
            except Exception as e:
                agent_logger.error(f"create_order failed: {e}")
                result = {"error": "create_order_failed", "message": str(e)}

            try:
                response = await chat.send_message_async(
                    Part.from_function_response(name="create_order", response=result)
                )
            except Exception as e:
                agent_logger.error(f"Error calling Gemini with create_order response: {e}")
                response = None
                break

        elif function_call.name == "get_order_history":
            try:
                result = await execute_get_order_history(session["merchant_id"], session, db)
                if result.get("orders") is not None:
                    payment_metadata_to_attach = {
                        "action": "order_history_card",
                        "orders": result.get("orders", []),
                        "count": result.get("count", 0)
                    }
            except Exception as e:
                agent_logger.error(f"get_order_history failed: {e}")
                result = {"error": "get_order_history_failed", "orders": [], "count": 0}

            try:
                response = await chat.send_message_async(
                    Part.from_function_response(name="get_order_history", response=result)
                )
            except Exception as e:
                agent_logger.error(f"Error calling Gemini with get_order_history response: {e}")
                response = None
                break

        elif function_call.name == "get_customer_profile":
            try:
                result = await execute_get_customer_profile(session["merchant_id"], session, db)
                if result.get("profile"):
                    payment_metadata_to_attach = {
                        "action": "profile_card",
                        "profile": result.get("profile")
                    }
            except Exception as e:
                agent_logger.error(f"get_customer_profile failed: {e}")
                result = {"error": "get_customer_profile_failed", "profile": None}

            try:
                response = await chat.send_message_async(
                    Part.from_function_response(name="get_customer_profile", response=result)
                )
            except Exception as e:
                agent_logger.error(f"Error calling Gemini with get_customer_profile response: {e}")
                response = None
                break

    yield json.dumps(get_status_payload("final_touches")) + "\n"
    await asyncio.sleep(0.2)

    elapsed_ms = int((datetime.now(timezone.utc) - start_time).total_seconds() * 1000)
    agent_logger.info(f"Agent loop completed in {elapsed_ms}ms, tool_calls={tool_call_count}, conversation_id={conversation_id}")

    if response:
        try:
            final_text = response.text
        except Exception:
            final_text = "Here is what I found for you."
    else:
        final_text = "I'm sorry, I'm having trouble getting a response. Can you try again?"

    # 4. Save agent message to DB
    msg_meta = {"products": collected_products}
    if payment_metadata_to_attach:
        msg_meta.update(payment_metadata_to_attach)

    agent_msg_row = ConversationMessage(
        conversation_id=conversation_id,
        sender=MessageSender.AGENT,
        message=final_text,
        msg_metadata=msg_meta
    )
    db.add(agent_msg_row)
    if convo:
        convo.updated_at = datetime.now(timezone.utc)
    db.commit()
    db.refresh(agent_msg_row)

    # 5. Serialize results
    user_serialized = {
        "message_id": user_msg_row.message_id,
        "conversation_id": user_msg_row.conversation_id,
        "sender": "user",
        "message": user_msg_row.message,
        "created_at": user_msg_row.created_at.isoformat()
    }
    agent_serialized = {
        "message_id": agent_msg_row.message_id,
        "conversation_id": agent_msg_row.conversation_id,
        "sender": "agent",
        "message": agent_msg_row.message,
        "products": collected_products,
        "metadata": agent_msg_row.msg_metadata,
        "created_at": agent_msg_row.created_at.isoformat()
    }

    # Yield final results payload
    yield json.dumps({
        "type": "final",
        "user_message": user_serialized,
        "agent_message": agent_serialized
    }) + "\n"

@public_router.get("/branding")
def get_public_branding(
    onboarding: Onboarding = Depends(resolve_merchant_by_host)
):
    """
    Exposes the resolved merchant's public branding configuration.
    Requires no auth headers. Resolves merchant context from Host header.
    """
    branding_config = onboarding.branding_config
    if not branding_config or not isinstance(branding_config, dict):
        raise HTTPException(
            status_code=404,
            detail="Branding configuration not found for this merchant."
        )
    return {
        **branding_config,
        "merchant_id": onboarding.user_id
    }





@public_router.post("/auth/login", response_model=LoginResponse)
async def login(
    payload: LoginRequest,
    db: Session = Depends(get_db)
):
    """
    Customer Login for the Agentic module.
    Authenticates against the merchant's login API dynamically and returns a ShopAgent JWT.
    """
    auth_logger.info(f"Login attempt: merchant={payload.merchant_id}, email={payload.email}")
    settings = get_settings()

    # 1. Fetch onboarding configuration
    onboarding = db.query(Onboarding).filter(Onboarding.user_id == payload.merchant_id).first()
    if not onboarding or not onboarding.auth_config:
        auth_logger.warning(f"Login failed: merchant={payload.merchant_id} not found or auth config missing")
        raise HTTPException(status_code=404, detail="merchant_not_found")

    auth_config = onboarding.auth_config

    # 2. Extract mappings and prepare endpoint URL
    auth_url = auth_config.get("auth_url")
    if not auth_url:
        auth_logger.warning(f"Login failed: auth_url missing for merchant={payload.merchant_id}")
        raise HTTPException(status_code=404, detail="merchant_not_found")

    # Resolve relative URL
    if not auth_url.startswith(("http://", "https://")):
        base = onboarding.base_url.rstrip("/")
        path = auth_url.lstrip("/")
        auth_url = f"{base}/{path}"

    method = (auth_config.get("method") or "POST").upper()
    identifier_field = auth_config.get("identifier_field") or "email"
    password_field = auth_config.get("password_field") or "password"
    token_path = auth_config.get("token_path") or "token"

    # 3. Call the merchant's login API
    request_body = {
        identifier_field: payload.email,
        password_field: payload.password
    }

    try:
        resp = await call_merchant_api(
            method,
            auth_url,
            json_body=request_body if method != "GET" else None,
            params=request_body if method == "GET" else None,
            context="merchant_login",
            redact_body_keys=["password", password_field],
            timeout=10.0,
        )
    except Exception as e:
        auth_logger.warning(f"Login failed (connection error): merchant={payload.merchant_id}, email={payload.email}, err={e}")
        raise HTTPException(status_code=401, detail="invalid_credentials")

    if resp.status_code != 200:
        auth_logger.warning(f"Login failed (merchant returned {resp.status_code}): merchant={payload.merchant_id}, email={payload.email}")
        raise HTTPException(status_code=401, detail="invalid_credentials")

    merchant_data = resp.json()

    # Extract token
    try:
        merchant_token = extract_by_path(merchant_data, token_path)
    except HTTPException:
        auth_logger.warning(f"Login failed (shape mismatch): merchant={payload.merchant_id}, token_path={token_path}")
        raise
    except Exception:
        auth_logger.warning(f"Login failed (shape mismatch): merchant={payload.merchant_id}, token_path={token_path}")
        raise HTTPException(status_code=502, detail="merchant_response_shape_mismatch")

    if not merchant_token:
        auth_logger.warning(f"Login failed (empty token): merchant={payload.merchant_id}, token_path={token_path}")
        raise HTTPException(status_code=502, detail="merchant_response_shape_mismatch")

    # Extract customer reference
    customer_ref = (
        get_value_by_path(merchant_data, "user_id") or
        get_value_by_path(merchant_data, "id") or
        get_value_by_path(merchant_data, "customer_id") or
        get_value_by_path(merchant_data, "user.id") or
        get_value_by_path(merchant_data, "customer.id") or
        get_value_by_path(merchant_data, "data.user_id") or
        get_value_by_path(merchant_data, "data.id")
    )
    if not customer_ref:
        customer_ref = payload.email
    else:
        customer_ref = str(customer_ref)

    # 4. Resolve session expiry and create session
    expires_at = resolve_session_expiry(merchant_token, merchant_data)

    session = MerchantUserSession(
        merchant_id=payload.merchant_id,
        customer_ref=customer_ref,
        email=payload.email,
        merchant_token_encrypted=encrypt_merchant_token(merchant_token),
        expires_at=expires_at,
    )
    db.add(session)
    db.commit()
    db.refresh(session)
    auth_logger.info(f"Login successful: merchant={payload.merchant_id}, customer={customer_ref}")

    # 5. Encode our JWT
    our_jwt = jwt.encode(
        {
            "sub": str(session.id),
            "merchant_id": str(payload.merchant_id),
            "customer_ref": customer_ref,
            "iat": int(datetime.now(timezone.utc).timestamp()),
            "exp": int(expires_at.timestamp()),
        },
        settings.JWT_SECRET,
        algorithm="HS256",
    )

    return LoginResponse(token=our_jwt, expires_at=expires_at)




@router.post("/conversations")
def create_conversation(
    session: dict = Depends(get_current_session),
    db: Session = Depends(get_db)
):
    """
    Creates a new conversation for the authenticated customer.
    """
    merchant_id = session["merchant_id"]
    user_email = session["customer_ref"]

    convo = Conversation(
        merchant_id=merchant_id,
        user_email=user_email
    )
    db.add(convo)
    db.commit()
    db.refresh(convo)

    return {"conversation_id": convo.id}


@router.post("/auth/logout")
def logout(
    session: dict = Depends(get_current_session),
    db: Session = Depends(get_db)
):
    """
    Customer Logout for the Agentic module.
    Deletes the customer's session row in the database, invalidating it server-side.
    """
    row = db.query(MerchantUserSession).filter(MerchantUserSession.id == session["session_id"]).first()
    if row:
        db.delete(row)
        db.commit()
    return {"status": "success"}


@router.get("/conversations/{conversation_id}/messages", response_model=MessageListResponse)
def get_conversation_messages(
    conversation_id: str,
    session: dict = Depends(get_current_session),
    db: Session = Depends(get_db)
):
    """
    Fetches the history of messages for a conversation, ordered chronologically.
    Verifies that the conversation belongs to the authenticated customer session.
    """
    convo = db.query(Conversation).filter(
        Conversation.id == conversation_id
    ).first()
    
    if not convo:
        raise HTTPException(status_code=404, detail="conversation_not_found")
        
    if convo.user_email != session["customer_ref"] or convo.merchant_id != session["merchant_id"]:
        raise HTTPException(status_code=404, detail="conversation_not_found")

    messages = db.query(ConversationMessage).filter(
        ConversationMessage.conversation_id == conversation_id
    ).order_by(ConversationMessage.created_at.asc()).all()

    messages_data = []
    for m in messages:
        messages_data.append({
            "message_id": m.message_id,
            "conversation_id": m.conversation_id,
            "sender": m.sender,
            "message": m.message,
            "created_at": m.created_at,
            "products": m.msg_metadata.get("products") if m.msg_metadata else None,
            "metadata": m.msg_metadata if m.msg_metadata else None
        })

    return {
        "title": convo.title,
        "messages": messages_data
    }


@router.post("/conversations/{conversation_id}/messages")
async def send_message(
    conversation_id: str,
    payload: SendMessageRequest,
    session: dict = Depends(get_current_session),
    db: Session = Depends(get_db)
):
    """
    Accepts a user message, stores it in database, and streams status stages
    followed by the final generated assistant response (NDJSON).
    """
    convo = db.query(Conversation).filter(
        Conversation.id == conversation_id
    ).first()
    
    if not convo:
        raise HTTPException(status_code=404, detail="conversation_not_found")
        
    if convo.user_email != session["customer_ref"] or convo.merchant_id != session["merchant_id"]:
        raise HTTPException(status_code=404, detail="conversation_not_found")

    return StreamingResponse(
        message_event_stream(conversation_id, payload.message, session, db),
        media_type="application/x-ndjson"
    )



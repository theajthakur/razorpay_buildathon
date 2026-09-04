from sqlalchemy.orm import Session
from app.system.models import Onboarding
from vertexai.generative_models import FunctionDeclaration, Tool

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
    "retry_payment": "retrying_payment",
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
    "retrying_payment": "Retrying payment…",
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
        "MUST be called to place an order and generate the Razorpay payment checkout card when the customer "
        "confirms purchase or says 'yes', 'proceed', 'confirm', or 'buy now'. "
        "address_id can be a real address ID, an alias ('a1', '1'), or 'default'/'home'. "
        "Do NOT reply with text saying an order is placed without executing this function!"
    ),
    parameters={
        "type": "object",
        "properties": {
            "address_id": {"type": "string", "description": "Address ID, alias ('a1', 'a2', '1'), or label from saved addresses (e.g. 'default')."},
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

retry_payment_func = FunctionDeclaration(
    name="retry_payment",
    description=(
        "Retry payment for an existing agent order when the previous payment attempt failed "
        "or is awaiting payment. Use this when the customer asks to retry payment, try paying again, "
        "or pay for an existing order. Do NOT call create_order again for a failed payment."
    ),
    parameters={
        "type": "object",
        "properties": {
            "agent_order_id": {
                "type": "string",
                "description": "Optional agent_order_id to retry payment for. If omitted, retries the latest unpaid or failed order.",
            },
        },
        "required": [],
    },
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
        retry_payment_func,
    ]

    if onboarding and onboarding.addresses_config and isinstance(onboarding.addresses_config, dict):
        if onboarding.addresses_config.get("supports_creation"):
            function_declarations.append(create_address_func)

    if onboarding and onboarding.order_history_config and isinstance(onboarding.order_history_config, dict) and onboarding.order_history_config.get("path"):
        function_declarations.append(get_order_history_func)

    if onboarding and onboarding.customer_profile_config and isinstance(onboarding.customer_profile_config, dict) and onboarding.customer_profile_config.get("path"):
        function_declarations.append(get_customer_profile_func)

    return Tool(function_declarations=function_declarations)

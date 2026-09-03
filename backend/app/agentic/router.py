"""
Agentic module router entrypoint.
Aggregates sub-routers from app.agentic.routes and re-exports symbols to maintain
100% backward compatibility for imports and monkeypatches across test suites.
"""

from app.core.logging_config import get_logger
# pyrefly: ignore [missing-import]
import vertexai
# pyrefly: ignore [missing-import]
from vertexai.generative_models import GenerativeModel

# Loggers
agent_logger = get_logger("agent")
cart_logger = get_logger("cart")
orders_logger = get_logger("orders")
auth_logger = get_logger("auth")
webhook_logger = get_logger("webhook")

# Routes & Master APIRouters
from app.agentic.routes import router, public_router
from app.agentic.routes.auth import get_public_branding, login, logout
from app.agentic.routes.conversations import list_conversations, create_conversation, get_conversation_messages
from app.agentic.routes.chat import send_message
from app.agentic.routes.payment import get_cart, verify_payment, retry_payment_endpoint

# Schemas
from app.agentic.schemas import (
    LoginRequest,
    LoginResponse,
    MessageSenderEnum,
    MessageCreateRequest,
    ProductSchema,
    MessageResponse,
    MessageListResponse,
    ConversationListEntry,
    ConversationListResponse,
    SendMessageRequest,
    AgentStage,
    CartItemResponse,
    CartResponse,
    VerifyPaymentRequest,
    RetryPaymentApiRequest,
)

# Tools execution
from app.agentic.tools import (
    FIELD_CANDIDATES,
    _pick,
    execute_search_products,
    MAX_CART_ITEMS,
    MAX_LINE_QUANTITY,
    execute_add_to_cart,
    execute_get_cart_items,
    execute_update_cart_item,
    execute_remove_from_cart,
    ADDRESS_FIELD_CANDIDATES,
    ADDRESS_CONCEPT_ORDER,
    resolve_address,
    execute_fetch_addresses,
    execute_create_address,
    ORDER_FIELD_CANDIDATES,
    execute_create_order,
    execute_get_order_history,
    PROFILE_FIELD_CANDIDATES,
    execute_get_customer_profile,
)

# Dependencies & Settings
from app.core.config import get_settings
from app.agentic.deps import get_merchant_auth_headers, get_current_session, get_merchant_token

# Services
from app.agentic.services import (
    hydrate_payment_metadata,
    execute_retry_payment,
    send_merchant_webhook,
    set_conversation_title,
    maybe_generate_initial_title,
    call_merchant_api,
    resolve_merchant_by_host,
)

# LLM & Orchestration
from app.agentic.llm import (
    build_system_instruction,
    TOOL_TO_STAGE,
    STAGE_LABELS,
    get_status_payload,
    search_products_func,
    create_conversation_title_func,
    add_to_cart_func,
    get_cart_func,
    update_cart_item_func,
    remove_from_cart_func,
    fetch_addresses_func,
    create_address_func,
    create_order_func,
    get_order_history_func,
    get_customer_profile_func,
    retry_payment_func,
    build_tools_for_merchant,
    _extract_function_call,
    message_event_stream,
)

__all__ = [
    "router",
    "public_router",
    "agent_logger",
    "cart_logger",
    "orders_logger",
    "auth_logger",
    "webhook_logger",
    "vertexai",
    "GenerativeModel",
    "get_public_branding",
    "login",
    "logout",
    "list_conversations",
    "create_conversation",
    "get_conversation_messages",
    "send_message",
    "get_cart",
    "verify_payment",
    "retry_payment_endpoint",
    "LoginRequest",
    "LoginResponse",
    "MessageSenderEnum",
    "MessageCreateRequest",
    "ProductSchema",
    "MessageResponse",
    "MessageListResponse",
    "ConversationListEntry",
    "ConversationListResponse",
    "SendMessageRequest",
    "AgentStage",
    "CartItemResponse",
    "CartResponse",
    "VerifyPaymentRequest",
    "RetryPaymentApiRequest",
    "FIELD_CANDIDATES",
    "_pick",
    "execute_search_products",
    "MAX_CART_ITEMS",
    "MAX_LINE_QUANTITY",
    "execute_add_to_cart",
    "execute_get_cart_items",
    "execute_update_cart_item",
    "execute_remove_from_cart",
    "ADDRESS_FIELD_CANDIDATES",
    "ADDRESS_CONCEPT_ORDER",
    "resolve_address",
    "execute_fetch_addresses",
    "execute_create_address",
    "ORDER_FIELD_CANDIDATES",
    "execute_create_order",
    "execute_get_order_history",
    "PROFILE_FIELD_CANDIDATES",
    "execute_get_customer_profile",
    "hydrate_payment_metadata",
    "execute_retry_payment",
    "send_merchant_webhook",
    "set_conversation_title",
    "maybe_generate_initial_title",
    "call_merchant_api",
    "resolve_merchant_by_host",
    "get_settings",
    "get_merchant_auth_headers",
    "get_current_session",
    "get_merchant_token",
    "build_system_instruction",
    "TOOL_TO_STAGE",
    "STAGE_LABELS",
    "get_status_payload",
    "search_products_func",
    "create_conversation_title_func",
    "add_to_cart_func",
    "get_cart_func",
    "update_cart_item_func",
    "remove_from_cart_func",
    "fetch_addresses_func",
    "create_address_func",
    "create_order_func",
    "get_order_history_func",
    "get_customer_profile_func",
    "retry_payment_func",
    "build_tools_for_merchant",
    "_extract_function_call",
    "message_event_stream",
]

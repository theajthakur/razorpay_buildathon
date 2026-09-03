import sys
from sqlalchemy.orm import Session
from app.system.models import Onboarding, CartItem, AgentOrder, AgentOrderStatus
from app.core.config import get_settings as default_get_settings
from app.agentic.field_mappings import extract_order_history
from app.agentic.deps import get_merchant_auth_headers as default_get_merchant_auth_headers
from app.agentic.merchant_api import call_merchant_api as default_call_merchant_api
from app.agentic.tools.addresses import execute_fetch_addresses as default_execute_fetch_addresses, resolve_address
from app.core.logging_config import get_logger

default_agent_logger = get_logger("agent")
default_orders_logger = get_logger("orders")

def _getattr(name, default):
    mod = sys.modules.get("app.agentic.router")
    return getattr(mod, name, default) if mod else default

ORDER_FIELD_CANDIDATES = {
    "order_id": ["order_id", "id", "_id"],
    "status": ["status", "order_status"],
    "total": ["total", "amount", "order_total"],
    "created_at": ["created_at", "date", "placed_at"],
    "items": ["items", "products", "line_items"],
}

async def execute_create_order(merchant_id: str, session: dict, conversation_id: str, args: dict, db: Session) -> dict:
    customer_email = session["customer_ref"]
    orders_logger = _getattr("orders_logger", default_orders_logger)
    execute_fetch_addresses = _getattr("execute_fetch_addresses", default_execute_fetch_addresses)
    call_merchant_api = _getattr("call_merchant_api", default_call_merchant_api)
    get_settings = _getattr("get_settings", default_get_settings)
    get_merchant_auth_headers = _getattr("get_merchant_auth_headers", default_get_merchant_auth_headers)

    orders_logger.info(f"Checkout initiated: merchant={merchant_id}, customer={customer_email}")

    # 1. Load cart items
    cart_items = db.query(CartItem).filter(
        CartItem.merchant_id == merchant_id,
        CartItem.customer_email == customer_email
    ).order_by(CartItem.created_at.asc()).all()

    if not cart_items:
        orders_logger.warning(f"Checkout aborted (cart empty): merchant={merchant_id}, customer={customer_email}")
        return {"error": "cart_empty", "message": "Your cart is empty. Please add products before checking out."}

    # 2. ALWAYS fetch real addresses here — unconditionally
    address_result = await execute_fetch_addresses(merchant_id, session, db)
    raw_addresses = address_result.get("addresses", [])

    supplied_id = str(args.get("address_id", "")).strip()
    selected_address = resolve_address(supplied_id, raw_addresses)

    if not selected_address:
        orders_logger.warning(
            f"create_order: address_id='{supplied_id}' could not be matched among "
            f"{len(raw_addresses)} real addresses for customer={customer_email} — "
            f"rejecting before any merchant API call."
        )
        return {
            "error": "invalid_address",
            "message": (
                "I couldn't match that to one of your saved addresses. "
                "Here are your saved addresses — please tell me which one to use."
            ),
            "addresses": raw_addresses,
        }

    real_address_id = selected_address["id"]
    orders_logger.info(
        f"create_order: address resolved — supplied='{supplied_id}', "
        f"matched real_id='{real_address_id}' ({selected_address.get('city', '?')})"
    )

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
        address_id_field: real_address_id
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
    key_id = settings.razorpay_key_id
    key_secret = settings.razorpay_key_secret

    if not key_id or not key_secret:
        err_msg = f"Razorpay order creation FAILED for agent_order_id={agent_order.id}: Missing Razorpay API credentials (RAZORPAY_KEY_ID / RAZORPAY_KEY_SECRET)"
        orders_logger.error(err_msg)
        agent_order.status = AgentOrderStatus.FAILED.value
        agent_order.failure_reason = "razorpay_error: Missing Razorpay API credentials"
        db.commit()
        return {
            "error": "payment_initiation_failed",
            "message": "I placed your order with the store, but I'm having trouble setting up payment right now. Please try again in a moment, or contact support — your order isn't lost.",
            "agent_order_id": agent_order.id,
            "merchant_order_id": merchant_order_id
        }

    try:
        import razorpay
        rzp_client = razorpay.Client(auth=(key_id, key_secret))
        rzp_order = rzp_client.order.create(data={
            "amount": int(round(order_total * 100)),
            "currency": currency,
            "receipt": str(agent_order.id),
            "notes": {
                "agent_order_id": str(agent_order.id),
                "merchant_order_id": str(merchant_order_id),
                "merchant_id": str(merchant_id)
            }
        })
        razorpay_order_id = rzp_order.get("id")
        if not razorpay_order_id:
            raise ValueError("Razorpay client returned response without order id")
    except Exception as e:
        err_msg = f"Razorpay order creation FAILED for agent_order_id={agent_order.id}: {e!r}"
        orders_logger.error(err_msg)
        agent_order.status = AgentOrderStatus.FAILED.value
        agent_order.failure_reason = f"razorpay_error: {e}"
        db.commit()
        return {
            "error": "payment_initiation_failed",
            "message": "I placed your order with the store, but I'm having trouble setting up payment right now. Please try again in a moment, or contact support — your order isn't lost.",
            "agent_order_id": agent_order.id,
            "merchant_order_id": merchant_order_id
        }

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
        "key_id": key_id,
        "payment_status": AgentOrderStatus.AWAITING_PAYMENT.value,
        "failure_reason": None
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


async def execute_get_order_history(merchant_id: str, session: dict, db: Session) -> dict:
    agent_logger = _getattr("agent_logger", default_agent_logger)
    get_merchant_auth_headers = _getattr("get_merchant_auth_headers", default_get_merchant_auth_headers)
    call_merchant_api = _getattr("call_merchant_api", default_call_merchant_api)

    agent_logger.info(f"Fetching order history: merchant={merchant_id}, customer={session.get('customer_ref')}")
    onboarding = db.query(Onboarding).filter(Onboarding.user_id == merchant_id).first()
    if not onboarding or not onboarding.order_history_config:
        agent_logger.warning(f"Order history fetch aborted: onboarding config missing for merchant={merchant_id}")
        return {"error": "onboarding_config_not_found", "orders": [], "count": 0}

    config = onboarding.order_history_config
    path = config.get("path", "")
    method = (config.get("method") or "GET").upper()

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
    extracted_items = extract_order_history(json_data, config)

    orders = []
    for item in extracted_items:
        if not isinstance(item, dict):
            continue
        order_data = dict(item)
        if "id" in order_data and "order_id" not in order_data:
            order_data["order_id"] = str(order_data["id"])
        elif "order_id" in order_data and "id" not in order_data:
            order_data["id"] = str(order_data["order_id"])
        orders.append(order_data)

    agent_logger.info(f"Order history fetched: merchant={merchant_id}, count={len(orders)}")
    return {"orders": orders, "count": len(orders)}

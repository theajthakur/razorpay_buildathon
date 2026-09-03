import sys
import asyncio
import httpx
from typing import Optional
from sqlalchemy.orm import Session
from app.system.models import Onboarding, AgentOrder, AgentOrderStatus
from app.core.config import get_settings as default_get_settings
from app.system.service import extract_relative_path
from app.core.logging_config import get_logger

default_orders_logger = get_logger("orders")
default_webhook_logger = get_logger("webhook")

def _getattr(name, default):
    mod = sys.modules.get("app.agentic.router")
    return getattr(mod, name, default) if mod else default

def hydrate_payment_metadata(metadata: Optional[dict], db: Session) -> Optional[dict]:
    """
    Hydrates message metadata with authoritative DB payment state so historical
    messages reflect the current order/payment status instead of stale initiation actions.
    """
    if not metadata or not isinstance(metadata, dict):
        return metadata

    agent_order_id = metadata.get("agent_order_id")
    razorpay_order_id = metadata.get("razorpay_order_id")
    merchant_order_id = metadata.get("merchant_order_id")

    order = None
    if agent_order_id:
        order = db.query(AgentOrder).filter(AgentOrder.id == agent_order_id).first()
    elif razorpay_order_id:
        order = db.query(AgentOrder).filter(AgentOrder.razorpay_order_id == razorpay_order_id).first()
    elif merchant_order_id:
        order = db.query(AgentOrder).filter(AgentOrder.merchant_order_id == merchant_order_id).order_by(AgentOrder.created_at.desc()).first()

    if not order:
        return metadata

    get_settings = _getattr("get_settings", default_get_settings)
    settings = get_settings()
    key_id = settings.razorpay_key_id or metadata.get("key_id", "")

    hydrated = dict(metadata)
    hydrated["agent_order_id"] = order.id
    if order.merchant_order_id:
        hydrated["merchant_order_id"] = order.merchant_order_id
    if order.razorpay_order_id:
        hydrated["razorpay_order_id"] = order.razorpay_order_id
    hydrated["payment_status"] = order.status
    hydrated["failure_reason"] = order.failure_reason
    if order.razorpay_payment_id:
        hydrated["razorpay_payment_id"] = order.razorpay_payment_id
        hydrated["payment_id"] = order.razorpay_payment_id
    if order.order_total is not None:
        hydrated["amount"] = float(order.order_total)
    hydrated["currency"] = order.currency or metadata.get("currency", "INR")
    if key_id:
        hydrated["key_id"] = key_id

    return hydrated


async def execute_retry_payment(
    merchant_id: str,
    session: dict,
    conversation_id: str,
    args: dict,
    db: Session
) -> dict:
    """
    Retries payment for an existing AgentOrder.
    Operates against existing order record; does not create a duplicate merchant order.
    """
    customer_email = session["customer_ref"]
    agent_order_id = args.get("agent_order_id")
    orders_logger = _getattr("orders_logger", default_orders_logger)
    get_settings = _getattr("get_settings", default_get_settings)

    query = db.query(AgentOrder).filter(
        AgentOrder.merchant_id == merchant_id,
        AgentOrder.customer_ref == customer_email
    )
    if agent_order_id:
        order = query.filter(AgentOrder.id == agent_order_id).first()
    else:
        if conversation_id:
            order = query.filter(AgentOrder.conversation_id == conversation_id).order_by(AgentOrder.created_at.desc()).first()
        if not order:
            order = query.order_by(AgentOrder.created_at.desc()).first()

    if not order:
        orders_logger.warning(f"retry_payment: no AgentOrder found for merchant={merchant_id}, customer={customer_email}")
        return {
            "error": "order_not_found",
            "message": "No existing order found to retry payment for."
        }

    settings = get_settings()
    key_id = settings.razorpay_key_id
    key_secret = settings.razorpay_key_secret

    # Check 1: Already completed (Idempotency)
    if order.status == AgentOrderStatus.PAYMENT_CAPTURED.value:
        payment_meta = {
            "action": "initiate_payment",
            "agent_order_id": order.id,
            "merchant_order_id": order.merchant_order_id,
            "razorpay_order_id": order.razorpay_order_id,
            "razorpay_payment_id": order.razorpay_payment_id,
            "payment_id": order.razorpay_payment_id,
            "amount": float(order.order_total) if order.order_total is not None else 0.0,
            "currency": order.currency,
            "key_id": key_id,
            "payment_status": AgentOrderStatus.PAYMENT_CAPTURED.value,
            "failure_reason": None
        }
        return {
            "status": "already_completed",
            "payment_status": AgentOrderStatus.PAYMENT_CAPTURED.value,
            "payment_metadata": payment_meta,
            "message": "Payment for this order has already been completed."
        }

    # Check 2: Currently awaiting payment with valid Razorpay order
    if order.status == AgentOrderStatus.AWAITING_PAYMENT.value and order.razorpay_order_id:
        payment_meta = {
            "action": "initiate_payment",
            "agent_order_id": order.id,
            "merchant_order_id": order.merchant_order_id,
            "razorpay_order_id": order.razorpay_order_id,
            "amount": float(order.order_total) if order.order_total is not None else 0.0,
            "currency": order.currency,
            "key_id": key_id,
            "payment_status": AgentOrderStatus.AWAITING_PAYMENT.value,
            "failure_reason": None
        }
        return {
            "status": "awaiting_payment",
            "payment_status": AgentOrderStatus.AWAITING_PAYMENT.value,
            "payment_metadata": payment_meta,
            "message": "Payment is pending for your order. Please complete payment below."
        }

    # Check 3: Failed or missing Razorpay order -> recreate Razorpay order
    if not key_id or not key_secret:
        orders_logger.error(f"retry_payment FAILED: Razorpay credentials missing for order {order.id}")
        return {
            "error": "payment_initiation_failed",
            "message": "Payment system credentials are not configured. Unable to retry payment."
        }

    order_total = float(order.order_total) if order.order_total is not None else 0.0
    currency = order.currency or "INR"

    try:
        import razorpay
        rzp_client = razorpay.Client(auth=(key_id, key_secret))
        rzp_order = rzp_client.order.create(data={
            "amount": int(round(order_total * 100)),
            "currency": currency,
            "receipt": str(order.id),
            "notes": {
                "agent_order_id": str(order.id),
                "merchant_order_id": str(order.merchant_order_id),
                "merchant_id": str(merchant_id),
                "is_retry": "true"
            }
        })
        new_rzp_id = rzp_order.get("id")
        if not new_rzp_id:
            raise ValueError("Razorpay client returned response without order id")
    except Exception as e:
        orders_logger.error(f"Razorpay retry order creation failed for order={order.id}: {e}")
        order.status = AgentOrderStatus.FAILED.value
        order.failure_reason = f"retry_razorpay_error: {e}"
        db.commit()
        return {
            "error": "payment_retry_failed",
            "message": f"Could not set up payment retry: {e}"
        }

    order.razorpay_order_id = new_rzp_id
    order.status = AgentOrderStatus.AWAITING_PAYMENT.value
    order.failure_reason = None
    db.commit()
    orders_logger.info(f"Payment retry initiated: agent_order_id={order.id}, razorpay_order_id={new_rzp_id}")

    payment_meta = {
        "action": "initiate_payment",
        "agent_order_id": order.id,
        "merchant_order_id": order.merchant_order_id,
        "razorpay_order_id": new_rzp_id,
        "amount": order_total,
        "currency": currency,
        "key_id": key_id,
        "payment_status": AgentOrderStatus.AWAITING_PAYMENT.value,
        "failure_reason": None
    }
    return {
        "status": "payment_reinitiated",
        "payment_status": AgentOrderStatus.AWAITING_PAYMENT.value,
        "payment_metadata": payment_meta,
        "message": "Payment has been re-initiated! Please click Pay Now to complete your purchase."
    }


async def send_merchant_webhook(
    merchant_id: str,
    event: str,
    event_id: str,
    merchant_order_id: str,
    db: Session
) -> bool:
    webhook_logger = _getattr("webhook_logger", default_webhook_logger)
    onboarding = db.query(Onboarding).filter(Onboarding.user_id == merchant_id).first()
    if not onboarding or not onboarding.base_url:
        webhook_logger.warning(f"send_merchant_webhook aborted: merchant={merchant_id} onboarding/base_url not found")
        return False

    webhook_path = onboarding.webhook_path or extract_relative_path(onboarding.webhook_url or "", onboarding.base_url) or "webhook/merchant-os"
    
    if webhook_path.startswith(("http://", "https://")):
        target_url = webhook_path
    else:
        target_url = f"{onboarding.base_url.rstrip('/')}/{webhook_path.lstrip('/')}"

    payload = {
        "event": event,
        "event_id": event_id,
        "merchant_order_id": merchant_order_id
    }

    headers = {
        "User-Agent": "ShopAgent-API-Agent/1.0",
        "Content-Type": "application/json",
        "Accept": "application/json"
    }

    max_retries = 3
    for attempt in range(1, max_retries + 1):
        try:
            async with httpx.AsyncClient(timeout=10.0, follow_redirects=True) as client:
                resp = await client.post(target_url, json=payload, headers=headers)
                if 200 <= resp.status_code < 300:
                    webhook_logger.info(
                        f"Merchant webhook delivered: merchant={merchant_id}, event={event}, "
                        f"event_id={event_id}, status_code={resp.status_code}, attempt={attempt}"
                    )
                    return True
                else:
                    webhook_logger.warning(
                        f"Merchant webhook failed: merchant={merchant_id}, status_code={resp.status_code}, "
                        f"attempt={attempt}/{max_retries}"
                    )
        except Exception as e:
            webhook_logger.error(
                f"Merchant webhook dispatch exception: merchant={merchant_id}, error={e!r}, "
                f"attempt={attempt}/{max_retries}"
            )
        if attempt < max_retries:
            await asyncio.sleep(0.5 * attempt)

    return False

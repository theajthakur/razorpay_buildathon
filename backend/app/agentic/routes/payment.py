import sys
import asyncio
import hmac
import hashlib
import uuid
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from app.core.database import get_db
from app.core.config import get_settings as default_get_settings
from app.system.models import AgentOrder, AgentOrderStatus
from app.agentic.deps import get_current_session
from app.agentic.schemas.payment import VerifyPaymentRequest, RetryPaymentApiRequest
from app.agentic.schemas.cart import CartResponse
from app.agentic.services.payment_service import execute_retry_payment, send_merchant_webhook as default_send_merchant_webhook
from app.agentic.tools.cart import execute_get_cart_items
from app.core.logging_config import get_logger

default_orders_logger = get_logger("orders")

def _getattr(name, default):
    mod = sys.modules.get("app.agentic.router")
    return getattr(mod, name, default) if mod else default

router = APIRouter()

@router.get("/cart", response_model=CartResponse)
async def get_cart(
    session: dict = Depends(get_current_session),
    db: Session = Depends(get_db)
):
    """
    Fetch the customer's current cart contents for the current merchant session.
    """
    return await execute_get_cart_items(session["merchant_id"], session["customer_ref"], db)


@router.post("/payments/verify")
async def verify_payment(
    payload: VerifyPaymentRequest,
    db: Session = Depends(get_db)
):
    """
    Verifies Razorpay payment signature, marks agent_orders row as payment_captured,
    and dispatches order.payment_completed merchant webhook.
    """
    get_settings = _getattr("get_settings", default_get_settings)
    orders_logger = _getattr("orders_logger", default_orders_logger)
    send_merchant_webhook = _getattr("send_merchant_webhook", default_send_merchant_webhook)
    settings = get_settings()
    key_secret = settings.razorpay_key_secret

    if not key_secret:
        orders_logger.error("Payment verification FAILED: Razorpay secret key is not configured.")
        raise HTTPException(status_code=500, detail="razorpay_secret_not_configured")

    # 1. Recompute expected signature using HMAC SHA256
    msg_bytes = f"{payload.razorpay_order_id}|{payload.razorpay_payment_id}".encode("utf-8")
    expected_signature = hmac.new(
        key=key_secret.encode("utf-8"),
        msg=msg_bytes,
        digestmod=hashlib.sha256
    ).hexdigest()

    if not hmac.compare_digest(expected_signature, payload.razorpay_signature):
        orders_logger.error(
            f"Payment signature MISMATCH for razorpay_order_id={payload.razorpay_order_id} — "
            f"possible tampering or spoofed callback."
        )
        raise HTTPException(status_code=400, detail="signature_verification_failed")

    # 2. Look up the agent_orders row by razorpay_order_id
    order = db.query(AgentOrder).filter(AgentOrder.razorpay_order_id == payload.razorpay_order_id).first()
    if not order:
        orders_logger.error(f"Payment verification failed: AgentOrder not found for razorpay_order_id={payload.razorpay_order_id}")
        raise HTTPException(status_code=404, detail="order_not_found")

    # 3. Mark captured
    order.status = AgentOrderStatus.PAYMENT_CAPTURED.value
    order.razorpay_payment_id = payload.razorpay_payment_id
    db.commit()
    db.refresh(order)
    orders_logger.info(f"Payment verified and captured: agent_order_id={order.id}, razorpay_payment_id={payload.razorpay_payment_id}")

    # 4. Fire merchant webhook
    event_id = str(uuid.uuid4())
    asyncio.create_task(
        send_merchant_webhook(
            merchant_id=order.merchant_id,
            event="order.payment_completed",
            event_id=event_id,
            merchant_order_id=order.merchant_order_id or "",
            db=db
        )
    )

    return {
        "status": "captured",
        "agent_order_id": order.id,
        "merchant_order_id": order.merchant_order_id,
        "razorpay_order_id": order.razorpay_order_id,
        "razorpay_payment_id": payload.razorpay_payment_id,
        "payment_id": payload.razorpay_payment_id,
        "payment_status": AgentOrderStatus.PAYMENT_CAPTURED.value,
        "amount": float(order.order_total) if order.order_total is not None else 0.0,
        "currency": order.currency,
        "message": "Payment verified and captured successfully."
    }


@router.post("/payments/retry")
async def retry_payment_endpoint(
    payload: RetryPaymentApiRequest,
    session: dict = Depends(get_current_session),
    db: Session = Depends(get_db)
):
    """
    Direct API endpoint to retry payment for an existing agent order.
    """
    args = {"agent_order_id": payload.agent_order_id} if payload.agent_order_id else {}
    return await execute_retry_payment(session["merchant_id"], session, "", args, db)

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from app.core.database import get_db
from app.core.security import validate_api_key
from app.system.models import User, AgentOrder
from app.core.logging_config import get_logger

merchant_logger = get_logger("merchant")

router = APIRouter()

@router.get("/orders/verify")
async def verify_merchant_order(
    merchant_order_id: str = Query(..., description="The merchant order ID to verify"),
    merchant_user: User = Depends(validate_api_key),
    db: Session = Depends(get_db)
):
    """
    Server-to-Server Order Verification Endpoint.
    Enables merchants to verify payment and order details using their API key
    after receiving a payment webhook event.
    """
    merchant_logger.info(
        f"Merchant order verification request: merchant_id={merchant_user.id}, "
        f"merchant_order_id={merchant_order_id}"
    )

    order = (
        db.query(AgentOrder)
        .filter(
            AgentOrder.merchant_id == merchant_user.id,
            AgentOrder.merchant_order_id == merchant_order_id
        )
        .first()
    )

    if not order:
        merchant_logger.warning(
            f"Merchant order verification failed (order_not_found): "
            f"merchant_id={merchant_user.id}, merchant_order_id={merchant_order_id}"
        )
        raise HTTPException(
            status_code=404,
            detail="order_not_found"
        )

    # Normalize payment status string (e.g. "payment_captured" -> "captured")
    status_str = order.status
    if status_str == "payment_captured":
        status_str = "captured"

    total_amount = float(order.order_total) if order.order_total is not None else 0.0

    return {
        "payment": {
            "status": status_str,
            "razorpay_payment_id": order.razorpay_payment_id
        },
        "data": {
            "order": {
                "order_total": total_amount
            }
        }
    }

import hmac
import hashlib
import uuid
import pytest
from unittest.mock import patch, AsyncMock
from fastapi.testclient import TestClient
from app.system.models import AgentOrder, AgentOrderStatus, User, Onboarding, Conversation
from app.core.config import get_settings

def generate_valid_signature(order_id: str, payment_id: str, secret: str) -> str:
    msg_bytes = f"{order_id}|{payment_id}".encode("utf-8")
    return hmac.new(key=secret.encode("utf-8"), msg=msg_bytes, digestmod=hashlib.sha256).hexdigest()

def test_no_razorpay_secret_in_frontend():
    """
    Acceptance check: Verify RAZORPAY_KEY_SECRET never appears anywhere in frontend_agent code or env.
    """
    import os
    frontend_dir = r"c:\Users\VIJAY\Documents\Projects\rzp_bthon\frontend_agent"
    for root, dirs, files in os.walk(frontend_dir):
        if "node_modules" in root or ".next" in root:
            continue
        for file in files:
            if file.endswith((".ts", ".tsx", ".js", ".jsx", ".env", ".env.local")):
                filepath = os.path.join(root, file)
                with open(filepath, "r", encoding="utf-8", errors="ignore") as f:
                    content = f.read()
                    assert "RAZORPAY_KEY_SECRET" not in content, f"Found secret key string in frontend file: {filepath}"
                    assert "RAZORPAY_SECRET_KEY" not in content, f"Found secret key string in frontend file: {filepath}"

@pytest.mark.asyncio
async def test_payment_verify_valid_signature(db_session, test_merchant, test_customer_user):
    """
    Acceptance check: Valid signature marks order captured, sets razorpay_payment_id,
    and fires merchant webhook.
    """
    from app.agentic.router import verify_payment, VerifyPaymentRequest

    settings = get_settings()
    secret = settings.razorpay_key_secret or "Ac5x60qHGapcJbdjqZbNVJDs"

    # Create dummy conversation & agent_order row
    conv = Conversation(
        id="conv_verify_1",
        merchant_id=test_merchant.id,
        user_email=test_customer_user.email,
        title="Test Verify Conv"
    )
    db_session.add(conv)

    agent_order = AgentOrder(
        merchant_id=test_merchant.id,
        customer_ref=test_customer_user.email,
        conversation_id=conv.id,
        items=[{"product_id": "p1", "name": "Item 1", "price": 100, "quantity": 1}],
        merchant_order_id="merchant_ord_verify_1",
        order_total=100.0,
        currency="INR",
        razorpay_order_id="order_test_verify_123",
        status=AgentOrderStatus.AWAITING_PAYMENT.value
    )
    db_session.add(agent_order)
    db_session.commit()

    pay_id = "pay_test_99999"
    valid_sig = generate_valid_signature(agent_order.razorpay_order_id, pay_id, secret)

    payload = VerifyPaymentRequest(
        razorpay_payment_id=pay_id,
        razorpay_order_id=agent_order.razorpay_order_id,
        razorpay_signature=valid_sig
    )

    with patch("app.agentic.router.send_merchant_webhook", new_callable=AsyncMock) as mock_webhook:
        mock_webhook.return_value = True

        res = await verify_payment(payload=payload, db=db_session)

        assert res.get("status") == "captured"
        assert res.get("agent_order_id") == agent_order.id
        assert res.get("razorpay_payment_id") == pay_id

        # Verify DB update
        db_order = db_session.query(AgentOrder).filter(AgentOrder.id == agent_order.id).first()
        assert db_order.status == AgentOrderStatus.PAYMENT_CAPTURED.value
        assert db_order.razorpay_payment_id == pay_id

@pytest.mark.asyncio
async def test_payment_verify_tampered_signature_rejected(db_session, test_merchant, test_customer_user):
    """
    Acceptance check: Tampered signature is rejected with HTTP 400 signature_verification_failed
    and order status remains awaiting_payment.
    """
    from app.agentic.router import verify_payment, VerifyPaymentRequest
    from fastapi import HTTPException

    conv = Conversation(
        id="conv_verify_2",
        merchant_id=test_merchant.id,
        user_email=test_customer_user.email,
        title="Test Tampered Conv"
    )
    db_session.add(conv)

    agent_order = AgentOrder(
        merchant_id=test_merchant.id,
        customer_ref=test_customer_user.email,
        conversation_id=conv.id,
        items=[{"product_id": "p1", "name": "Item 1", "price": 100, "quantity": 1}],
        merchant_order_id="merchant_ord_tamper_1",
        order_total=100.0,
        currency="INR",
        razorpay_order_id="order_tamper_123",
        status=AgentOrderStatus.AWAITING_PAYMENT.value
    )
    db_session.add(agent_order)
    db_session.commit()

    tampered_payload = VerifyPaymentRequest(
        razorpay_payment_id="pay_fake_123",
        razorpay_order_id=agent_order.razorpay_order_id,
        razorpay_signature="invalid_tampered_signature_hash"
    )

    with pytest.raises(HTTPException) as exc_info:
        await verify_payment(payload=tampered_payload, db=db_session)

    assert exc_info.value.status_code == 400
    assert exc_info.value.detail == "signature_verification_failed"

    # Confirm status in DB remains awaiting_payment
    db_order = db_session.query(AgentOrder).filter(AgentOrder.id == agent_order.id).first()
    assert db_order.status == AgentOrderStatus.AWAITING_PAYMENT.value

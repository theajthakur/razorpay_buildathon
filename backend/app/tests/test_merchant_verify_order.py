import pytest
from app.system.models import AgentOrder, AgentOrderStatus, User, Conversation, APIKey
from app.core.security import hash_api_key
from app.core.config import get_settings

@pytest.mark.asyncio
async def test_merchant_order_verification_success(db_session):
    """
    Acceptance check: Valid API key + matching merchant order ID returns HTTP 200
    with status 'captured', razorpay_payment_id, and order_total.
    """
    from app.merchant.router import verify_merchant_order

    settings = get_settings()

    # Create approved test merchant user
    merchant = User(
        id="m_verify_user_1",
        email="m_verify_1@example.com",
        store_name="Verify Store 1",
        status="approved"
    )
    db_session.add(merchant)

    # Create API key record for merchant
    raw_key = "sk_test_123456abcdef"
    prefix = "123456"
    key_hash = hash_api_key(raw_key, settings.API_KEY_HMAC_SECRET)

    api_key_rec = APIKey(
        customer_id=merchant.id,
        name="Verification Key",
        key_prefix=prefix,
        key_hash=key_hash,
        status="active"
    )
    db_session.add(api_key_rec)

    # Create conversation & captured agent order
    conv = Conversation(
        id="conv_m_verify_1",
        merchant_id=merchant.id,
        user_email="customer1@example.com",
        title="Verify Order Conv"
    )
    db_session.add(conv)

    agent_order = AgentOrder(
        merchant_id=merchant.id,
        customer_ref="customer1@example.com",
        conversation_id=conv.id,
        items=[{"product_id": "p1", "name": "Shirt", "price": 500, "quantity": 1}],
        merchant_order_id="ORD-99901",
        order_total=500.0,
        currency="INR",
        razorpay_order_id="order_rzp_99901",
        razorpay_payment_id="pay_rzp_99901",
        status=AgentOrderStatus.PAYMENT_CAPTURED.value
    )
    db_session.add(agent_order)
    db_session.commit()

    # Call endpoint directly
    res = await verify_merchant_order(
        merchant_order_id="ORD-99901",
        merchant_user=merchant,
        db=db_session
    )

    assert res["payment"]["status"] == "captured"
    assert res["payment"]["razorpay_payment_id"] == "pay_rzp_99901"
    assert res["data"]["order"]["order_total"] == 500.0

@pytest.mark.asyncio
async def test_merchant_order_verification_not_found(db_session):
    """
    Acceptance check: Querying a non-existent merchant order ID raises 404 order_not_found.
    """
    from app.merchant.router import verify_merchant_order
    from fastapi import HTTPException

    merchant = User(
        id="m_verify_user_2",
        email="m_verify_2@example.com",
        store_name="Verify Store 2",
        status="approved"
    )
    db_session.add(merchant)
    db_session.commit()

    with pytest.raises(HTTPException) as exc:
        await verify_merchant_order(
            merchant_order_id="NON_EXISTENT_ORD",
            merchant_user=merchant,
            db=db_session
        )

    assert exc.value.status_code == 404
    assert exc.value.detail == "order_not_found"

@pytest.mark.asyncio
async def test_merchant_order_verification_tenant_isolation(db_session):
    """
    Acceptance check: Merchant A cannot query Merchant B's order ID (returns 404).
    """
    from app.merchant.router import verify_merchant_order
    from fastapi import HTTPException

    merchant_a = User(id="m_user_a", email="ma@example.com", store_name="Store A", status="approved")
    merchant_b = User(id="m_user_b", email="mb@example.com", store_name="Store B", status="approved")
    db_session.add_all([merchant_a, merchant_b])

    conv = Conversation(id="conv_m_b", merchant_id=merchant_b.id, user_email="c2@example.com")
    db_session.add(conv)

    # Order belongs to Merchant B
    order_b = AgentOrder(
        merchant_id=merchant_b.id,
        customer_ref="c2@example.com",
        conversation_id=conv.id,
        items=[],
        merchant_order_id="ORD-MERCHANT-B",
        order_total=750.0,
        currency="INR",
        status=AgentOrderStatus.PAYMENT_CAPTURED.value
    )
    db_session.add(order_b)
    db_session.commit()

    # Merchant A attempts to verify Merchant B's order ID
    with pytest.raises(HTTPException) as exc:
        await verify_merchant_order(
            merchant_order_id="ORD-MERCHANT-B",
            merchant_user=merchant_a,
            db=db_session
        )

    assert exc.value.status_code == 404
    assert exc.value.detail == "order_not_found"

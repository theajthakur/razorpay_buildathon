import asyncio
import pytest
from unittest.mock import patch, MagicMock, AsyncMock
from app.system.models import AgentOrder, AgentOrderStatus, CartItem, Conversation

def test_no_mock_order_id_in_codebase():
    """
    Acceptance check 1: Confirm no 'order_mock_' exists in the agentic router module.
    """
    from app.agentic import router
    import inspect
    source = inspect.getsource(router)
    assert "order_mock_" not in source, "Found leftover 'order_mock_' string in router.py!"

@pytest.mark.asyncio
async def test_razorpay_order_creation_failure_marks_order_failed(db_session, test_merchant, test_customer_user):
    """
    Acceptance check 2: Reproducing a Razorpay auth failure results in:
    - agent_orders row marked 'failed' with failure_reason='razorpay_error: ...'
    - ERROR log captured
    - Clear customer-facing error response
    """
    from app.agentic.router import execute_create_order

    # Populate dummy conversation
    conv = Conversation(
        id="conv_123",
        merchant_id=test_merchant.id,
        user_email=test_customer_user.email,
        title="Test Conversation"
    )
    db_session.add(conv)

    # Populate dummy cart item
    cart_item = CartItem(
        merchant_id=test_merchant.id,
        customer_email=test_customer_user.email,
        product_id="prod_1",
        name="Test Laptop",
        price=500.0,
        quantity=1
    )
    db_session.add(cart_item)
    db_session.commit()

    session_ctx = {"customer_ref": test_customer_user.email}
    args_ctx = {"address_id": "addr_123"}

    dummy_settings = MagicMock()
    dummy_settings.razorpay_key_id = "rzp_test_123"
    dummy_settings.razorpay_key_secret = "test_secret_123"

    # Mock execute_fetch_addresses and call_merchant_api
    with patch("app.agentic.router.execute_fetch_addresses", new_callable=AsyncMock) as mock_fetch_addrs, \
         patch("app.agentic.router.call_merchant_api", new_callable=AsyncMock) as mock_merchant_api, \
         patch("app.agentic.router.get_settings", return_value=dummy_settings), \
         patch("razorpay.Client") as mock_rzp_cls, \
         patch("app.agentic.router.orders_logger") as mock_logger:

        mock_fetch_addrs.return_value = {"addresses": [{"id": "addr_123", "line1": "123 Main St"}]}
        
        mock_resp = MagicMock()
        mock_resp.status_code = 200
        mock_resp.json.return_value = {"order_id": "merchant_ord_999"}
        mock_merchant_api.return_value = mock_resp

        mock_rzp_instance = MagicMock()
        mock_rzp_instance.order.create.side_effect = Exception("Authentication failed")
        mock_rzp_cls.return_value = mock_rzp_instance

        # Call execute_create_order
        result = await execute_create_order(
            merchant_id=test_merchant.id,
            session=session_ctx,
            conversation_id="conv_123",
            args=args_ctx,
            db=db_session
        )

        # 1. Check returned result
        assert result.get("error") == "payment_initiation_failed"
        assert "trouble setting up payment" in result.get("message", "")
        assert "agent_order_id" in result

        # 2. Check DB record state
        agent_order_id = result["agent_order_id"]
        agent_order = db_session.query(AgentOrder).filter(AgentOrder.id == agent_order_id).first()

        assert agent_order is not None
        assert agent_order.status == AgentOrderStatus.FAILED.value
        assert "razorpay_error: Authentication failed" in agent_order.failure_reason
        assert agent_order.merchant_order_id == "merchant_ord_999"  # Merchant order preserved!

        # 3. Check error log invocation
        mock_logger.error.assert_called()
        error_log_call = mock_logger.error.call_args[0][0]
        assert "Razorpay order creation FAILED" in error_log_call

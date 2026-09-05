import json
import httpx
from fastapi import APIRouter, Depends, Header, HTTPException, Request
from sqlalchemy.orm import Session
from app.core.config import get_settings
from app.core.database import get_db
from app.core.logging_config import get_logger
from app.core.security import get_current_user
from datetime import datetime, timezone, timedelta
from sqlalchemy import func
from app.system.models import User, AgentOrder, Conversation, Onboarding

try:
    # pyrefly: ignore [missing-import]
    from svix.webhooks import Webhook, WebhookVerificationError
    HAS_SVIX = True
except ImportError:
    # pyrefly: ignore [name-defined]
    Webhook = None
    WebhookVerificationError = Exception
    HAS_SVIX = False
from app.system.schemas import (
    AccountResponse,
    OnboardingUpsertRequest,
    OnboardingPartialUpdateRequest,
    OnboardingResponse,
    TestEndpointRequest,
    TestCustomerAuthRequest
)
from app.system.service import (
    handle_clerk_user_upsert,
    get_user_by_id,
    get_user_onboarding,
    upsert_user_onboarding,
    patch_user_onboarding
)

webhook_logger = get_logger("webhook")
system_logger = get_logger("system")

router = APIRouter()

@router.post("/webhooks/clerk")
async def clerk_webhook(
    request: Request,
    db: Session = Depends(get_db),
    svix_id: str | None = Header(None, alias="svix-id"),
    svix_timestamp: str | None = Header(None, alias="svix-timestamp"),
    svix_signature: str | None = Header(None, alias="svix-signature"),
):
    """
    Receives and processes webhook events from Clerk (e.g. user.created).
    Verifies signatures using Svix if CLERK_WEBHOOK_SECRET is set in environment and svix is installed.
    """
    webhook_logger.info("Clerk webhook request received")
    settings = get_settings()
    
    try:
        body = await request.body()
        body_str = body.decode("utf-8")

        # 1. Signature Verification
        if settings.CLERK_WEBHOOK_SECRET and HAS_SVIX:
            if not svix_id or not svix_timestamp or not svix_signature:
                webhook_logger.warning("Clerk webhook verification failed: missing Svix headers")
                raise HTTPException(status_code=400, detail="Missing Svix verification headers")
            
            try:
                wh = Webhook(settings.CLERK_WEBHOOK_SECRET)
                payload = wh.verify(body_str, {
                    "svix-id": svix_id,
                    "svix-timestamp": svix_timestamp,
                    "svix-signature": svix_signature
                })
            except WebhookVerificationError:
                webhook_logger.warning("Clerk webhook verification failed: invalid signature")
                raise HTTPException(status_code=400, detail="Invalid webhook signature")
        else:
            # Bypassed signature check in local development or when svix package is absent
            try:
                payload = json.loads(body_str)
            except json.JSONDecodeError:
                webhook_logger.warning("Clerk webhook failed: invalid JSON body")
                raise HTTPException(status_code=400, detail="Invalid JSON body")

        if isinstance(payload, (str, bytes)):
            try:
                payload = json.loads(payload)
            except Exception:
                payload = None

        if not isinstance(payload, dict):
            try:
                payload = json.loads(body_str)
            except json.JSONDecodeError:
                webhook_logger.warning("Clerk webhook failed: invalid JSON body")
                raise HTTPException(status_code=400, detail="Invalid JSON body")

        event_type = payload.get("type")
        event_data = payload.get("data") or {}
        webhook_logger.info(f"Clerk webhook payload parsed: event_type={event_type}, user_id={event_data.get('id')}")

        # 2. Event Routing
        if event_type in ("user.created", "user.updated"):
            try:
                user = handle_clerk_user_upsert(db, event_data)
                webhook_logger.info(f"Clerk webhook user upserted: user_id={user.id}")
                return {"status": "success", "user_id": user.id}
            except ValueError as err:
                webhook_logger.error(f"Clerk webhook user upsert validation failed: {err}")
                raise HTTPException(status_code=400, detail=str(err))

        webhook_logger.info(f"Clerk webhook event ignored: event_type={event_type}")
        return {"status": "ignored"}

    except HTTPException as http_err:
        # Re-raise HTTPExceptions as-is
        raise http_err
    except Exception as e:
        webhook_logger.error(f"Internal error processing Clerk webhook: {e}")
        raise HTTPException(
            status_code=500,
            detail=f"Internal webhook processing error: {str(e)}"
        )

@router.get("/accounts/me", response_model=AccountResponse)
def get_current_user_account(
    current_user: User = Depends(get_current_user)
):
    """
    Returns the authenticated user details.
    Uses the get_current_user guard dependency for token validation.
    """
    return current_user

@router.get("/onboarding", response_model=OnboardingResponse)
def get_onboarding(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Retrieves the onboarding configurations for the logged-in merchant.
    """
    onboarding = get_user_onboarding(db, current_user.id)
    if not onboarding:
        raise HTTPException(status_code=404, detail="Onboarding configurations not found")
    return onboarding

@router.post("/onboarding", response_model=OnboardingResponse)
def upsert_onboarding(
    payload: OnboardingUpsertRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Saves or updates the onboarding settings for the logged-in merchant.
    """
    return upsert_user_onboarding(db, current_user.id, payload)

@router.patch("/onboarding", response_model=OnboardingResponse)
def patch_onboarding(
    payload: OnboardingPartialUpdateRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Partially updates onboarding settings for autosave.
    """
    return patch_user_onboarding(db, current_user.id, payload)

@router.post("/onboarding/test-endpoint")
async def test_onboarding_endpoint(
    payload: TestEndpointRequest,
    current_user: User = Depends(get_current_user)
):
    """
    Proxy test request to a merchant's API endpoint to bypass CORS.
    Uses httpx to dispatch the call and capture response structures.
    """
    base = payload.base_url.rstrip("/")
    path = payload.path.lstrip("/")
    full_url = f"{base}/{path}"

    headers = {
        "User-Agent": "ShopAgent-API-Agent/1.0",
        "Accept": "application/json"
    }
    cookies = {}

    # Check for authentication token injections
    if payload.auth_needed and payload.credential_value:
        val = payload.credential_value
        
        # If token delivery details are provided dynamically, use them
        if payload.token_delivery_method:
            deliv_method = payload.token_delivery_method
            name = payload.token_delivery_name or "Authorization"
            
            if deliv_method == "header":
                if payload.token_delivery_bearer:
                    headers[name] = f"Bearer {val}"
                else:
                    headers[name] = val
            elif deliv_method == "cookie":
                cookies[name] = val
        else:
            # Fallback legacy authentication rules
            method = payload.auth_method
            if method == "bearer":
                headers["Authorization"] = f"Bearer {val}"
            elif method == "apikey":
                headers["X-API-Key"] = val
                headers["Authorization"] = val
            elif method == "basic":
                if val.lower().startswith("basic "):
                    headers["Authorization"] = val
                else:
                    headers["Authorization"] = f"Basic {val}"

    # Prepare request payload
    req_body = payload.payload or {}

    try:
        async with httpx.AsyncClient(timeout=10.0, follow_redirects=True) as client:
            if payload.method.upper() == "GET":
                response = await client.get(full_url, params=req_body, headers=headers, cookies=cookies)
            elif payload.method.upper() == "POST":
                response = await client.post(full_url, json=req_body, headers=headers, cookies=cookies)
            elif payload.method.upper() == "PUT":
                response = await client.put(full_url, json=req_body, headers=headers, cookies=cookies)
            elif payload.method.upper() == "PATCH":
                response = await client.patch(full_url, json=req_body, headers=headers, cookies=cookies)
            else:
                raise HTTPException(status_code=400, detail=f"Unsupported method: {payload.method}")

            # 2xx and 3xx codes are verified as successful routes
            is_success = 200 <= response.status_code < 400

            # Try parsing response body as JSON
            try:
                response_data = response.json()
            except Exception:
                response_data = {"raw_text": response.text[:2000]}

            return {
                "status": "success" if is_success else "failed",
                "status_code": response.status_code,
                "preview": response.text[:200],
                "data": response_data
            }
    except httpx.ConnectError:
        return {
            "status": "failed",
            "status_code": 0,
            "preview": "Connection error: Failed to resolve host or connect to endpoint.",
            "data": {"detail": "Connection error: Failed to resolve host or connect."}
        }
    except httpx.TimeoutException:
        return {
            "status": "failed",
            "status_code": 0,
            "preview": "Timeout error: Host did not respond within 10 seconds.",
            "data": {"detail": "Timeout error: Host did not respond within 10 seconds."}
        }
    except Exception as e:
        return {
            "status": "failed",
            "status_code": 0,
            "preview": f"Error: {str(e)}",
            "data": {"detail": f"Error: {str(e)}"}
        }

@router.post("/onboarding/test-customer-auth")
async def test_customer_auth_endpoint(
    payload: TestCustomerAuthRequest,
    current_user: User = Depends(get_current_user)
):
    """
    Test customer authentication endpoint by dispatching credentials payload.
    Bypasses CORS restrictions on the merchant's customer-auth URL.
    """
    full_url = payload.auth_url or payload.auth_path or ""
    if payload.base_url and not full_url.startswith(("http://", "https://")):
        full_url = f"{payload.base_url.rstrip('/')}/{full_url.lstrip('/')}"
    method = payload.auth_method.upper()
    body = payload.payload

    headers = {
        "User-Agent": "ShopAgent-API-Agent/1.0",
        "Accept": "application/json",
        "Content-Type": "application/json"
    }

    try:
        async with httpx.AsyncClient(timeout=10.0, follow_redirects=True) as client:
            if method == "GET":
                response = await client.get(full_url, params=body, headers=headers)
            elif method == "POST":
                response = await client.post(full_url, json=body, headers=headers)
            elif method == "PUT":
                response = await client.put(full_url, json=body, headers=headers)
            elif method == "PATCH":
                response = await client.patch(full_url, json=body, headers=headers)
            else:
                raise HTTPException(status_code=400, detail=f"Unsupported method: {method}")

            # Try parsing JSON first
            try:
                response_json = response.json()
            except Exception:
                response_json = {"raw_text": response.text[:2000]}

            return {
                "status": "success" if 200 <= response.status_code < 300 else "failed",
                "status_code": response.status_code,
                "data": response_json
            }
    except httpx.ConnectError:
        return {
            "status": "failed",
            "status_code": 0,
            "data": {"detail": "Connection error: Failed to connect to customer auth URL."}
        }
    except httpx.TimeoutException:
        return {
            "status": "failed",
            "status_code": 0,
            "data": {"detail": "Timeout error: Customer auth request timed out."}
        }
    except Exception as e:
        return {
            "status": "failed",
            "status_code": 0,
            "data": {"detail": f"Error: {str(e)}"}
        }

@router.get("/analytics/summary")
def get_analytics_summary(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Returns live merchant analytics summary metrics:
    - Revenue via Agent (total & relative yesterday difference)
    - Orders (total count & average cart value)
    - Conversations (total & average per user)
    """
    merchant_id = current_user.id

    # 1. Total Revenue calculation
    raw_total_rev = db.query(func.sum(AgentOrder.order_total)).filter(
        AgentOrder.merchant_id == merchant_id
    ).scalar()
    total_rev = float(raw_total_rev) if raw_total_rev is not None else 0.0

    # Yesterday comparison calculation
    now = datetime.now(timezone.utc)
    today_start = now.replace(hour=0, minute=0, second=0, microsecond=0)
    yesterday_start = today_start - timedelta(days=1)

    raw_today_rev = db.query(func.sum(AgentOrder.order_total)).filter(
        AgentOrder.merchant_id == merchant_id,
        AgentOrder.created_at >= today_start
    ).scalar()
    today_rev = float(raw_today_rev) if raw_today_rev is not None else 0.0

    raw_yesterday_rev = db.query(func.sum(AgentOrder.order_total)).filter(
        AgentOrder.merchant_id == merchant_id,
        AgentOrder.created_at >= yesterday_start,
        AgentOrder.created_at < today_start
    ).scalar()
    yesterday_rev = float(raw_yesterday_rev) if raw_yesterday_rev is not None else 0.0

    if yesterday_rev > 0:
        pct_diff = ((today_rev - yesterday_rev) / yesterday_rev) * 100.0
        relative_yesterday = f"{'+' if pct_diff >= 0 else ''}{pct_diff:.1f}%"
    elif today_rev > 0:
        relative_yesterday = "+100.0%"
    else:
        relative_yesterday = "+0.0%"

    # 2. Orders calculation
    order_count = db.query(func.count(AgentOrder.id)).filter(
        AgentOrder.merchant_id == merchant_id
    ).scalar() or 0

    raw_avg_cart = db.query(func.avg(AgentOrder.order_total)).filter(
        AgentOrder.merchant_id == merchant_id
    ).scalar()
    avg_cart = float(raw_avg_cart) if raw_avg_cart is not None else 0.0

    # 3. Conversations calculation
    conv_count = db.query(func.count(Conversation.id)).filter(
        Conversation.merchant_id == merchant_id
    ).scalar() or 0

    unique_users = db.query(func.count(func.distinct(Conversation.user_email))).filter(
        Conversation.merchant_id == merchant_id
    ).scalar() or 0

    avg_per_user = round(conv_count / unique_users) if unique_users > 0 else 0

    formatted_total_rev = f"₹{total_rev:,.2f}"
    formatted_order_count = str(order_count)
    formatted_avg_cart = str(int(round(avg_cart))) if avg_cart > 0 else "0"
    formatted_conv_count = str(conv_count)
    formatted_avg_per_user = str(avg_per_user)

    return {
        "revenue": {
            "total": formatted_total_rev,
            "relative_yesterday": relative_yesterday
        },
        "orders": {
            "total_count": formatted_order_count,
            "average_cart_value": formatted_avg_cart
        },
        "conversations": {
            "total": formatted_conv_count,
            "average_per_user": formatted_avg_per_user
        }
    }


@router.get("/analytics/activity")
def get_recent_activity(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Returns live Recent Activity Feed log of purchases, chats, and automated system synchronization.
    """
    merchant_id = current_user.id

    # Fetch recent orders
    recent_orders = db.query(AgentOrder).filter(
        AgentOrder.merchant_id == merchant_id
    ).order_by(AgentOrder.created_at.desc()).limit(10).all()

    # Fetch recent conversations
    recent_convs = db.query(Conversation).filter(
        Conversation.merchant_id == merchant_id
    ).order_by(Conversation.created_at.desc()).limit(10).all()

    # Fetch onboarding for system sync log
    onboarding = db.query(Onboarding).filter(Onboarding.user_id == merchant_id).first()

    activities = []

    for order in recent_orders:
        order_num = order.merchant_order_id or (order.id[:6].upper() if order.id else "1024")
        cust_name = order.customer_ref or "Customer"
        amt = f"₹{float(order.order_total):,.2f}" if order.order_total else "₹0.00"
        
        # Calculate time ago
        time_str = "just now"
        if order.created_at:
            delta = datetime.now(timezone.utc) - (order.created_at.replace(tzinfo=timezone.utc) if order.created_at.tzinfo is None else order.created_at)
            mins = int(delta.total_seconds() / 60)
            if mins < 60:
                time_str = f"{max(1, mins)} mins ago"
            else:
                hours = int(mins / 60)
                time_str = f"{hours} hour{'s' if hours > 1 else ''} ago"

        activities.append({
            "id": f"ord-{order.id}",
            "type": "order",
            "title": f"Order #{order_num} placed via Agent",
            "subtitle": f"Customer: {cust_name} • {time_str}",
            "amount": amt,
            "timestamp": order.created_at.isoformat() if order.created_at else datetime.now(timezone.utc).isoformat()
        })

    for conv in recent_convs:
        cust_name = conv.user_email or "Shopper"
        time_str = "just now"
        if conv.created_at:
            delta = datetime.now(timezone.utc) - (conv.created_at.replace(tzinfo=timezone.utc) if conv.created_at.tzinfo is None else conv.created_at)
            mins = int(delta.total_seconds() / 60)
            if mins < 60:
                time_str = f"{max(1, mins)} mins ago"
            else:
                hours = int(mins / 60)
                time_str = f"{hours} hour{'s' if hours > 1 else ''} ago"

        activities.append({
            "id": f"conv-{conv.id}",
            "type": "chat",
            "title": "New chat session started",
            "subtitle": f"Customer: {cust_name} • {time_str}",
            "amount": None,
            "timestamp": conv.created_at.isoformat() if conv.created_at else datetime.now(timezone.utc).isoformat()
        })

    if onboarding and onboarding.updated_at:
        delta = datetime.now(timezone.utc) - (onboarding.updated_at.replace(tzinfo=timezone.utc) if onboarding.updated_at.tzinfo is None else onboarding.updated_at)
        mins = int(delta.total_seconds() / 60)
        if mins < 60:
            time_str = f"{max(1, mins)} mins ago"
        else:
            hours = int(mins / 60)
            time_str = f"{hours} hour{'s' if hours > 1 else ''} ago"

        activities.append({
            "id": f"sync-{onboarding.user_id}",
            "type": "sync",
            "title": "Catalog sync complete",
            "subtitle": f"Customer: System • {time_str}",
            "amount": None,
            "timestamp": onboarding.updated_at.isoformat()
        })

    # Sort activities by timestamp descending
    activities.sort(key=lambda x: x["timestamp"], reverse=True)

    return {"activities": activities}



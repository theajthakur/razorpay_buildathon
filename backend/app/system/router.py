import json
import httpx
from fastapi import APIRouter, Depends, Header, HTTPException, Request
from sqlalchemy.orm import Session
from svix.webhooks import Webhook, WebhookVerificationError
from app.core.config import get_settings
from app.core.database import get_db
from app.core.security import get_current_user
from app.system.models import User
from app.system.schemas import (
    AccountResponse,
    OnboardingUpsertRequest,
    OnboardingResponse,
    TestEndpointRequest,
    TestCustomerAuthRequest
)
from app.system.service import (
    handle_clerk_user_upsert,
    get_user_by_id,
    get_user_onboarding,
    upsert_user_onboarding
)

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
    Verifies signatures using Svix if CLERK_WEBHOOK_SECRET is set in environment.
    """
    settings = get_settings()
    body = await request.body()
    body_str = body.decode("utf-8")

    # 1. Signature Verification
    if settings.CLERK_WEBHOOK_SECRET:
        if not svix_id or not svix_timestamp or not svix_signature:
            raise HTTPException(status_code=400, detail="Missing Svix verification headers")
        
        try:
            wh = Webhook(settings.CLERK_WEBHOOK_SECRET)
            payload = wh.verify(body_str, {
                "svix-id": svix_id,
                "svix-timestamp": svix_timestamp,
                "svix-signature": svix_signature
            })
        except WebhookVerificationError:
            raise HTTPException(status_code=400, detail="Invalid webhook signature")
    else:
        # Bypassed signature check in local development
        try:
            payload = json.loads(body_str)
        except json.JSONDecodeError:
            raise HTTPException(status_code=400, detail="Invalid JSON body")

    event_type = payload.get("type")
    event_data = payload.get("data", {})

    # 2. Event Routing
    if event_type in ("user.created", "user.updated"):
        try:
            user = handle_clerk_user_upsert(db, event_data)
            return {"status": "success", "user_id": user.id}
        except ValueError as err:
            raise HTTPException(status_code=400, detail=str(err))

    return {"status": "ignored"}

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
        "User-Agent": "MerchantOS-API-Agent/1.0",
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
    full_url = payload.auth_url
    method = payload.auth_method.upper()
    body = payload.payload

    headers = {
        "User-Agent": "MerchantOS-API-Agent/1.0",
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

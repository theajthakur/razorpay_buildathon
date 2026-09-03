from datetime import datetime, timezone
import jwt
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from app.core.database import get_db
from app.core.config import get_settings
from app.system.models import Onboarding, MerchantUserSession
from app.agentic.dependencies import resolve_merchant_by_host
from app.agentic.crypto import encrypt_merchant_token
from app.agentic.auth_utils import resolve_session_expiry, get_value_by_path, extract_by_path
from app.agentic.deps import get_current_session
from app.agentic.merchant_api import call_merchant_api
from app.agentic.schemas.auth import LoginRequest, LoginResponse
from app.core.logging_config import get_logger

auth_logger = get_logger("auth")

router = APIRouter()
public_router = APIRouter()

@public_router.get("/branding")
def get_public_branding(
    onboarding: Onboarding = Depends(resolve_merchant_by_host)
):
    """
    Exposes the resolved merchant's public branding configuration.
    Requires no auth headers. Resolves merchant context from Host header.
    """
    branding_config = onboarding.branding_config
    if not branding_config or not isinstance(branding_config, dict):
        raise HTTPException(
            status_code=404,
            detail="Branding configuration not found for this merchant."
        )
    return {
        **branding_config,
        "merchant_id": onboarding.user_id
    }


@public_router.post("/auth/login", response_model=LoginResponse)
async def login(
    payload: LoginRequest,
    db: Session = Depends(get_db)
):
    """
    Customer Login for the Agentic module.
    Authenticates against the merchant's login API dynamically and returns a ShopAgent JWT.
    """
    auth_logger.info(f"Login attempt: merchant={payload.merchant_id}, email={payload.email}")
    settings = get_settings()

    # 1. Fetch onboarding configuration
    onboarding = db.query(Onboarding).filter(Onboarding.user_id == payload.merchant_id).first()
    if not onboarding or not onboarding.auth_config:
        auth_logger.warning(f"Login failed: merchant={payload.merchant_id} not found or auth config missing")
        raise HTTPException(status_code=404, detail="merchant_not_found")

    auth_config = onboarding.auth_config

    # 2. Extract mappings and prepare endpoint URL
    auth_url = auth_config.get("path") or auth_config.get("auth_url")
    if not auth_url:
        auth_logger.warning(f"Login failed: auth_url/path missing for merchant={payload.merchant_id}")
        raise HTTPException(status_code=404, detail="merchant_not_found")

    # Resolve relative URL
    if not auth_url.startswith(("http://", "https://")):
        base = onboarding.base_url.rstrip("/")
        path = auth_url.lstrip("/")
        auth_url = f"{base}/{path}"

    method = (auth_config.get("method") or "POST").upper()
    identifier_field = auth_config.get("identifier_field") or "email"
    password_field = auth_config.get("password_field") or "password"
    token_path = auth_config.get("token_path") or "token"

    # 3. Call the merchant's login API
    request_body = {
        identifier_field: payload.email,
        password_field: payload.password
    }

    try:
        resp = await call_merchant_api(
            method,
            auth_url,
            json_body=request_body if method != "GET" else None,
            params=request_body if method == "GET" else None,
            context="merchant_login",
            redact_body_keys=["password", password_field],
            timeout=10.0,
        )
    except Exception as e:
        auth_logger.warning(f"Login failed (connection error): merchant={payload.merchant_id}, email={payload.email}, err={e}")
        raise HTTPException(status_code=401, detail="invalid_credentials")

    if resp.status_code != 200:
        auth_logger.warning(f"Login failed (merchant returned {resp.status_code}): merchant={payload.merchant_id}, email={payload.email}")
        raise HTTPException(status_code=401, detail="invalid_credentials")

    merchant_data = resp.json()

    # Extract token
    try:
        merchant_token = extract_by_path(merchant_data, token_path)
    except HTTPException:
        auth_logger.warning(f"Login failed (shape mismatch): merchant={payload.merchant_id}, token_path={token_path}")
        raise
    except Exception:
        auth_logger.warning(f"Login failed (shape mismatch): merchant={payload.merchant_id}, token_path={token_path}")
        raise HTTPException(status_code=502, detail="merchant_response_shape_mismatch")

    if not merchant_token:
        auth_logger.warning(f"Login failed (empty token): merchant={payload.merchant_id}, token_path={token_path}")
        raise HTTPException(status_code=502, detail="merchant_response_shape_mismatch")

    # Extract customer reference
    customer_ref = (
        get_value_by_path(merchant_data, "user_id") or
        get_value_by_path(merchant_data, "id") or
        get_value_by_path(merchant_data, "customer_id") or
        get_value_by_path(merchant_data, "user.id") or
        get_value_by_path(merchant_data, "customer.id") or
        get_value_by_path(merchant_data, "data.user_id") or
        get_value_by_path(merchant_data, "data.id")
    )
    if not customer_ref:
        customer_ref = payload.email
    else:
        customer_ref = str(customer_ref)

    # 4. Resolve session expiry and create session
    expires_at = resolve_session_expiry(merchant_token, merchant_data)

    session = MerchantUserSession(
        merchant_id=payload.merchant_id,
        customer_ref=customer_ref,
        email=payload.email,
        merchant_token_encrypted=encrypt_merchant_token(merchant_token),
        expires_at=expires_at,
    )
    db.add(session)
    db.commit()
    db.refresh(session)
    auth_logger.info(f"Login successful: merchant={payload.merchant_id}, customer={customer_ref}")

    # 5. Encode our JWT
    our_jwt = jwt.encode(
        {
            "sub": str(session.id),
            "merchant_id": str(payload.merchant_id),
            "customer_ref": customer_ref,
            "iat": int(datetime.now(timezone.utc).timestamp()),
            "exp": int(expires_at.timestamp()),
        },
        settings.JWT_SECRET,
        algorithm="HS256",
    )

    return LoginResponse(token=our_jwt, expires_at=expires_at)


@router.post("/auth/logout")
def logout(
    session: dict = Depends(get_current_session),
    db: Session = Depends(get_db)
):
    """
    Customer Logout for the Agentic module.
    Deletes the customer's session row in the database, invalidating it server-side.
    """
    row = db.query(MerchantUserSession).filter(MerchantUserSession.id == session["session_id"]).first()
    if row:
        db.delete(row)
        db.commit()
    return {"status": "success"}

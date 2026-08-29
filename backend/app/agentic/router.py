from datetime import datetime, timezone
import httpx
import jwt
from pydantic import BaseModel
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from app.core.database import get_db
from app.core.config import get_settings
from app.system.models import Onboarding, MerchantUserSession
from app.agentic.dependencies import resolve_merchant_by_host
from app.agentic.crypto import encrypt_merchant_token
from app.agentic.auth_utils import resolve_session_expiry, get_value_by_path
from app.agentic.deps import get_current_session, get_merchant_token

router = APIRouter()
public_router = APIRouter()

class LoginRequest(BaseModel):
    merchant_id: str
    email: str
    password: str

class LoginResponse(BaseModel):
    token: str
    expires_at: datetime

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
    return branding_config

@public_router.post("/auth/login", response_model=LoginResponse)
async def login(
    payload: LoginRequest,
    db: Session = Depends(get_db)
):
    """
    Customer Login for the Agentic module.
    Authenticates against the merchant's login API and returns a ShopAgent JWT.
    """
    settings = get_settings()

    # 1. Fetch onboarding configuration
    onboarding = db.query(Onboarding).filter(Onboarding.user_id == payload.merchant_id).first()
    if not onboarding:
        raise HTTPException(status_code=401, detail="invalid_credentials")

    if not onboarding.auth_enabled or not onboarding.auth_config:
        raise HTTPException(status_code=401, detail="invalid_credentials")

    auth_config = onboarding.auth_config

    # 2. Extract mappings and prepare endpoint URL
    auth_url = auth_config.get("auth_url")
    if not auth_url:
        raise HTTPException(status_code=401, detail="invalid_credentials")

    # Resolve relative URL
    if not auth_url.startswith(("http://", "https://")):
        base = onboarding.base_url.rstrip("/")
        path = auth_url.lstrip("/")
        auth_url = f"{base}/{path}"

    identifier_field = auth_config.get("identifier_field") or "email"
    password_field = auth_config.get("password_field") or "password"
    token_path = auth_config.get("token_path") or "token"

    # 3. Call the merchant's login API
    request_body = {
        identifier_field: payload.email,
        password_field: payload.password
    }

    try:
        async with httpx.AsyncClient() as client:
            resp = await client.post(
                auth_url,
                json=request_body,
                timeout=10.0
            )
    except Exception:
        # Generic 401 on connection failure
        raise HTTPException(status_code=401, detail="invalid_credentials")

    if resp.status_code != 200:
        raise HTTPException(status_code=401, detail="invalid_credentials")

    merchant_data = resp.json()

    # Extract token
    merchant_token = get_value_by_path(merchant_data, token_path)
    if not merchant_token:
        merchant_token = merchant_data.get("token") or merchant_data.get("access_token")

    if not merchant_token:
        raise HTTPException(status_code=401, detail="invalid_credentials")

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

@router.get("/session-check")
def session_check(
    session: dict = Depends(get_current_session)
):
    """
    Protected route helper to verify get_current_session (no DB query).
    """
    return session

@router.get("/merchant-token-check")
def merchant_token_check(
    token: str = Depends(get_merchant_token)
):
    """
    Protected route helper to verify get_merchant_token (decrypts token).
    """
    return {"token": token}

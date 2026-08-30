from fastapi import Header, HTTPException, Depends
from sqlalchemy.orm import Session
from passlib.context import CryptContext
import jwt
from jwt.exceptions import PyJWTError
from app.core.database import get_db
from app.core.config import get_settings
from app.core.logging_config import get_logger
from app.system.models import User

auth_logger = get_logger("auth")

# Set up cryptography context with bcrypt scheme
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

# Instantiate JWKS Client for Clerk public key caching
settings = get_settings()
jwks_client = jwt.PyJWKClient(settings.CLERK_JWKS_URL)

def hash_password(password: str) -> str:
    """Hashes a plain password using bcrypt."""
    return pwd_context.hash(password)

def verify_password(plain: str, hashed: str) -> bool:
    """Verifies a plain password against a bcrypt hash."""
    return pwd_context.verify(plain, hashed)

def get_current_user(
    authorization: str | None = Header(None),
    db: Session = Depends(get_db)
) -> User:
    """
    HTTP Security Guard: Extracts and cryptographically verifies Clerk JWT token from the Authorization Header.
    Auto-creates the user row if it does not exist in the local database.
    """
    if not authorization or not authorization.startswith("Bearer "):
        auth_logger.warning("Auth error: missing or invalid Authorization header format")
        raise HTTPException(
            status_code=401,
            detail="Missing or invalid Authorization header"
        )
    
    token = authorization.split(" ")[1]
    
    try:
        # Get the signing key matching the 'kid' (Key ID) header in the JWT
        signing_key = jwks_client.get_signing_key_from_jwt(token)
        
        # Verify signature, expiration (exp), and decode claims with leeway for clock drift
        payload = jwt.decode(
            token,
            signing_key.key,
            algorithms=["RS256"],
            options={"verify_exp": True},
            leeway=60
        )
        
        clerk_id = payload.get("sub")
        if not clerk_id:
            auth_logger.warning("Auth error: JWT token missing subject (sub) claim")
            raise HTTPException(
                status_code=401,
                detail="JWT token is missing the subject (sub) claim"
            )
    except PyJWTError as err:
        auth_logger.warning(f"Auth error: JWT verification failed: {str(err)}")
        raise HTTPException(
            status_code=401,
            detail=f"JWT verification failed: {str(err)}"
        )
    
    user = db.query(User).filter(User.id == clerk_id).first()
    
    # Auto-Heal: If database was reset but browser session remains active
    if not user:
        user = User(
            id=clerk_id,
            email=payload.get("email") or f"{clerk_id}@merchant.local",
            store_name="Synced Store",
            status="pending"
        )
        db.add(user)
        db.commit()
        db.refresh(user)
        
    return user

def get_current_approved_user(
    current_user: User = Depends(get_current_user)
) -> User:
    """
    Dependency to ensure the current authenticated user has an 'approved' status.
    """
    if current_user.status != "approved":
        raise HTTPException(
            status_code=403,
            detail="Access forbidden: account status is not approved"
        )
    return current_user

import hmac
import hashlib
from datetime import datetime, timezone
from app.system.models import APIKey

def hash_api_key(key: str, secret: str) -> str:
    """Computes HMAC-SHA256 hash of an API key using the server-side secret/pepper."""
    return hmac.new(
        secret.encode("utf-8"),
        key.encode("utf-8"),
        hashlib.sha256
    ).hexdigest()

def validate_api_key(
    authorization: str | None = Header(None),
    x_api_key: str | None = Header(None, alias="X-API-Key"),
    db: Session = Depends(get_db)
) -> User:
    """
    Authenticates external API key requests:
    - Supports 'Authorization: Bearer <key>', 'Authorization: <key>', and 'X-API-Key: <key>'
    - Verifies format, prefix, active status, expiration
    - Updates last_used_at with a 60-second debounce write limit
    """
    raw_key = None
    if authorization and authorization.lower().startswith("bearer "):
        raw_key = authorization.split(" ")[1]
    elif x_api_key:
        raw_key = x_api_key
    elif authorization:
        raw_key = authorization

    if not raw_key or not (raw_key.startswith("sk_live_") or raw_key.startswith("sk_test_")):
        raise HTTPException(
            status_code=401,
            detail="Invalid or missing API Key"
        )

    # Prefix is the first 6 chars of the random portion (sk_live_ is 8 characters long)
    prefix = raw_key[8:14]
    
    # Compute the hash of the full key
    hashed_key = hash_api_key(raw_key, settings.API_KEY_HMAC_SECRET)
    
    # Query database
    key_record = (
        db.query(APIKey)
        .filter(APIKey.key_prefix == prefix, APIKey.key_hash == hashed_key)
        .first()
    )
    
    if not key_record:
        raise HTTPException(
            status_code=401,
            detail="Invalid API Key"
        )
    
    if key_record.status == "paused":
        raise HTTPException(
            status_code=401,
            detail="API Key is paused"
        )
    elif key_record.status != "active":
        raise HTTPException(
            status_code=401,
            detail="Invalid API Key"
        )
        
    # Passive expiration check
    now = datetime.now(timezone.utc)
    if key_record.expires_at:
        expires_at_utc = key_record.expires_at.astimezone(timezone.utc) if key_record.expires_at.tzinfo else key_record.expires_at.replace(tzinfo=timezone.utc)
        if expires_at_utc < now:
            raise HTTPException(
                status_code=401,
                detail="Expired API Key"
            )
            
    # Debounced update of last_used_at (at most once every 60 seconds)
    should_update = False
    if not key_record.last_used_at:
        should_update = True
    else:
        last_used_utc = key_record.last_used_at.astimezone(timezone.utc) if key_record.last_used_at.tzinfo else key_record.last_used_at.replace(tzinfo=timezone.utc)
        if (now - last_used_utc).total_seconds() > 60:
            should_update = True
            
    if should_update:
        key_record.last_used_at = now
        db.commit()
        
    # Get the user owning this key
    user = db.query(User).filter(User.id == key_record.customer_id).first()
    if not user or user.status != "approved":
        raise HTTPException(
            status_code=401,
            detail="User account associated with this key is inactive or blocked"
        )
        
    return user

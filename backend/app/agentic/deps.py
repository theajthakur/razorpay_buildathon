import jwt
from datetime import datetime, timezone
from fastapi import Header, HTTPException, Depends
from sqlalchemy.orm import Session
from app.core.config import get_settings
from app.core.database import get_db
from app.system.models import MerchantUserSession
from app.agentic.crypto import decrypt_merchant_token

settings = get_settings()

def get_current_session(
    authorization: str = Header(...),
) -> dict:
    """
    Local, no-DB, no-network token validation.
    Decodes the client JWT and extracts identity information.
    """
    if not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="missing_token")
    token = authorization.removeprefix("Bearer ")

    try:
        decoded = jwt.decode(token, settings.JWT_SECRET, algorithms=["HS256"])
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="session_expired")
    except jwt.InvalidTokenError:
        raise HTTPException(status_code=401, detail="invalid_token")

    return {
        "session_id": decoded["sub"],
        "merchant_id": decoded["merchant_id"],
        "customer_ref": decoded["customer_ref"],
    }

def get_merchant_token(
    session: dict = Depends(get_current_session),
    db: Session = Depends(get_db),
) -> str:
    """
    DB-lookup dependency. Decrypts and returns the merchant auth token.
    Only use on routes that actually perform outgoing merchant API calls.
    """
    row = db.query(MerchantUserSession).filter(MerchantUserSession.id == session["session_id"]).first()
    if not row:
        raise HTTPException(status_code=401, detail="merchant_session_expired")

    # Double check database expiry
    now = datetime.now(timezone.utc)
    row_exp = row.expires_at
    if row_exp.tzinfo is None:
        row_exp = row_exp.replace(tzinfo=timezone.utc)

    if row_exp < now:
        db.delete(row)
        db.commit()
        raise HTTPException(status_code=401, detail="merchant_session_expired")

    return decrypt_merchant_token(row.merchant_token_encrypted)

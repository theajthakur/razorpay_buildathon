from fastapi import Header, HTTPException, Depends
from sqlalchemy.orm import Session
from passlib.context import CryptContext
import jwt
from jwt.exceptions import PyJWTError
from app.core.database import get_db
from app.core.config import get_settings
from app.system.models import User

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
        print("Auth Error: Missing or invalid Authorization header format")
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
            print("Auth Error: JWT token is missing subject (sub) claim")
            raise HTTPException(
                status_code=401,
                detail="JWT token is missing the subject (sub) claim"
            )
    except PyJWTError as err:
        print(f"Auth Error: JWT verification failed: {str(err)}")
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

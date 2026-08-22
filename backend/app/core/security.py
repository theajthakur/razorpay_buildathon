from fastapi import Header, HTTPException, Depends
from sqlalchemy.orm import Session
from passlib.context import CryptContext
from app.core.database import get_db
from app.system.models import User

# Set up cryptography context with bcrypt scheme
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

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
    HTTP Security Guard: Extracts Clerk User ID from the Authorization Header.
    Auto-creates the user row if it does not exist in local development.
    """
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(
            status_code=401,
            detail="Missing or invalid Authorization header"
        )
    
    clerk_id = authorization.split(" ")[1]
    user = db.query(User).filter(User.id == clerk_id).first()
    
    # Auto-Heal: If database was reset but browser session remains active
    if not user:
        user = User(
            id=clerk_id,
            email=f"{clerk_id}@merchant.local",
            store_name="Synced Store",
            status="pending"
        )
        db.add(user)
        db.commit()
        db.refresh(user)
        
    return user

from sqlalchemy.orm import Session
from app.system.models import User, Onboarding
from app.system.schemas import OnboardingUpsertRequest

def handle_clerk_user_upsert(db: Session, event_data: dict) -> User:
    """
    Handles user creation or update from a Clerk webhook event (e.g. user.created, user.updated).
    Extracts Clerk ID, email, and constructs a store_name default from user name.
    """
    clerk_id = event_data.get("id")
    if not clerk_id:
        raise ValueError("Missing 'id' in Clerk event data")

    email_addresses = event_data.get("email_addresses", [])
    email = ""
    if email_addresses:
        email = email_addresses[0].get("email_address", "")

    first_name = event_data.get("first_name", "") or ""
    last_name = event_data.get("last_name", "") or ""
    full_name = f"{first_name} {last_name}".strip()
    store_name = f"{full_name}'s Store" if full_name else "Merchant Store"

    # Query existing user by Clerk ID
    db_user = db.query(User).filter(User.id == clerk_id).first()
    if not db_user:
        db_user = User(
            id=clerk_id,
            email=email,
            store_name=store_name,
            status="pending"
        )
        db.add(db_user)
    else:
        # Update fields if existing
        db_user.email = email
        if not db_user.store_name:
            db_user.store_name = store_name

    db.commit()
    db.refresh(db_user)
    return db_user

def get_user_by_id(db: Session, user_id: str) -> User | None:
    """Retrieves a user by their unique Clerk ID."""
    return db.query(User).filter(User.id == user_id).first()

def get_user_onboarding(db: Session, user_id: str) -> Onboarding | None:
    """Retrieves the onboarding record for a user if it exists."""
    return db.query(Onboarding).filter(Onboarding.user_id == user_id).first()

def upsert_user_onboarding(db: Session, user_id: str, data: OnboardingUpsertRequest) -> Onboarding:
    """
    Creates or updates the onboarding record for a given user.
    Also transitions the user status to 'approved' once onboarding is completed.
    """
    db_onboarding = db.query(Onboarding).filter(Onboarding.user_id == user_id).first()
    
    if not db_onboarding:
        db_onboarding = Onboarding(
            user_id=user_id,
            base_url=data.base_url,
            auth_needed=data.auth_needed,
            auth_method=data.auth_method,
            credential_value=data.credential_value,
            endpoints=data.endpoints,
            bank_account=data.bank_account,
            ifsc=data.ifsc,
            branch_name=data.branch_name
        )
        db.add(db_onboarding)
    else:
        db_onboarding.base_url = data.base_url
        db_onboarding.auth_needed = data.auth_needed
        db_onboarding.auth_method = data.auth_method
        db_onboarding.credential_value = data.credential_value
        db_onboarding.endpoints = data.endpoints
        db_onboarding.bank_account = data.bank_account
        db_onboarding.ifsc = data.ifsc
        db_onboarding.branch_name = data.branch_name

    # Auto-approve user status upon completing onboarding setup
    db_user = db.query(User).filter(User.id == user_id).first()
    if db_user and db_user.status == "pending":
        db_user.status = "approved"

    db.commit()
    db.refresh(db_onboarding)
    return db_onboarding

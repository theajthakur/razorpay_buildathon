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
    
    # Convert Pydantic auth_config structure to serializable dictionary for JSON storage
    auth_config_dict = data.auth_config.model_dump() if data.auth_config else None
    
    # Convert scoped resource configs to serializable dictionaries
    products_config_dict = data.products_config.model_dump() if data.products_config else None
    order_history_config_dict = data.order_history_config.model_dump() if data.order_history_config else None
    customer_profile_config_dict = data.customer_profile_config.model_dump() if data.customer_profile_config else None
    addresses_config_dict = data.addresses_config.model_dump() if data.addresses_config else None
    create_order_config_dict = data.create_order_config.model_dump() if data.create_order_config else None
    branding_config_dict = data.branding_config.model_dump() if data.branding_config else None

    if not db_onboarding:
        db_onboarding = Onboarding(
            user_id=user_id,
            base_url=data.base_url,
            auth_enabled=data.auth_enabled,
            auth_disabled_ack=data.auth_disabled_ack,
            auth_config=auth_config_dict,
            products_config=products_config_dict,
            order_history_config=order_history_config_dict,
            customer_profile_config=customer_profile_config_dict,
            addresses_config=addresses_config_dict,
            create_order_config=create_order_config_dict,
            bank_account=data.bank_account,
            ifsc=data.ifsc,
            branch_name=data.branch_name,
            branding_config=branding_config_dict,
            webhook_url=data.webhook_url
        )
        db.add(db_onboarding)
    else:
        db_onboarding.base_url = data.base_url
        db_onboarding.auth_enabled = data.auth_enabled
        db_onboarding.auth_disabled_ack = data.auth_disabled_ack
        db_onboarding.auth_config = auth_config_dict
        db_onboarding.products_config = products_config_dict
        db_onboarding.order_history_config = order_history_config_dict
        db_onboarding.customer_profile_config = customer_profile_config_dict
        db_onboarding.addresses_config = addresses_config_dict
        db_onboarding.create_order_config = create_order_config_dict
        db_onboarding.bank_account = data.bank_account
        db_onboarding.ifsc = data.ifsc
        db_onboarding.branch_name = data.branch_name
        db_onboarding.branding_config = branding_config_dict
        db_onboarding.webhook_url = data.webhook_url

    # Auto-approve user status upon completing onboarding setup
    db_user = db.query(User).filter(User.id == user_id).first()
    if db_user and db_user.status == "pending":
        db_user.status = "approved"

    db.commit()
    db.refresh(db_onboarding)
    return db_onboarding

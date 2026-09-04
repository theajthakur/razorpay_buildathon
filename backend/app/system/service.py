from app.system.models import User, Onboarding
from sqlalchemy.orm import Session
from sqlalchemy.orm.attributes import flag_modified
from app.system.schemas import OnboardingUpsertRequest, OnboardingPartialUpdateRequest

def extract_relative_path(url: str, base_url: str) -> str:
    if not url:
        return ""
    url = url.strip()
    base_url = base_url.strip().rstrip("/")
    if base_url and url.startswith(base_url):
        return url[len(base_url):].lstrip("/")
    if "://" in url:
        parts = url.split("://", 1)[1].split("/", 1)
        if len(parts) == 2:
            return parts[1]
        return ""
    return url.lstrip("/")

def migrate_legacy_onboarding_urls(db: Session, user_id: str | None = None) -> None:
    """
    Data migration routine: Converts legacy full auth_url / webhook_url fields into path-only fields.
    """
    query = db.query(Onboarding)
    if user_id:
        query = query.filter(Onboarding.user_id == user_id)
    records = query.all()
    modified = False
    for rec in records:
        base = rec.base_url or ""
        if rec.auth_config and isinstance(rec.auth_config, dict):
            auth_url = rec.auth_config.get("auth_url")
            path = rec.auth_config.get("path")
            if not path and auth_url:
                rec.auth_config["path"] = extract_relative_path(auth_url, base)
                flag_modified(rec, "auth_config")
                modified = True
            elif path and "://" in path:
                rec.auth_config["path"] = extract_relative_path(path, base)
                flag_modified(rec, "auth_config")
                modified = True

        if rec.webhook_url and not rec.webhook_path:
            rec.webhook_path = extract_relative_path(rec.webhook_url, base)
            modified = True
        elif rec.webhook_path and "://" in rec.webhook_path:
            rec.webhook_path = extract_relative_path(rec.webhook_path, base)
            modified = True

    if modified:
        db.commit()

def handle_clerk_user_upsert(db: Session, event_data: dict) -> User:
    """
    Handles user creation or update from a Clerk webhook event (e.g. user.created, user.updated).
    Extracts Clerk ID, email, and constructs a store_name default from user name.
    If the email sent by Clerk already belongs to a different existing user ID in the database,
    prefixes the existing user's email with '[duplicate]' to keep existing data safe
    and allow the new Clerk user to be inserted gracefully.
    """
    clerk_id = event_data.get("id")
    if not clerk_id:
        raise ValueError("Missing 'id' in Clerk event data")

    email_addresses = event_data.get("email_addresses", [])
    email = ""
    if email_addresses:
        email = email_addresses[0].get("email_address", "").strip()

    first_name = event_data.get("first_name", "") or ""
    last_name = event_data.get("last_name", "") or ""
    full_name = f"{first_name} {last_name}".strip()
    store_name = f"{full_name}'s Store" if full_name else "Merchant Store"

    custom_store_name = event_data.get("store_name") or event_data.get("unsafe_metadata", {}).get("store_name")
    if custom_store_name:
        store_name = custom_store_name

    # Check if a DIFFERENT user in DB already has this email
    if email:
        existing_user_with_email = db.query(User).filter(
            User.email == email,
            User.id != clerk_id
        ).first()

        if existing_user_with_email:
            dup_email = f"[duplicate]{existing_user_with_email.email}"
            counter = 1
            while db.query(User).filter(User.email == dup_email, User.id != existing_user_with_email.id).first():
                dup_email = f"[duplicate_{counter}]{existing_user_with_email.email}"
                counter += 1

            existing_user_with_email.email = dup_email
            db.commit()

    # Query existing user by Clerk ID
    db_user = db.query(User).filter(User.id == clerk_id).first()
    if not db_user:
        db_user = User(
            id=clerk_id,
            email=email,
            store_name=store_name,
            status="approved"
        )
        db.add(db_user)
    else:
        # Update fields if existing
        if email:
            db_user.email = email
        if store_name and (not db_user.store_name or db_user.store_name == "Merchant Store"):
            db_user.store_name = store_name
        if db_user.status == "pending":
            db_user.status = "approved"

    db.commit()
    db.refresh(db_user)
    return db_user

def get_user_by_id(db: Session, user_id: str) -> User | None:
    """Retrieves a user by their unique Clerk ID."""
    return db.query(User).filter(User.id == user_id).first()

def get_user_onboarding(db: Session, user_id: str) -> Onboarding | None:
    """Retrieves the onboarding record for a user if it exists."""
    migrate_legacy_onboarding_urls(db, user_id)
    return db.query(Onboarding).filter(Onboarding.user_id == user_id).first()

def upsert_user_onboarding(db: Session, user_id: str, data: OnboardingUpsertRequest) -> Onboarding:
    """
    Creates or updates the onboarding record for a given user.
    Also transitions the user status to 'approved' once onboarding is completed.
    """
    db_onboarding = db.query(Onboarding).filter(Onboarding.user_id == user_id).first()
    
    # Convert Pydantic auth_config structure to serializable dictionary for JSON storage
    auth_config_dict = data.auth_config.model_dump() if data.auth_config else None
    if auth_config_dict and "path" in auth_config_dict:
        auth_config_dict["path"] = extract_relative_path(auth_config_dict["path"], data.base_url)
    
    # Convert scoped resource configs to serializable dictionaries
    products_config_dict = data.products_config.model_dump() if data.products_config else None
    order_history_config_dict = data.order_history_config.model_dump() if data.order_history_config else None
    customer_profile_config_dict = data.customer_profile_config.model_dump() if data.customer_profile_config else None
    addresses_config_dict = data.addresses_config.model_dump() if data.addresses_config else None
    create_order_config_dict = data.create_order_config.model_dump() if data.create_order_config else None
    verify_order_config_dict = data.verify_order_config.model_dump() if data.verify_order_config else None
    branding_config_dict = data.branding_config.model_dump() if data.branding_config else None

    webhook_p = data.webhook_path or extract_relative_path(data.webhook_url or "", data.base_url)

    if not db_onboarding:
        db_onboarding = Onboarding(
            user_id=user_id,
            base_url=data.base_url if (data.base_url and data.base_url != "http://placeholder") else "https://shopagent-backend.vijstack.com",
            auth_enabled=data.auth_enabled,
            auth_disabled_ack=data.auth_disabled_ack,
            auth_config=auth_config_dict,
            products_config=products_config_dict,
            order_history_config=order_history_config_dict,
            customer_profile_config=customer_profile_config_dict,
            addresses_config=addresses_config_dict,
            create_order_config=create_order_config_dict,
            verify_order_config=verify_order_config_dict,
            bank_account=data.bank_account,
            ifsc=data.ifsc,
            branch_name=data.branch_name,
            branding_config=branding_config_dict,
            webhook_url=data.webhook_url,
            webhook_path=webhook_p
        )
        db.add(db_onboarding)
    else:
        if data.base_url and data.base_url != "http://placeholder":
            db_onboarding.base_url = data.base_url
        db_onboarding.auth_enabled = data.auth_enabled
        db_onboarding.auth_disabled_ack = data.auth_disabled_ack
        if auth_config_dict is not None:
            db_onboarding.auth_config = auth_config_dict
        if products_config_dict is not None:
            db_onboarding.products_config = products_config_dict
        if order_history_config_dict is not None:
            db_onboarding.order_history_config = order_history_config_dict
        if customer_profile_config_dict is not None:
            db_onboarding.customer_profile_config = customer_profile_config_dict
        if addresses_config_dict is not None:
            db_onboarding.addresses_config = addresses_config_dict
        if create_order_config_dict is not None:
            db_onboarding.create_order_config = create_order_config_dict
        if verify_order_config_dict is not None:
            db_onboarding.verify_order_config = verify_order_config_dict
        if data.bank_account is not None:
            db_onboarding.bank_account = data.bank_account
        if data.ifsc is not None:
            db_onboarding.ifsc = data.ifsc
        if data.branch_name is not None:
            db_onboarding.branch_name = data.branch_name
        if branding_config_dict is not None:
            db_onboarding.branding_config = branding_config_dict
        if data.webhook_url is not None:
            db_onboarding.webhook_url = data.webhook_url
        if webhook_p:
            db_onboarding.webhook_path = webhook_p

    # Auto-approve user status upon completing onboarding setup
    db_user = db.query(User).filter(User.id == user_id).first()
    if db_user and db_user.status == "pending":
        db_user.status = "approved"

    db.commit()
    db.refresh(db_onboarding)
    return db_onboarding

def patch_user_onboarding(db: Session, user_id: str, data: OnboardingPartialUpdateRequest) -> Onboarding:
    """
    Partially updates onboarding fields for autosave.
    Strictly maintains a single onboarding record per user and prevents corrupting valid base_url.
    """
    db_onboarding = db.query(Onboarding).filter(Onboarding.user_id == user_id).first()
    if not db_onboarding:
        init_base = data.base_url if (data.base_url and data.base_url != "http://placeholder") else "https://shopagent-backend.vijstack.com"
        db_onboarding = Onboarding(
            user_id=user_id,
            base_url=init_base,
            auth_enabled=True if data.auth_enabled is None else data.auth_enabled
        )
        db.add(db_onboarding)
        db.commit()
        db.refresh(db_onboarding)

    update_dict = data.model_dump(exclude_unset=True)

    base = update_dict.get("base_url") or db_onboarding.base_url or ""
    if base == "http://placeholder":
        base = db_onboarding.base_url or "https://shopagent-backend.vijstack.com"

    if "base_url" in update_dict and update_dict["base_url"] is not None:
        new_base_url = str(update_dict["base_url"]).strip()
        if new_base_url and new_base_url != "http://placeholder":
            db_onboarding.base_url = new_base_url
    if "auth_enabled" in update_dict and update_dict["auth_enabled"] is not None:
        db_onboarding.auth_enabled = update_dict["auth_enabled"]
    if "auth_disabled_ack" in update_dict and update_dict["auth_disabled_ack"] is not None:
        db_onboarding.auth_disabled_ack = update_dict["auth_disabled_ack"]
    if "auth_config" in update_dict:
        auth_c = update_dict["auth_config"]
        if auth_c and "path" in auth_c:
            auth_c["path"] = extract_relative_path(auth_c["path"], base)
        db_onboarding.auth_config = auth_c
        flag_modified(db_onboarding, "auth_config")
    if "products_config" in update_dict:
        db_onboarding.products_config = update_dict["products_config"]
        flag_modified(db_onboarding, "products_config")
    if "order_history_config" in update_dict:
        db_onboarding.order_history_config = update_dict["order_history_config"]
        flag_modified(db_onboarding, "order_history_config")
    if "customer_profile_config" in update_dict:
        db_onboarding.customer_profile_config = update_dict["customer_profile_config"]
        flag_modified(db_onboarding, "customer_profile_config")
    if "addresses_config" in update_dict:
        db_onboarding.addresses_config = update_dict["addresses_config"]
        flag_modified(db_onboarding, "addresses_config")
    if "create_order_config" in update_dict:
        db_onboarding.create_order_config = update_dict["create_order_config"]
        flag_modified(db_onboarding, "create_order_config")
    if "verify_order_config" in update_dict:
        db_onboarding.verify_order_config = update_dict["verify_order_config"]
        flag_modified(db_onboarding, "verify_order_config")
    if "bank_account" in update_dict:
        db_onboarding.bank_account = update_dict["bank_account"]
    if "ifsc" in update_dict:
        db_onboarding.ifsc = update_dict["ifsc"]
    if "branch_name" in update_dict:
        db_onboarding.branch_name = update_dict["branch_name"]
    if "branding_config" in update_dict:
        db_onboarding.branding_config = update_dict["branding_config"]
        flag_modified(db_onboarding, "branding_config")
    if "webhook_url" in update_dict:
        db_onboarding.webhook_url = update_dict["webhook_url"]
    if "webhook_path" in update_dict or "webhook_url" in update_dict:
        wp = update_dict.get("webhook_path") or extract_relative_path(update_dict.get("webhook_url") or "", base)
        if wp:
            db_onboarding.webhook_path = wp

    db_user = db.query(User).filter(User.id == user_id).first()
    if db_user and db_user.status == "pending":
        db_user.status = "approved"

    db.commit()
    db.refresh(db_onboarding)
    return db_onboarding


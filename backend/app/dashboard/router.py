import secrets
import re
import uuid
import boto3
from botocore.config import Config
from datetime import datetime, timezone
from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import JSONResponse
from sqlalchemy.orm import Session
from sqlalchemy.orm.attributes import flag_modified
from app.core.config import get_settings
from app.core.database import get_db
from app.core.security import get_current_approved_user, hash_api_key
from app.system.models import User, APIKey, Onboarding
from app.dashboard.schemas import (
    APIKeyCreateRequest,
    APIKeyCreateResponse,
    APIKeyListResponse,
    APIKeyResponse,
    LogoPresignRequest,
    LogoPresignResponse,
    MerchantSettingsSaveRequest,
    MerchantSettingsResponse,
)

settings = get_settings()
router = APIRouter()

@router.post("/keys", response_model=APIKeyCreateResponse)
def create_api_key(
    payload: APIKeyCreateRequest,
    current_user: User = Depends(get_current_approved_user),
    db: Session = Depends(get_db),
):
    """
    Creates a new API key for the authenticated merchant:
    - Enforces maximum limit of 5 keys (counting all statuses).
    - Enforces unique key names across all active/revoked keys for this merchant.
    - Generates and returns the raw key exactly once.
    """
    name = payload.name.strip()
    if not name:
        return JSONResponse(
            status_code=400,
            content={
                "error": {
                    "code": "invalid_key_name",
                    "message": "Key name cannot be empty."
                }
            }
        )

    # 1. Fetch all existing keys for this customer
    existing_keys = db.query(APIKey).filter(APIKey.customer_id == current_user.id).all()

    # 2. Enforce limit of max 5 keys (counting both active and revoked)
    if len(existing_keys) >= 5:
        return JSONResponse(
            status_code=403,
            content={
                "error": {
                    "code": "key_limit_reached",
                    "message": "You have reached the maximum limit of 5 API keys."
                }
            }
        )

    # 3. Enforce name uniqueness across all statuses
    for key in existing_keys:
        if key.name.lower() == name.lower():
            return JSONResponse(
                status_code=409,
                content={
                    "error": {
                        "code": "duplicate_key_name",
                        "message": f"You already have a key named \"{key.name}\"."
                    }
                }
            )

    # 4. Generate the random key
    # sk_live_<24 random bytes in Base64URL>
    random_b64url = secrets.token_urlsafe(24)
    full_key = f"sk_live_{random_b64url}"
    
    # prefix is the first 6 chars of the random portion
    prefix = random_b64url[:6]
    
    # Hash the full key
    hashed_key = hash_api_key(full_key, settings.API_KEY_HMAC_SECRET)

    # 5. Save the new API Key to the database
    new_key = APIKey(
        customer_id=current_user.id,
        name=name,
        key_prefix=prefix,
        key_hash=hashed_key,
        status="active",
        created_at=datetime.now(timezone.utc),
        expires_at=None, # Optional expiry, null by default
    )
    db.add(new_key)
    db.commit()
    db.refresh(new_key)

    # 6. Return response including the raw API key (never stored or retrievable again)
    return APIKeyCreateResponse(
        id=new_key.id,
        name=new_key.name,
        key_prefix=new_key.key_prefix,
        api_key=full_key,
        status=new_key.status,
        created_at=new_key.created_at,
        expires_at=new_key.expires_at,
    )

@router.get("/keys", response_model=APIKeyListResponse)
def list_api_keys(
    current_user: User = Depends(get_current_approved_user),
    db: Session = Depends(get_db),
):
    """
    Returns all keys for the authenticated merchant, never including key_hash or raw keys.
    """
    keys = db.query(APIKey).filter(APIKey.customer_id == current_user.id).order_by(APIKey.created_at.desc()).all()
    
    total_count = len(keys)
    active_count = sum(1 for k in keys if k.status == "active")

    key_responses = [
        APIKeyResponse(
            id=k.id,
            name=k.name,
            key_prefix=k.key_prefix,
            status=k.status,
            created_at=k.created_at,
            expires_at=k.expires_at,
            last_used_at=k.last_used_at,
        )
        for k in keys
    ]

    return APIKeyListResponse(
        keys=key_responses,
        active_count=active_count,
        total_count=total_count,
        max_keys=5,
    )

@router.delete("/keys/{key_id}")
def delete_api_key(
    key_id: str,
    current_user: User = Depends(get_current_approved_user),
    db: Session = Depends(get_db),
):
    """
    Deletes the specified API key immediately from the database.
    """
    key_record = db.query(APIKey).filter(APIKey.id == key_id, APIKey.customer_id == current_user.id).first()
    if not key_record:
        raise HTTPException(status_code=404, detail="API Key not found")

    db.delete(key_record)
    db.commit()

    return {"status": "success", "message": "API key deleted successfully"}

@router.patch("/keys/{key_id}/pause", response_model=APIKeyResponse)
def pause_api_key(
    key_id: str,
    current_user: User = Depends(get_current_approved_user),
    db: Session = Depends(get_db),
):
    """
    Pauses the specified API key (sets status to paused).
    """
    key_record = db.query(APIKey).filter(APIKey.id == key_id, APIKey.customer_id == current_user.id).first()
    if not key_record:
        raise HTTPException(status_code=404, detail="API Key not found")

    key_record.status = "paused"
    db.commit()
    db.refresh(key_record)

    return key_record

@router.patch("/keys/{key_id}/continue", response_model=APIKeyResponse)
def continue_api_key(
    key_id: str,
    current_user: User = Depends(get_current_approved_user),
    db: Session = Depends(get_db),
):
    """
    Resumes the specified API key (sets status to active).
    """
    key_record = db.query(APIKey).filter(APIKey.id == key_id, APIKey.customer_id == current_user.id).first()
    if not key_record:
        raise HTTPException(status_code=404, detail="API Key not found")

    key_record.status = "active"
    db.commit()
    db.refresh(key_record)

    return key_record


ALLOWED_MIME_TYPES = {
    "image/png": "png",
    "image/jpeg": "jpeg",
    "image/webp": "webp",
    "image/svg+xml": "svg"
}

@router.post("/settings/logo/presign", response_model=LogoPresignResponse)
def presign_logo_upload(
    payload: LogoPresignRequest,
    current_user: User = Depends(get_current_approved_user),
):
    """
    Generates a presigned S3 URL for uploading a merchant logo.
    """
    file_type = payload.fileType.lower().strip()
    if file_type not in ALLOWED_MIME_TYPES:
        raise HTTPException(
            status_code=400,
            detail=f"Unsupported file type: {payload.fileType}. Allowed types are PNG, JPEG, WEBP, and SVG."
        )

    ext = ALLOWED_MIME_TYPES[file_type]
    object_uuid = uuid.uuid4()
    # Unique S3 object key: merchant-logo/{merchant_id}/{uuid}.{extension}
    key = f"merchant-logo/{current_user.id}/{object_uuid}.{ext}"

    # Generate presigned PUT URL
    try:
        s3_config = Config(signature_version="s3v4")
        s3_client = boto3.client(
            "s3",
            aws_access_key_id=settings.AWS_ACCESS_KEY,
            aws_secret_access_key=settings.AWS_SECRET_KEY,
            region_name=settings.AWS_REGION,
            config=s3_config
        )
        
        upload_url = s3_client.generate_presigned_url(
            ClientMethod="put_object",
            Params={
                "Bucket": settings.S3_BUCKET_NAME,
                "Key": key,
                "ContentType": file_type
            },
            ExpiresIn=300 # expires in 5 minutes
        )
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Failed to generate presigned S3 URL: {str(e)}"
        )

    public_url = f"https://{settings.S3_BUCKET_NAME}.s3.{settings.AWS_REGION}.amazonaws.com/{key}"

    return LogoPresignResponse(
        uploadUrl=upload_url,
        publicUrl=public_url,
        key=key
    )

@router.get("/settings", response_model=MerchantSettingsResponse)
def get_merchant_settings(
    current_user: User = Depends(get_current_approved_user),
    db: Session = Depends(get_db),
):
    """
    Retrieves the merchant settings from onboarding.branding_config JSON column.
    """
    onboarding = db.query(Onboarding).filter(Onboarding.user_id == current_user.id).first()
    branding_config = onboarding.branding_config if onboarding else {}
    if not branding_config:
        branding_config = {}

    logo_url = branding_config.get("logo_url")
    brand_color = branding_config.get("brand_color")
    display_name = branding_config.get("display_name") or current_user.store_name

    return MerchantSettingsResponse(
        logo_url=logo_url,
        brand_color=brand_color,
        accent_color=branding_config.get("accent_color"),
        display_name=display_name,
        confirmation_limit=branding_config.get("confirmation_limit"),
        toggles=branding_config.get("toggles")
    )

@router.patch("/settings", response_model=MerchantSettingsResponse)
def update_merchant_settings(
    payload: MerchantSettingsSaveRequest,
    current_user: User = Depends(get_current_approved_user),
    db: Session = Depends(get_db),
):
    """
    Saves or updates the merchant settings. Validates brand_color and logo_url prefix.
    """
    if payload.brand_color is not None:
        if not re.match(r"^#[0-9A-Fa-f]{6}$", payload.brand_color):
            raise HTTPException(
                status_code=400,
                detail="Invalid brand_color format. Must be a valid hex color starting with #."
            )

    if payload.logo_url is not None and payload.logo_url != "":
        expected_prefix_1 = f"https://{settings.S3_BUCKET_NAME}.s3.amazonaws.com/merchant-logo/"
        expected_prefix_2 = f"https://{settings.S3_BUCKET_NAME}.s3.{settings.AWS_REGION}.amazonaws.com/merchant-logo/"
        if not (payload.logo_url.startswith(expected_prefix_1) or payload.logo_url.startswith(expected_prefix_2)):
            raise HTTPException(
                status_code=400,
                detail="Invalid logo_url. Must point to the authorized S3 bucket prefix."
            )

    onboarding = db.query(Onboarding).filter(Onboarding.user_id == current_user.id).first()
    if not onboarding:
        onboarding = Onboarding(
            user_id=current_user.id,
            base_url="http://placeholder",
            auth_enabled=True,
            branding_config={}
        )
        db.add(onboarding)
        db.commit()
        db.refresh(onboarding)

    branding_config = onboarding.branding_config or {}

    if payload.logo_url is not None:
        branding_config["logo_url"] = payload.logo_url
    if payload.brand_color is not None:
        branding_config["brand_color"] = payload.brand_color
    if payload.accent_color is not None:
        branding_config["accent_color"] = payload.accent_color
    if payload.display_name is not None:
        branding_config["display_name"] = payload.display_name
    if payload.confirmation_limit is not None:
        branding_config["confirmation_limit"] = payload.confirmation_limit
    if payload.toggles is not None:
        branding_config["toggles"] = payload.toggles

    onboarding.branding_config = branding_config
    flag_modified(onboarding, "branding_config")

    db.commit()
    db.refresh(onboarding)

    logo_url = branding_config.get("logo_url")
    brand_color = branding_config.get("brand_color")
    display_name = branding_config.get("display_name") or current_user.store_name

    return MerchantSettingsResponse(
        logo_url=logo_url,
        brand_color=brand_color,
        accent_color=branding_config.get("accent_color"),
        display_name=display_name,
        confirmation_limit=branding_config.get("confirmation_limit"),
        toggles=branding_config.get("toggles")
    )

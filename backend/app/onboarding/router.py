import re
from typing import List
from urllib.parse import urlparse
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from sqlalchemy.orm.attributes import flag_modified

from app.core.database import get_db
from app.core.security import get_current_approved_user
from app.system.models import User, Onboarding, DomainMapping
from app.onboarding.schemas import (
    DomainCreateRequest,
    DomainResponse,
    DomainListResponse,
)
from app.services.vercel import (
    add_domain_to_vercel,
    verify_domain_on_vercel,
    delete_domain_from_vercel,
    VercelError,
    VercelDomainConflictError,
    VercelConfigurationError,
    VercelServiceUnavailableError,
    VercelAPIError,
)

router = APIRouter(prefix="/domains", tags=["Onboarding Domains"])

DOMAIN_REGEX = re.compile(
    r"^(?:[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?\.)+[a-zA-Z]{2,}$"
)

def normalize_and_validate_domain(raw_domain: str) -> str:
    """
    Validates and normalizes a domain string.
    Removes protocols, trailing slashes, whitespace, and validates format.
    """
    if not raw_domain or not raw_domain.strip():
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Domain name cannot be empty."
        )

    domain = raw_domain.strip().lower()

    # Strip protocol if present
    if "://" in domain:
        try:
            parsed = urlparse(domain)
            domain = parsed.netloc or parsed.path
        except Exception:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Invalid domain format."
            )

    # Remove port or path if user passed a URL
    domain = domain.split("/")[0].split(":")[0].strip().rstrip(".")

    if not domain or not DOMAIN_REGEX.match(domain):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Invalid domain format: '{raw_domain}'. Domain must be a valid hostname (e.g. agent.merchant.com)."
        )

    return domain


def get_or_create_user_onboarding(user: User, db: Session) -> Onboarding:
    onboarding = db.query(Onboarding).filter(Onboarding.user_id == user.id).first()
    if not onboarding:
        onboarding = Onboarding(
            user_id=user.id,
            base_url="https://shopagent-backend.vijstack.com",
            auth_enabled=True,
            branding_config={}
        )
        db.add(onboarding)
        db.commit()
        db.refresh(onboarding)
    return onboarding


@router.post("", response_model=DomainResponse, status_code=status.HTTP_201_CREATED)
@router.post("/", response_model=DomainResponse, status_code=status.HTTP_201_CREATED, include_in_schema=False)
def create_domain(
    payload: DomainCreateRequest,
    current_user: User = Depends(get_current_approved_user),
    db: Session = Depends(get_db),
):
    """
    Adds a custom domain to Vercel and creates a domain_mapping record for the authenticated merchant.
    """
    normalized_domain = normalize_and_validate_domain(payload.domain)
    onboarding = get_or_create_user_onboarding(current_user, db)

    # 1. Check if domain already exists in local database
    existing = db.query(DomainMapping).filter(DomainMapping.domain == normalized_domain).first()
    if existing:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"Domain '{normalized_domain}' is already registered."
        )

    # 2. Add domain to Vercel project
    try:
        vercel_data = add_domain_to_vercel(normalized_domain)
    except VercelDomainConflictError as e:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail=e.message)
    except VercelConfigurationError as e:
        raise HTTPException(status_code=status.HTTP_503_SERVICE_UNAVAILABLE, detail=e.message)
    except VercelServiceUnavailableError as e:
        raise HTTPException(status_code=status.HTTP_502_BAD_GATEWAY, detail=e.message)
    except VercelAPIError as e:
        raise HTTPException(status_code=e.status_code, detail=e.message)
    except VercelError as e:
        raise HTTPException(status_code=e.status_code, detail=e.message)

    # Extract DNS details returned from Vercel
    config_info = vercel_data.get("config", {})
    rec_cnames = config_info.get("recommendedCNAME", [])
    cname_target = None
    if rec_cnames and isinstance(rec_cnames, list):
        for item in rec_cnames:
            if isinstance(item, dict) and item.get("rank") == 1:
                cname_target = str(item.get("value", "")).rstrip(".")
                break
        if not cname_target and len(rec_cnames) > 0 and isinstance(rec_cnames[0], dict):
            cname_target = str(rec_cnames[0].get("value", "")).rstrip(".")

    if not cname_target:
        cnames = config_info.get("cnames", [])
        if cnames and isinstance(cnames, list) and len(cnames) > 0:
            cname_target = str(cnames[0]).rstrip(".")
        else:
            cname_target = "cname.vercel-dns.com"

    dns_details = {
        "verified": False,
        "misconfigured": config_info.get("misconfigured", True),
        "recommendedCNAME": rec_cnames,
        "recommendedIPv4": config_info.get("recommendedIPv4", []),
        "cname_target": cname_target,
        "cnames": config_info.get("cnames", []),
        "aValues": config_info.get("aValues", []),
        "nameservers": config_info.get("nameservers", []),
        "configuredBy": config_info.get("configuredBy"),
        "serviceType": config_info.get("serviceType"),
        "verification": vercel_data.get("verification", []),
        "apexName": vercel_data.get("apexName"),
        "gitBranch": vercel_data.get("gitBranch"),
    }
    initial_status = "PENDING"

    # 3. Create DomainMapping database record
    new_mapping = DomainMapping(
        onboarding_id=onboarding.id,
        domain=normalized_domain,
        status=initial_status,
        dns_details=dns_details,
    )
    db.add(new_mapping)
    db.commit()
    db.refresh(new_mapping)

    return new_mapping


@router.get("", response_model=DomainListResponse)
@router.get("/", response_model=DomainListResponse, include_in_schema=False)
def list_domains(
    current_user: User = Depends(get_current_approved_user),
    db: Session = Depends(get_db),
):
    """
    Returns all domain mappings belonging exclusively to the authenticated merchant.
    """
    onboarding = db.query(Onboarding).filter(Onboarding.user_id == current_user.id).first()
    if not onboarding:
        return DomainListResponse(domains=[], total_count=0)

    mappings = (
        db.query(DomainMapping)
        .filter((DomainMapping.onboarding_id == onboarding.id) | (DomainMapping.onboarding_id == onboarding.user_id))
        .order_by(DomainMapping.created_at.desc())
        .all()
    )

    domain_responses = [DomainResponse.model_validate(m) for m in mappings]
    return DomainListResponse(domains=domain_responses, total_count=len(domain_responses))


@router.get("/{domain_id}", response_model=DomainResponse)
def get_domain(
    domain_id: str,
    current_user: User = Depends(get_current_approved_user),
    db: Session = Depends(get_db),
):
    """
    Retrieves a specific domain mapping, enforcing merchant ownership authorization.
    """
    onboarding = db.query(Onboarding).filter(Onboarding.user_id == current_user.id).first()
    if not onboarding:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Domain mapping not found.")

    mapping = db.query(DomainMapping).filter(DomainMapping.id == domain_id).first()
    if not mapping or (mapping.onboarding_id != onboarding.id and mapping.onboarding_id != onboarding.user_id):
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Domain mapping not found.")

    return mapping


@router.post("/{domain_id}/verify", response_model=DomainResponse)
def verify_domain(
    domain_id: str,
    current_user: User = Depends(get_current_approved_user),
    db: Session = Depends(get_db),
):
    """
    Checks verification status on Vercel and updates local status to ACTIVE or FAILED/PENDING.
    """
    onboarding = db.query(Onboarding).filter(Onboarding.user_id == current_user.id).first()
    if not onboarding:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Domain mapping not found.")

    mapping = db.query(DomainMapping).filter(DomainMapping.id == domain_id).first()
    if not mapping or (mapping.onboarding_id != onboarding.id and mapping.onboarding_id != onboarding.user_id):
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Domain mapping not found.")

    try:
        verification_res = verify_domain_on_vercel(mapping.domain)
    except VercelConfigurationError as e:
        raise HTTPException(status_code=status.HTTP_503_SERVICE_UNAVAILABLE, detail=e.message)
    except VercelServiceUnavailableError as e:
        raise HTTPException(status_code=status.HTTP_502_BAD_GATEWAY, detail=e.message)
    except VercelAPIError as e:
        mapping.status = "FAILED"
        db.commit()
        raise HTTPException(status_code=e.status_code, detail=e.message)

    is_verified = verification_res.get("verified", False)
    mapping.dns_details = verification_res.get("dns_details", {})
    mapping.status = "ACTIVE" if is_verified else "PENDING"
    flag_modified(mapping, "dns_details")

    db.commit()
    db.refresh(mapping)

    return mapping


@router.delete("/{domain_id}")
def delete_domain(
    domain_id: str,
    current_user: User = Depends(get_current_approved_user),
    db: Session = Depends(get_db),
):
    """
    Deletes a domain mapping from Vercel and local database, enforcing merchant ownership.
    """
    onboarding = db.query(Onboarding).filter(Onboarding.user_id == current_user.id).first()
    if not onboarding:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Domain mapping not found.")

    mapping = db.query(DomainMapping).filter(DomainMapping.id == domain_id).first()
    if not mapping or (mapping.onboarding_id != onboarding.id and mapping.onboarding_id != onboarding.user_id):
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Domain mapping not found.")

    # 1. Remove domain from Vercel
    try:
        delete_domain_from_vercel(mapping.domain)
    except VercelConfigurationError as e:
        raise HTTPException(status_code=status.HTTP_503_SERVICE_UNAVAILABLE, detail=e.message)
    except VercelServiceUnavailableError as e:
        raise HTTPException(status_code=status.HTTP_502_BAD_GATEWAY, detail=e.message)
    except VercelAPIError as e:
        # If 404 on Vercel side, allow local deletion to complete
        if e.status_code != 404:
            raise HTTPException(status_code=e.status_code, detail=e.message)

    # 2. Delete local database record
    db.delete(mapping)
    db.commit()

    return {"status": "success", "message": f"Domain '{mapping.domain}' removed successfully."}

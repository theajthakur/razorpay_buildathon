from fastapi import Header, HTTPException, Depends, Request
from sqlalchemy.orm import Session
from app.core.database import get_db
from app.system.models import DomainMapping, Onboarding

def resolve_merchant_by_host(
    request: Request,
    host: str = Header(None),
    db: Session = Depends(get_db)
) -> Onboarding:
    """
    FastAPI dependency that:
    1. Reads the incoming request's Host header.
    2. Looks up the matching domain_mappings record by host.
    3. Fetches the merchant onboarding profile by slug.
    4. Attaches the onboarding to the request context state.
    5. Returns a 404 if mapping or merchant is not found.
    """
    if not host:
        raise HTTPException(status_code=400, detail="Missing Host header")

    host_clean = host.strip()

    # Query the domain mapping database table
    mapping = db.query(DomainMapping).filter(DomainMapping.domain == host_clean).first()
    if not mapping:
        raise HTTPException(
            status_code=404,
            detail=f"No merchant mapping found for host: {host_clean}"
        )

    # Find the corresponding merchant onboarding record
    onboarding = db.query(Onboarding).filter(Onboarding.slug == mapping.slug).first()
    if not onboarding:
        raise HTTPException(
            status_code=404,
            detail=f"No onboarding configuration found for merchant slug: {mapping.slug}"
        )

    # Store on request.state.merchant for downstream handlers
    request.state.merchant = onboarding

    return onboarding

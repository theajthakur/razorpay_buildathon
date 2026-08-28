from urllib.parse import urlparse
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
    1. Resolves the host using x-forwarded-host, origin, referer, or host headers.
    2. Looks up the matching domain_mappings record by target host.
    3. Fetches the merchant onboarding profile by slug.
    4. Attaches the onboarding to the request context state.
    5. Returns a 404 if mapping or merchant is not found.
    """
    target_host = ""

    # 1. Check X-Forwarded-Host
    forwarded = request.headers.get("x-forwarded-host")
    if forwarded:
        target_host = forwarded.strip()

    # 2. Check Origin header (common for AJAX requests)
    if not target_host:
        origin = request.headers.get("origin")
        if origin:
            try:
                target_host = urlparse(origin).netloc
            except Exception:
                pass

    # 3. Check Referer header (common for widget embeds or pages)
    if not target_host:
        referer = request.headers.get("referer")
        if referer:
            try:
                target_host = urlparse(referer).netloc
            except Exception:
                pass

    # 4. Fall back to Host header
    if not target_host and host:
        target_host = host.strip()

    if not target_host:
        raise HTTPException(status_code=400, detail="Missing target host in request headers.")

    # Query the domain mapping database table
    mapping = db.query(DomainMapping).filter(DomainMapping.domain == target_host).first()
    if not mapping:
        raise HTTPException(
            status_code=404,
            detail=f"No merchant mapping found for host: {target_host}"
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

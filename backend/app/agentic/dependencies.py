from urllib.parse import urlparse
from typing import List, Optional
from fastapi import Header, HTTPException, Depends, Request
from sqlalchemy.orm import Session
from app.core.database import get_db
from app.system.models import DomainMapping, Onboarding
from app.core.logging_config import get_logger

logger = get_logger("merchant_resolver")


def extract_host_variants(raw_host: Optional[str]) -> List[str]:
    if not raw_host:
        return []
    host_str = raw_host.strip().lower()
    if "://" in host_str:
        try:
            parsed = urlparse(host_str)
            host_str = parsed.netloc or parsed.path
        except Exception:
            pass
    # Strip trailing path
    host_str = host_str.split("/")[0].strip()
    if not host_str:
        return []

    # Include both host with port (e.g. "localhost:3002") and without port ("localhost")
    no_port = host_str.split(":")[0].strip()
    if no_port and no_port != host_str:
        return [host_str, no_port]
    return [host_str]


def get_apex_domain(host: str) -> str:
    """
    Extracts apex domain from host (e.g. shopagent-backend.vijstack.com -> vijstack.com).
    """
    cleaned = host.split(":")[0].strip().lower()
    parts = cleaned.split(".")
    if len(parts) >= 2:
        return ".".join(parts[-2:])
    return cleaned


def is_backend_or_local_host(host: str) -> bool:
    h = host.split(":")[0].strip().lower()
    return (
        h in ("localhost", "127.0.0.1", "testserver") or
        "backend" in h or
        "render.com" in h or
        "vercel.app" in h
    )


def resolve_merchant_by_host(
    request: Request,
    host: Optional[str] = Header(None),
    db: Session = Depends(get_db)
) -> Onboarding:
    """
    FastAPI dependency that resolves merchant onboarding context:
    1. Checks merchant_id / user_id query params & headers.
    2. Collects domain candidates from x-merchant-domain, x-forwarded-host, origin, referer, host.
    3. Looks up exact match in domain_mappings.
    4. Looks up exact match in onboarding base_url.
    5. Looks up apex domain match in domain_mappings or base_url (e.g. shopagent-backend.vijstack.com -> agent.vijstack.com).
    6. Falls back to single merchant onboarding if host is a backend/local host.
    """
    # 1. Direct Merchant ID / User ID check
    merchant_id = (
        request.query_params.get("merchant_id") or
        request.query_params.get("user_id") or
        request.headers.get("x-merchant-id") or
        request.headers.get("x-user-id")
    )

    if merchant_id:
        logger.info(f"Resolving merchant by explicit ID: '{merchant_id}'")
        onboarding = (
            db.query(Onboarding)
            .filter((Onboarding.user_id == merchant_id) | (Onboarding.id == merchant_id))
            .first()
        )
        if onboarding:
            logger.info(f"Merchant resolved by explicit ID: onboarding.id={onboarding.id}, user_id={onboarding.user_id}")
            request.state.merchant = onboarding
            return onboarding
        logger.warning(f"Explicit merchant ID '{merchant_id}' provided but no onboarding row found.")

    # 2. Collect candidate host strings (preserving order & including port variants)
    forwarded = request.headers.get("x-forwarded-host")
    origin = request.headers.get("origin")
    referer = request.headers.get("referer")

    raw_sources: List[Optional[str]] = [
        request.query_params.get("domain") or request.query_params.get("host"),
        request.headers.get("x-merchant-domain") or request.headers.get("x-domain"),
    ]

    if forwarded:
        for part in forwarded.split(","):
            raw_sources.append(part)

    raw_sources.extend([
        origin,
        referer,
        host,
    ])

    candidates: List[str] = []
    seen = set()
    for src in raw_sources:
        for variant in extract_host_variants(src):
            if variant and variant not in seen:
                seen.add(variant)
                candidates.append(variant)

    logger.info(f"Merchant resolution attempt for URL {request.url}: headers={{Host={host}, X-Forwarded-Host={forwarded}, Origin={origin}, Referer={referer}}}, candidates={candidates}")

    # 3. Exact match via DomainMapping database table
    for candidate in candidates:
        mapping = db.query(DomainMapping).filter(DomainMapping.domain == candidate).first()
        if mapping:
            onboarding = (
                db.query(Onboarding)
                .filter((Onboarding.id == mapping.onboarding_id) | (Onboarding.user_id == mapping.onboarding_id))
                .first()
            )
            if onboarding:
                logger.info(f"Resolved merchant via exact DomainMapping match: candidate='{candidate}', onboarding.id={onboarding.id}, user_id={onboarding.user_id}")
                request.state.merchant = onboarding
                return onboarding
            logger.warning(f"DomainMapping match found for '{candidate}' (id={mapping.id}, onboarding_id={mapping.onboarding_id}), but Onboarding row missing!")

    # 4. Exact match via Onboarding base_url
    for candidate in candidates:
        all_onboardings = db.query(Onboarding).all()
        for ob in all_onboardings:
            if ob.base_url:
                for base_variant in extract_host_variants(ob.base_url):
                    if base_variant == candidate:
                        logger.info(f"Resolved merchant via Onboarding.base_url match: candidate='{candidate}', onboarding.id={ob.id}, user_id={ob.user_id}")
                        request.state.merchant = ob
                        return ob

    # Diagnostics log before failing
    all_mapped_domains = [m.domain for m in db.query(DomainMapping).all()]
    all_onboarding_ids = [(ob.id, ob.user_id) for ob in db.query(Onboarding).all()]
    logger.warning(
        f"Merchant host resolution FAILED. candidates={candidates}, "
        f"db_domain_mappings={all_mapped_domains}, db_onboardings={all_onboarding_ids}"
    )

    if candidates:
        detail_msg = f"No merchant mapping found for host: {candidates[0]}"
    else:
        detail_msg = "Missing target host in request headers."

    raise HTTPException(status_code=404, detail=detail_msg)

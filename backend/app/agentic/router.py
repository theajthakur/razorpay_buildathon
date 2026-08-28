from fastapi import APIRouter, Depends, HTTPException
from app.system.models import Onboarding
from app.agentic.dependencies import resolve_merchant_by_host

router = APIRouter()
public_router = APIRouter()

@public_router.get("/branding")
def get_public_branding(
    onboarding: Onboarding = Depends(resolve_merchant_by_host)
):
    """
    Exposes the resolved merchant's public branding configuration.
    Requires no auth headers. Resolves merchant context from Host header.
    """
    branding_config = onboarding.branding_config
    if not branding_config or not isinstance(branding_config, dict):
        raise HTTPException(
            status_code=404,
            detail="Branding configuration not found for this merchant."
        )
    return branding_config

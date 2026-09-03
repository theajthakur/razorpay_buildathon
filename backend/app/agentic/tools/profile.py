import sys
from sqlalchemy.orm import Session
from app.system.models import Onboarding
from app.agentic.auth_utils import extract_by_path
from app.agentic.deps import get_merchant_auth_headers as default_get_merchant_auth_headers
from app.agentic.merchant_api import call_merchant_api as default_call_merchant_api
from app.agentic.tools.products import _pick
from app.core.logging_config import get_logger

default_agent_logger = get_logger("agent")

def _getattr(name, default):
    mod = sys.modules.get("app.agentic.router")
    return getattr(mod, name, default) if mod else default

PROFILE_FIELD_CANDIDATES = {
    "name": ["name", "full_name", "user_name", "customer_name"],
    "email": ["email", "customer_email"],
    "loyalty_tier": ["loyalty_tier", "tier", "membership_tier", "level"],
    "member_since": ["member_since", "created_at", "joined_at", "registration_date"],
}

async def execute_get_customer_profile(merchant_id: str, session: dict, db: Session) -> dict:
    agent_logger = _getattr("agent_logger", default_agent_logger)
    get_merchant_auth_headers = _getattr("get_merchant_auth_headers", default_get_merchant_auth_headers)
    call_merchant_api = _getattr("call_merchant_api", default_call_merchant_api)

    agent_logger.info(f"Fetching customer profile: merchant={merchant_id}, customer={session.get('customer_ref')}")
    onboarding = db.query(Onboarding).filter(Onboarding.user_id == merchant_id).first()
    if not onboarding or not onboarding.customer_profile_config:
        agent_logger.warning(f"Customer profile fetch aborted: onboarding config missing for merchant={merchant_id}")
        return {"error": "onboarding_config_not_found", "profile": None}

    config = onboarding.customer_profile_config
    path = config.get("path", "")
    method = (config.get("method") or "GET").upper()
    response_key = config.get("response_key", "profile")

    if not path:
        return {"error": "customer_profile_config_invalid", "profile": None}

    url = f"{onboarding.base_url.rstrip('/')}/{path.lstrip('/')}"
    headers = {}
    if onboarding.auth_enabled:
        try:
            headers = get_merchant_auth_headers(session=session, db=db)
        except Exception as e:
            agent_logger.warning(f"Failed to resolve auth headers for get_customer_profile: {e}")

    resp = await call_merchant_api(
        method, url,
        headers=headers,
        context="get_customer_profile",
    )
    resp.raise_for_status()

    json_data = resp.json()
    raw_profile = extract_by_path(json_data, response_key, default=json_data)
    if not isinstance(raw_profile, dict):
        raw_profile = json_data if isinstance(json_data, dict) else {}

    profile = {}
    for field, candidates in PROFILE_FIELD_CANDIDATES.items():
        try:
            val = _pick(raw_profile, candidates, field)
            if val is not None and str(val).strip():
                profile[field] = val
        except KeyError:
            pass

    if "email" not in profile and session.get("customer_ref"):
        profile["email"] = session.get("customer_ref")

    agent_logger.info(f"Customer profile fetched: merchant={merchant_id}")
    return {"profile": profile}

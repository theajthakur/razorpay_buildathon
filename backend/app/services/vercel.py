import httpx
from typing import Dict, Any, Optional
from app.core.config import get_settings
from app.core.logging_config import get_logger

logger = get_logger("vercel_service")


class VercelError(Exception):
    """Base exception for Vercel service errors."""
    def __init__(self, message: str, status_code: int = 500):
        super().__init__(message)
        self.message = message
        self.status_code = status_code


class VercelConfigurationError(VercelError):
    def __init__(self, message: str = "Vercel credentials (VERCEL_TOKEN_KEY or VERCEL_PROJECT_ID) are not configured."):
        super().__init__(message, status_code=503)


class VercelDomainConflictError(VercelError):
    def __init__(self, message: str = "Domain already exists or is owned by another Vercel project."):
        super().__init__(message, status_code=409)


class VercelAPIError(VercelError):
    def __init__(self, message: str, status_code: int = 400):
        super().__init__(message, status_code=status_code)


class VercelServiceUnavailableError(VercelError):
    def __init__(self, message: str = "Unable to connect to Vercel API services."):
        super().__init__(message, status_code=502)


def get_vercel_credentials():
    settings = get_settings()
    token = settings.VERCEL_TOKEN_KEY
    project_id = settings.VERCEL_PROJECT_ID
    if not token or not project_id:
        logger.error("Vercel credentials missing in environment variables.")
        raise VercelConfigurationError()
    return token, project_id


def add_domain_to_vercel(domain: str) -> Dict[str, Any]:
    """
    Submits a custom domain to the configured Vercel project via Vercel REST API.
    Retrieves project domain details and Vercel domain configuration (exact CNAME target & verification).
    """
    token, project_id = get_vercel_credentials()
    url = f"https://api.vercel.com/v10/projects/{project_id}/domains"
    config_url = f"https://api.vercel.com/v6/domains/{domain}/config?projectIdOrName={project_id}"
    headers = {
        "Authorization": f"Bearer {token}",
        "Content-Type": "application/json",
    }
    payload = {"name": domain}

    try:
        with httpx.Client(timeout=15.0) as client:
            response = client.post(url, headers=headers, json=payload)
            # Try fetching Vercel domain config for specific CNAME target & misconfigured status
            config_resp = client.get(config_url, headers=headers)
    except Exception as e:
        logger.error(f"Failed HTTP connection to Vercel API: {e}")
        raise VercelServiceUnavailableError(f"Failed to communicate with Vercel API: {str(e)}")

    if response.status_code in (200, 201):
        data = response.json()
        logger.info(f"Successfully added domain '{domain}' to Vercel project.")
        
        config_data = {}
        if config_resp.status_code == 200:
            try:
                config_data = config_resp.json()
            except Exception:
                pass

        data["config"] = config_data
        return data

    error_data = {}
    try:
        error_data = response.json().get("error", {})
    except Exception:
        pass

    error_code = error_data.get("code", "")
    error_msg = error_data.get("message", response.text)

    if response.status_code == 409 or "already" in error_code.lower() or "already" in error_msg.lower() or "domain_taken" in error_code.lower():
        raise VercelDomainConflictError(f"Domain '{domain}' already exists in Vercel or belongs to another project.")
    
    if response.status_code >= 500:
        raise VercelServiceUnavailableError(f"Vercel server error: {error_msg}")

    raise VercelAPIError(f"Vercel API error: {error_msg}", status_code=response.status_code)


def verify_domain_on_vercel(domain: str) -> Dict[str, Any]:
    """
    Triggers domain verification check on Vercel and retrieves current configuration status.
    Returns dict: {"verified": bool, "dns_details": dict, "raw": dict}
    """
    token, project_id = get_vercel_credentials()
    headers = {
        "Authorization": f"Bearer {token}",
        "Content-Type": "application/json",
    }

    verify_url = f"https://api.vercel.com/v9/projects/{project_id}/domains/{domain}/verify"
    get_url = f"https://api.vercel.com/v9/projects/{project_id}/domains/{domain}"
    config_url = f"https://api.vercel.com/v6/domains/{domain}/config?projectIdOrName={project_id}"

    try:
        with httpx.Client(timeout=15.0) as client:
            # 1. Trigger verification call
            verify_resp = client.post(verify_url, headers=headers)
            # 2. Fetch project domain details
            get_resp = client.get(get_url, headers=headers)
            # 3. Fetch domain config for specific CNAME target & misconfigured flag
            config_resp = client.get(config_url, headers=headers)
    except Exception as e:
        logger.error(f"Failed HTTP connection to Vercel API during verification: {e}")
        raise VercelServiceUnavailableError(f"Failed to communicate with Vercel API: {str(e)}")

    data = {}
    if get_resp.status_code == 200:
        data = get_resp.json()
    elif verify_resp.status_code == 200:
        data = verify_resp.json()
    else:
        err_msg = get_resp.text or verify_resp.text
        if get_resp.status_code == 404:
            raise VercelAPIError(f"Domain '{domain}' not found in Vercel project.", status_code=404)
        raise VercelAPIError(f"Failed to verify domain on Vercel: {err_msg}", status_code=get_resp.status_code)

    config_data = {}
    if config_resp.status_code == 200:
        try:
            config_data = config_resp.json()
        except Exception:
            pass

    project_verified = data.get("verified", False)
    misconfigured = config_data.get("misconfigured", True)
    
    # Domain is truly verified ONLY if project verified is True AND misconfigured is False
    is_fully_verified = project_verified and (not misconfigured)

    rec_cnames = config_data.get("recommendedCNAME", [])
    cname_target = None
    if rec_cnames and isinstance(rec_cnames, list):
        for item in rec_cnames:
            if isinstance(item, dict) and item.get("rank") == 1:
                cname_target = str(item.get("value", "")).rstrip(".")
                break
        if not cname_target and len(rec_cnames) > 0 and isinstance(rec_cnames[0], dict):
            cname_target = str(rec_cnames[0].get("value", "")).rstrip(".")

    if not cname_target:
        cnames = config_data.get("cnames", [])
        if cnames and isinstance(cnames, list) and len(cnames) > 0:
            cname_target = str(cnames[0]).rstrip(".")
        else:
            cname_target = "cname.vercel-dns.com"

    dns_details = {
        "verified": is_fully_verified,
        "misconfigured": misconfigured,
        "recommendedCNAME": rec_cnames,
        "recommendedIPv4": config_data.get("recommendedIPv4", []),
        "cname_target": cname_target,
        "cnames": config_data.get("cnames", []),
        "aValues": config_data.get("aValues", []),
        "nameservers": config_data.get("nameservers", []),
        "configuredBy": config_data.get("configuredBy"),
        "serviceType": config_data.get("serviceType"),
        "verification": data.get("verification", []),
        "apexName": data.get("apexName"),
        "gitBranch": data.get("gitBranch"),
    }

    return {
        "verified": is_fully_verified,
        "dns_details": dns_details,
        "raw": data
    }


def delete_domain_from_vercel(domain: str) -> bool:
    """
    Removes a custom domain from the configured Vercel project.
    """
    token, project_id = get_vercel_credentials()
    url = f"https://api.vercel.com/v9/projects/{project_id}/domains/{domain}"
    headers = {
        "Authorization": f"Bearer {token}",
    }

    try:
        with httpx.Client(timeout=15.0) as client:
            response = client.delete(url, headers=headers)
    except Exception as e:
        logger.error(f"Failed HTTP connection to Vercel API during domain deletion: {e}")
        raise VercelServiceUnavailableError(f"Failed to communicate with Vercel API: {str(e)}")

    if response.status_code in (200, 204, 404):
        logger.info(f"Domain '{domain}' deleted from Vercel project (status code {response.status_code}).")
        return True

    err_msg = response.text
    raise VercelAPIError(f"Failed to delete domain from Vercel: {err_msg}", status_code=response.status_code)

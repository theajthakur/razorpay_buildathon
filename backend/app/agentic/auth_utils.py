import jwt
from datetime import datetime, timedelta, timezone

MAX_SESSION_TTL = timedelta(hours=1)

def resolve_session_expiry(merchant_token: str, merchant_auth_response: dict) -> datetime:
    """
    Decides the final session expiry time.
    Calculates the minimum between the merchant token's expiry and the MAX_SESSION_TTL (1 hour).
    """
    now = datetime.now(timezone.utc)
    cap = now + MAX_SESSION_TTL

    # 1. Try decoding the merchant token as a JWT to extract exp claim (no signing key validation)
    try:
        decoded = jwt.decode(merchant_token, options={"verify_signature": False})
        if decoded.get("exp"):
            exp_val = decoded["exp"]
            exp = datetime.fromtimestamp(exp_val, tz=timezone.utc)
            return min(exp, cap)
    except jwt.exceptions.DecodeError:
        pass

    # 2. Check for explicit expires_in offset (in seconds)
    if "expires_in" in merchant_auth_response:
        try:
            seconds = int(merchant_auth_response["expires_in"])
            return min(now + timedelta(seconds=seconds), cap)
        except (ValueError, TypeError):
            pass

    # 3. Check for explicit expires_at ISO date string
    if "expires_at" in merchant_auth_response:
        try:
            iso_str = merchant_auth_response["expires_at"]
            if iso_str.endswith("Z"):
                iso_str = iso_str[:-1] + "+00:00"
            exp = datetime.fromisoformat(iso_str)
            if exp.tzinfo is None:
                exp = exp.replace(tzinfo=timezone.utc)
            return min(exp, cap)
        except Exception:
            pass

    # 4. Fallback default
    return cap


def get_value_by_path(d: dict, path: str):
    """
    Resolves a nested dictionary value using a dot-separated path.
    Example: get_value_by_path({"data": {"token": "abc"}}, "data.token") -> "abc"
    """
    if not path:
        return None
    parts = path.split(".")
    curr = d
    for p in parts:
        if isinstance(curr, dict) and p in curr:
            curr = curr[p]
        else:
            return None
    return curr


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


def extract_by_path(data: dict, path: str, default=None):
    """
    Resolves a nested dictionary value using a dot-separated path like 'data.products'.
    Returns `default` if any segment is missing.
    """
    if not path or not isinstance(data, (dict, list)):
        return default
    current = data
    for part in path.split("."):
        if not isinstance(current, dict) or part not in current:
            return default
        current = current[part]
    return current if current is not None else default

def get_value_by_path(d: dict, path: str, default=None):
    return extract_by_path(d, path, default=default)

def find_list_in_dict(obj, target_key: str | None = None) -> list | None:
    """
    Recursively searches obj (dict/list) for a list matching target_key (or dot path),
    or any list containing dictionary items.
    """
    if isinstance(obj, list):
        return obj

    if not isinstance(obj, dict):
        return None

    # 1. If dot-notation path like 'data.products' is passed
    if target_key:
        extracted = extract_by_path(obj, target_key)
        if isinstance(extracted, list):
            return extracted

    # 2. Check if target_key exists directly at this level
    if target_key and target_key in obj:
        val = obj[target_key]
        if isinstance(val, list):
            return val
        if isinstance(val, dict):
            res = find_list_in_dict(val, target_key)
            if res is not None:
                return res

    # 3. Check for common container keys if target_key wasn't found at top level
    for candidate_key in [target_key, "products", "items", "data", "results", "catalog", "menu", "records"]:
        if candidate_key and candidate_key in obj:
            val = obj[candidate_key]
            if isinstance(val, list):
                return val
            if isinstance(val, dict):
                res = find_list_in_dict(val, target_key)
                if res is not None:
                    return res

    # 4. Deep search all dict values for any list of dicts
    for k, val in obj.items():
        if isinstance(val, list) and len(val) > 0 and isinstance(val[0], dict):
            return val
        if isinstance(val, dict):
            res = find_list_in_dict(val, target_key)
            if res is not None:
                return res

    return None


import httpx
from app.core.logging_config import get_logger

_merchant_logger = get_logger("merchant_api")

async def call_merchant_api(
    method: str,
    url: str,
    *,
    headers: dict | None = None,
    json_body: dict | None = None,
    params: dict | None = None,
    context: str = "",
    redact_body_keys: list[str] | None = None,
    timeout: float = 15.0
) -> httpx.Response:
    """
    Calls a merchant API and logs full error details on failure before the caller decides how to handle it.
    Never logs the Authorization header value itself — only whether one was present (<redacted>).
    Supports redacting specific body keys (e.g. password) in the logged request body while sending unredacted payload.
    """
    safe_headers_summary = {
        k: ("<redacted>" if k.lower() == "authorization" else v)
        for k, v in (headers or {}).items()
    }

    safe_json_body = json_body
    if json_body and isinstance(json_body, dict):
        safe_json_body = dict(json_body)
        if redact_body_keys:
            for key in redact_body_keys:
                if key in safe_json_body:
                    safe_json_body[key] = "<redacted>"

    method_upper = method.upper()

    async with httpx.AsyncClient() as client:
        try:
            if method_upper == "GET":
                resp = await client.get(url, params=params, headers=headers, timeout=timeout)
            elif method_upper == "POST":
                resp = await client.post(url, json=json_body, params=params, headers=headers, timeout=timeout)
            elif method_upper == "PUT":
                resp = await client.put(url, json=json_body, params=params, headers=headers, timeout=timeout)
            elif method_upper == "PATCH":
                resp = await client.patch(url, json=json_body, params=params, headers=headers, timeout=timeout)
            elif method_upper == "DELETE":
                resp = await client.delete(url, params=params, headers=headers, timeout=timeout)
            else:
                resp = await client.request(method_upper, url, json=json_body, params=params, headers=headers, timeout=timeout)
        except httpx.RequestError as e:
            _merchant_logger.error(
                f"[{context}] Request failed before a response was received: {method_upper} {url} — {e!r}"
            )
            raise

    if resp.status_code >= 400:
        body_preview = resp.text[:2000]  # cap logged body length to 2000 chars
        _merchant_logger.error(
            f"[{context}] Merchant API error: {method_upper} {url} -> {resp.status_code}\n"
            f"  Headers sent: {safe_headers_summary}\n"
            f"  Request body: {safe_json_body}\n"
            f"  Response body: {body_preview}"
        )

    return resp

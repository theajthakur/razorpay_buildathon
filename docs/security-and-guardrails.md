# Security & Guardrails

Detailed specification of ShopAgent's authentication mechanisms, authorization scoping, credential protection, AI execution guardrails, and frontend/backend security boundaries.

## Related Documentation

- [Architecture](architecture.md)
- [Agentic Commerce](agentic-commerce.md)
- [Payment Flow](payment-flow.md)
- [Failure Recovery](failure-recovery.md)
- [Merchant Integration](merchant-integration.md)
- [Custom Domains](custom-domains.md)
- [API Reference](api-reference.md)

---

## 1. Merchant Authentication (Clerk RS256 JWKS)

Merchants log into the **Merchant Dashboard** (`frontend_main`) via Clerk authentication.

```
Merchant Browser → Authorization: Bearer <Clerk JWT> → FastAPI get_current_user Guard
                                                                 ↓
                                                      PyJWKClient (JWKS Cache)
                                                                 ↓
                                                      RS256 Signature & Expiry Check
                                                                 ↓
                                                      Database Lookup / Auto-Heal User
```

- **Token Verification**: `get_current_user` in `app/core/security.py` extracts the Bearer token and verifies its RS256 signature against Clerk's JSON Web Key Set (`CLERK_JWKS_URL`) using `jwt.PyJWKClient`.
- **Auto-Healing User Creation**: If a merchant authenticates with a valid Clerk JWT whose Clerk ID (`sub`) is not yet present in the PostgreSQL `users` table, ShopAgent automatically creates a user row with `status = "approved"` (or `pending`). Email collisions are automatically resolved by suffixing `[duplicate]`.
- **Status Authorization**: `get_current_approved_user` enforces that the merchant account status is explicitly set to `"approved"`, returning `403 Forbidden` if blocked or pending.

---

## 2. Customer Authentication & Session Management

Customers interact with the **AI Storefront** (`frontend_agent`) without direct Clerk accounts.

```
Customer Login → POST /api/public/auth/login → Merchant Auth API Endpoint
                                                       ↓
                                            Extract Merchant Bearer Token
                                                       ↓
                                            Fernet Encrypt Token → PostgreSQL
                                                       ↓
                                            Issue ShopAgent HS256 JWT
```

- **Dynamic Merchant Auth Proxy**: Customers log in via `/api/public/auth/login`. ShopAgent proxies the credentials to the merchant's own authentication API (`Onboarding.auth_config`), extracting the returned merchant session token.
- **Credential Protection**: The merchant API token is encrypted using AES-256-CBC via `cryptography.fernet.Fernet` (`MERCHANT_TOKEN_ENCRYPTION_KEY`) before being saved to `MerchantUserSession.merchant_token_encrypted`. Plaintext merchant tokens are **never written to logs** or exposed to the client browser.
- **ShopAgent JWT**: ShopAgent issues its own HS256 JWT to the customer containing:
  - `sub`: `MerchantUserSession.id`
  - `merchant_id`: Clerk user ID of the merchant
  - `customer_ref`: Customer email / ID
  - `exp`: Calculated expiry (minimum of merchant token expiry and `MAX_SESSION_TTL` = 1 hour).
- **Logout**: `POST /agentic/auth/logout` immediately deletes the `MerchantUserSession` record from PostgreSQL, invalidating the session server-side.

---

## 3. Merchant API Key Security (`sk_live_...`)

External servers authenticate against ShopAgent (e.g., for order verification) using API Keys managed via the Merchant Dashboard.

- **Key Format**: `sk_live_<24 random Base64URL bytes>`.
- **Key Prefix & Hashing**:
  - The first 6 characters of the random payload serve as `key_prefix` for fast indexing.
  - The raw key is hashed using **HMAC-SHA256** with a server-side pepper secret (`API_KEY_HMAC_SECRET`).
  - Raw API keys are returned **exactly once** upon creation and are **never stored** in readable form.
- **Active & Paused States**: API Keys have a status column (`active` or `paused`). Paused keys return `401 Unauthorized`.
- **Debounced Access Tracking**: `last_used_at` timestamps are updated at most once every 60 seconds to avoid database write contention.
- **Multiple Header/Query Support**: Key validation accepts `Authorization: Bearer <key>`, `Authorization: <key>`, `X-API-Key: <key>`, or `?api_key=<key>`.

---

## 4. Multi-Tenant Data Isolation

ShopAgent enforces multi-tenancy at both the HTTP routing layer and database access layer:

1. **Host-Based Resolution**: `resolve_merchant_by_host` resolves the current `Onboarding` tenant context from HTTP headers (`Host`, `X-Forwarded-Host`, `Origin`, `Referer`) or `merchant_id` parameters.
2. **Explicit Database Scoping**: Every database query across cart items, orders, conversations, and merchant sessions explicitly scopes by `merchant_id`:
   ```python
   db.query(CartItem).filter(
       CartItem.merchant_id == session["merchant_id"],
       CartItem.customer_email == session["customer_ref"]
   )
   ```
3. **Cross-Tenant Access Prevention**: Conversation routes (`GET /agentic/conversations/{id}/messages`) verify that both `convo.user_email == session["customer_ref"]` and `convo.merchant_id == session["merchant_id"]` match before returning messages.

---

## 5. AI Guardrails & Execution Constraints

To prevent AI model hallucinations and unauthorized actions, strict guardrails are enforced in `app/agentic/llm/prompts.py` and tool implementations:

```
┌─────────────────────────────────────────────────────────────────────────┐
│                      AI GUARDRAIL RULES                              │
├─────────────────────────────────────────────────────────────────────────┤
│ 1. Mandatory Tool Execution Rule:                                       │
│    Model MUST execute create_order tool function call. Text replies     │
│    claiming "Order is placed" without function call are PROHIBITED.     │
│                                                                         │
│ 2. Explicit Confirmation Required:                                      │
│    create_order is ONLY dispatched after explicit customer purchase     │
│    confirmation ("yes", "confirm", "buy now").                          │
│                                                                         │
│ 3. No Fake Payment Capture Claims:                                      │
│    Model CANNOT inform customer payment is "completed" or "captured"    │
│    unless verified server-side via HMAC SHA256 signature.               │
│                                                                         │
│ 4. Live Price Snapshotting:                                             │
│    Item prices are calculated from active cart items and live catalog;   │
│    the model cannot invent custom prices in tool calls.                │
│                                                                         │
│ 5. Cart Quantity & Size Caps:                                           │
│    Max 5 unique cart items; max 20 quantity per line item.              │
└─────────────────────────────────────────────────────────────────────────┘
```

---

## 6. Frontend / Backend Security Boundaries

| Secret / Credential | Storage Location | Accessible to Frontend? | Usage / Purpose |
|---|---|---|---|
| `RAZORPAY_KEY_SECRET` | Backend `.env` | **NO** | Server-side HMAC SHA256 signature verification. |
| `RAZORPAY_KEY_ID` | Backend `.env` | **YES** (passed in metadata) | Initializing client-side Razorpay Checkout modal. |
| `CLERK_WEBHOOK_SECRET` | Backend `.env` | **NO** | Svix signature verification for Clerk webhooks. |
| `API_KEY_HMAC_SECRET` | Backend `.env` | **NO** | Server-side HMAC pepper for API key hashing. |
| `MERCHANT_TOKEN_ENCRYPTION_KEY` | Backend `.env` | **NO** | Fernet encryption/decryption of merchant tokens. |
| `JWT_SECRET` | Backend `.env` | **NO** | Signing customer session JWTs (HS256). |
| Customer Password | In-Memory (login execution) | **NO** (Redacted in logs) | Proxied to merchant auth API; never stored. |

---

## 7. Known Production Hardening Opportunities

Based on strict code inspection of the current implementation, the following areas represent production hardening opportunities:

1. **SSRF Protection on Merchant Base URLs**: Merchant base URLs (`Onboarding.base_url`) are currently accepted as configured. In production, an IP egress filter or domain allowlist should prevent backend outgoing HTTP requests to internal IP ranges (`127.0.0.1`, `169.254.169.254`, `10.0.0.0/8`).
2. **Query Parameter API Key Leakage**: API Key authentication supports `?api_key=sk_live_...`. While convenient for testing, query parameters may appear in web server access logs. Production recommendation is enforcing header-based delivery (`Authorization` or `X-API-Key`).
3. **Rate Limiting**: `POST /api/public/auth/login` and `POST /agentic/conversations/{id}/messages` currently rely on infrastructure-level rate limiting. Application-level Redis rate-limiting (e.g., slowapi) is recommended for burst protection.
4. **Durable Webhook Outbox**: Merchant webhooks (`send_merchant_webhook`) execute via in-memory `asyncio.create_task()` with 3 retries. A durable PostgreSQL transactional outbox or Redis queue (Celery/ARQ) would ensure delivery across backend service restarts.

# Task: API Key Management — Backend, Schema, and CRUD Endpoints

## Context

Merchant Dashboard → Settings → API Keys needs to feel like a real production feature (think Stripe/Vercel/Razorpay's own API key screens), not a toy CRUD form. This covers schema, key generation/hashing, and the endpoints. A follow-up prompt will cover the frontend UI — this one should produce a backend contract clean enough for that UI to build against without backend changes later.

First inspect the existing codebase for auth/session conventions, DB client/ORM, and existing route patterns, and match all new code to them.

## Database schema

Table: `api_keys`

| Column | Type | Notes |
|---|---|---|
| `id` | UUID | Primary key |
| `customer_id` | string/UUID (FK) | References the merchant/account owning this key |
| `name` | string | User-friendly label, e.g. "Production" |
| `key_prefix` | string | First 6 chars of the secret portion, shown in UI to identify the key without exposing it |
| `key_hash` | string | HMAC-SHA256 hash of the full key — never store or log the raw key |
| `status` | enum | `active`, `revoked` |
| `created_at` | timestamp | |
| `expires_at` | timestamp, nullable | Optional expiry |
| `last_used_at` | timestamp, nullable | Updated on each successful authenticated request using this key |
| `revoked_at` | timestamp, nullable | Set when status transitions to `revoked` |

**Constraints**
- `UNIQUE (customer_id, name)` — composite uniqueness at the DB level, even though the frontend also pre-validates this client-side. Treat the DB constraint as the source of truth; the client-side check is UX sugar, not the actual guarantee.
- Add an index on `(customer_id, status)` for fast "list active keys" and limit-check queries.
- Add an index on `key_prefix` if you'll ever need to look up by prefix (e.g. for support/debugging — never for auth, auth always uses the full-key hash).

## Key generation & hashing

- Generate keys as `sk_live_<32+ random bytes, base62 or hex>` (use `sk_test_` for a sandbox/test-mode key if the project has one — confirm against existing implementation before assuming test mode exists).
- `key_prefix` = first 6 characters of the random portion (not including the `sk_live_` label), stored in plaintext for display — e.g. user sees `sk_live_7f8a3b••••••••••••`.
- Hash the **full generated key** (not just the random portion) using HMAC-SHA256 with a server-side secret pepper stored in an env var (e.g. `API_KEY_HMAC_SECRET`) — this is HMAC, not plain SHA-256, so the hash can't be reversed via rainbow tables even if the DB leaks, and can't be forged without the pepper even if hashing logic is known.
- The full raw key is returned to the client **exactly once**, in the create-key response. It is never stored, logged, or retrievable again after that — the UI must make this unmissable (handled in the frontend prompt).

## Business rules

- **Max 5 keys per merchant, counting ALL statuses.** Every row for a `customer_id` counts toward the cap regardless of `active`/`revoked` — revoking a key does **not** free up a slot. Enforce this server-side regardless of what the frontend shows.
- **Name uniqueness applies across ALL statuses.** A name used by a revoked key is still taken — `(customer_id, name)` must be unique across every row for that merchant, not just active ones. Return a clear `409 Conflict` with a specific error code (e.g. `duplicate_key_name`) if violated, so the frontend can show a friendly message even if its own client-side pre-check somehow got out of sync (e.g. two tabs open).
- **Revoke is soft-delete.** Revoked keys are kept for audit history, not hard-deleted. Once revoked, a key immediately fails authentication regardless of `expires_at`.
- **Expiry is passive.** No cron job required — check `expires_at < now()` at the moment the key is used to authenticate a request, and treat expired keys as invalid (but leave `status` as `active` in the DB unless you want a separate cleanup job later; document this choice either way).
- **`last_used_at` updates** should happen on the authentication middleware path for every key-authenticated request, but debounce/batch this write (e.g. update at most once per minute per key) rather than writing on every single request, to avoid hammering the DB on high-traffic keys.

## Endpoints

All endpoints require the merchant's session auth (however the existing dashboard already authenticates merchants — reuse that, this is not the API-key-based auth used by *external* callers).

### `POST /api/dashboard/keys` — Create key
**Request**
```json
{ "name": "Production" }
```
**Logic**
1. Validate `name` is non-empty, reasonable length (e.g. max 100 chars).
2. Check **total** key count (all statuses) for this `customer_id` — if ≥ 5, return `403` with code `key_limit_reached`. Revoked keys still count.
3. Check `(customer_id, name)` uniqueness across **all statuses** — return `409` with code `duplicate_key_name` if it already exists, even if the existing row is revoked (this is a safety net; frontend should already prevent this case in the common path).
4. Generate key, compute prefix + HMAC hash, insert row with `status: active`.
5. Return the **raw key once**, plus the row's metadata.

**Response**
```json
{
  "id": "uuid",
  "name": "Production",
  "key_prefix": "7f8a3b",
  "api_key": "sk_live_7f8a3b9c2d4e6f1a8b0c...",
  "status": "active",
  "created_at": "2026-08-24T10:00:00Z",
  "expires_at": null
}
```
Note `api_key` only ever appears in this create response — never in any GET/list response afterward.

### `GET /api/dashboard/keys` — List keys
Returns all keys for the authenticated merchant, **never** including `key_hash` or the raw key. Include `name` in the list so the frontend can do client-side duplicate-name validation without a network round trip on every keystroke.

**Response**
```json
{
  "keys": [
    {
      "id": "uuid",
      "name": "Production",
      "key_prefix": "7f8a3b",
      "status": "active",
      "created_at": "2026-08-24T10:00:00Z",
      "expires_at": null,
      "last_used_at": "2026-08-24T15:22:10Z",
      "revoked_at": null
    }
  ],
  "active_count": 1,
  "total_count": 1,
  "max_keys": 5
}
```
Note `active_count` here is a display detail only ("2 of 5 currently active"); the field that actually gates the "Generate" button is `total_count` — include both: `"active_count": 1, "total_count": 3, "max_keys": 5`. `total_count` reaching `max_keys` disables key creation even if `active_count` is lower, since revoked keys still occupy a slot.

### `PATCH /api/dashboard/keys/:id/revoke` — Revoke key
No body needed. Sets `status: revoked`, `revoked_at: now()`. Idempotent — revoking an already-revoked key returns `200` without error, not a `409`.

**Response**
```json
{ "id": "uuid", "status": "revoked", "revoked_at": "2026-08-24T16:00:00Z" }
```

## Error response format
Match whatever error shape the rest of the dashboard API already uses; if none exists yet, use:
```json
{ "error": { "code": "duplicate_key_name", "message": "You already have a key named \"Production\"." } }
```

## Acceptance checks
- Creating a 6th key (counting active + revoked together) is rejected with `key_limit_reached`, even if attempted via direct API call bypassing the UI. Revoking an existing key does not free up a slot.
- Creating a key with a name matching an existing key for the same merchant — active *or* revoked — returns `duplicate_key_name`. Revoked keys' names are never reusable.
- The raw key is retrievable exactly once, at creation, and is unrecoverable afterward (confirm no logging path — including error/exception logs — ever captures the raw key).
- `GET /keys` never returns `key_hash` or a raw key under any circumstance, including error paths.
- Revoking a key immediately invalidates it for authentication on the very next request, not eventually-consistent.
- `last_used_at` updates on real usage without introducing a write on every single request (debounced).
- DB-level unique constraint on `(customer_id, name)` exists and is verified with a test that attempts a duplicate insert directly, bypassing the API layer.
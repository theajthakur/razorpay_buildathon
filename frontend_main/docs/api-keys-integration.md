# Developer Reference: API Key Management Integration

This document outlines the architecture, database schema, endpoint contracts, and security enforcement policies for the merchant API Key Management system.

---

## 1. Hashing & Security Design

### Key Formats
- Keys are generated on the server with format: `sk_live_<24 random bytes in Base64URL>` (producing a total length of 40 characters, with a 32-character random portion).
- `key_prefix` consists of the first 6 characters of the random portion (e.g., `7f8a3b`).

### Secret Hashing (HMAC-SHA256)
- The raw secret is **never stored** in the database.
- It is hashed exactly once using HMAC-SHA256 with a server-side pepper key:
  ```python
  hashed_key = hmac.new(
      pepper.encode("utf-8"),
      raw_key.encode("utf-8"),
      hashlib.sha256
  ).hexdigest()
  ```
- This prevents rainbow table lookups if the database is leaked.
- The raw key is returned in the API response **exactly once** upon creation, after which it is unrecoverable.

---

## 2. Database Schema (`api_keys` Table)

| Column | Type | Description |
|---|---|---|
| `id` | VARCHAR (PK) | Unique key identifier (UUID v4 string) |
| `customer_id` | VARCHAR (FK) | Owner merchant, maps to `users.id` (`ondelete="CASCADE"`) |
| `name` | VARCHAR | User-friendly label (e.g., "Production") |
| `key_prefix` | VARCHAR | First 6 chars of secret for display (Index) |
| `key_hash` | VARCHAR | HMAC-SHA256 signature hash of the full key |
| `status` | VARCHAR | Current state: `active` or `paused` (Default `active`) |
| `created_at` | TIMESTAMPTZ | Creation timestamp |
| `expires_at` | TIMESTAMPTZ | Optional expiration date (Nullable) |
| `last_used_at` | TIMESTAMPTZ | Last authenticated request timestamp (Nullable) |

### Constraints & Indexes
- **Name Uniqueness**: Composite unique constraint `UniqueConstraint("customer_id", "name", name="uq_customer_id_name")` prevents duplicate names per merchant (applies to active and paused keys).
- **Index**: Composite index `Index("idx_customer_id_status", "customer_id", "status")` enables fast list and count lookups.

---

## 3. Backend API Contract

All dashboard endpoints are prefix-mounted under `/api/dashboard` and require the merchant's Clerk session token (using `get_current_approved_user` to restrict access to signed-in and active users with `status == "approved"`).

### 1. `POST /api/dashboard/keys` — Create Key
- **Request**: `{ "name": "Production" }`
- **Validation**:
  - Checks if merchant has reached the limit of **max 5 keys** (counting active + paused keys). Returns `403` with code `key_limit_reached`.
  - Checks duplicate name. Returns `409` with code `duplicate_key_name`.
- **Response**: Returns `APIKeyCreateResponse` containing metadata plus the one-time raw `api_key` string.

### 2. `GET /api/dashboard/keys` — List Keys
- **Response**: Returns `APIKeyListResponse` showing the keys metadata array (omitting hashes/raw keys), `active_count`, `total_count`, and `max_keys`.

### 3. `DELETE /api/dashboard/keys/{key_id}` — Direct Deletion
- **Action**: Immediately hard-deletes the API key row from the database (releasing the unique name and freeing up a slot on the max 5 keys limit).
- **Response**: `{ "status": "success", "message": "API key deleted successfully" }`

### 4. `PATCH /api/dashboard/keys/{key_id}/pause` — Pause Key
- **Action**: Transitions status to `paused`.
- **Response**: Updated `APIKeyResponse` object.

### 5. `PATCH /api/dashboard/keys/{key_id}/continue` — Resume Key
- **Action**: Transitions status back to `active`.
- **Response**: Updated `APIKeyResponse` object.

---

## 4. Key Request Authentication Middleware

Incoming external requests from shop storefront integrations are validated via `validate_api_key` dependency:

1. **Extraction**: Checks both `Authorization` header (`Bearer sk_live_...` or `sk_live_...`) and `X-API-Key` header.
2. **Lookup**: Extracts the prefix (chars at index 8-14) and computes the HMAC hash of the full key using the server pepper. Looks up matching row in `api_keys`.
3. **Status Check**: If status is `paused`, throws `401 Unauthorized` with detail `"API Key is paused"`.
4. **Passive Expiry**: Checks if `expires_at` is set and `expires_at < now()`. If expired, throws `401` with detail `"Expired API Key"`.
5. **Debounced `last_used_at` Update**: Updates `last_used_at` with a **60-second debounce write limit** to avoid hammering the database on high-traffic keys.

---

## 5. Frontend Architecture (`frontend_main`)

Page Route: `/settings/api-keys`

### Components Structure
```text
/app/(dashboard)/settings/api-keys
  ├─ page.tsx                - Container shell coordinating dialogs and shimmer skeletons
  ├─ useApiKeys.ts           - Custom React hook wrapping fetch / mutate client actions
  └─ components/
      ├─ ApiKeysHeader.tsx   - Header title, counter badge, and generate button (with limit tooltip)
      ├─ ApiKeysTable.tsx    - Table & card layouts switcher, with empty state illustration
      ├─ ApiKeyRow.tsx       - Desktop row / mobile card mapper, displaying prefix and action actions menu
      ├─ GenerateKeyDialog.tsx  - Dialog collecting name, applying live duplicate checking
      ├─ RevealKeyDialog.tsx - Monospace reveal modal with clipboard copy validation (closes only after copy)
      └─ DeleteKeyDialog.tsx - Confirmation dialog detailing permanent deletion implications
```

### Key Behaviors
- **Live Client Validation**: Name text input validates live against the in-memory keys list using the derived `takenNames` case-insensitive Set (disabling submit before network calls are made).
- **Limit Gate**: "Generate API Key" button disables automatically if `totalCount >= 5` (irrespective of whether keys are active or paused).
- **Copied Enforcement**: The copy-to-clipboard button must be pressed at least once inside the Reveal dialog to unlock the "I've Saved the Key" close action.

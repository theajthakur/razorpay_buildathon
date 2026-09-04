# Merchant Order Verification & API Key Auth

This document describes the **Merchant Order Verification API** (`GET /merchant/orders/verify`), flexible API key authentication mechanisms, Clerk middleware configuration, and integration workflow for server-to-server verification.

---

## Overview

When an end customer completes an order payment via Razorpay, or when a merchant's server needs to verify the status and breakdown of an agent-generated order, the merchant queries the platform's verification endpoint.

To enable **hassle-free server-to-server verification** directly from merchant backend scripts or webhooks without requiring complex OAuth session tokens or browser cookie contexts, the endpoint supports API Key authentication via standard headers as well as URL query parameters.

---

## Endpoint Specification

### `GET /merchant/orders/verify`

#### Query Parameters

| Parameter | Type | Required | Description |
|---|---|---|---|
| `merchant_order_id` | `string` | **Yes** | The merchant's internal order ID (e.g. `ORD-1788543303789-36B1`) |
| `api_key` \| `apikey` | `string` | Optional* | Live API Key (`sk_live_...`) issued in the Merchant Dashboard |

*\*Note: Required if API key is not supplied via HTTP header.*

#### Authentication Methods

Merchants can authenticate their request using **any** of the following methods:

1. **Query Parameter (Recommended for Simple Callbacks & Webhooks)**:
   ```http
   GET /merchant/orders/verify?merchant_order_id=ORD-1788543303789-36B1&api_key=sk_live_abc123... HTTP/1.1
   Host: shopagent-backend.vijstack.com
   ```
2. **`X-API-Key` Header**:
   ```http
   GET /merchant/orders/verify?merchant_order_id=ORD-1788543303789-36B1 HTTP/1.1
   Host: shopagent-backend.vijstack.com
   X-API-Key: sk_live_abc123...
   ```
3. **`Authorization: Bearer` Header**:
   ```http
   GET /merchant/orders/verify?merchant_order_id=ORD-1788543303789-36B1 HTTP/1.1
   Host: shopagent-backend.vijstack.com
   Authorization: Bearer sk_live_abc123...
   ```

---

## Technical Implementation Details

### 1. API Key Extraction & Security Validation (`backend/app/core/security.py`)

The authentication helper `validate_api_key` inspects both the request headers and URL query parameters to retrieve the key prefix and raw secret:

```python
# Order of precedence for API Key extraction:
# 1. Authorization: Bearer <sk_live_...>
# 2. X-API-Key: <sk_live_...>
# 3. Query parameter ?api_key=<sk_live_...> or ?apikey=<sk_live_...>
```

- **Hashing**: The raw API key is hashed using SHA-256 and matched against stored key hashes in the `api_keys` table.
- **Status Check**: Verifies that the API key status is `active` (not `paused` or `revoked`).
- **Tenant Scope**: Resolves the associated `user_id` / `merchant_id` to guarantee that merchants can only verify orders belonging to their own store.

### 2. Next.js Clerk Middleware Bypass (`frontend_main/middleware.ts`)

In environments where API requests pass through or proxy via `frontend_main` (or Next.js middleware), server-to-server endpoints must be excluded from Clerk user authentication checks:

```typescript
const isPublicRoute = createRouteMatcher([
  '/',
  '/sign-in(.*)',
  '/sign-up(.*)',
  '/api/public/(.*)',
  '/merchant/(.*)' // Excludes merchant callback & order verification APIs from Clerk session checks
]);
```

This prevents external merchant servers from receiving `401 Unauthorized` or HTML login redirects when making automated HTTP GET verification calls.

---

## Response Schemas

### Success Response (`200 OK`)

```json
{
  "status": "success",
  "verified": true,
  "order": {
    "merchant_order_id": "ORD-1788543303789-36B1",
    "razorpay_order_id": "order_PxY123456789",
    "razorpay_payment_id": "pay_PxY987654321",
    "status": "payment_captured",
    "order_total": 1499.00,
    "currency": "INR",
    "customer_ref": "customer@example.com",
    "created_at": "2026-09-04T17:33:46Z",
    "items": [
      {
        "product_id": "prod_101",
        "name": "Passionfruit Mint Tea",
        "quantity": 2,
        "price": 749.50
      }
    ]
  }
}
```

### Invalid / Unauthenticated Key (`401 Unauthorized`)

```json
{
  "detail": "Invalid or inactive API key. Pass 'api_key' in query params or 'X-API-Key' / 'Authorization: Bearer' in headers."
}
```

### Order Not Found (`404 Not Found`)

```json
{
  "detail": "Order 'ORD-999999' not found for this merchant."
}
```

---

## Verification & Test Suite

The verification endpoint behavior is fully validated in unit tests (`backend/app/tests/test_merchant_verify_order.py`):
- `test_verify_order_with_query_param_api_key`: Validates successful verification passing `?api_key=sk_live_...`.
- `test_verify_order_with_header_api_key`: Validates successful verification passing `X-API-Key` header.
- `test_verify_order_invalid_key`: Verifies 401 response on invalid keys.
- `test_verify_order_cross_tenant_isolation`: Ensures Merchant A cannot verify Merchant B's orders.

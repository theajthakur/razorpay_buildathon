# API Reference

Code-verified API reference for ShopAgent backend endpoints, detailing HTTP methods, paths, authentication requirements, payload schemas, and validation rules.

## Related Documentation

- [Architecture](architecture.md)
- [Agentic Commerce](agentic-commerce.md)
- [Payment Flow](payment-flow.md)
- [Security & Guardrails](security-and-guardrails.md)
- [Failure Recovery](failure-recovery.md)
- [Merchant Integration](merchant-integration.md)
- [Custom Domains](custom-domains.md)

---

## 1. Authentication Endpoints

### `POST /api/public/auth/login`
- **Purpose**: Authenticates a customer dynamically against the merchant's login API and returns a ShopAgent customer JWT.
- **Auth**: Public (No auth header required).
- **Request Body**:
  ```json
  {
    "merchant_id": "user_2ab...",
    "email": "customer@example.com",
    "password": "customerpassword"
  }
  ```
- **Response**:
  ```json
  {
    "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
    "expires_at": "2026-09-05T14:45:00Z"
  }
  ```

### `POST /agentic/auth/logout`
- **Purpose**: Invalidates the current customer's session server-side by deleting the `MerchantUserSession` database row.
- **Auth**: Customer Session (`Authorization: Bearer <ShopAgent JWT>`).
- **Response**: `{"status": "success"}`

### `GET /system/accounts/me`
- **Purpose**: Returns account details for the currently logged-in merchant.
- **Auth**: Merchant Clerk (`Authorization: Bearer <Clerk JWT>`).
- **Response**:
  ```json
  {
    "id": "user_2ab...",
    "email": "merchant@store.com",
    "store_name": "Artisan Store",
    "status": "approved"
  }
  ```

### `POST /system/webhooks/clerk`
- **Purpose**: Webhook handler receiving Clerk account creation/update events.
- **Auth**: Public / Svix Signature Header (`svix-id`, `svix-timestamp`, `svix-signature`).

---

## 2. Agent & Conversation Endpoints

### `POST /agentic/conversations`
- **Purpose**: Creates a new conversation thread for the customer.
- **Auth**: Customer Session (`Authorization: Bearer <ShopAgent JWT>`).
- **Response**: `{"conversation_id": "550e8400-e29b-41d4-a716-446655440000"}`

### `GET /agentic/conversations`
- **Purpose**: Lists all conversation threads belonging to the authenticated customer for the current merchant.
- **Auth**: Customer Session (`Authorization: Bearer <ShopAgent JWT>`).
- **Response**:
  ```json
  {
    "conversations": [
      {
        "id": "550e8400-...",
        "title": "Black Denim Jacket Order",
        "created_at": "2026-09-05T10:00:00Z",
        "updated_at": "2026-09-05T10:05:00Z"
      }
    ]
  }
  ```

### `GET /agentic/conversations/{conversation_id}/messages`
- **Purpose**: Retrieves message history for a conversation thread with hydrated payment metadata.
- **Auth**: Customer Session (`Authorization: Bearer <ShopAgent JWT>`).

### `POST /agentic/conversations/{conversation_id}/messages`
- **Purpose**: Accepts a natural language message, executes tool calling, and streams NDJSON status events and response text.
- **Auth**: Customer Session (`Authorization: Bearer <ShopAgent JWT>`).
- **Request Body**: `{"message": "I'd like to order two of these jackets"}`
- **Response Content-Type**: `application/x-ndjson`

---

## 3. Shopping Cart Endpoints

### `GET /agentic/cart`
- **Purpose**: Fetches current cart contents, line items, item count, and subtotal.
- **Auth**: Customer Session (`Authorization: Bearer <ShopAgent JWT>`).
- **Response**:
  ```json
  {
    "items": [
      {
        "product_id": "prod_101",
        "name": "Denim Jacket",
        "thumbnail_url": "https://img.com/jacket.jpg",
        "price": 2499.00,
        "quantity": 1
      }
    ],
    "count": 1,
    "subtotal": 2499.00
  }
  ```

---

## 4. Payment Endpoints

### `POST /agentic/payments/verify`
- **Purpose**: Verifies Razorpay payment signature, updates `AgentOrder.status` to `payment_captured`, and triggers merchant webhook.
- **Auth**: Public.
- **Request Body**:
  ```json
  {
    "razorpay_order_id": "order_NqJ9Xz3kL8mP2Q",
    "razorpay_payment_id": "pay_NqJABc4dE5fG6H",
    "razorpay_signature": "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855"
  }
  ```
- **Response**: `{"status": "captured", "payment_status": "payment_captured", ...}`

### `POST /agentic/payments/retry`
- **Purpose**: Re-initiates Razorpay payment for an existing agent order without recreating the merchant order.
- **Auth**: Customer Session (`Authorization: Bearer <ShopAgent JWT>`).
- **Request Body**: `{"agent_order_id": "550e8400-..."}`

---

## 5. Server-to-Server Order Verification

### `GET /merchant/orders/verify`
- **Purpose**: Allows merchants to verify order payment status using their API Key after receiving a payment webhook event.
- **Auth**: API Key (`Authorization: Bearer sk_live_...` or `X-API-Key` or `?api_key=...`).
- **Query Parameter**: `merchant_order_id` (string, required).
- **Response**:
  ```json
  {
    "payment": {
      "status": "captured",
      "razorpay_payment_id": "pay_NqJABc4dE5fG6H"
    },
    "data": {
      "order": {
        "order_total": 2499.00
      }
    }
  }
  ```

---

## 6. Branding & Settings Endpoints

### `GET /api/public/branding`
- **Purpose**: Exposes resolved merchant's store name, logo URL, and brand color palette based on request Host header.
- **Auth**: Public (Resolved via `resolve_merchant_by_host`).

### `GET /api/dashboard/settings`
- **Purpose**: Fetches dashboard branding settings for the authenticated merchant.
- **Auth**: Approved Merchant (`Authorization: Bearer <Clerk JWT>`).

### `PATCH /api/dashboard/settings`
- **Purpose**: Updates merchant display name, logo URL, brand color, and feature toggles.
- **Auth**: Approved Merchant (`Authorization: Bearer <Clerk JWT>`).

### `POST /api/dashboard/settings/logo/presign`
- **Purpose**: Generates a presigned AWS S3 PUT URL for uploading merchant store logos.
- **Auth**: Approved Merchant (`Authorization: Bearer <Clerk JWT>`).
- **Request Body**: `{"fileType": "image/png"}`

---

## 7. Custom Domain Endpoints

### `POST /onboarding/domains`
- **Purpose**: Registers a custom domain with Vercel DNS and creates a PostgreSQL `domain_mapping` record.
- **Auth**: Approved Merchant (`Authorization: Bearer <Clerk JWT>`).
- **Request Body**: `{"domain": "agent.mystore.com"}`

### `GET /onboarding/domains`
- **Purpose**: Lists all registered custom domains for the authenticated merchant.
- **Auth**: Approved Merchant (`Authorization: Bearer <Clerk JWT>`).

### `POST /onboarding/domains/{domain_id}/verify`
- **Purpose**: Triggers DNS verification check against Vercel API and updates status to `ACTIVE` or `PENDING`.
- **Auth**: Approved Merchant (`Authorization: Bearer <Clerk JWT>`).

### `DELETE /onboarding/domains/{domain_id}`
- **Purpose**: Removes a custom domain from Vercel infrastructure and local database.
- **Auth**: Approved Merchant (`Authorization: Bearer <Clerk JWT>`).

---

## 8. API Key Management Endpoints

### `POST /api/dashboard/keys`
- **Purpose**: Generates a new API Key (`sk_live_...`) for server-to-server merchant integrations. Max limit: 5 keys.
- **Auth**: Approved Merchant (`Authorization: Bearer <Clerk JWT>`).
- **Request Body**: `{"name": "Production Verification Key"}`

### `GET /api/dashboard/keys`
- **Purpose**: Lists merchant API keys (showing prefix, status, creation date, and last used timestamp).
- **Auth**: Approved Merchant (`Authorization: Bearer <Clerk JWT>`).

### `PATCH /api/dashboard/keys/{key_id}/pause`
- **Purpose**: Pauses an active API key.
- **Auth**: Approved Merchant (`Authorization: Bearer <Clerk JWT>`).

### `PATCH /api/dashboard/keys/{key_id}/continue`
- **Purpose**: Resumes a paused API key.
- **Auth**: Approved Merchant (`Authorization: Bearer <Clerk JWT>`).

### `DELETE /api/dashboard/keys/{key_id}`
- **Purpose**: Immediately revokes and deletes an API key.
- **Auth**: Approved Merchant (`Authorization: Bearer <Clerk JWT>`).

---

## 9. Analytics & Onboarding Endpoints

### `GET /system/analytics/summary`
- **Purpose**: Returns live merchant revenue, order counts, average cart value, and conversation metrics.
- **Auth**: Merchant Clerk (`Authorization: Bearer <Clerk JWT>`).

### `GET /system/analytics/activity`
- **Purpose**: Returns live activity feed of recent orders, customer chats, and catalog sync events.
- **Auth**: Merchant Clerk (`Authorization: Bearer <Clerk JWT>`).

### `GET /system/onboarding`
- **Purpose**: Retrieves merchant API endpoint configuration schema.
- **Auth**: Merchant Clerk (`Authorization: Bearer <Clerk JWT>`).

### `POST /system/onboarding/test-endpoint`
- **Purpose**: Proxies a test request against a merchant's API endpoint to bypass CORS and capture response schemas.
- **Auth**: Merchant Clerk (`Authorization: Bearer <Clerk JWT>`).

# ShopAgent Integration Guide

This guide covers everything you need to integrate your store with ShopAgent: authentication, the order lifecycle, the webhook you'll receive, and the verify endpoint you'll call to confirm payment before fulfilling an order.

---

## API Format

All ShopAgent APIs share these conventions.

**Base URL**
```
https://api.shopagent.dev/v1
```

**Authentication**

Every request to ShopAgent's API includes your API key as a bearer token:

```
Authorization: Bearer <YOUR_SHOPAGENT_API_KEY>
```

Keep this key server-side only. Never expose it in client-side code.

**Content type**

All requests and responses use JSON:

```
Content-Type: application/json
```

**Standard error format**

```json
{
  "error": {
    "code": "invalid_request",
    "message": "merchant_order_id is required"
  }
}
```

**Common status codes**

| Code | Meaning |
|------|---------|
| `200` | Success |
| `400` | Malformed or missing request fields |
| `401` | Missing or invalid API key |
| `404` | Resource not found |
| `409` | Conflict (e.g. insufficient stock) |
| `429` | Rate limited |
| `5xx` | ShopAgent-side error — safe to retry with backoff |

---

## Order Lifecycle

```
pending → confirmed
        → failed
        → flagged_amount_mismatch
```

| Status | Meaning | What to do |
|---|---|---|
| `pending` | Order created, payment not yet confirmed | Wait — do not fulfill |
| `confirmed` | Payment captured and verified | Safe to fulfill |
| `failed` | Payment did not succeed | Do not fulfill; notify customer if needed |
| `flagged_amount_mismatch` | Payment captured but amount didn't match your order total | Do not fulfill — investigate manually |

---

## Webhook: `order.payment_completed`

When a payment completes, ShopAgent sends a `POST` request to the webhook URL you registered.

### Payload structure

The webhook body is intentionally minimal — treat it as a **trigger**, not a data source. Full payment details must always be pulled via [Verify Order](#verify-order), never trusted from the webhook body itself.

```json
{
  "event": "order.payment_completed",
  "event_id": "evt_9f8a3b2c1d",
  "merchant_order_id": "ORD1234"
}
```

| Field | Type | Description |
|---|---|---|
| `event` | string | Always `"order.payment_completed"` for this event type |
| `event_id` | string | Unique ID for this event — use it to dedupe retried/duplicate deliveries |
| `merchant_order_id` | string | Your own order ID, as provided when the order was created |

### Expected response

Return a `2xx` status quickly (within a few seconds). If you don't acknowledge, ShopAgent retries with exponential backoff.

```
200 OK
```

### Idempotency

Webhooks may be delivered more than once for the same event. Before processing, check whether you've already seen this `event_id` and skip reprocessing if so.

---

## Verify Order

After receiving the webhook (or at any time you want to double-check an order), call this endpoint to get the authoritative payment status.

**Endpoint**

```
GET /orders/verify
```

### Request

Sent as query parameters, authenticated with your API key.

```
GET /merchant/orders/verify?merchant_order_id=ORD1234
Authorization: Bearer <YOUR_SHOPAGENT_API_KEY>
```

| Parameter | Type | Required | Description |
|---|---|---|---|
| `merchant_order_id` | string | Yes | The order ID from your own system |

### Response structure

```json
{
  "merchant_order_id": "ORD1234",
  "agent_order_id": "shopagent_ord_88221",
  "payment_status": "captured",
  "order_total": 360,
  "currency": "INR",

  "payment": {
    "razorpay_payment_id": "pay_QwErTy12345",
    "razorpay_order_id": "order_AbCdEf6789",
    "method": "upi",
    "captured_at": "2026-08-23T14:32:05Z"
  },

  "verified_at": "2026-08-23T14:35:00Z",
  "verification_source": "razorpay_api"
}
```

| Field | Type | Description |
|---|---|---|
| `merchant_order_id` | string | Your order ID |
| `agent_order_id` | string | ShopAgent's internal order ID, for your records |
| `payment_status` | string | One of `pending`, `authorized`, `captured`, `failed`, `refunded` |
| `order_total` | number | Total amount for this order, in your store's currency unit |
| `currency` | string | ISO currency code |
| `payment.razorpay_payment_id` | string | Underlying payment provider's payment ID |
| `payment.razorpay_order_id` | string | Underlying payment provider's order ID |
| `payment.method` | string | Payment method used (e.g. `upi`, `card`) |
| `payment.captured_at` | string (ISO 8601) | When payment was captured |
| `verified_at` | string (ISO 8601) | When this verify call was answered |
| `verification_source` | string | Always `razorpay_api` — confirms this status was freshly checked against the payment provider, not read from a cache |

**Only fulfill orders where `payment_status` is `captured`.** `authorized` means funds are reserved but not yet captured — do not treat this as a completed sale.

---

## Quickstart Checklist

1. Get your API key from your ShopAgent dashboard.
2. Expose the store APIs ShopAgent needs (product lookup, order creation, order status).
3. Register your webhook URL to receive `order.payment_completed`.
4. On webhook receipt, dedupe by `event_id`, then call **Verify Order**.
5. Fulfill only when `payment_status` is `captured` and `order_total` matches what you expect.

---

## FAQ

**What if I miss a webhook?**
Call Verify Order directly with your `merchant_order_id` at any time — you don't need to wait for or rely solely on the webhook.

**What amount unit is used?**
`order_total` is in your store's standard currency unit (e.g. rupees, not paise) unless otherwise noted for a specific field.

**Should I trust the webhook body for order details?**
No. The webhook only tells you *something* happened for a given `merchant_order_id`. Always confirm details via Verify Order before taking action.
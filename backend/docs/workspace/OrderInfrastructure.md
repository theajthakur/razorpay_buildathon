# Task: Order Infrastructure — Schema + Agent Order Flow

## Context

When a customer asks the ShopAgent chat agent to buy something, the agent uses an "order" tool that: (1) creates a ShopAgent-owned order record with our own unique ID, (2) calls the **merchant's** existing order-creation API (the contract merchants implement per our integration docs — `product_id`/`order_id`, `quantity`, optional `coupon_code`, `address`, `user_id`) to get back a `merchant_order_id` and the authoritative `order_total` for that quantity, (3) stores that on our record, and (4) creates a Razorpay order for that amount so the customer can pay. This is the reverse direction of the webhook/verify contract we already documented — here, ShopAgent is the one collecting payment on the merchant's behalf and will later notify the merchant via webhook once payment is captured (that part is a follow-up task; this task is schema + steps 1–4).

First inspect the existing codebase for DB client/ORM conventions, existing merchant/store connection tables (API keys, webhook URLs), and Razorpay SDK usage already in the project, and match new code to those.

## Database schema

### Table: `agent_orders`

| Column | Type | Notes |
|---|---|---|
| `id` | UUID | ShopAgent's own unique order ID (this is what we call `agent_order_id` elsewhere — e.g. in webhook payloads) |
| `merchant_id` | UUID (FK → merchants/stores table) | Which merchant this order is placed against |
| `customer_ref` | string | The customer identifier *on the merchant's own system* — ShopAgent uses the merchant's auth, not its own accounts, so this is their ID, not ours |
| `conversation_id` | UUID, nullable (FK → chat/conversation table, if one exists) | Links the order back to the agent conversation that created it, for support/debugging |
| `merchant_product_id` | string | The product ID as known on the merchant's system |
| `quantity` | integer | |
| `merchant_order_id` | string, nullable | Populated once the merchant's create-order API responds; null while that call hasn't completed yet |
| `unit_price` | decimal, nullable | From the merchant's response, not computed by us |
| `order_total` | decimal, nullable | From the merchant's response — this is the authoritative total; ShopAgent never computes pricing itself |
| `currency` | string | e.g. `INR` |
| `razorpay_order_id` | string, nullable | Set once we create the Razorpay order |
| `razorpay_payment_id` | string, nullable | Set once payment is captured (populated in the follow-up payment-confirmation task, not this one) |
| `status` | enum | See lifecycle below |
| `failure_reason` | string, nullable | Set when `status = failed`, human-readable cause |
| `created_at` | timestamp | |
| `updated_at` | timestamp | |

**Status lifecycle**
```
initiated
  → merchant_order_created   (merchant API responded with merchant_order_id + total)
  → awaiting_payment         (Razorpay order created, waiting for customer to pay)
  → payment_captured         (out of scope for this task — set by the payment-confirmation flow)
  → failed                   (any step failed — see failure_reason)
```

**Constraints & indexes**
- Index on `(merchant_id, customer_ref)` — for "this customer's orders with this merchant" lookups.
- Index on `merchant_order_id` — needed once the payment-confirmation flow looks orders up by it (mirrors the pattern from our own merchant-facing webhook contract).
- `razorpay_order_id` should be unique when non-null (one Razorpay order per agent order).

## Order creation flow (agent tool → merchant API → Razorpay)

Implement as a single service function the agent's "place order" tool calls — e.g. `createAgentOrder({ merchantId, customerRef, conversationId, productId, quantity, address, couponCode })`.

### Step 1 — Create local record
Insert an `agent_orders` row with `status: initiated`, generating our own `id` up front. Do this **before** calling the merchant, so that if the merchant call fails partway, we still have a row to mark `failed` with a reason, rather than losing the attempt entirely.

### Step 2 — Call the merchant's order-creation API
Use the merchant's registered order-creation endpoint (per the connection details stored for that `merchant_id` — base URL + auth, however that's stored in the existing merchant-connection table). Send `product_id`, `quantity`, `address`, `user_id` (= `customer_ref`), and `coupon_code` if provided.

- **On success**: expect `merchant_order_id`, `status`, `order_total` back (per our own integration contract). Update the row: `merchant_order_id`, `unit_price` (if returned), `order_total`, `currency`, `status: merchant_order_created`.
- **On failure** (merchant API errors, times out, or returns e.g. `insufficient_stock`): update the row to `status: failed` with `failure_reason` set to something specific enough to debug later (e.g. `"merchant_api_error: insufficient_stock"`), and surface a clear, non-technical message back to the agent/customer ("That item just went out of stock — want me to suggest something similar?"). Do not proceed to Razorpay.

### Step 3 — Create the Razorpay order
Using `order_total` from Step 2 (never a value the agent or customer supplied), create a Razorpay order for that amount:
```js
const razorpayOrder = await razorpay.orders.create({
  amount: Math.round(order.order_total * 100), // paise
  currency: order.currency,
  receipt: order.id, // our agent_order_id, for cross-referencing in the Razorpay dashboard
  notes: {
    agent_order_id: order.id,
    merchant_order_id: order.merchant_order_id,
    merchant_id: order.merchant_id,
  },
});
```
Store `razorpay_order_id`, set `status: awaiting_payment`.

### Step 4 — Return checkout details
Return to the caller (agent/frontend) what's needed to launch Razorpay Checkout: `razorpay_order_id`, `amount`, `currency`, and the Razorpay key ID (public key, safe to expose client-side — never the secret). The agent conversation should present this as a payment step, not silently assume payment succeeds — actual capture confirmation is a separate follow-up flow (webhook from Razorpay + our own verify-and-notify-merchant step), not part of this task.

## Error handling & idempotency notes
- If the merchant API call in Step 2 times out but may have actually succeeded on their end (ambiguous outcome), do not blindly retry with a new order — that risks creating a duplicate order on the merchant's system. Mark the local row `failed` with reason `"merchant_api_timeout_ambiguous"` and let a human/support flow reconcile it, unless the merchant's create-order API is documented as idempotent on some client-supplied key (confirm before assuming).
- Step 3 (Razorpay order creation) should only ever run after Step 2 has concretely succeeded — never create a Razorpay charge for an order the merchant hasn't actually confirmed it can fulfill.
- All monetary values in the DB should be stored as decimals (or integer minor units, e.g. paise, if that's the existing project's convention elsewhere) — check and match whatever convention the rest of the codebase already uses rather than introducing a second one.

## Acceptance checks
- A successful flow produces one `agent_orders` row that progresses `initiated → merchant_order_created → awaiting_payment`, with `order_total` matching exactly what the merchant API returned (not recomputed or altered by ShopAgent).
- A merchant API failure at Step 2 leaves the row at `failed` with a specific `failure_reason`, and never reaches Step 3 (no Razorpay order created for a failed merchant order).
- `razorpay_order_id` is unique per row and traceable back to `agent_order_id`/`merchant_order_id` via the Razorpay order's `notes` field.
- No monetary amount used in Razorpay order creation is ever sourced from anywhere other than the merchant API's response for that specific request.
- Querying by `merchant_order_id` or by `(merchant_id, customer_ref)` uses the indexes above, not a full table scan.
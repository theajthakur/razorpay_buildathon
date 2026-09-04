# Agent Orchestrator & Tool Calling Engine

This document details the conversational AI agent engine (`backend/app/agentic`), Google Gemini / Vertex AI tool calling orchestration, strict execution rules, pricing safety checks, and real-time streaming protocol.

---

## Overview

The **Agent Orchestrator** is the brain of the platform. It translates natural language customer inputs into dynamic REST API calls against the merchant's backend while maintaining cart state, session context, and billing safety.

---

## Key System Principles & Guardrails

1. **Mandatory `create_order` Execution**: System prompt rules (`backend/app/agentic/prompts.py`) strictly enforce that whenever a customer agrees to buy or confirms checkout details, the agent **MUST** invoke the `create_order` function tool. The LLM is explicitly forbidden from generating fake confirmation messages or text promises without dispatching the execution tool.
2. **Server-Side Price Re-Verification**: Prices in customer cart snapshots are display estimates. When `create_order` executes, the backend re-fetches product details live from the merchant's catalog API to calculate total billing. If a price changed or an item is out of stock, order creation halts and the customer is notified.
3. **Cart Safety Caps**:
   - **Distinct Line Items Cap**: Maximum 5 distinct items per cart.
   - **Quantity Cap**: Maximum 20 units per item.
4. **No Password Storage**: Customer logins are delegated directly to the merchant's authentication endpoint. Session tokens issued by the backend are AES-Fernet encrypted and store the merchant's customer identity token server-side only.

---

## Tool System Matrix

The engine declares Function Tools to Gemini/Vertex AI during conversation turns:

| Tool Name | Scope | Description |
|---|---|---|
| `search_products` | Public | Queries merchant `/products` endpoint with filter/query parameters |
| `add_to_cart` | Customer Session | Inserts or increments item in `cart_items` table (enforces line item and quantity caps) |
| `get_cart_items` | Customer Session | Retrieves active cart items and calculates estimated subtotal |
| `update_cart_item` | Customer Session | Updates quantity or removes item if quantity set to 0 |
| `remove_from_cart` | Customer Session | Removes targeted product from customer cart |
| `fetch_addresses` | Customer Auth | Fetches saved customer shipping addresses from merchant `/addresses` endpoint |
| `create_address` | Customer Auth | Creates a new shipping address on merchant backend |
| `create_order` | Customer Auth + Checkout | Re-verifies live prices, creates merchant order, creates Razorpay order & returns payment link |
| `retry_payment` | Customer Auth | Regenerates Razorpay order/payment link if previous session expired |
| `get_order_history` | Customer Auth | Fetches customer's past orders from merchant `/orders` endpoint |
| `get_customer_profile` | Customer Auth | Looks up customer profile from merchant `/profile` endpoint |
| `create_conversation_title` | Conversation | Generates a concise title summarizing the first conversation query |

---

## Real-Time NDJSON Streaming Event Protocol

The agent backend streams responses to `frontend_agent` as line-delimited JSON (`NDJSON`):

```json
{"type": "status", "stage": "searching_products", "label": "Searching catalog for 'mint'..."}
{"type": "status", "stage": "adding_to_cart", "label": "Adding item to cart..."}
{"type": "cart_updated", "items": [...], "count": 1, "subtotal": 499.00}
{"type": "message_chunk", "content": "I've added the Passionfruit Mint Tea to your cart!"}
{"type": "card", "card_type": "order_confirmation", "data": {...}}
```

---

## Unit & Integration Testing

All tools and prompt behaviors are covered by automated tests (`backend/app/tests/`):
- `test_cart_tools.py`: Cart CRUD, line item caps, and quantity cap enforcement.
- `test_address_order_tools.py`: Address fetching and order creation pipeline.
- `test_order_history_profile_tools.py`: History and profile lookup parsing.
- `test_payment_verify.py` & `test_razorpay_fail_loudly.py`: Price re-verification and payment link generation safety.

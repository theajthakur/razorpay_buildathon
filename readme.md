# AI Commerce Layer for Any Business

Built for the **[Razorpay AI Buildathon](https://razorpay.com/buildathon/) — Agentic Commerce track**.

> **Note**: *"ShopAgent"* is the current working name for the platform.

---

## Executive Summary

**AI Commerce Layer** is a multi-tenant SaaS platform that empowers any merchant to transform their existing REST APIs (products, orders, customers, authentication, addresses) into a fully interactive, conversational AI shopping agent. Customers can search catalogs, compare products, manage shopping carts, select delivery addresses, check order status, and complete payments via **Razorpay** directly through a chat interface — without merchants writing or maintaining custom AI infrastructure.

Merchants onboard their API schemas once via the **Merchant SaaS Dashboard** (`frontend_main`), and their custom-branded AI Agent goes live at a dedicated domain or embeddable widget (`frontend_agent`).

---

## Core Security & Architecture Principles

- **Zero Password Storage**: Customer authentication is delegated directly to the merchant's auth API. The platform never stores customer credentials; it issues short-lived, AES-encrypted session tokens (`MerchantUserSession`).
- **Server-Side Price & Inventory Re-Verification**: Cart snapshots are display-only. Real billing totals are re-verified server-side against the merchant's live product endpoints during order creation to eliminate stale prices or LLM hallucinations.
- **Explicit Human Consent Checkpoint**: AI agents cannot autonomously charge a customer. Payment requires explicit confirmation of cart items, shipping address, and total amount on a dedicated inline checkout card (`OrderConfirmationCard`).
- **Strict Billing Safety Limits**: Capped at **5 distinct line items per cart** and a maximum of **20 units per item** to prevent runaway agent loops.
- **Zero Shared Payment Secrets**: Razorpay order creation and payment link generation are scoped per merchant account using encrypted merchant settings.

---

## System Architecture — 3 Sub-Packages

```
┌────────────────────────────────────────────────────────┐   ┌────────────────────────────────────────────────────────┐
│             frontend_main (Port 3000)                  │   │             frontend_agent (Port 3001)                 │
│         Merchant Control Plane & SaaS Dashboard        │   │        Customer-Facing Conversational Widget           │
└───────────────────────────┬────────────────────────────┘   └───────────────────────────┬────────────────────────────┘
                            │                                                            │
                            └─────────────────────────────┬──────────────────────────────┘
                                                          │
                                                          ▼
                                          ┌───────────────────────────────┐
                                          │      common backend (FastAPI) │
                                          │  Port 8000 · Modular Engine   │
                                          └───────────────┬───────────────┘
                                                          │
                    ┌─────────────────────────────────────┼─────────────────────────────────────┐
                    ▼                                     ▼                                     ▼
      ┌───────────────────────────┐         ┌───────────────────────────┐         ┌───────────────────────────┐
      │     Merchant REST APIs    │         │       Razorpay API        │         │      PostgreSQL DB        │
      │ (Auth, Products, Orders,  │         │   (Order Creation &       │         │ (SQLAlchemy + Alembic     │
      │  Customers, Addresses)    │         │    Payment Verification)  │         │   9 Core Models)          │
      └───────────────────────────┘         └───────────────────────────┘         └───────────────────────────┘
```

### 1. `backend` — FastAPI Core Service (`http://localhost:8000`)
Modular FastAPI engine handling multi-tenant routing, database persistence, LLM orchestration, encrypted sessions, and payment verification.

- **`app/system`**: SaaS administrative domain — merchant accounts (`users`), store configurations (`onboardings`), API keys (`api_keys`), domain mappings (`domain_mappings`), branding, and settlement bank details.
- **`app/agentic`**: Live Google Gemini / Vertex AI tool-calling engine, streaming NDJSON event pipeline (`message_event_stream`), session management, cart CRUD tools, address tools, order creation with server-side price re-verification, payment verification, and webhook relaying.
- **`app/dashboard`**: Merchant management endpoints for analytics, verification testing of onboarded APIs, and settings configuration.
- **`app/core`**: Application settings (`pydantic-settings`), database session management (`SQLAlchemy`), security helpers (bcrypt password hashing, SHA-256 API key hashing, AES Fernet encryption), and centralized logging setup.
- **`app/merchant`**: Internal merchant API routing.

### 2. `frontend_main` — Merchant SaaS Dashboard (`http://localhost:3000`)
The control plane where merchants configure their store, onboard resource endpoints, provision API keys, and view live interactive documentation.

- **Tech Stack**: Next.js 15 (App Router), TypeScript, Tailwind CSS, Framer Motion, Lucide Icons, Clerk Authentication.
- **Onboarding Wizard**:
  - **Connection Setup**: Base URL input, Auth journey configuration (Auth URL, identifier/password payload keys, token extraction path, delivery via Bearer header or cookie).
  - **Resource Endpoint Configurator**: Interactive testing modals for 6 resource types:
    1. Products Endpoint (`/products`)
    2. Order History Endpoint (`/orders`)
    3. Customer Profile Endpoint (`/profile`)
    4. Customer Addresses Endpoint (`/addresses`)
    5. Create Order Endpoint (`/orders/create`)
    6. Verify Order Endpoint (`/orders/verify`)
- **SSR Developer Documentation** (`/documentation`): Real-time rendered API documentation dynamically reflecting the merchant's configured endpoints, field mappings, and code examples.
- **API Keys & Settings** (`/settings`): Provision, pause, or revoke up to 5 storefront developer keys (`rzp_live_...`), set branding colors, custom subdomains, and human-confirmation payout thresholds.

### 3. `frontend_agent` — Customer Chat Widget (`http://localhost:3001`)
The customer-facing conversational shopping interface.

- **Tech Stack**: Next.js 15 (App Router), TypeScript, Tailwind CSS, Lucide Icons.
- **Features**:
  - **Delegated Customer Auth (`LoginModal`)**: Prompts login when identity-required actions (orders, addresses, checkout) are requested, sending credentials directly to merchant's auth endpoint.
  - **Real-Time NDJSON Streaming**: Streams agent responses while rendering live tool execution stages (*"Searching products..."*, *"Adding to cart..."*, *"Verifying prices..."*, *"Generating payment link..."*).
  - **Interactive Product Cards (`ProductCard`, `ProductCardGrid`)**: Displays product recommendations with image thumbnails, price formatting, stock status, and 1-click cart addition.
  - **Cart Drawer & Subtotal View**: Real-time cart overlay with quantity modifiers and item caps.
  - **Inline Order & Payment Confirmation (`OrderConfirmationCard`)**: Inline checkout card for delivery address selection, item breakdown, price re-verification, and direct Razorpay checkout execution (modal / iframe / payment link).
  - **Multi-Conversation Sidebar**: Automatically titles customer chats based on the first query using LLM titling.

---

## Agentic LLM Orchestrator & Tool System

The backend orchestrates Gemini LLM loops through Function Declarations containerized in Vertex AI / Google GenAI SDK:

| Tool Name | Description | Execution & Guardrails |
|---|---|---|
| `search_products` | Search catalog by query, category, or price range | Calls merchant's `/products` endpoint using session token; transforms field mappings dynamically |
| `add_to_cart` | Add product to customer cart or increment quantity | Enforces **5 distinct line-item cap** and **max 20 units/item** in database (`cart_items`) |
| `get_cart_items` | Fetch customer's current shopping cart | Queries database `cart_items` and calculates display subtotal estimate |
| `update_cart_item` | Modify item quantity in cart | Updates quantity; deletes row if quantity drops to 0 |
| `remove_from_cart` | Remove specific product from cart | Deletes product row from `cart_items` for target customer |
| `fetch_addresses` | Retrieve customer's saved delivery addresses | Calls merchant's `/addresses` API using customer session token |
| `create_address` | Add new delivery address for customer | Calls merchant's address creation endpoint |
| `create_order` | Initiate order creation and payment | Re-verifies product prices against merchant API, creates merchant order, creates Razorpay order |
| `retry_payment` | Regenerate payment order/link | Used if payment expires or fails |
| `get_order_history` | Retrieve past orders for customer | Calls merchant's `/orders` history endpoint |
| `get_customer_profile` | Fetch customer account details | Calls merchant's `/profile` endpoint |
| `create_conversation_title` | Auto-title chat session | Summarizes first message into a concise conversation title |

### Real-Time Progress Stream Protocol

Backend emits real-time NDJSON event chunks during agent execution:
```json
{ "type": "status", "stage": "adding_to_cart", "label": "Adding to your cart…" }
```
When cart contents change, a cart update payload is broadcasted:
```json
{ "type": "cart_updated", "items": [...], "count": 2, "subtotal": 2499.00 }
```

---

## Database Schema (PostgreSQL via SQLAlchemy & Alembic)

1. **`users`**: Merchant primary ledger (Clerk User ID PK, store name, email, status: `pending` \| `approved` \| `blocked`).
2. **`onboardings`**: Store configurations (`user_id` FK, `base_url`, `auth_config`, `products_config`, `order_history_config`, `customer_profile_config`, `addresses_config`, `create_order_config`, `verify_order_config`, `branding_config`, settlement bank details, `webhook_url`, `webhook_path`, `slug`).
3. **`domain_mappings`**: Custom store subdomains (`id`, `domain` unique, `slug` FK).
4. **`api_keys`**: Developer keys (`id`, `customer_id` FK, `name`, `key_prefix`, `key_hash` SHA-256, `status`: `active` \| `paused`, `last_used_at`).
5. **`merchant_user_sessions`**: Customer session tokens (`id`, `merchant_id` FK, `customer_ref`, `email`, `merchant_token_encrypted` AES-Fernet, `expires_at`).
6. **`conversations`**: Chat sessions (`id`, `merchant_id` FK, `user_email`, `title`, `created_at`, `updated_at`).
7. **`conversation_messages`**: Chat history (`message_id`, `conversation_id` FK, `sender`: `user` \| `agent`, `message`, `metadata` JSON for cards/attachments).
8. **`cart_items`**: Shopping cart (`id`, `merchant_id` FK, `customer_email`, `product_id`, `name`, `thumbnail_url`, `price`, `quantity`, UniqueConstraint on `merchant_id + customer_email + product_id`).
9. **`agent_orders`**: Order ledger (`id`, `merchant_id` FK, `customer_ref`, `conversation_id`, `items` JSON, `merchant_order_id`, `order_total`, `currency`, `razorpay_order_id`, `razorpay_payment_id`, `status`: `initiated` \| `merchant_order_created` \| `awaiting_payment` \| `payment_captured` \| `failed`).

---

## Automated Test Suite

The repository contains **81 automated unit & integration tests** across 16 test files (100% pass rate):

- **Auth & Sessions**: Merchant registration, Clerk webhook sync, delegated customer authentication token encryption, and session expiration (`test_agentic_auth.py`, `test_clerk_webhook.py`, `test_clerk_duplicate_email.py`).
- **Cart & Limits**: Cart CRUD operations, 5-item distinct line-item cap enforcement, quantity caps, and session isolation (`test_cart_tools.py`).
- **API Keys & Settings**: Provisioning, hashing verification, status toggling (active/paused), and key prefix matching (`test_api_keys.py`, `test_settings.py`).
- **Field Mappings & Onboarding**: Schema translation logic and onboarding endpoint verification (`test_field_mappings.py`, `test_onboarding.py`).
- **Order & Address Tools**: Address fetching, order creation, order history parsing, and profile lookup (`test_address_order_tools.py`, `test_order_history_profile_tools.py`).
- **Payment & Verification**: Razorpay order generation, server-side price re-verification, payment verification webhooks, and explicit error handling (`test_payment_verify.py`, `test_merchant_verify_order.py`, `test_razorpay_fail_loudly.py`).
- **Public Branding & Logging**: Public store branding endpoint and structured logging (`test_public_branding.py`, `test_logging_config.py`, `test_merchant_api_logging.py`).

### Running Tests Locally

```bash
cd backend
.\venv\Scripts\pytest
```

---

## Getting Started / Local Setup

### 1. Backend Setup

```bash
cd backend
python -m venv venv
.\venv\Scripts\activate   # On Windows (or source venv/bin/activate on Unix)
pip install -r requirements.txt
python run_migrations.py
uvicorn app.main:app --reload --port 8000
```

### 2. Merchant Dashboard (`frontend_main`) Setup

```bash
cd frontend_main
pnpm install
pnpm dev
# Open http://localhost:3000
```

### 3. Customer Chat Widget (`frontend_agent`) Setup

```bash
cd frontend_agent
pnpm install
pnpm dev --port 3001
# Open http://localhost:3001
```

---

## License & Competition Context

Built for the **Razorpay AI Buildathon 2026**. Designed for multi-tenant scalability, zero-friction merchant onboarding, and enterprise-grade billing safety.
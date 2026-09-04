# AI Commerce Layer for Any Business (ShopAgent)

Built for the **[Razorpay AI Buildathon](https://razorpay.com/buildathon/) — Agentic Commerce track**.

> **Live Platform Links**:
> - **Merchant SaaS Dashboard**: [https://shopagent.vijstack.com](https://shopagent.vijstack.com)
> - **Customer Agent Widget**: [https://shopagent-agent.vijstack.com](https://shopagent-agent.vijstack.com)
> - **Backend API**: [https://shopagent-backend.vijstack.com](https://shopagent-backend.vijstack.com)

---

## Executive Summary

**AI Commerce Layer (ShopAgent)** is a multi-tenant SaaS platform that empowers any merchant to transform their existing REST APIs (products, orders, customers, authentication, addresses) into a fully interactive, conversational AI shopping agent. Customers can search catalogs, compare products, manage shopping carts, select delivery addresses, check order status, and complete payments via **Razorpay** directly through a chat interface — without merchants writing or maintaining custom AI infrastructure.

Merchants onboard their API schemas once via the **Merchant SaaS Dashboard** (`frontend_main`), register their custom branded domain (e.g. `agent.mybrand.com`), and their AI Agent goes live immediately.

---

## Technical Documentation Index

For in-depth architectural guides and developer specifications, see the `docs/` folder:

- 🌐 [Custom Domain Integration & Vercel DNS Setup](docs/domain_integration.md)
- 🔑 [Merchant Order Verification & API Key Auth](docs/order_verification.md)
- 🤖 [Agent Orchestrator & Tool Calling Engine](docs/agent_orchestrator.md)
- 🚀 [GCP Compute Engine CI/CD Pipeline Guide](docs/gcp_cicd_setup.md)

---

## Core Security & Architecture Principles

- **Zero Password Storage**: Customer authentication is delegated directly to the merchant's auth API. The platform never stores customer credentials; it issues short-lived, AES-Fernet encrypted session tokens (`MerchantUserSession`).
- **Server-Side Price & Inventory Re-Verification**: Cart snapshots are display-only. Real billing totals are re-verified server-side against the merchant's live product endpoints during order creation to eliminate stale prices or LLM hallucinations.
- **Explicit Human Consent Checkpoint & Tool Enforcement**: AI agents cannot autonomously charge a customer. Payment requires explicit confirmation of cart items, shipping address, and total amount on a dedicated inline checkout card (`OrderConfirmationCard`). System prompt rules strictly enforce that the agent executes the `create_order` tool call whenever a customer confirms purchase.
- **Flexible Order Verification**: Hassle-free server-to-server verification endpoint (`GET /merchant/orders/verify`) supporting API Key authentication via query parameters (`?api_key=sk_live_...`) or HTTP headers (`X-API-Key` / `Authorization`). Clerk middleware excludes `/merchant/(.*)` paths to ensure seamless webhook validation.
- **Custom Domain Provisioning & Clean 404 Handing**: Automated Vercel DNS integration (`cname.vercel-dns.com` / `e493a233eec4285d.vercel-dns-017.com`) with real-time verification status. Unmapped hostnames return a strict 404 Domain Error screen linking to `https://shopagent.vijstack.com` with zero placeholder mock fallbacks.
- **Strict Billing Safety Limits**: Capped at **5 distinct line items per cart** and a maximum of **20 units per item** to prevent runaway agent loops.
- **Zero Shared Payment Secrets**: Razorpay order creation and payment link generation are scoped per merchant account using encrypted merchant settings.

---

## System Architecture — 3 Sub-Packages

```
┌────────────────────────────────────────────────────────┐   ┌────────────────────────────────────────────────────────┐
│         frontend_main (https://shopagent.vijstack.com) │   │     frontend_agent (https://agent.mybrand.com)         │
│          Merchant Control Plane & SaaS Dashboard       │   │        Customer-Facing Conversational Widget           │
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

### 1. `backend` — FastAPI Core Service (`https://shopagent-backend.vijstack.com`)
Modular FastAPI engine handling multi-tenant routing, database persistence, LLM orchestration, encrypted sessions, custom domain mapping, and payment verification.

- **`app/system`**: SaaS administrative domain — merchant accounts (`users`), store configurations (`onboardings`), API keys (`api_keys`), custom domain mappings (`domain_mappings` integrated with Vercel API), branding, and settlement bank details.
- **`app/agentic`**: Live Google Gemini / Vertex AI tool-calling engine, streaming NDJSON event pipeline (`message_event_stream`), session management, cart CRUD tools, address tools, order creation with server-side price re-verification, payment verification, and webhook relaying.
- **`app/dashboard`**: Merchant management endpoints for analytics, verification testing of onboarded APIs, and settings configuration.
- **`app/core`**: Application settings (`pydantic-settings`), database session management (`SQLAlchemy`), security helpers (bcrypt password hashing, SHA-256 API key hashing, AES Fernet encryption), and centralized logging setup.
- **`app/merchant`**: Internal merchant API routing (`GET /merchant/orders/verify`).

### 2. `frontend_main` — Merchant SaaS Dashboard (`https://shopagent.vijstack.com`)
The control plane where merchants configure their store, onboard resource endpoints, provision API keys, manage custom domains, and view live interactive documentation.

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
- **Custom Domain Management (`/domain`)**: Add custom domains, view CNAME/A record DNS configuration, trigger Vercel status verification, and manage domain mappings with a fully responsive layout.
- **SSR Developer Documentation (`/documentation`)**: Real-time rendered API documentation dynamically reflecting the merchant's configured endpoints, field mappings, and code examples.
- **API Keys & Settings (`/settings`)**: Provision, pause, or revoke storefront developer keys (`sk_live_...`), set branding colors, custom subdomains, and human-confirmation payout thresholds.

### 3. `frontend_agent` — Customer Chat Widget (`https://shopagent-agent.vijstack.com`)
The customer-facing conversational shopping interface.

- **Tech Stack**: Next.js 15 (App Router), TypeScript, Tailwind CSS, Lucide Icons.
- **Features**:
  - **Delegated Customer Auth (`LoginModal`)**: Prompts login when identity-required actions (orders, addresses, checkout) are requested, sending credentials directly to merchant's auth endpoint.
  - **Real-Time NDJSON Streaming**: Streams agent responses while rendering live tool execution stages (*"Searching products..."*, *"Adding to cart..."*, *"Verifying prices..."*, *"Generating payment link..."*).
  - **Interactive Product Cards (`ProductCard`, `ProductCardGrid`)**: Displays product recommendations with image thumbnails, price formatting, stock status, and 1-click cart addition.
  - **Cart Drawer & Subtotal View**: Real-time cart overlay with quantity modifiers and item caps.
  - **Inline Order & Payment Confirmation (`OrderConfirmationCard`)**: Inline checkout card for delivery address selection, item breakdown, price re-verification, and direct Razorpay checkout execution (modal / iframe / payment link).
  - **Unmapped Domain 404 Screen**: Displays a custom 404 UI when an unmapped host visits the agent, providing an immediate CTA link to `https://shopagent.vijstack.com`.
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
| `create_order` | Initiate order creation and payment | Mandatory tool execution on confirmation. Re-verifies product prices against merchant API, creates merchant order, creates Razorpay order |
| `retry_payment` | Regenerate payment order/link | Used if payment expires or fails |
| `get_order_history` | Retrieve past orders for customer | Calls merchant's `/orders` history endpoint |
| `get_customer_profile` | Fetch customer account details | Calls merchant's `/profile` endpoint |
| `create_conversation_title` | Auto-title chat session | Summarizes first message into a concise conversation title |

---

## Database Schema (PostgreSQL via SQLAlchemy & Alembic)

1. **`users`**: Merchant primary ledger (Clerk User ID PK, store name, email, status: `pending` \| `approved` \| `blocked`).
2. **`onboardings`**: Store configurations (`user_id` FK, `base_url`, `auth_config`, `products_config`, `order_history_config`, `customer_profile_config`, `addresses_config`, `create_order_config`, `verify_order_config`, `branding_config`, settlement bank details, `webhook_url`, `webhook_path`, `slug`).
3. **`domain_mappings`**: Custom store domains (`id`, `domain` unique, `slug` FK, `user_id` FK, `status`, `created_at`).
4. **`api_keys`**: Developer keys (`id`, `customer_id` FK, `name`, `key_prefix`, `key_hash` SHA-256, `status`: `active` \| `paused`, `last_used_at`).
5. **`merchant_user_sessions`**: Customer session tokens (`id`, `merchant_id` FK, `customer_ref`, `email`, `merchant_token_encrypted` AES-Fernet, `expires_at`).
6. **`conversations`**: Chat sessions (`id`, `merchant_id` FK, `user_email`, `title`, `created_at`, `updated_at`).
7. **`conversation_messages`**: Chat history (`message_id`, `conversation_id` FK, `sender`: `user` \| `agent`, `message`, `metadata` JSON for cards/attachments).
8. **`cart_items`**: Shopping cart (`id`, `merchant_id` FK, `customer_email`, `product_id`, `name`, `thumbnail_url`, `price`, `quantity`, UniqueConstraint on `merchant_id + customer_email + product_id`).
9. **`agent_orders`**: Order ledger (`id`, `merchant_id` FK, `customer_ref`, `conversation_id`, `items` JSON, `merchant_order_id`, `order_total`, `currency`, `razorpay_order_id`, `razorpay_payment_id`, `status`: `initiated` \| `merchant_order_created` \| `awaiting_payment` \| `payment_captured` \| `failed`).

---

## Automated Test Suite

The repository contains **91 automated unit & integration tests** across 17 test files (100% pass rate):

- **Auth & Sessions**: Merchant registration, Clerk webhook sync, delegated customer authentication token encryption, and session expiration (`test_agentic_auth.py`, `test_clerk_webhook.py`, `test_clerk_duplicate_email.py`).
- **Cart & Limits**: Cart CRUD operations, 5-item distinct line-item cap enforcement, quantity caps, and session isolation (`test_cart_tools.py`).
- **API Keys & Settings**: Provisioning, hashing verification, status toggling (active/paused), and key prefix matching (`test_api_keys.py`, `test_settings.py`).
- **Custom Domains**: Domain mapping creation, Vercel verification API mocking, dynamic host branding resolution, and unmapped domain 404 checks (`test_domain_mappings.py`, `test_public_branding.py`).
- **Order & Address Tools**: Address fetching, order creation, order history parsing, and profile lookup (`test_address_order_tools.py`, `test_order_history_profile_tools.py`).
- **Payment & Order Verification**: Razorpay order generation, server-side price re-verification, payment verification webhooks, and `GET /merchant/orders/verify` query parameter API key authentication (`test_payment_verify.py`, `test_merchant_verify_order.py`, `test_razorpay_fail_loudly.py`).

### Running Tests Locally

```bash
cd backend
.\venv\Scripts\pytest
```

---

## Local Setup Guide

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

Built for the **Razorpay AI Buildathon 2026**. Designed for multi-tenant scalability, zero-friction merchant onboarding, custom domain integration, and enterprise-grade billing safety.
# AI Commerce Layer for Any Business

Built for the [Razorpay AI Buildathon](https://razorpay.com/buildathon/) — Agentic Commerce track.

> Note: "ShopAgent" is the current working name but has naming collisions with existing AI-commerce products in the space — treat as placeholder until a final name/domain is locked in.

## What this is

A SaaS platform where any business connects its existing APIs (products, orders, customers, auth) and instantly gets its own AI shopping agent — a conversational interface where customers can search products, compare options, manage cart items, check order status/history, and complete purchases, without the merchant building or maintaining any AI infrastructure themselves.

The merchant doesn't rebuild their backend. They onboard once through a dashboard (`frontend_main`), and their agent goes live at a dedicated subdomain or widget (`frontend_agent`).

## Why this approach

- **No password storage** — the agent authenticates customers through the merchant's own existing auth API. The platform never stores customer passwords; it only holds short-lived, encrypted session tokens issued after delegating login to the merchant.
- **No shared payment secrets** — payments go through Razorpay. The merchant connects their own settlement bank and webhook details; the platform never sees or stores their secret API keys. Orders are created using the merchant's own authorized access token.
- **Explicit consent before payment** — the agent always confirms cart + total with the customer before any charge is executed, to prevent unintended or hallucinated purchases.
- **Strict Billing Safety** — cart snapshot prices are display-only. Real billing amounts are always re-verified server-side against the merchant's authoritative product endpoints during order creation.

## Buildathon demo scope

The generic multi-merchant onboarding UX and AI Agent orchestrator are fully built and functional end-to-end against a real food ordering merchant (Ponion), with real APIs wired end-to-end.

---

## Architecture — 3 parts

```
frontend_main (merchant SaaS dashboard)     frontend_agent (customer-facing chat)
        │                                            │
        └──────────────────┬─────────────────────────┘
                           ▼
                    common backend
       (FastAPI · modular: system/ + agentic/)
                           │
             ┌─────────────┼──────────────┐
             ▼             ▼              ▼
     Merchant's own APIs   Razorpay API   Postgres (via SQLAlchemy + Alembic)
  (auth, products, orders,
     customers, addresses)
```

### 1. `backend` — FastAPI, modular

- **`system/`** — core SaaS logic: merchant accounts (`users`), onboarding config (`onboardings`), API keys (`api_keys`), domain mappings (`domain_mappings`), and authentication journey setup.
- **`agentic/`** — live Vertex AI (Gemini) LLM tool-calling orchestrator, streaming message engine, session token management, and per-customer cart storage.
- **Stack**: FastAPI, Pydantic v2 + pydantic-settings, SQLAlchemy + Alembic for migrations, PyJWT + Passlib (bcrypt) for token signing and hashing, HTTPX for async merchant API integration.
- **CORS**: allowed origins `localhost:3000` (merchant dashboard) and `localhost:3001` (customer chat widget).

### 2. `frontend_main` — merchant-facing SaaS dashboard (`localhost:3000`)

The control plane. Merchants sign up, onboard their APIs, connect payment payouts, manage API keys, and access live SSR developer documentation.

- **Stack**: Next.js (App Router) + TypeScript + Vanilla CSS / Tailwind, Framer Motion for animation, Lucide icons.
- **Design system**: semantic theme tokens (`primary`, `secondary`, `accent`, `background`, `surface`, `border`, `text-primary`, `text-secondary`, `success`, `warning`, `error`). Plus Jakarta Sans (headings) & Inter (body).
- **SSR Documentation site** (`/documentation`, `/documentation/onboarding`, `/documentation/dashboard`):
  - Server-side rendered merchant docs that fetch live merchant onboarding configurations and render request examples using **their actual configured endpoints and field names** (e.g. `example.com/products`).
  - Smooth ScrollSpy navigation with scroll-position offset detection across all documentation sections.
- **Key flows built:**
  - **Landing page** (`/`) — sticky navigation, animated feature sections, autoplaying interactive chat demo mockup.
  - **Merchant Auth** — signup/login with JWT sessions for merchant account owners.
  - **Gated Onboarding**:
    - **Step 1 — Connection Details**: base URL, auth journey (auth URL, identifier/password fields, token extraction path, token delivery via header or cookie), and live auth endpoint verification.
    - **Step 2 — Resource Endpoints**: 5 dedicated resource modals (Products, Order History, Customer Profile, Customer Addresses, Create Order) with live request testing using captured session tokens.
  - **Settings & API Keys** (`/settings`, `/settings/api-keys`): toggle assistant capabilities, set human-confirmation payout thresholds, and provision/pause/revoke up to 5 merchant API keys.

### 3. `frontend_agent` — customer-facing chat widget (`localhost:3001` / subdomains)

The customer-facing conversational shopping interface.

- **Stack**: Next.js (App Router) + TypeScript + Tailwind CSS.
- **Features built:**
  - **Session Authentication Modal (`LoginModal`)**: delegates customer credentials to the merchant's login route and receives short-lived session tokens.
  - **Real-Time NDJSON Streaming**: streams AI agent responses line-by-line while displaying live backend tool execution stages (`"Searching products…"`, `"Adding to your cart…"`, `"Checking your cart…"`, `"Naming this chat…"`, `"Putting it together…"`).
  - **Product Card Recommendations**: renders responsive, interactive product cards beneath agent messages with quick action buttons.
  - **Multi-Conversation Sidebar**: lists customer conversations with automatic first-message titling and active switching.

---

## Agentic LLM Orchestrator & Tool System

The backend orchestrates Gemini LLM loops through a single Vertex AI `Tool` container with FunctionDeclarations:

| Function Tool | Description | Execution & Guardrails |
|---|---|---|
| `search_products` | Search catalog by query/price/category | Calls merchant's onboarded `/products` API using session token |
| `add_to_cart` | Add product to cart or increment quantity | Scoped by `(merchant_id, customer_email)`. Enforces **5 distinct line-item cap** (`cart_full`) and max 20 units/item |
| `get_cart_items` | Fetch customer's current cart contents | Queries `cart_items` table and calculates display subtotal estimate |
| `update_cart_item` | Update item quantity in cart | Deletes row if `quantity <= 0`; updates quantity otherwise |
| `remove_from_cart` | Remove item from cart | Deletes specified product row from `cart_items` |
| `create_conversation_title` | Set/rename chat title | Updates `conversations` title in DB |

### Progress Status Stream Protocol

Status events emit both `stage` IDs and human-readable `label` strings in real-time NDJSON stream chunks:
```json
{ "type": "status", "stage": "adding_to_cart", "label": "Adding to your cart…" }
```
When cart contents change, the backend automatically emits a real-time cart update event:
```json
{ "type": "cart_updated", "items": [...], "count": 2, "subtotal": 2499.00 }
```

---

## Data Model (PostgreSQL via SQLAlchemy & Alembic)

**`users`** — merchant accounts
- `id` (Clerk/UUID), `store_name`, `email` (unique), `status` (`pending` | `approved`), `created_on`

**`onboardings`** — merchant store configurations
- `user_id` (FK `users.id`), `base_url`, `auth_enabled`, `auth_config` (JSON), `products_config` (JSON), `order_history_config` (JSON), `customer_profile_config` (JSON), `addresses_config` (JSON), `create_order_config` (JSON), `branding_config` (JSON), `webhook_url`, `bank_account`, `ifsc`, `branch_name`, `slug`

**`domain_mappings`** — custom store domains
- `id`, `domain` (unique), `slug` (FK `onboardings.slug`)

**`api_keys`** — storefront developer keys
- `id`, `customer_id` (FK `users.id`), `name`, `key_prefix`, `key_hash`, `status` (`active` | `paused`), `last_used_at`

**`merchant_user_sessions`** — delegated customer login tokens
- `id`, `merchant_id` (FK `users.id`), `customer_ref`, `email`, `merchant_token_encrypted`, `expires_at`

**`conversations`** — customer chat threads
- `id`, `merchant_id` (FK `users.id`), `user_email`, `title` (default `"Untitled"`), `created_at`, `updated_at`

**`conversation_messages`** — message history
- `message_id`, `conversation_id` (FK `conversations.id`), `sender` (`user` | `agent`), `message`, `metadata` (JSON for product attachments)

**`cart_items`** — per-customer shopping cart
- `id`, `merchant_id` (FK `users.id`), `customer_email`, `product_id`, `name`, `thumbnail_url`, `price` (display snapshot), `quantity`
- `UniqueConstraint("merchant_id", "customer_email", "product_id")`
- `Index("idx_cart_merchant_customer", "merchant_id", "customer_email")`

---

## Automated Test Suite

The project includes an automated test suite (**37 unit & integration tests**) covering:

- Merchant signup, login, JWT issuance, and API key hashing (`test_system.py`)
- Delegated auth token resolution, encrypted storage, and session validation (`test_agentic_auth.py`)
- Cart CRUD tools (`add_to_cart`, `get_cart_items`, `update_cart_item`, `remove_from_cart`), 5-item distinct cap enforcement, session isolation, and REST endpoints (`test_cart_tools.py`)
- Tool-to-stage status message mappings and fallback handling


Run tests locally:
```bash
cd backend
.\venv\Scripts\python -m unittest discover -s app/tests
```

---

## Roadmap

- Razorpay OAuth direct merchant account connect
- Live checkout execution with server-side price re-verification against merchant endpoints
- Payment webhook verification and order confirmation relay to chat widget
- Advanced catalog recommendation fine-tuning
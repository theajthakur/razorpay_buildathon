# AI Commerce Layer for Any Business

Built for the [Razorpay AI Buildathon](https://razorpay.com/buildathon/) — Agentic Commerce track.

> Note: "ShopAgent" is the current working name but has naming collisions with existing AI-commerce products in the space — treat as placeholder until a final name/domain is locked in.

## What this is

A SaaS platform where any business connects its existing APIs (products, orders, customers, auth) and instantly gets its own AI shopping agent — a conversational interface where customers can search products, compare options, check order status/history, and complete purchases, without the merchant building or maintaining any of it themselves.

The merchant doesn't rebuild their backend. They onboard once through a dashboard, and their agent goes live at a dedicated subdomain (e.g. `agent.merchantsite.com`).

## Why this approach

- **No password storage** — the agent authenticates customers through the merchant's own existing auth API. The platform never stores customer passwords; it only holds short-lived, scoped session tokens issued after delegating login to the merchant.
- **No shared payment secrets** — payments go through Razorpay OAuth. The merchant connects their own Razorpay account; the platform never sees or stores their secret API keys. Orders are created using the merchant's own authorized access token, so money flows directly into the merchant's account.
- **Explicit consent before payment** — the agent always confirms cart + total with the customer before any charge is executed, to prevent unintended/hallucinated purchases.

## Buildathon demo scope

Rather than building a generic "connect any API" platform for the demo, the build is scoped to one real, fully working vertical: an existing food ordering site (Ponion) that the founder already operates, with real APIs wired end-to-end. The generic multi-merchant onboarding UX is built and functional — it's just demonstrated against one real merchant rather than claimed to work universally. Full production concerns (arbitrary schema auto-discovery, scaling, secrets infra hardening) are discussed as roadmap, not built for the demo.

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

- **`system/`** — core SaaS logic: merchant accounts, onboarding, connection config, auth journey config. This is where account signup, onboarding data, and eventually billing/merchant management live.
- **`agentic/`** — will hold the AI agent orchestration flow (LLM tool-calling against the merchant's onboarded APIs). Scaffolded but not yet implemented.
- **Stack**: FastAPI, Pydantic + pydantic-settings (`Settings` via `.env`, cached with `lru_cache`), SQLAlchemy + Alembic for migrations, bcrypt (via passlib) for password hashing.
- **CORS**: allowed origins `localhost:3000` and `localhost:3001` (frontend_main and frontend_agent dev servers).

### 2. `frontend_main` — merchant-facing SaaS dashboard (`localhost:3000`)

The control plane. Merchants sign up, onboard their APIs, connect Razorpay, and manage their agent.

- **Stack**: Next.js (App Router) + TypeScript + Tailwind, Framer Motion for animation, lucide-react for icons.
- **Design system**: all colors defined once as CSS variables in `global.css` and mapped to semantic Tailwind tokens (`primary`, `secondary`, `accent`, `background`, `surface`, `border`, `text-primary`, `text-secondary`, `success`, `warning`, `error`) — no raw hex or default Tailwind colors used anywhere else in the codebase. Light background, dark text. Exactly 2 fonts: Plus Jakarta Sans (headings), Inter (body). Generous whitespace, minimum 16px body text.
- **`docs/`** — living documentation folder inside the app itself (`design-system.md`, `architecture.md`, `pages.md`, `onboarding-flow.md`, etc.), updated as part of every build step so anyone can get full context without reading the codebase.
- **`components/`** — reusable, presentational-only components (Button, Input, Card, Sidebar, StatusBadge, EndpointRow, ChatDemo, StepItem, FeatureItem, etc.)

**Key flows built:**
- **Landing page** (`/`) — modern, sticky surface navbar, animated (Framer Motion) sections, an autoplaying chat demo mockup showing the full customer journey (search → pick → confirm → pay → success), no "AI-ish" badges/pills anywhere.
- **Auth** — merchant signup/login (the merchant's own account with the platform — separate from their end-customers' auth).
- **Onboarding** — two-step flow, gated (Step 2 unlocks only after Step 1 is saved):
  - **Step 1 — Connection Details**: base URL, and an authentication toggle (on by default). Turning auth off requires an explicit danger-styled confirmation modal, since disabling it removes the ability to track orders/history per customer. If auth is enabled, the merchant configures the full login journey inline: auth URL + method, a field-mapping modal (identifier field + type [email/mobile/text], password field), a live test request against the real endpoint, automatic recursive token-path detection in the response (with manual override, validated live), and token delivery config (header + optional Bearer prefix, or cookie). Drafts persist to `localStorage` until saved to the DB, so no progress is lost on refresh.
  - **Step 2 — Resource Endpoints**: each resource (Products, Order History, Customer Profile, Addresses, Create Order) is configured through its own modal rather than one generic form, scoped to what that resource actually needs. Every test call in this step automatically reuses the token captured in Step 1 (no re-entry) and shows the full raw response body, not just a status code.
- **Dashboard / Settings** — overview cards, agent branding, confirmation-threshold setting, feature toggles (scaffolded).

### 3. `frontend_agent` — customer-facing chat (`agent.merchantsite.com`, dev on `localhost:3001`)

Not yet built. Will be the actual chat interface end customers use: login via the merchant's delegated auth, product search/browse, cart + explicit payment confirmation, order status/history — all conversational, calling the common backend, which in turn calls the merchant's onboarded APIs using the saved config.

---

## Data model (as currently implemented)

**`users`** (system module)
- `id`, `store_name`, `email` (unique), `password_hash` (bcrypt), `created_on`, `status` (`pending` | `blocked` | `approved`, default `pending`)

**`onboardings`** (one row per merchant, linked by `user_id`)
- `base_url`
- `auth_enabled` (bool), `auth_disabled_ack` (bool — only true if the merchant explicitly confirmed the risk warning)
- `auth_config` (JSON) — the full login journey: `auth_url`, `method`, `identifier_field`, `identifier_type`, `password_field`, `token_path`, `token_delivery` (`method`: header/cookie, `header_name`, `bearer_prefix`, `cookie_name`)
- `products_config` (JSON) — `path`, `method`, `payload_key`, `response_key`
- `order_history_config` (JSON) — `path`, `method`, `response_key`
- `customer_profile_config` (JSON) — `path`, `method`
- `addresses_config` (JSON) — `fetch: {path, method, response_key}`, `create: {path, method, field_mapping[]}`
- `create_order_config` (JSON) — `path`, `method`, `cart_key`, `item_id_field`, `price_field`, `quantity_field`
- `bank_account`, `ifsc`, `branch_name` — merchant payout details
- `created_at`, `updated_at`

Verified working end-to-end against a real merchant (Ponion, a food ordering platform) — auth token successfully resolved via `data.token`, all 5 resource configs saved correctly.

---

## Roadmap (not yet built)

- `agentic/` module: turn saved onboarding config into live LLM tool definitions (tool-calling orchestrator)
- Razorpay OAuth connect flow (merchant connects their own Razorpay account)
- `frontend_agent` — the actual customer-facing chat app
- Live "test request" calling logic on the backend (currently the data model supports storing config; actually calling the merchant's real endpoints during onboarding tests still needs to be wired up per resource)
- Payment webhook handling + order confirmation relay back to the agent
- Full production security hardening (secrets encryption at rest, token refresh, rate limiting) — discussed as roadmap for the pitch, not required for the demo
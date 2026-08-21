# Infra.md — Agentic Commerce SaaS (Razorpay Buildathon)

Three-part system: `common-backend`, `frontend_agent`, `frontend_main`.
Demo vertical: existing food ordering site (single merchant, real APIs).

---

## 1. common-backend

The shared engine. Multi-tenant — every request resolves to a `merchant_id` and behaves according to that merchant's stored config. Neither frontend talks to merchant APIs directly; everything routes through here.

### Responsibilities
- Own the single source of truth for merchant config, sessions, orders-via-agent, and Razorpay tokens.
- Run the AI agent orchestration (LLM + tool calling) parameterized per merchant.
- Bridge customer auth to the merchant's own auth API — never store customer passwords.
- Handle Razorpay OAuth token exchange/refresh and order creation on behalf of the merchant.
- Enforce the trust/consent checkpoint before any payment is executed.

### Modules

**a) Merchant Registry**
- CRUD for merchant profile: name, branding, agent config
- Stores merchant's connected API endpoints (products, orders, customers, auth) + how to auth to them (API key / bearer token / basic auth)
- Stores merchant's Razorpay OAuth access + refresh tokens (encrypted at rest)
- Stores agent behavior settings: confirmation threshold amount, enabled features (order history, open cart negotiation, etc.)

**b) Agent Orchestrator**
- Receives: `merchant_id`, `customer_session`, `message`, `conversation_history`
- Loads merchant's tool config (which of their APIs map to which agent tools)
- Calls LLM (Claude API, tool use) with the merchant-specific tool definitions
- Executes whichever tool the LLM picks → calls the real merchant API → returns result to LLM → LLM replies to customer
- Tools: `search_products`, `get_product_details`, `check_stock`, `get_order_history`, `get_order_status`, `create_cart`, `confirm_and_pay`

**c) Auth Bridge**
- `POST /auth/login` — takes `merchant_id` + customer credentials → calls that merchant's auth API → returns a short-lived, scoped session token issued by common-backend (not the merchant's raw token)
- Session token maps internally to the merchant's real token, held server-side only, never sent to frontend_agent
- Session expires; no persistent password storage, ever

**d) Order & Payment Service**
- `POST /cart` — builds cart against merchant's product API (price/stock validated live, not cached)
- `POST /checkout/confirm` — the explicit human-confirmation step; nothing charges without this
- `POST /checkout/pay` — creates a Razorpay Order (test mode) using the merchant's OAuth-authorized token, returns a Payment Link / Checkout session
- Razorpay webhook receiver — verifies signature, updates order status, notifies agent to relay confirmation to customer

**e) Razorpay OAuth Service**
- `GET /razorpay/connect` — starts OAuth flow for a merchant (used by frontend_main)
- `GET /razorpay/callback` — exchanges code for access/refresh token, stores against merchant_id
- Token refresh handled transparently before each payment call

**f) Merchant Identification**
- Every inbound request carries `merchant_id` (via header or path — subdomain in production, simple header/path for buildathon demo)
- Middleware resolves merchant_id → loads config → attaches to request context before any handler runs

### Stack
- Node.js/Express or FastAPI (pick whichever you're faster in)
- Postgres (or even SQLite for demo) — merchants, sessions, orders, tool configs
- Claude API for orchestration (tool use / function calling)
- Redis (optional, only if you want cleaner session/cart state — skip for demo if short on time)

### Explicitly out of scope for buildathon build
- Auto-discovery of arbitrary merchant API schemas (manual mapping via frontend_main is enough)
- Multi-region/scaling concerns
- Full production-grade encryption/secrets infra — note it as roadmap, don't build it

---

## 2. frontend_agent — `agent.merchantsite.com`

Customer-facing. This is what the merchant's end customers actually use. One deployment, merchant-branded via config from common-backend (logo/name/colors pulled at load time by `merchant_id`).

### Responsibilities
- Chat interface — the only real UI surface a customer sees
- Customer login (delegated to merchant's own auth via common-backend's Auth Bridge)
- Render agent responses richly: product cards, cart summary, order status — not raw text dumps
- Explicit confirm-before-pay screen/step
- Razorpay checkout handoff (Payment Link redirect or embedded checkout)
- Order history / status view, driven by the same chat or a simple side panel

### Key screens
1. **Landing / chat start** — merchant branding, "Hi, I'm [Merchant]'s assistant"
2. **Login prompt** — triggered when customer asks for anything needing identity (orders, checkout)
3. **Chat thread** — main surface; renders text, product cards, cart, confirmation prompts inline
4. **Checkout confirmation** — explicit "Confirm ₹X order?" step, cannot be skipped
5. **Order status view** — pulled via agent tool call, displayed as a simple card

### Stack
- React (Vite) — lightweight, fast to build
- Talks only to common-backend (never directly to merchant APIs or Razorpay)
- No sensitive tokens stored client-side beyond the short-lived session token issued by Auth Bridge

---

## 3. frontend_main — merchant SaaS dashboard

Merchant-facing control plane. This is *your* product's login (separate identity system from the merchant's own customers).

### Responsibilities
- Merchant signup/login (your SaaS's own auth — Auth0/Clerk/simple JWT, whatever's fastest)
- Onboarding wizard: merchant enters/maps their API endpoints (products, orders, customers, auth)
- Razorpay "Connect" button → kicks off OAuth flow via common-backend
- Dashboard: agent conversations/activity, orders placed through the agent, basic revenue/analytics
- Settings: agent branding, confirmation threshold, which tools/features are enabled

### Key screens
1. **Signup/login** (merchant's own account with your SaaS)
2. **Onboarding — Connect APIs**: form to input base URL + auth method for products/orders/customers/auth endpoints, with a "test connection" button
3. **Onboarding — Connect Razorpay**: OAuth button → redirect → success state showing connected account
4. **Dashboard**: agent traffic, orders via agent, conversion snapshot
5. **Agent Settings**: name/branding, confirmation threshold amount, feature toggles

### Stack
- React (Vite), same framework as frontend_agent for consistency/speed
- Talks only to common-backend (merchant registry + Razorpay OAuth endpoints)

---

## Demo narrative this structure supports
1. Open **frontend_main** → show your food ordering site's APIs already connected, Razorpay connected via OAuth (2-minute onboarding story)
2. Switch to **frontend_agent** → real customer logs in, browses menu, adds items, confirms, pays via Razorpay test mode, checks order status — all conversational
3. Close on the architecture: one backend, config-driven per merchant, real auth delegation, real OAuth-scoped payments, explicit human-confirmation checkpoint before money moves

## Security talking points to have ready
- Customer passwords never touch common-backend — only short-lived scoped session tokens
- Merchant's Razorpay secret key never touches your platform — OAuth access token only, encrypted at rest, refreshed transparently
- No payment executes without an explicit confirmation step — mitigates "agent hallucinated a purchase" concern
- Every payment/order action is logged against merchant_id + session for audit
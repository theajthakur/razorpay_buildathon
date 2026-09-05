# Infra.md — Agentic Commerce SaaS (Razorpay Buildathon)

Three-part system: `backend`, `frontend_agent`, `frontend_main`.

---

## Production Deployment URLs

- **Merchant SaaS Dashboard (`frontend_main`)**: `https://shopagent.vijstack.com`
- **Common Backend (`backend`)**: `https://shopagent-backend.vijstack.com`

---

## System Architecture

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

---

## 1. common-backend (FastAPI)

The shared engine. Multi-tenant — every request resolves to a `merchant_id` and behaves according to that merchant's stored config. Neither frontend talks to merchant APIs directly; everything routes through here.

### Modules

**a) Merchant Registry & Domain Service**
- CRUD for merchant profile: name, branding, agent config.
- Custom domain management (`domain_mappings` table) integrated with Vercel DNS API (`POST /v9/projects/{project_id}/domains`). Provisions DNS records (CNAME `cname.vercel-dns.com` / `e493a233eec4285d.vercel-dns-017.com`) and queries dynamic verification status.
- Public branding resolution (`GET /api/public/branding`): Host header lookup against `domain_mappings`. Returns 404 Domain Error JSON if host is unmapped (0 placeholder/mock fallback).

**b) Agent Orchestrator**
- Google Gemini / Vertex AI tool calling engine parameterized per merchant.
- Tools: `search_products`, `add_to_cart`, `get_cart_items`, `update_cart_item`, `remove_from_cart`, `fetch_addresses`, `create_address`, `create_order`, `retry_payment`, `get_order_history`, `get_customer_profile`, `create_conversation_title`.
- Enforces mandatory tool execution (`create_order`) on purchase confirmation and server-side price re-verification during cart checkout.

**c) Auth Bridge**
- Customer authentication is delegated directly to the merchant's auth API.
- Issues AES-Fernet encrypted session tokens (`MerchantUserSession`), preserving zero password storage on the platform.

**d) Order & Payment Verification Service**
- Hassle-free merchant order verification endpoint: `GET /merchant/orders/verify?merchant_order_id=...&api_key=sk_live_...`.
- Flexible authentication accepting API keys via URL query parameters (`?api_key=` / `?apikey=`) or standard HTTP headers (`X-API-Key` / `Authorization: Bearer`).
- Excluded from Clerk user middleware in `frontend_main/middleware.ts` (`/merchant/(.*)`) to enable seamless server-to-server webhook verification.

---

## 2. frontend_agent (Customer Chat Widget)

Customer-facing. One deployment, merchant-branded via config from common-backend (`GET /api/public/branding`).

### Responsibilities
- Conversational UI rendering agent text chunks, product cards, cart drawer, address selector, and inline checkout cards.
- Real-time NDJSON event streaming.
- Dedicated **Store Domain Not Found (404)** error view for unmapped custom subdomains, with onboarding CTA redirecting to `https://shopagent.vijstack.com`.

---

## 3. frontend_main (Merchant SaaS Dashboard)

Merchant-facing control plane built with Next.js 15, TypeScript, Tailwind CSS, and Clerk Authentication.

### Key Sections
1. **Onboarding Wizard**: Base URL setup, auth configuration, dynamic resource configurator with live test modals for 6 core endpoints.
2. **Custom Domain Management (`/domain`)**: Add custom domain, view required DNS records (CNAME/A), verify DNS status with Vercel API, delete domain mappings. Responsive layout (`flex-col md:flex-row`, progressive column reduction).
3. **API Keys & Settings (`/settings`)**: Provision, pause, or revoke developer keys (`sk_live_...`), configure branding, set payout confirmation thresholds.
4. **Developer Documentation (`/documentation`)**: SSR interactive API documentation dynamically generated from merchant configuration.
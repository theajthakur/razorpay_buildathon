# Architecture

Comprehensive architectural blueprint of ShopAgent, detailing component responsibilities, state ownership, authentication boundaries, multi-tenancy, database entity relationships, and key design tradeoffs.

## Related Documentation

- [Agentic Commerce](agentic-commerce.md)
- [Payment Flow](payment-flow.md)
- [Security & Guardrails](security-and-guardrails.md)
- [Failure Recovery](failure-recovery.md)
- [Merchant Integration](merchant-integration.md)
- [Custom Domains](custom-domains.md)
- [API Reference](api-reference.md)

---

## 1. System Overview & Purpose

**ShopAgent** is an AI-native conversational commerce engine that converts traditional merchant HTTP APIs into an interactive, LLM-powered storefront. Instead of forcing merchants to rebuild their inventory, cart, or order management backends, ShopAgent acts as an adaptive orchestration middleware. It translates natural language customer intent into deterministic tool executions against existing merchant APIs, manages session and cart state in PostgreSQL, and completes financial transactions securely via Razorpay.

```mermaid
flowchart TD
    Customer(["AI Buyer / Customer"])
    
    subgraph Frontend ["Frontend Layer"]
        AgentUI["AI Storefront (frontend_agent)<br/>Next.js 15 / React / Tailwind"]
        DashUI["Merchant Dashboard (frontend_main)<br/>Next.js 15 / Clerk Auth / Shadcn"]
    end

    subgraph LLM ["AI Orchestration Layer"]
        Gemini["Google Gemini Model<br/>(via Vertex AI SDK)"]
    end

    subgraph Backend ["ShopAgent FastAPI Backend"]
        HostRes["Host Resolver Middleware<br/>(resolve_merchant_by_host)"]
        Router["FastAPI Router Layer"]
        Orchestrator["Agent Loop / Orchestrator<br/>(message_event_stream)"]
        Tools["Dynamic Tool Registry<br/>(build_tools_for_merchant)"]
        AuthModule["Auth & Security Engine<br/>(Clerk JWKS / JWT / Fernet)"]
        PaymentService["Payment & Webhook Engine<br/>(Razorpay SDK & Webhooks)"]
    end

    subgraph Storage ["Persistence Layer"]
        PG[("PostgreSQL Database<br/>Users, Onboarding, Orders,<br/>Cart, Messages, Domains")]
    end

    subgraph External ["External Services & Infrastructure"]
        MerchantAPI["Existing Merchant Backend APIs<br/>(Products, Auth, Orders, Addresses)"]
        RazorpayGateway["Razorpay Payment Gateway<br/>(Orders API & Checkout Modal)"]
        VercelAPI["Vercel Infrastructure API<br/>(Custom Domain DNS & SSL)"]
    end

    Customer <--> AgentUI
    DashUI <-->|Clerk JWT| Router
    AgentUI <-->|ShopAgent JWT / Host Header| HostRes
    HostRes --> Router
    Router --> Orchestrator
    Orchestrator <--> Gemini
    Orchestrator --> Tools
    Tools <--> MerchantAPI
    Router --> AuthModule
    Router --> PaymentService
    PaymentService <--> RazorpayGateway
    Backend <--> Storage
    DashUI <-->|Domain Config| VercelAPI
```

---

## 2. Core Components & Responsibilities

### 2.1 Frontends

#### `frontend_agent` (AI Storefront)
- **Role**: Lightweight customer-facing conversational interface built with Next.js 15.
- **Responsibilities**:
  - Renders real-time chat UI with streaming status indicators (`thinking`, `searching_products`, `processing_checkout`).
  - Displays dynamic UI cards for product search results, cart items, saved delivery addresses, order history, and account profiles.
  - Hosts the embedded Razorpay Checkout modal for one-click payment execution.
  - Obtains merchant branding context dynamically via host header resolution (`/api/public/branding`).

#### `frontend_main` (Merchant Dashboard)
- **Role**: Administrative web application for merchants.
- **Responsibilities**:
  - Authenticates merchants via Clerk (OAuth & Email magic links).
  - Guides merchants through API endpoint mapping (Auth, Catalog, Cart, Addresses, Orders).
  - Manages API Keys (`sk_live_...`) with permission scoping and pause/resume capabilities.
  - Provisions custom domains via Vercel DNS integration.
  - Displays live analytics (Revenue, Orders, Average Cart Value, Activity Feed).

---

### 2.2 Security & Authentication Boundaries

ShopAgent enforces distinct security models across different user types and integration touchpoints:

```mermaid
flowchart LR
    subgraph MerchantAuth ["Merchant Auth Boundary"]
        Clerk["Clerk OAuth / Magic Link"] -->|RS256 JWT| Backend1["get_current_user Guard<br/>(JWKS Key Verification)"]
    end

    subgraph CustomerAuth ["Customer Auth Boundary"]
        Login["Customer Login Proxy"] -->|Merchant Auth API| MerchantToken["Merchant Access Token"]
        MerchantToken -->|Fernet AES-256| SessionStore["MerchantUserSession DB"]
        SessionStore -->|HS256 Token| Backend2["Customer JWT Guard<br/>(get_current_session)"]
    end

    subgraph S2SAuth ["Server-to-Server Auth Boundary"]
        APIKeyHeader["Header / Query API Key<br/>sk_live_..."] -->|HMAC-SHA256 + Pepper| Backend3["API Key Guard<br/>(validate_api_key)"]
    end
```

---

### 2.3 Backend & AI Layer

#### FastAPI Backend (`backend/app`)
- **Role**: High-performance asynchronous Python backend serving as the central engine.
- **Responsibilities**:
  - Enforces multi-tenant isolation, route validation, session state management, and cryptography.
  - Bridges agent tool execution with external merchant HTTP endpoints.
  - Manages Razorpay order generation, HMAC SHA256 signature verification, and automated webhook dispatches.

#### Agent / LLM Orchestrator (`app/agentic/llm/orchestrator.py`)
- **Role**: Event-driven streaming orchestrator managing conversation execution loops.
- **Responsibilities**:
  - Manages the Vertex AI / Gemini SDK chat instance.
  - Injects conversation history and system instructions tailored with the merchant's store name.
  - Executes function calls returned by Gemini, enforces a maximum loop iteration guardrail (max 4 iterations), and streams NDJSON events back to the client.

#### Tool-Calling Architecture (`app/agentic/llm/tools.py`)
- **Role**: Schema registry for function declarations exposed to Gemini.
- **Responsibilities**:
  - Dynamically builds available tool schemas based on the merchant's active `Onboarding` features (e.g., omitting `create_address` if address creation isn't supported by the merchant backend).
  - Translates model intent into structured parameters validated by tool handler modules (`products.py`, `cart.py`, `addresses.py`, `orders.py`, `profile.py`).

---

### 2.4 Database Entity-Relationship (ER) Architecture

The PostgreSQL relational schema is structured to maintain strict tenant separation and full transaction history:

```mermaid
erDiagram
    users ||--o| onboardings : "owns (1-to-1)"
    users ||--o{ api_keys : "owns (1-to-N)"
    users ||--o{ merchant_user_sessions : "hosts (1-to-N)"
    users ||--o{ conversations : "hosts (1-to-N)"
    users ||--o{ cart_items : "stores (1-to-N)"
    users ||--o{ agent_orders : "processes (1-to-N)"
    onboardings ||--o{ domain_mappings : "provisions (1-to-N)"
    conversations ||--o{ conversation_messages : "contains (1-to-N)"
    conversations ||--o{ agent_orders : "links (0-to-N)"

    users {
        string id PK "Clerk User ID"
        string email
        string store_name
        string status "pending | approved | blocked"
    }

    onboardings {
        string id PK
        string user_id FK
        string base_url
        boolean auth_enabled
        json auth_config
        json products_config
        json order_history_config
        json customer_profile_config
        json addresses_config
        json create_order_config
        json verify_order_config
        json branding_config
    }

    domain_mappings {
        string id PK
        string onboarding_id FK
        string domain UK
        string status "PENDING | ACTIVE | FAILED"
        json dns_details
    }

    api_keys {
        string id PK
        string customer_id FK
        string name
        string key_prefix
        string key_hash
        string status "active | paused"
    }

    merchant_user_sessions {
        string id PK
        string merchant_id FK
        string customer_ref
        string email
        string merchant_token_encrypted
        datetime expires_at
    }

    conversations {
        string id PK
        string merchant_id FK
        string user_email
        string title
    }

    conversation_messages {
        string message_id PK
        string conversation_id FK
        string sender "user | agent"
        text message
        json metadata
    }

    cart_items {
        string id PK
        string merchant_id FK
        string customer_email
        string product_id
        string name
        numeric price
        integer quantity
    }

    agent_orders {
        string id PK
        string merchant_id FK
        string customer_ref
        string conversation_id FK
        string merchant_order_id
        numeric order_total
        string razorpay_order_id UK
        string razorpay_payment_id
        string status "initiated | merchant_order_created | awaiting_payment | payment_captured | failed"
    }
```

---

### 2.5 External Services & Infrastructure

#### Merchant APIs
- **Role**: Existing e-commerce backends owned by merchants.
- **Responsibilities**:
  - Acts as the ultimate source of truth for product availability, customer account credentials, saved delivery addresses, and primary merchant order creation.

#### Razorpay Payment Gateway
- **Role**: External financial infrastructure handling order generation, customer checkout UI, and signature verification.

---

## 3. Ownership & Responsibility Matrix

To prevent ambiguity, responsibilities across component boundaries are explicitly separated:

| Component / Layer | Responsible For | NOT Responsible For |
|---|---|---|
| **AI Reasoning (Gemini)** | Natural language parsing, intent recognition, selecting appropriate tool calls, conversational response generation. | Money movement authorization, price calculations, database mutations, direct payment state toggling. |
| **Deterministic Backend (ShopAgent)** | Price validation, cart line calculations, database state persistence, signature verification, API key hashing, host resolution, session encryption. | Inventing product details, overriding merchant inventory rules, executing unverified payment claims. |
| **Merchant Source-of-Truth** | Real product catalog data, customer authentication validity, primary merchant order creation, delivery address validation. | Conversational state, Razorpay checkout modal rendering, agent message streaming. |
| **Payment Source-of-Truth (Razorpay)** | Customer card/UPI charge processing, generating cryptographically signed payment signatures. | Local cart management, conversational context, merchant API configuration. |
| **ShopAgent Internal State** | Scoped `AgentOrder` lifecycle tracking (`initiated` → `payment_captured`), cart items state, conversation thread indexing. | Merchant inventory reservation outside created orders, global user password storage. |

---

## 4. Multi-Tenancy & Session Scoping

ShopAgent provides multi-tenant isolation out of the box:

```mermaid
flowchart TD
    Req[Incoming HTTP Request] --> ResolveHost["resolve_merchant_by_host Dependency"]
    ResolveHost --> CheckParam{Explicit merchant_id in Query/Header?}
    CheckParam -- Yes --> MatchDB1[Fetch Onboarding by User ID]
    CheckParam -- No --> CheckDomain{Host Header matches DomainMapping?}
    CheckDomain -- Yes --> MatchDB2[Fetch Onboarding by onboarding_id]
    CheckDomain -- No --> CheckBase{Host Header matches Onboarding base_url?}
    CheckBase -- Yes --> MatchDB3[Fetch Onboarding by base_url]
    CheckBase -- No --> CheckLocal{Local / Backend Host?}
    CheckLocal -- Yes --> Fallback[Fallback to default merchant]
    CheckLocal -- No --> Err404[Raise 404 Domain Not Found]

    MatchDB1 --> ScopedContext["Inject merchant_id into Request State"]
    MatchDB2 --> ScopedContext
    MatchDB3 --> ScopedContext
    Fallback --> ScopedContext
    ScopedContext --> SQLFilter["Enforce WHERE merchant_id = session['merchant_id'] on all SQL Queries"]
```

1. **Host-Based Merchant Resolution**: `resolve_merchant_by_host` inspects incoming request HTTP headers (`Host`, `X-Forwarded-Host`, `Origin`, `Referer`) or explicit `merchant_id` query parameters, matching them against `DomainMapping` records and `Onboarding.base_url`.
2. **Customer Session Scoping**: Upon customer login via `/api/public/auth/login`, ShopAgent generates a scoped JWT containing `sub` (Session ID), `merchant_id`, and `customer_ref`.
3. **Database Level Isolation**: All queries against `cart_items`, `agent_orders`, `conversations`, and `merchant_user_sessions` enforce explicit SQL filtering on `merchant_id`.

---

## 5. Key Architectural Decisions & Tradeoffs

### Decision 1: Adaptation Layer vs. Backend Rebuild
- **Approach**: ShopAgent maps existing merchant REST endpoints using configurable JSON field paths (`products_config`, `create_order_config`, `addresses_config`) rather than requiring a dedicated plugin or database migration.
- **Tradeoff**: Increases backend complexity in handling dynamic JSON extractions (`extract_by_path`, `find_list_in_dict`), but reduces merchant onboarding time to minutes with zero backend codebase modifications.

### Decision 2: Hybrid Database + API Cart Management
- **Approach**: Shopping carts are maintained natively in ShopAgent's PostgreSQL database (`cart_items`), while product catalog searches and order creations are routed live to the merchant API.
- **Tradeoff**: Requires live price re-verification during `create_order`, but prevents excessive HTTP roundtrips to merchant backends during casual chat browsing.

### Decision 3: Deterministic Tool Execution Guardrails
- **Approach**: The system instruction explicitly forbids Gemini from textually claiming an order is placed or payment is captured without successfully dispatching the `create_order` or `retry_payment` function calls.
- **Tradeoff**: Increases strictness in prompt formatting, but eliminates AI hallucination vulnerabilities where a model falsely informs a customer that their card was charged.

### Decision 4: Asynchronous Server-Side Signature Verification
- **Approach**: Razorpay payment success is never trusted based on client-side JS callbacks alone. The storefront submits `razorpay_order_id`, `razorpay_payment_id`, and `razorpay_signature` to `/agentic/payments/verify`, where server-side HMAC SHA256 verification is performed before updating `AgentOrder.status` to `payment_captured`.
- **Tradeoff**: Requires an extra API call after Razorpay modal dismissal, but guarantees 100% transaction integrity against client spoofing.

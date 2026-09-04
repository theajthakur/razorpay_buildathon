# Custom Domain Integration & Management

This document details the Custom Domain Management architecture, Vercel DNS integration, backend domain resolution, dynamic branding, and unmapped domain handling in the **AI Commerce Layer (ShopAgent)** platform.

---

## Overview

The platform allows multi-tenant merchants to connect their own custom subdomains or apex domains (e.g., `agent.mybrand.com` or `shop.mybrand.com`) to host their personalized AI shopping agent widget (`frontend_agent`).

Merchants manage their domains directly through the **Merchant Dashboard** (`frontend_main/app/(dashboard)/domain`), which interfaces with the FastAPI `backend` and Vercel DNS infrastructure.

---

## Architecture & Data Flow

```
┌───────────────────────────┐
│     Merchant Dashboard    │  (frontend_main: /domain)
│  (Add/Delete/Verify Domain)│
└─────────────┬─────────────┘
              │ REST API (/system/domains)
              ▼
┌───────────────────────────┐
│      FastAPI Backend      │
│  (app/system/routes.py)   │
└──────┬─────────────────┬──┘
       │                 │ Vercel REST API (/v9/projects/.../domains)
       ▼                 ▼
┌──────────────┐   ┌──────────────┐
│  PostgreSQL  │   │  Vercel DNS  │  (DNS Records: CNAME cname.vercel-dns.com / A Records)
│(domain_maps) │   │ Services     │
└──────────────┘   └──────────────┘
```

---

## 1. Domain Provisioning Lifecycle

### Step 1: Merchant Domain Registration
1. Merchant inputs a domain (e.g., `agent.mybrand.com`) in the **Add Custom Domain** modal (`DomainAddModal.tsx`).
2. `frontend_main` invokes `POST /system/domains` with payload `{ "domain": "agent.mybrand.com" }`.
3. Backend validates domain syntax, checks for existing database entries in `domain_mappings`, and registers the domain with Vercel API (`POST https://api.vercel.com/v9/projects/{project_id}/domains`).
4. Backend creates a record in `domain_mappings` linked to the merchant's onboarding configuration (`slug` and `user_id`).

### Step 2: DNS Configuration & Verification
1. `DnsDetailsCard.tsx` presents the exact DNS records required for activation:
   - **CNAME Record**: Name: `@` or `subdomain`, Value: `cname.vercel-dns.com` or project-specific Vercel CNAME (`e493a233eec4285d.vercel-dns-017.com`).
   - **A Record**: (For root domains) `76.76.21.21`.
2. Merchant adds these records to their domain provider (Cloudflare, GoDaddy, Namecheap, Route53, etc.).
3. Merchant clicks **Verify DNS Status** in the dashboard.
4. `frontend_main` calls `GET /system/domains/{domain_id}/verify`. Backend checks domain status with Vercel (`GET https://api.vercel.com/v6/domains/{domain}/config`) and returns verification status (`verified: true/false`, SSL status, and missing DNS records if unverified).

### Step 3: Dynamic Request Routing & Public Branding
1. When a end customer visits `https://agent.mybrand.com`, `frontend_agent` sends an initial request to `GET /api/public/branding` with the request `Host` header.
2. Backend middleware resolves the hostname against `domain_mappings`:
   - Matches `domain_mappings.domain` -> retrieves associated `onboardings` config -> returns store name, branding primary/accent colors, logo URL, and initial welcome prompts.

---

## 2. Unmapped Domain Handling & Error Screen

If a visitor navigates to an unconfigured domain or an invalid subdomain point to the agent frontend:

1. `GET /api/public/branding` checks the database for `domain_mappings`.
2. If no mapping exists, backend returns `404 Not Found` with JSON:
   ```json
   {
     "error": "Domain not found",
     "message": "This domain is not associated with any active merchant store."
   }
   ```
3. **No Mock / Placeholder Fallbacks**: Legacy mock data (e.g. "Ponion") has been completely removed across the system.
4. `frontend_agent` renders a dedicated full-screen **Store Domain Not Found (404)** interface (`AppShell.tsx`):
   - Clear icon header and message explaining that the domain is not mapped to an active AI agent.
   - Primary Call To Action (CTA) button redirecting to `https://shopagent.vijstack.com` for store onboarding.

---

## 3. Frontend Component Structure (`frontend_main/app/(dashboard)/domain`)

- **`page.tsx`**: Main responsive page layout orchestrating domain listing, stats cards, and action modals. Uses progressive grid column reduction (`3 -> 2 -> 1`) and `flex-col md:flex-row` wrapping to guarantee crisp display on mobile, tablet, and desktop viewports.
- **`DomainList.tsx`**: Interactive table/card list displaying active, pending verification, and primary status tags.
- **`DomainStatusBadge.tsx`**: Status indicator (`Verified` with green pill, `Pending Verification` with amber pill, `SSL Provisioning` with blue pill).
- **`DnsDetailsCard.tsx`**: Step-by-step DNS setup instructions with 1-click copy buttons for record values.
- **`DomainAddModal.tsx`**: Modal dialog for adding new custom domains.
- **`DomainDeleteModal.tsx`**: Confirmation modal dialog for deleting custom domain mappings.

---

## 4. API Endpoints Reference

| Method | Endpoint | Auth | Description |
|---|---|---|---|
| `GET` | `/system/domains` | Clerk User | List all custom domains registered by current merchant |
| `POST` | `/system/domains` | Clerk User | Register a new custom domain with backend & Vercel DNS |
| `DELETE` | `/system/domains/{domain_id}` | Clerk User | Remove a custom domain mapping and detach from Vercel |
| `GET` | `/system/domains/{domain_id}/verify` | Clerk User | Query Vercel DNS verification status for a specific domain |
| `GET` | `/api/public/branding` | Public | Resolve host header to merchant store configuration & branding |

---

## 5. Security & Isolation

- **Tenant Isolation**: Domain mappings are strictly bound to the authenticated merchant's `user_id`. A merchant cannot claim or modify a domain belonging to another merchant.
- **SSL Certificate Automation**: Vercel automatically provisions Let's Encrypt TLS certificates upon DNS verification, ensuring zero-configuration HTTPS for custom subdomains.

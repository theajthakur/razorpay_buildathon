# Architecture Overview

This app is the merchant-facing dashboard of a 3-part system: common-backend, frontend_agent, frontend_main.

## Authentication Strategy

For `frontend_main` (the merchant SaaS control panel), authentication manages merchant sign-in and store account configuration. This is strictly separate from end-customer agent authentication (which is handled by `frontend_agent`).

- **Implementation**: Email/Password authentication flow with mock session routing between `/login`, `/signup`, and the authenticated `/(dashboard)` route group.
- **Route Group Isolation**:
  - Public marketing pages live inside `app/(marketing)` using a clean transparent navbar layout (naked header) at root `/`.
  - Authenticated dashboard pages live inside `app/(dashboard)` sharing a common sidebar layout, header with merchant profile, and generous main content canvas.

# Infrastructure Setup

This document records the base infrastructure configuration for `frontend_main`.

## Stack Specification
- **Framework**: Next.js (App Router)
- **Language**: TypeScript
- **Styling**: Tailwind CSS v4 / PostCSS with CSS variable design system
- **Typography**: Google Fonts (`Inter` body font, `Plus Jakarta Sans` heading font via `next/font/google`)

## Directory Structure Strategy
- `/app` — routes/pages only, no business logic
- `/components` — reusable, presentational components ONLY (no page-specific logic)
- `/lib` — helpers, API client, utils
- `/docs` — living project documentation (updated at every step)

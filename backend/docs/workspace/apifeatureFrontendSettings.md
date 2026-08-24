# Task: API Keys Settings Page — Frontend

## Context

Dashboard → Settings → API Keys, built against the backend contract already implemented (`POST /api/dashboard/keys`, `GET /api/dashboard/keys`, `PATCH /api/dashboard/keys/:id/revoke`). Max 5 keys **total, counting all statuses** (active + revoked both occupy a slot — revoking never frees one up). Key names are unique per merchant across all statuses (a revoked key's name is permanently taken).

This should read as a real production settings page — think Stripe/Vercel/Razorpay's own API key screens — not a form bolted onto a table. First inspect the existing dashboard's component library, layout conventions, and existing settings pages (if any) and match those exactly — this page should feel native to the rest of the dashboard, not a new visual language.

## Component breakdown (build modularly — separate components, not one large file)

```
/settings/api-keys
  ├─ ApiKeysPage.tsx          — page shell, data fetching, top-level state
  ├─ ApiKeysHeader.tsx        — title, description, "Generate API Key" button, count indicator
  ├─ ApiKeysTable.tsx         — table + empty state switch
  ├─ ApiKeyRow.tsx            — single row: name, prefix, status badge, last used, actions
  ├─ GenerateKeyDialog.tsx    — name input, client-side validation, submit
  ├─ RevealKeyDialog.tsx      — one-time reveal of the raw key after creation
  ├─ RevokeKeyDialog.tsx      — confirmation before revoking
  └─ useApiKeys.ts            — hook: fetch, create, revoke, derived state (count, limit reached, taken names)
```

Adjust naming/folder convention to match whatever the existing dashboard already uses — the structure above is a guide, not a mandate.

## Data flow

- `useApiKeys()` hook owns fetching `GET /api/dashboard/keys` and exposes: `keys`, `totalCount`, `activeCount`, `maxKeys`, `isLimitReached` (`totalCount >= maxKeys`), `takenNames` (a `Set` of every existing key name, any status — used for instant client-side duplicate checks), plus `createKey`, `revokeKey`, and loading/error state for each.
- No polling needed for a settings page like this — refetch after create/revoke actions instead.

## Header

- Title + one-line description of what API keys are for.
- Primary button: **"Generate API Key"**.
  - Disabled when `isLimitReached`, with a tooltip: "You've reached the limit of 5 API keys. Revoke one to make room — revoked keys still count toward the limit." (be explicit that revoking won't free a slot, since that's counterintuitive).
- Small inline counter next to the button, e.g. `"3 / 5 keys used"`, always visible regardless of limit state — not just shown when near/at the cap.

## Table

**Columns:** Name · Key (prefix, e.g. `sk_live_7f8a3b••••••••`) · Status (badge) · Created · Last used · Actions

- **Status badge**: `active` = solid/success-tinted badge; `revoked` = muted/neutral badge with a strikethrough or reduced-opacity row treatment — revoked rows should read as clearly inert at a glance, not just via the badge text.
- **Last used**: relative time (e.g. "2 hours ago") if present, otherwise "Never used" in muted text — never leave it blank.
- **Actions**: `active` rows show a "Revoke" action (in a row-level menu, not a raw inline button, to avoid accidental clicks); `revoked` rows show no actions, or a disabled/greyed action area.
- Sort by `created_at` descending by default.

### Empty state

When `keys.length === 0`: no table at all — a centered empty-state panel with a short explanatory line ("You haven't created any API keys yet.") and a "Generate your first key" CTA that opens the same dialog as the header button. Don't render an empty `<table>` with a "no rows" message — that reads as unfinished, not intentional.

## Generate flow

1. Click "Generate API Key" → `GenerateKeyDialog` opens with a single `name` text input, autofocused.
2. **Client-side validation, live as they type, no backend call:**
   - Empty name → submit disabled.
   - Name matches an entry in `takenNames` (case-sensitive or case-insensitive — pick one and apply consistently, recommend case-insensitive comparison since "Production" and "production" being allowed to coexist would confuse merchants) → show inline error "You already have a key with this name" immediately, submit button disabled — **no network request fired for this check**, since the full name list is already in memory from `useApiKeys()`.
3. On submit, call `createKey(name)`. Handle the `409 duplicate_key_name` response defensively too (race condition safety net — e.g. two tabs), showing the same inline error even though the common path never reaches the backend with a duplicate.
4. On success, close `GenerateKeyDialog` and immediately open `RevealKeyDialog` with the raw key from the response.

## Reveal dialog (critical — this is the one-time-only moment)

- Show the full raw key in a monospace, selectable text block with a "Copy" button (copy-to-clipboard, with a brief "Copied!" confirmation state).
- A clear, impossible-to-miss warning: **"This is the only time you'll see this key. Store it somewhere safe — you won't be able to view it again."** Use a warning-tinted callout, not just plain text.
- Require an explicit acknowledgment before the dialog can be dismissed — either a "I've copied my key" confirm button (disabled until they've clicked Copy at least once, if you want to be strict) or at minimum a deliberate close action, not a click-outside-to-dismiss on this specific dialog, since accidental dismissal here is unrecoverable.
- After closing, the table refetches and shows the new row (prefix + name only, as normal).

## Revoke flow

- Row action → `RevokeKeyDialog` confirmation: name the key being revoked, state plainly that this is immediate and permanent ("This will immediately stop authenticating requests with this key. This cannot be undone, and revoking does not free up a slot for a new key.") — that last clause matters given the all-statuses limit rule.
- On confirm, call `revokeKey(id)`, optimistically update the row's status to `revoked` in the UI, then reconcile with the refetch.

## Responsive behavior

- Desktop: full table as described.
- Tablet/mobile: collapse to a stacked card-per-key layout (name + status badge on top row, prefix + last-used below, actions as a menu) rather than a horizontally-scrolling table — a scrolling table on mobile reads as unfinished for a settings page like this.
- Dialogs (`GenerateKeyDialog`, `RevealKeyDialog`, `RevokeKeyDialog`) become full-height sheets on small screens rather than centered modals, if that's the existing dashboard's mobile dialog pattern — match whatever convention already exists.

## Loading & error states

- Initial table load: skeleton rows (3–4 shimmering placeholder rows), not a spinner replacing the whole page.
- Create/revoke in flight: button shows a loading state and is disabled for the duration — no double-submit possible.
- Network/server errors on any action: inline error message near the relevant action (toast is fine too if that's the existing dashboard's pattern) — never a silent failure.

## Accessibility

- Dialogs trap focus and are dismissible via Escape (except `RevealKeyDialog` per the note above — decide deliberately whether Escape is disabled there too, and if so, make that intentional rather than an oversight).
- Status badges carry text, not color alone, so they're not color-blind-dependent.
- Table rows and row-menu actions are keyboard-navigable.
- Copy button has an accessible label beyond just an icon.

## Acceptance checks
- Attempting to type a duplicate name shows the inline error instantly with zero network calls — verify via network tab that no request fires until a valid, non-duplicate name is submitted.
- Generate button is disabled once `totalCount` (not `activeCount`) reaches 5, and revoking a key does not re-enable it.
- The raw key is visible exactly once, in `RevealKeyDialog`, and there is no way to retrieve it again from anywhere in the UI afterward (confirm the row itself only ever shows the prefix).
- Empty state renders instead of an empty table when there are zero keys.
- Revoked rows are visually distinct at a glance (not just a text label) and have no available actions.
- Page is fully usable at mobile width: card layout, no horizontal scroll, dialogs adapt to small screens.
- Matches the existing dashboard's design tokens, spacing scale, and component library — no new one-off styles introduced.
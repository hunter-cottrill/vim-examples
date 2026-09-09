# CLAUDE.md

Guidance for AI coding agents (Claude Code, Cursor, etc.) working in this Vim App SDK
app. Read this before writing any SDK code.

> **SDK reference:** the shared surface, conventions, and known runtime gotchas live in
> [`docs/vim-sdk-notes.md`](https://github.com/hunter-cottrill/vim-examples/blob/main/docs/vim-sdk-notes.md)
> — read it before writing any SDK code. Live upstream reference:
> https://developer-docs.getvim.ai/llms.txt. Where either disagrees with the installed types,
> the types win: `node_modules/@vimconnect/app-sdk/dist/index.d.ts`.
>
> This file covers only what is specific to **this app**.

## What this is

Price transparency at the point of order: it reads the order + patient insurance the
moment a provider selects or signs an order, and shows the estimated patient
out-of-pocket cost in-workflow via `@vimconnect/app-sdk` (Next.js / React / TypeScript).
Runs as an iframe inside the Vim Hub (a sidebar the Vim Connect Chrome extension injects
into a web EHR) plus a headless offscreen worker that fires a push notification with the
same estimate when the sidepanel is closed.

## Golden rules (do not violate)

1. **The order event carries no order data — confirmed live.** `order.basicInformation`
   arrives empty on `order_select`/`order_sign`, so the order must be re-fetched via
   `getOrderById()`, which itself can reject with "No order is in the current EHR context"
   in the same tick the event fires (a context-population race, not a bug) — see the
   retry-with-backoff in `src/lib/vim/retry.ts`.
2. **Codes and dollar amounts come from the controlled tables in `src/lib/pricing/`,
   never free text or model invention.** The CPT crosswalk matches free-text order names
   against a bundled procedure vocabulary and returns a confirm-picker on ambiguity —
   never a guess. If an LLM is ever added, it may only phrase an already-computed
   estimate, never compute or adjust a number.
3. **Secrets are server-only.** `CLIENT_SECRET` lives behind `/token` and
   `/api/auth/token`, never in the client bundle or a `NEXT_PUBLIC_*` var. `.env.local`
   is gitignored — never commit it; only `.env.local.example` (placeholders) ships.
4. **`lib/vim/` is the only SDK boundary.** `client.ts` for the UI SDK, `workerClient.ts`
   for the headless worker — everything else depends on the narrow types in
   `lib/vim/types.ts`, never on `@vimconnect/app-sdk` entity types directly.

## The trigger and reads this app actually uses

1. **Workflow events** — `order_select` / `order_sign`, one-shot, carry an id reference
   only (not inline order data — see Golden Rule 1).
2. **Entity API** — `sdk.ehr.api.order.getOrderById()` (resolves the current order from
   context), `sdk.ehr.api.patient.getInsurances()`.
3. **Context** — `encounter_open:encounter`, read continuously for
   `basicInformation.selfPay` (the only self-pay signal anywhere in the SDK schema).
4. **Worker-side** — `sdk.ehr.workflow.register(event, { operations: ['notify'] }, cb)`
   for the same two events, `sdk.hub.appState.isAppOpen` to skip notifying when the UI is
   already open, `handle.hub.pushNotification.show(...)` to fire the estimate.

## Writeback

**None — display-only by design.** There is no purpose-built audit or note field for "an
estimate was shown," and repurposing an unrelated field would be wrong; this app logs
app-side only. This was checked against `getManifest().contextWriteback`, not assumed;
re-check for the current session rather than trusting this line.

## What does NOT exist in the SDK (don't invent)

No pricing, benefits, claims-adjudication, or billing-document-generation concept
anywhere in the SDK — that's why `lib/pricing/` is entirely app-owned. No CPT/procedure
code field on the `Order` entity — only free-text `orderName`/`reason`, hence the
crosswalk. No `getEncounter()` Entity API read — self-pay only arrives via the continuous
context subscription.

## Build order (each step testable before the next)

Domain logic first (pure functions in `lib/pricing/`, no SDK — unit-test offline) → the
`lib/vim/` boundary (prove `initVimSDK` connects and logs a real `order_select` payload) →
then one vertical slice (read → reason → render) end to end before adding the worker's
notification path.

## Commands

- `npm install` — installs deps.
- `npm run dev` — dev server. Confirm the port matches your registered App URL.
- `npm run build` / `tsc --noEmit` — type-check + build; run before claiming done.
- `npm test` — Vitest over `lib/pricing/` (no EHR/SDK needed).
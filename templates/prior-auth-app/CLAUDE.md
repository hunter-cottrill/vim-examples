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

Prior authorization at the point of order: it reads the order + patient insurance +
diagnoses the moment a provider selects or signs an order, determines whether the payer
requires prior auth for that procedure, and — if so — lets the provider submit and track the
request in-workflow via `@vimconnect/app-sdk` (Next.js / React / TypeScript). Runs as an
iframe inside the Vim Hub (a sidebar the Vim Connect Chrome extension injects into a web
EHR) plus a headless offscreen worker that notifies the provider once, at the "auth may be
required" moment, when the sidepanel is closed.

## Golden rules (do not violate)

1. **The order event carries no order data — confirmed live.** The event fires with an id
   but empty `basicInformation`, so the order must be re-fetched via `getOrderById()`,
   which itself can reject with "No order is in the current EHR context" in the same tick
   the event fires (a context-population race, not a bug) — see the retry-with-backoff in
   `src/lib/vim/retry.ts`.
2. **Codes come from the controlled tables in `src/lib/priorAuth/data/`, never free text or
   model invention.** The procedure crosswalk matches free-text order names against a
   bundled vocabulary and returns `ambiguous`/`none` rather than guessing; the payer map and
   rules table are equally bundled and app-owned. If an LLM is ever added, it may only rank
   or explain an already-retrieved shortlist, never author a code or a determination.
3. **Secrets are server-only.** `CLIENT_SECRET` lives behind `/token` and
   `/api/auth/token`, never in the client bundle or a `NEXT_PUBLIC_*` var. `.env.local`
   is gitignored — never commit it; only `.env.local.example` (placeholders) ships.
4. **`lib/vim/` is the only SDK boundary.** `client.ts` for the UI SDK, `workerClient.ts`
   for the headless worker — everything else (including all of `lib/priorAuth/`) depends on
   the narrow types in `lib/vim/types.ts`, never on `@vimconnect/app-sdk` entity types
   directly.

## The trigger and reads this app actually uses

1. **Workflow events** — `order_select` / `order_sign`, one-shot, carry an id reference
   only (not inline order data — see Golden Rule 1).
2. **Entity API** — `sdk.ehr.api.order.getOrderById()`, `sdk.ehr.api.patient.getInsurances()`,
   `sdk.ehr.api.patient.getProblems()` — all resolve from the current context, no-arg. Fetched
   concurrently with retry-with-backoff (`src/lib/vim/retry.ts`).
3. **Context** — `chart_open:patient`, read continuously only to detect a patient change and
   reset the PA lifecycle (never surface one patient's result over another patient's chart).
4. **Worker-side** — `sdk.ehr.workflow.register(event, { operations: ['notify'] }, cb)` for
   the same two events (one registration per event id, not array-based like the UI's `.on`),
   `sdk.hub.appState.isAppOpen` to skip notifying when the UI is already open,
   `handle.api.isValid()` (namespaced, not a flat `handle.isValid()`) checked before use and
   after every `await`, `handle.hub.pushNotification.show(...)` to fire the notification.

## Writeback

**None.** Every available writable target was checked against "somewhere to put an
authorization number" — none fit. This app displays the approval number to the provider; it
never invents a write target. This was checked against `getManifest().contextWriteback`, not
assumed; re-check for the current session rather than trusting this line.

## What does NOT exist in the SDK (don't invent)

No procedure/CPT code field on the `Order` entity — only free-text `orderName`/`reason`,
hence the crosswalk. No structured plan/network id on `Insurance` — only a bare `payerName`,
hence the payer map. No payer/clearinghouse connectivity anywhere in the SDK — adjudication
is entirely simulated by this app's own backend. No SDK-provided timer/polling primitive for
deferred Worker work — this is why async resolution while the panel stays closed is a
disclosed v1 limitation, not an oversight.

## Build order (each step testable before the next)

Domain logic first (pure functions in `lib/priorAuth/`, no SDK — unit-test offline) → the
`lib/vim/` boundary (prove `initVimSDK` connects and logs a real `order_select` payload) →
the dev simulator (`NEXT_PUBLIC_SIM_MODE=true`, `/dev/harness`) → one vertical slice
(read → reason → render) end to end → submit/poll against the app's own backend → the
worker's notification path.

## Commands

- `npm install` — installs deps.
- `npm run dev` — dev server. Confirm the port matches your registered App URL.
- `npm run build` / `tsc --noEmit` — type-check + build; run before claiming done.
- `npm test` — Vitest over `lib/priorAuth/` (no EHR/SDK needed).
# CLAUDE.md

Guidance for AI coding agents (Claude Code, Cursor, etc.) working in this Vim App SDK
app. Read this before writing any SDK code.

> Full verified SDK reference: `llms.txt` (repo root). If a fact here and there conflict,
> the installed types win — read `node_modules/@vimconnect/app-sdk/dist/index.d.ts`.

## What this is

Prior authorization at the point of order: it reads the order + patient insurance +
diagnoses the moment a provider selects or signs an order, determines whether the payer
requires prior auth for that procedure, and — if so — lets the provider submit and track the
request in-workflow via `@vimconnect/app-sdk` (Next.js / React / TypeScript). Runs as an
iframe inside the Vim Hub (a sidebar the Vim Connect Chrome extension injects into a web
EHR) plus a headless offscreen worker that notifies the provider once, at the "auth may be
required" moment, when the sidepanel is closed.

## Golden rules (do not violate)

1. **Verify before you assert.** The SDK is niche and pre-1.0. Do not use a method or
   event key you can't trace to the installed `.d.ts`. A method existing in the types
   does NOT guarantee it's implemented in a given EHR build, and inline entity data on a
   workflow event is not guaranteed either — the event fires with an id but empty
   `basicInformation`, so the order must be re-fetched via `getOrderById()`, which itself
   can reject with "No order is in the current EHR context" in the same tick the event
   fires (a context-population race, not a bug) — see the retry-with-backoff in
   `src/lib/vim/retry.ts`.
2. **No chart writeback.** Every documented writable target (`encounter.assessment.diagnoses`,
   `encounter.billingInformation.procedureCodes`, `referral.basicInformation.notes`) was
   checked against "somewhere to put an authorization number" — none fit. This app displays
   the approval number to the provider; it never invents a write target. If a real target is
   ever confirmed, writeback goes through the ceremony: `getCapability('update')` →
   `requestPermission('update', { fields })` if `requestable` → `update(...)` only if
   `hasPermission('update')`. Refusal is a clean no-op.
3. **Codes come from the controlled tables in `src/lib/priorAuth/data/`, never free text or
   model invention.** The procedure crosswalk matches free-text order names against a
   bundled vocabulary and returns `ambiguous`/`none` rather than guessing; the payer map and
   rules table are equally bundled and app-owned. If an LLM is ever added, it may only rank
   or explain an already-retrieved shortlist, never author a code or a determination.
4. **Secrets are server-only.** `CLIENT_SECRET` lives behind `/token` and
   `/api/auth/token`, never in the client bundle or a `NEXT_PUBLIC_*` var. `.env.local`
   is gitignored — never commit it; only `.env.local.example` (placeholders) ships.
5. **`lib/vim/` is the only SDK boundary.** `client.ts` for the UI SDK, `workerClient.ts`
   for the headless worker — everything else (including all of `lib/priorAuth/`) depends on
   the narrow types in `lib/vim/types.ts`, never on `@vimconnect/app-sdk` entity types
   directly.

## Auth flow

Launch (`/launch?launch_id=...`) → authorize redirect (`scope="launch openid"`, `launch`,
`state="launchId:csrf"`) → callback `/app?code=...` → server route swaps code for a token
via JSON POST to `{backend}/app-auth/token` → `initVimSDK({ accessToken })` →
`sdk.hub.setActivationStatus('ENABLED')`. The offscreen worker mirrors this via
`/offscreen/launch` → `/offscreen/app` → `initWorkerVimSDK(...)`. Backend host is
`api.getvim.ai` / `api.stage.getvim.ai`.

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
5. **No writeback.** See Golden Rule 2.

## Build order (each step testable before the next)

Domain logic first (pure functions in `lib/priorAuth/`, no SDK — unit-test offline) → the
`lib/vim/` boundary (prove `initVimSDK` connects and logs a real `order_select` payload) →
the dev simulator (`NEXT_PUBLIC_SIM_MODE=true`, `/dev/harness`) → one vertical slice
(read → reason → render) end to end → submit/poll against the app's own backend → the
worker's notification path. See the build plan for the full step-by-step order.

## Commands

- `npm install` — installs deps.
- `npm run dev` — dev server. Confirm the port matches your registered App URL.
- `npm run build` / `tsc --noEmit` — type-check + build; run before claiming done.
- `npm test` — Vitest over `lib/priorAuth/` (no EHR/SDK needed).

## What does NOT exist in the SDK (don't invent)

No procedure/CPT code field on the `Order` entity — only free-text `orderName`/`reason`,
hence the crosswalk. No structured plan/network id on `Insurance` — only a bare `payerName`,
hence the payer map. No payer/clearinghouse connectivity anywhere in the SDK — adjudication
is entirely simulated by this app's own backend. No `sdk.ehr.api.referral` namespace and no
`sdk.ehr.api.provider` namespace (the latter is never mentioned in any verified source — this
app does not use it). No SDK-provided timer/polling primitive for deferred Worker work — this
is why async resolution while the panel stays closed is a disclosed v1 limitation, not an
oversight. No documented writeback target for an authorization/reference number anywhere —
see Golden Rule 2.

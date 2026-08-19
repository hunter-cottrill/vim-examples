# CLAUDE.md

Guidance for AI coding agents (Claude Code, Cursor, etc.) working in a Vim App SDK
starter template. Read this before writing any SDK code.

> Full verified SDK reference: `llms.txt` (repo root / docs). If a fact here and there
> conflict, the installed types win — read `node_modules/@vimconnect/app-sdk/dist/index.d.ts`.

## What this is
A starter app on `@vimconnect/app-sdk` (Next.js / React / TypeScript). It runs as an
iframe inside the Vim Hub (a sidebar the Vim Connect Chrome extension injects into a web
EHR), reads clinical context, and writes back to the chart through a permission gate.

## Golden rules (do not violate)
1. **Verify before you assert.** The SDK is niche and pre-1.0. Do not use a method or
   event key you can't trace to the installed `.d.ts`. A method existing in the types does
   NOT guarantee it's implemented in a given EHR build — guard Entity API calls with a
   `typeof fn === "function"` check and a try/catch (see `llms.txt`).
2. **No silent writes.** Every writeback goes through the ceremony:
   `getCapability('update')` → `requestPermission('update', { fields })` if `requestable`
   → `update(...)` only if `hasPermission('update')`. Refusal is a clean no-op.
3. **`update()` takes a nested object** (`{ assessment: { diagnoses: [...] } }`);
   dot-notation keys throw `INVALID_DATA`. `mode` is `'override' | 'append'` (no `'merge'`).
4. **Secrets are server-only.** `CLIENT_SECRET` and any LLM key live behind `/api/*` routes,
   never in the client bundle or a `NEXT_PUBLIC_*` var. `.env.local` is gitignored — never
   commit it; only `.env.example` (empty placeholders) ships.
5. **Codes come from a controlled vocabulary**, never free text or model invention. Any
   LLM ranks/explains a shortlist; it never authors a code that isn't in the list.

## Auth flow
Launch (`/launch?launch_id=...`) → authorize redirect (`scope="launch openid"`, `launch`,
`state="launchId:csrf"`) → callback `/app?code=...` → server route swaps code for a token
via JSON POST to `{backend}/app-auth/token` → `initVimSDK({ accessToken })` →
`setActivationStatus("ENABLED")`. Backend host is `api.getvim.ai` / `api.stage.getvim.ai`.

## The four EHR primitives
1. **Workflow events** — one-shot (`chart_open`, `order_select`). Carry ID references.
2. **Context** — continuous state (`chart_open:patient`, `encounter_open:encounter`).
   Data under `curr.fields`.
3. **Entity API** — on-demand reads (`sdk.ehr.api.patient.getProblems()`).
4. **Writeback** — permission-gated writes.

## Build order (each step testable before the next)
Domain logic first (pure functions, no SDK — unit-test offline) → auth/connection (prove
`initVimSDK` connects and logs a real `chart_open` payload) → then vertical slices
(read → reason → render → write) one at a time. Do not build all reads, then all UI, then
all writeback — build one insight end-to-end first.

## Commands
- `npm install` — installs deps (needs Zod v4).
- `npm run dev` — dev server. Confirm the port matches your registered App URL.
- `npm run build` / `tsc --noEmit` — type-check + build; run before claiming done.

## What does NOT exist (don't invent)
No insights/gaps API. No problem-list write (use encounter diagnosis). No medication write.
No CRM/coordinator API (use your own backend). No `sdk.ehr.api.referral` namespace (use the
`referral_start:referral` context key). See `llms.txt` for the full list.

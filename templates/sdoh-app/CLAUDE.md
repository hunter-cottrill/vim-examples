# CLAUDE.md

Guidance for AI coding agents working in this app. Read this before writing any SDK code.

> Full verified SDK reference: `llms.txt`. If a fact here and there conflict, the
> installed types win — read `node_modules/@vimconnect/app-sdk/dist/index.d.ts`.

## What this is

An SDOH (social determinants of health) flagging app on `@vimconnect/app-sdk`. It runs as
an iframe inside the Vim Hub, reads a patient's address/insurance/problems on chart open,
runs them through a deterministic rules engine, and lets the provider add the resulting
Z-codes to the encounter through a permission-gated writeback.

## Golden rules (do not violate)

1. **Verify before you assert.** The SDK is niche and pre-1.0. Do not use a method or
   event key you can't trace to the installed `.d.ts`.
2. **No silent writes.** Every writeback goes through the ceremony:
   `getCapability('update')` → `requestPermission('update', { fields })` if `requestable`
   → `update(...)` only if `hasPermission('update')`. Refusal is a clean no-op, never a
   thrown error the provider sees as a crash.
3. **`update()` takes a nested object** (`{ assessment: { diagnoses: [...] } }`);
   dot-notation keys throw `INVALID_DATA`. Modes differ by surface: the UI's
   `sdk.ehr.context.<entity>` is typed `ContextWriteback<T>` and accepts
   `'override' | 'merge' | 'append'`; the Worker's pre-authorized handle is
   `ContextWritebackNamespace` and accepts only `'override' | 'append'`. Confirm
   against the installed types for the surface you're on. This app only ever
   uses `'append'`.
4. **Secrets are server-only.** `CLIENT_SECRET` lives behind `/token` and
   `/api/auth/token`, never in the client bundle or a `NEXT_PUBLIC_*` var. `.env.local` is
   gitignored — never commit it; only `.env.local.example` (placeholders) ships.
5. **Z-codes come from the controlled vocabulary in `src/lib/sdoh/codes.ts`**, never free
   text or model invention. There is no LLM in this app at all — every rule is
   deterministic (see `src/lib/sdoh/rules.ts`'s own header comment on why).
6. **The bundled ZIP-risk table (`src/lib/sdoh/zip-risk.ts`) is fabricated illustrative
   demo data**, not a real deprivation index. Never let it get presented as authoritative
   in UI copy, a demo narration, or documentation.

## Auth flow

Launch (`/launch?launch_id=...`) → authorize redirect (`scope="launch openid"`, `launch`,
`state="launchId:csrf"`) → callback `/app?code=...` → server route swaps code for a token
via JSON POST to `{backend}/app-auth/token` → `initVimSDK({ accessToken })` →
`setActivationStatus("ENABLED")`. The Worker (`/offscreen`) repeats the same handshake
independently — it's a separate SDK connection, not a shared session with the UI app.

## The four EHR primitives

1. **Workflow events** — one-shot (`chart_open`). This app's only trigger, on both the UI
   (`sdk.ehr.workflow.on`) and Worker (`worker.ehr.workflow.register`) surfaces — never a
   different trigger between them.
2. **Context** — continuous state, keyed strings like `chart_open:patient`. Not used here;
   this app reads via the Entity API instead (see below), which the SDK constraints call
   out as the more retry-hardened path for a workflow-triggered read.
3. **Entity API** — on-demand reads: `getPatient()`, `getInsurances()`, `getProblems()`,
   each wrapped in `retryWithBackoff` (`src/lib/retry.ts`) for the
   `ENTITY_NOT_IN_CONTEXT` race right after `chart_open` fires. Falls back to the
   `chart_open` event's own inline `entities.patient` (typed as a full `Patient`, not just
   an id) only if the Entity API is exhausted and the fallback has usable signal.
4. **Writeback** — permission-gated writes to `sdk.ehr.context.encounter`, targeting
   `assessment.diagnoses`. This is the only confirmed writable target for these codes —
   there is no problem-list write.

## What does NOT exist (don't invent) — beyond llms.txt's list

- **No `language`/`preferredLanguage` field anywhere on `Patient` or `Demographics`** in
  the installed 0.4.56 types — confirmed absent, not merely undocumented. The
  language-access rule (`evaluateLanguageAccess` in `src/lib/sdoh/rules.ts`) and its
  `LanguageSignal` type stay fully implemented and fixture-tested; in a live EHR today,
  `PatientContext.language` will always be `null` (see `src/lib/patient-mapping.ts`'s
  comment), and `dataCompleteness` will correspondingly always include the
  language-missing reason until the platform adds this field. This is a real, honest
  limitation, not a bug — see README and the plan's open questions.
- **No submit/poll backend.** Writeback is a single SDK call with an immediate outcome;
  there is no pending job, no second route reading state a first route wrote.
- **No live community-resource directory or ZIP-risk-scoring service.** Both are bundled
  static data (`src/lib/sdoh/resources.ts`, `src/lib/sdoh/zip-risk.ts`). If a real
  integration replaces them later, preserve the `matchZipRisk(zipCode): ZipRiskMatch` and
  `resourceFor(need): ResourceRef | null` function signatures behind new API routes — the
  domain logic and UI don't need to change, only where those functions get their data.

## Build order (each step testable before the next)

Pure domain logic first (`src/lib/sdoh/*`, `src/lib/app-state.ts` — no SDK, unit-tested
offline) → auth/connection (prove `initVimSDK` connects) → dev simulator
(`NEXT_PUBLIC_SIM_MODE=true`, `/dev/harness`) → vertical slices (read → reason → render,
then writeback) verified through the harness → Worker (reuses the same pure logic, never
forked) → convention files.

## Commands

- `npm install` — installs deps (needs Zod v4).
- `npm run dev` — dev server on port 8080. Confirm the port matches your registered App URL.
- `npm test` — Vitest over the domain logic. No `.env`, no SDK, no network required.
- `npm run type-check` / `npm run build` — run before claiming any change done.
# CLAUDE.md

Guidance for AI coding agents working in this app. Read this before writing any SDK code.

> **SDK reference:** the shared surface, conventions, and known runtime gotchas live in
> [`docs/vim-sdk-notes.md`](https://github.com/hunter-cottrill/vim-examples/blob/main/docs/vim-sdk-notes.md)
> — read it before writing any SDK code. Live upstream reference:
> https://developer-docs.getvim.ai/llms.txt. Where either disagrees with the installed types,
> the types win: `node_modules/@vimconnect/app-sdk/dist/index.d.ts`.
>
> This file covers only what is specific to **this app**.

## What this is

An SDOH (social determinants of health) flagging app on `@vimconnect/app-sdk`. It runs as
an iframe inside the Vim Hub, reads a patient's address/insurance/problems on chart open,
runs them through a deterministic rules engine, and lets the provider add the resulting
Z-codes to the encounter through a permission-gated writeback.

## Golden rules (do not violate)

1. **Z-codes come from the controlled vocabulary in `src/lib/sdoh/codes.ts`**, never free
   text or model invention. There is no LLM in this app at all — every rule is
   deterministic (see `src/lib/sdoh/rules.ts`'s own header comment on why).
2. **The bundled ZIP-risk table (`src/lib/sdoh/zip-risk.ts`) is fabricated illustrative
   demo data**, not a real deprivation index. Never let it get presented as authoritative
   in UI copy, a demo narration, or documentation.
3. **A ZIP-derived insight is always `inferred`, never `confirmed`.** The match confidence
   describes how well the ZIP matched the table, not whether this patient has the need — the
   table is neighbourhood-level, so any claim about an individual is an ecological inference
   regardless of how exact the lookup was. Match confidence gates whether the insight fires,
   never how the evidence is labelled.
4. **The language-access insight carries no suggested Z-code, deliberately.** A language
   barrier is a demographic fact that triggers a service, not a billable diagnosis. Z60.3
   ("Acculturation difficulty") is in the vocabulary but is a different clinical claim —
   vocabulary membership is not clinical appropriateness. Don't "helpfully" add it.
5. **Secrets are server-only.** `CLIENT_SECRET` lives behind `/token` and
   `/api/auth/token`, never in the client bundle or a `NEXT_PUBLIC_*` var. `.env.local` is
   gitignored — never commit it; only `.env.local.example` (placeholders) ships.
6. **The Worker repeats the OAuth handshake independently** — it is a separate SDK
   connection, not a shared session with the UI app.

## The reads this app makes

1. **Workflow event** — `chart_open`, this app's only trigger, on both the UI
   (`sdk.ehr.workflow.on`) and Worker (`worker.ehr.workflow.register`) surfaces — never a
   different trigger between them.
2. **Entity API** — `getPatient()`, `getInsurances()`, `getProblems()`, each wrapped in
   `retryWithBackoff` (`src/lib/retry.ts`) for the `ENTITY_NOT_IN_CONTEXT` race right after
   `chart_open` fires. Falls back to the event's inline `entities.patient` only if the Entity
   API is exhausted and the fallback has usable signal.

## Writeback

**Encounter `assessment.diagnoses`, permission-gated, `mode: 'append'`.** This is the only
template in the repo that actually writes. The target was confirmed against
`getManifest().contextWriteback` for the session it was built on — re-check for the current
session rather than trusting this line, since coverage expands as the platform adds
capabilities. Refusal is a clean no-op, never a thrown error the provider sees as a crash.

## What does NOT exist (don't invent)

- **No `language`/`preferredLanguage` field anywhere on `Patient` or `Demographics`** in
  the installed types — confirmed absent, not merely undocumented. The language-access rule
  (`evaluateLanguageAccess` in `src/lib/sdoh/rules.ts`) and its `LanguageSignal` type stay
  fully implemented and fixture-tested; in a live EHR today, `PatientContext.language` will
  always be `null` (see `src/lib/patient-mapping.ts`'s comment), and `dataCompleteness` will
  correspondingly always include the language-missing reason until the platform adds this
  field. This is a real, honest limitation, not a bug.
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
# CLAUDE.md

Guidance for AI coding agents working in this app. Read this before writing any SDK code.

> Full verified SDK reference: `llms.txt`. If a fact here and there conflict, the
> installed types win — read `node_modules/@vimconnect/app-sdk/dist/index.d.ts`.

## What this is

A clinical-trial-matching app on `@vimconnect/app-sdk`. It runs as an iframe inside the
Vim Hub, reads a patient's ZIP code and problem list on chart open, maps them to a trial
condition and an approximate coordinate via two bundled crosswalks, searches the live
ClinicalTrials.gov API, and shows the provider a distance-sorted, read-only list.

## Golden rules (do not violate)

1. **Verify before you assert.** The SDK is niche and pre-1.0. Do not use a method or
   event key you can't trace to the installed `.d.ts`.
2. **No writeback exists in this app, and none should be invented.** No entity offers a
   confirmed writable target for "trials of interest" (no Task/Flag entity — only
   field-path updates like `encounter.assessment`). Displaying the value is the correct
   answer here, not repurposing an unrelated clinical field.
3. **Secrets are server-only.** `CLIENT_SECRET` lives behind `/token` and
   `/api/auth/token`, never in the client bundle or a `NEXT_PUBLIC_*` var. `.env.local` is
   gitignored — never commit it; only `.env.local.example` (placeholders) ships.
4. **Condition search terms come from the controlled crosswalk in
   `src/lib/trial-match/condition-crosswalk.ts`**, never free text or model invention.
   There is no LLM in this app — every mapping is a deterministic table lookup.
5. **`SDKError` is declared in the types but not exported by the compiled runtime
   bundle** — don't use `instanceof SDKError`; duck-type on `(err as any)?.code` instead.
   `update()`'s modes differ by surface: the UI's `sdk.ehr.context.<entity>` is typed
   `ContextWriteback<T>` and accepts `'override' | 'merge' | 'append'`; the Worker's
   pre-authorized handle is `ContextWritebackNamespace` and accepts only
   `'override' | 'append'`. Confirm against the installed types for the surface
   you're on — the two interfaces are easy to conflate.
6. **The ZIP3-centroid table (`src/lib/trial-match/zip3-centroids.ts`) is a real, publicly
   sourced dataset (U.S. Census Bureau ZCTA Gazetteer)**, but it's still an area-level
   approximation — never present a ZIP3 centroid as an individual patient's confirmed
   location, in UI copy or documentation.
7. **Trial listings come from the live ClinicalTrials.gov API v2**, not a bundled
   dataset like this repo's other templates use — a deliberate exception, scoped tightly:
   only the search inputs (condition vocabulary, status filter, radius) are controlled;
   `src/app/api/trials/search/route.ts` is the only file that calls it.
8. **`Diagnosis.system` is declared in the reference but not reliably populated —
   confirmed live** against a Vim staging sandbox: `getProblems()` returned problems like
   `{"code":"I10","description":"Essential Hypertension","status":"active"}` with no
   `system` field at all. `matchConditionCrosswalk` (`condition-crosswalk.ts`) therefore
   only bails to `'none'` on an *explicitly* known non-ICD-10 label (`ICD-9`,
   `SNOMED-CT`); a missing/blank/unrecognized system still gets attempted against the
   ICD-10 table, since the table's letter-prefixed keys won't spuriously match a
   differently-shaped code anyway. Don't "fix" this back to a strict `=== 'ICD-10'` check
   — that's the bug this rule exists to prevent from regressing.
9. **ClinicalTrials.gov's `query.cond` does thesaurus-style term expansion, not plain
   substring matching — confirmed live.** An unquoted `query.cond=Hypertension` returned a
   pure glaucoma study (conditions: "Primary Open Angle Glaucoma", no mention of
   hypertension anywhere) alongside genuine essential-hypertension trials. Every
   `query.cond` value is therefore sent as a quoted exact phrase
   (`src/app/api/trials/search/route.ts`'s `buildStudiesUrl`), and the crosswalk's
   hypertension entry uses the precise term `"Essential Hypertension"` rather than the
   bare word. Don't remove the quoting as a "simplification" — verified live that it's
   load-bearing for result relevance, not stylistic.

## Auth flow

Launch (`/launch?launch_id=...`) → authorize redirect (`scope="launch openid"`, `launch`,
`state="launchId:csrf"`) → callback `/app?code=...` → server route swaps code for a token
via JSON POST to `{backend}/app-auth/token` → `initVimSDK({ accessToken })` →
`setActivationStatus("ENABLED")`.

## The four EHR primitives

1. **Workflow events** — one-shot (`chart_open`). This app's only trigger
   (`sdk.ehr.workflow.on`).
2. **Context** — continuous state, keyed strings like `chart_open:patient`. Not used here;
   this app reads via the Entity API instead, which is the more retry-hardened path for a
   workflow-triggered read.
3. **Entity API** — on-demand reads: `getPatient()`, `getProblems()`, each wrapped in
   `retryWithBackoff` (`src/lib/retry.ts`) for the `ENTITY_NOT_IN_CONTEXT` race right
   after `chart_open` fires. Falls back to the `chart_open` event's own inline
   `entities.patient` (a full `Patient`, not just an id) only if the Entity API is
   exhausted and the fallback has usable signal.
4. **Writeback** — not used. See golden rule 2.

## What does NOT exist (don't invent) — beyond llms.txt's list

- **No Task/Flag/CareCoordinationNote entity** for "trials of interest" — see golden
  rule 2.
- **No submit/poll backend.** `/api/trials/search` is a single stateless request/response;
  there is no pending job, no second route reading state a first route wrote.
- **No bundled trial dataset.** Unlike this repo's other templates, trial listings come
  live from ClinicalTrials.gov (golden rule 7) — if this is ever swapped for a different
  data source, preserve the `TrialSearchRequest`/`TrialSearchResponse` contract in
  `src/lib/trial-match/types.ts` so only `src/app/api/trials/search/route.ts`'s internals
  need to change.

## Build order (each step testable before the next)

Pure domain logic first (`src/lib/trial-match/*`, `src/lib/app-state.ts` — no SDK, unit-
tested offline) → auth/connection (prove `initVimSDK` connects) → dev simulator
(`NEXT_PUBLIC_SIM_MODE=true`, `/dev/harness`) → vertical slices (read → reason → render,
then live trial search) verified through the harness → convention files.

## Commands

- `npm install` — installs deps (needs Zod v4).
- `npm run dev` — dev server on port 8080. Confirm the port matches your registered App URL.
- `npm test` — Vitest over the domain logic. No `.env`, no SDK, no network required.
- `npm run type-check` / `npm run build` — run before claiming any change done.

<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

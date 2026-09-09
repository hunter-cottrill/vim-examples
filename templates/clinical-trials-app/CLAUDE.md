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

A clinical-trial-matching app on `@vimconnect/app-sdk`. It runs as an iframe inside the
Vim Hub, reads a patient's ZIP code and problem list on chart open, maps them to a trial
condition and an approximate coordinate via two bundled crosswalks, searches the live
ClinicalTrials.gov API, and shows the provider a distance-sorted, read-only list.

## Golden rules (do not violate)

1. **Secrets are server-only.** `CLIENT_SECRET` lives behind `/token` and
   `/api/auth/token`, never in the client bundle or a `NEXT_PUBLIC_*` var. `.env.local` is
   gitignored — never commit it; only `.env.local.example` (placeholders) ships.
2. **Condition search terms come from the controlled crosswalk in
   `src/lib/trial-match/condition-crosswalk.ts`**, never free text or model invention.
   There is no LLM in this app — every mapping is a deterministic table lookup.
3. **The ZIP3-centroid table (`src/lib/trial-match/zip3-centroids.ts`) is a real, publicly
   sourced dataset (U.S. Census Bureau ZCTA Gazetteer)**, but it's still an area-level
   approximation — never present a ZIP3 centroid as an individual patient's confirmed
   location, in UI copy or documentation.
4. **Trial listings come from the live ClinicalTrials.gov API v2**, not a bundled
   dataset like this repo's other templates use — a deliberate exception, scoped tightly:
   only the search inputs (condition vocabulary, status filter, radius) are controlled;
   `src/app/api/trials/search/route.ts` is the only file that calls it.
5. **`Diagnosis.system` is declared in the reference but not reliably populated —
   confirmed live** against a Vim staging sandbox: `getProblems()` returned problems like
   `{"code":"I10","description":"Essential Hypertension","status":"active"}` with no
   `system` field at all. `matchConditionCrosswalk` (`condition-crosswalk.ts`) therefore
   only bails to `'none'` on an *explicitly* known non-ICD-10 label (`ICD-9`,
   `SNOMED-CT`); a missing/blank/unrecognized system still gets attempted against the
   ICD-10 table, since the table's letter-prefixed keys won't spuriously match a
   differently-shaped code anyway. Don't "fix" this back to a strict `=== 'ICD-10'` check
   — that's the bug this rule exists to prevent from regressing.
6. **ClinicalTrials.gov's `query.cond` does thesaurus-style term expansion, not plain
   substring matching — confirmed live.** An unquoted `query.cond=Hypertension` returned a
   pure glaucoma study (conditions: "Primary Open Angle Glaucoma", no mention of
   hypertension anywhere) alongside genuine essential-hypertension trials. Every
   `query.cond` value is therefore sent as a quoted exact phrase
   (`src/app/api/trials/search/route.ts`'s `buildStudiesUrl`), and the crosswalk's
   hypertension entry uses the precise term `"Essential Hypertension"` rather than the
   bare word. Don't remove the quoting as a "simplification" — verified live that it's
   load-bearing for result relevance, not stylistic.

## The reads this app makes

1. `chart_open` workflow event — this app's only trigger (`sdk.ehr.workflow.on`).
2. `getPatient()` / `getProblems()` Entity API, each wrapped in `retryWithBackoff`
   (`src/lib/retry.ts`) for the `ENTITY_NOT_IN_CONTEXT` race right after `chart_open` fires.
   Falls back to the event's inline `entities.patient` only if the Entity API is exhausted
   and the fallback has usable signal.

## Writeback

**None.** No writable target appropriate for "trials of interest" was available — displaying
the value is the correct answer here, not repurposing an unrelated clinical field. This was
checked against `getManifest().contextWriteback`, not assumed; re-check for the current
session rather than trusting this line.

## What does NOT exist (don't invent)

- **No Task/Flag/CareCoordinationNote entity** for "trials of interest".
- **No submit/poll backend.** `/api/trials/search` is a single stateless request/response;
  there is no pending job, no second route reading state a first route wrote.
- **No bundled trial dataset.** Unlike this repo's other templates, trial listings come
  live from ClinicalTrials.gov (golden rule 4) — if this is ever swapped for a different
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
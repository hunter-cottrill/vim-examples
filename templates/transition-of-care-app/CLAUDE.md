# CLAUDE.md

Guidance for AI coding agents (Claude Code, Cursor, etc.) working in this Vim
App SDK starter template. Read this before writing any SDK code.

> Full verified SDK reference: `llms.txt` (repo root / docs). If a fact here
> and `llms.txt` conflict, the installed types win — read
> `node_modules/@vimconnect/app-sdk/dist/index.d.ts`.

## What this is

An app on `@vimconnect/app-sdk` (Next.js / React / TypeScript). It runs as an
iframe inside the Vim Hub, and on `chart_open` tells a provider whether their
patient was recently hospitalized, what the stay was for, and which discharge
diagnoses/medications aren't yet reflected on the current chart. There is no
writeback and no Worker in this app — see "What this deliberately does not
build" below for why.

## Golden rules (do not violate)

1. **Verify before you assert.** The SDK is niche and pre-1.0. Do not use a
   method or event key you can't trace to the installed `.d.ts`. A method
   existing in the types does NOT guarantee it's implemented in a given EHR
   build — guard Entity API calls with retry + a `NOT_IMPLEMENTED` check (see
   `src/lib/retry.ts`), never with `instanceof SDKError` (not exported at
   runtime — duck-type on `err.code`, see `src/lib/sdk-error.ts`).
2. **There is no encounter-history API and no admission/discharge fields on
   `Encounter`.** Confirmed absent from the installed type bundle
   (`EncounterSchema` has `id, plan, type, isSigned, provider, diagnoses,
   objective, assessment, subjective, identifiers, dateOfService,
   encounterNotes, basicInformation{type,status,selfPay,dateOfService},
   billingInformation, patientInstructions` — nothing about admission,
   discharge, disposition, or facility). The `encounter` Entity API namespace
   only has `getProcedureCodes()`/`updateProcedureCodes()` — no
   `getEncounters()`/list. Encounter data otherwise only arrives via the
   `encounter_open:encounter` context key when a provider opens an encounter
   — never on `chart_open`, and never as history. This is why "recent
   hospital stay" is answered by the bundled `src/lib/hospitalizationDataset.ts`
   instead — a stand-in for a real ADT/HIE/claims feed. If you're asked to
   make this "real," that means rewiring the internals of
   `src/app/api/hospitalization/route.ts` to an actual external source, not
   fabricating history inside the SDK client.
3. **No order query/list API.** `order.getOrderById()` only, no way to check
   whether a follow-up visit is already scheduled. Do not claim or imply a
   scheduling check anywhere in this app.
4. **No confirmed writable target.** No problem-list write, no
   medication-list write, no order create/update anywhere in the reference.
   This app is display-only. If the platform adds a real writable target
   later, writeback could be reconsidered — until then, don't invent one.
5. **Secrets are server-only.** `CLIENT_SECRET` lives behind `/token` and
   `/api/auth/token`, never in the client bundle or a `NEXT_PUBLIC_*` var.
   `.env.local` is gitignored — never commit it; only `.env.local.example`
   ships.
6. **One thin SDK client.** `src/lib/vim-client.ts` is the only module that
   imports runtime values from `@vimconnect/app-sdk`. Everything else —
   domain logic, UI — depends only on the local types in
   `src/lib/transition/types.ts`. If you need a new SDK read, add it to
   `vim-client.ts` and translate its result into a local type there; don't
   reach into `@vimconnect/app-sdk` from a component.
7. **Reconciliation confidence describes the chart, not a clinical
   conclusion.** "Not on the problem list" is what the data shows; "no
   longer indicated" is a judgment the chart never made. Don't let a future
   copy change slide from one into the other (see
   `src/components/TransitionSummaryCard.tsx`'s `CONFIDENCE_COPY`).

## Auth flow

Launch (`/launch?launch_id=...`) → authorize redirect (`scope="launch
openid"`, `launch`, `state="launchId:csrf"`) → callback `/app?code=...` →
server route swaps code for a token via JSON POST to
`{backend}/app-auth/token` → `initVimSDK({ accessToken })` →
`setActivationStatus("ENABLED")`. Backend host is `api.getvim.ai` /
`api.stage.getvim.ai`.

## The reads this app makes

1. `chart_open` workflow event — trigger only, carries a bare id reference.
   Entity API reads below resolve their id from the current context, so
   nothing is ever extracted from the event payload itself.
2. `chart_open:patient` / `encounter_open:patient` context — watched only for
   the dual-key teardown rule (reset to "waiting" only on a true
   present-to-absent transition on BOTH keys — see `src/lib/presence-tracker.ts`
   and its use in `vim-client.ts`'s `onPatientContextCleared`). Opening an
   encounter from inside a chart empties `chart_open:patient` while
   `encounter_open:patient` populates; the patient has not left.
3. `patient.getPatient()` / `patient.getProblems()` / `patient.getMedications()`
   Entity API (no-arg — resolves from current context) — each retried with
   backoff on transient failure, `NOT_IMPLEMENTED` treated as `unsupported`,
   not `error`.
4. `GET /api/hospitalization?patientKey=<mrn-or-ehrPatientId>` — this app's
   own route, fronting the bundled dataset. `patientKey` is
   `identifiers.mrn ?? identifiers.ehrPatientId`; if neither is present, the
   lookup is never attempted (`kind: 'unavailable'`), never silently reported
   as "not found."

## What does NOT exist (don't invent)

No encounter-history API. No admission/discharge/disposition/facility field
on `Encounter`. No order query/list API (so no scheduled-follow-up check). No
`sdk.ehr.api.referral` namespace. No problem-list write, no medication write,
no order create/update — none of that is relevant here since this app has no
writeback at all. `Medication` has no `dosage` or `status` field — dosage is
`strength`+`frequency`+`quantity`, and there's nothing to say whether a
medication is still active.

## What this app deliberately does not build

- **No state machine.** This is a single-shot read-evaluate-render flow;
  there's no pending stage and no user-driven multi-step lifecycle.
  `src/lib/transition/types.ts` uses derived-status unions (`SectionStatus<T>`,
  `PageStatus`, `HospitalizationLookupResult`) instead.
- **No Worker.** `chart_open` already puts the provider in front of the open
  panel — there's nothing to reach them with the panel closed.
- **No opportunistic `encounter_open:encounter` enrichment.** It would only
  ever reflect whatever encounter happens to be open *right now*, which is a
  different, narrower thing than "the recent hospitalization" and would risk
  conflating the two in the UI.
- **No scheduled-follow-up check.** See golden rule 3.

## Build order

Pure domain logic first (`src/lib/transition/*`, `src/lib/hospitalizationDataset.ts`
— no SDK, unit-test offline) → dev simulator (`src/dev/*`, so every later step
can verify through the harness) → auth/connection (prove `initVimSDK` connects
and logs a real `chart_open`) → the thin SDK client → then vertical slices
(patient identity → problems/medications → hospitalization lookup →
reconciliation → teardown) one at a time, verified through `/dev/harness` at
each step.

## Commands

- `npm install` — installs deps.
- `npm run dev` — dev server. Confirm the port matches your registered App
  URL.
- `npm run build` / `npm run type-check` — build / type-check; run before
  claiming done.
- `npm test` — Vitest over `src/lib/transition/*`, `src/lib/hospitalizationDataset.ts`,
  and `src/lib/vim-client.ts`'s pure mapping functions; no EHR/SDK/`.env`
  needed.

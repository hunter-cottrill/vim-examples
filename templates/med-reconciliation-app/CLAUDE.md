# CLAUDE.md

Guidance for AI coding agents working in this repository.

> Read `llms.txt` first — it is the verified `@vimconnect/app-sdk` surface this app depends on. If a fact here and there conflict, the installed types win: read `node_modules/@vimconnect/app-sdk/dist/index.d.ts`.

## What this is

A Vim Connect app template. On `chart_open`, it compares the chart's medication list against the chart's problem list and shows where they disagree. No writeback. A headless Worker notifies the provider when the panel is closed.

## Golden rules (do not violate)

1. **Verify before you assert.** The SDK is niche and pre-1.0. Do not use a method, event key or entity field you can't trace to the installed `.d.ts`.

2. **Findings are named for what the data shows, never for the clinical conclusion.** "No problem on the list matching this medication" is a description of two lists. "No longer indicated" would be a judgement the chart never made. An honest evidence label does not rescue an overclaiming title, because the title is what a busy reader actually reads. All finding copy lives in `src/lib/med-rec/presentation.ts`.

3. **Reserve "confirmed"/`chart_stated` for what the chart asserts about THIS patient.** Anything routed through `vocabulary.ts` is a population-level clinical association applied to an individual, so it is `inferred_*` however exactly the name matched. The evidence label must reflect the weakest link from source data to claim, not the confidence of the lookup.

4. **`none` is not a negative.** "Not in this app's vocabulary" and "nothing to report" are different outcomes and must stay visibly different in the UI. That is why `nothing_to_reconcile` still carries `excluded`, and why an unmapped active problem suppresses the whole `medication_without_problem_match` rule and sets `unmappedProblemSuppression` rather than quietly producing fewer findings.

5. **Never gate logic on an optional entity field.** Real sandbox problem lists return `code` and `description` with **no `system` at all**. `codeMayBeIcd10()` therefore only bails when the system explicitly names a non-ICD-10 vocabulary. Don't "fix" it to a strict `=== 'ICD-10'` check — that's the bug this rule exists to prevent from regressing. Same for `isConsideredActive()`: an absent status means the EHR didn't populate it, not that the problem resolved.

6. **Watch BOTH patient context keys, and wait out the settle window.** `chart_open` is entry-only; teardown comes from the context keys emptying. Opening an encounter from inside a chart empties `chart_open:patient` while `encounter_open:patient` populates — the patient has not left — and the two updates arrive in an unspecified order, so an all-absent instant is not a departure. `src/lib/presence-tracker.ts` is pure and fully tested; change it there, with a test, never inline in `vim-client.ts`.

7. **Secrets are server-only.** `CLIENT_SECRET` lives behind `/token` and `/api/auth/token`, never in the client bundle or a `NEXT_PUBLIC_*` var.

8. **`SDKError` is declared in the types but not exported by the runtime bundle** — duck-type on `err.code`, never `instanceof`.

9. **One OAuth implementation.** Both surfaces go through `src/lib/launch-auth.ts`. Do not grow a second copy inside the Worker page — that is precisely how cds-app ended up reading different env vars and destructuring `accessToken` from a response returning `access_token`.

10. **Never persist observed patient or clinical data.** The Worker's dedupe map holds a patient id and a signature built from finding kinds and this app's own vocabulary labels — no drug names, no ICD codes — in tab memory only. The EHR is the system of record.

11. **The UI and the Worker call the same `reconcile()` and the same `describeFinding()`.** Never fork the rules or the copy.

12. **The simulator must drive the real path.** Fixtures are raw `Patient`/`Medication`/`Diagnosis` payloads injected at the `vim-client.ts` boundary and resolved by `resolveRawChartPayload` — the same function `fetchChartContext` calls. Never dispatch a pre-built domain object or reducer input from the harness: a harness that hand-builds what a correct mapper would have produced passes while the app is broken.

## Auth flow

`/launch?launch_id` → CSRF in `sessionStorage` → `{vimBackend}/app-auth/authorize` (`scope="launch openid"`, `state="{launchId}:{csrf}"`) → `/app?code&state` → `POST /token` server-side → `initVimSDK({ accessToken })` → `setActivationStatus('ENABLED')`. The Worker runs the same sequence with `redirect_uri` of `/offscreen` and additionally needs the `id_token`.

## The four EHR primitives

1. **Workflow events** — one-shot, fire on entry. This app subscribes to `chart_open`.
2. **Context** — continuous, keyed strings. Used here **only** for teardown detection, across both patient keys. The data itself is read via the Entity API.
3. **Entity API** — on-demand, typed. `getMedications()` and `getProblems()`, no-arg overloads, retried with backoff.
4. **Writeback** — not used. See golden rule 2 and `llms.txt`.

## What does NOT exist (don't invent) — beyond llms.txt's list

- No pharmacy fill / dispense / claims read. The `/api/fill-history` contract in the README is a **boundary for an implementer to fill**, not a route this template ships. Do not stub it with synthetic data.
- No `Medication.status`, so "active medications" cannot be filtered the way active problems can.
- No backend store, and none is needed: nothing pends and nothing is written.

## Build order (each step testable before the next)

Pure domain (`src/lib/med-rec/*`, `src/lib/app-state.ts`, `src/lib/presence-tracker.ts` — no SDK, unit-tested offline) → auth/connection → SDK boundary plus the SIM seam → dev simulator (`NEXT_PUBLIC_SIM_MODE=true`, `/dev/harness`) → UI → vertical slices verified through the harness → Worker → convention files.

## Commands

```bash
npm run dev          # localhost:8080
npm test             # domain tests; no EHR, no SDK, no .env needed
npm run type-check
npm run build
```

Scaffolding gate — must return nothing:

```bash
grep -rniE "demo-card|SDK Explorer|onOpenExplorer|vim-sdk-demo-app|CapabilityAutoRunner|vim-demo-app|reference implementation" src/ package.json
```

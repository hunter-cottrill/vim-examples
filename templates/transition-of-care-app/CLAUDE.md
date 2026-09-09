# CLAUDE.md

Guidance for AI coding agents working in this repository.

> **SDK reference:** the shared surface, conventions, and known runtime gotchas live in
> [`docs/vim-sdk-notes.md`](https://github.com/hunter-cottrill/vim-examples/blob/main/docs/vim-sdk-notes.md)
> — read it before writing any SDK code. Live upstream reference:
> https://developer-docs.getvim.ai/llms.txt. Where either disagrees with the installed types,
> the types win: `node_modules/@vimconnect/app-sdk/dist/index.d.ts`.
>
> This file covers only what is specific to **this app**.

## What this is

A Vim Connect app template. On `chart_open`, it checks whether the patient was recently discharged from a hospital and shows what the stay was, what the discharge record says changed, and what is still outstanding. No writeback.

## Golden rules (do not violate)

1. **There is no encounter-history read, and the fix is never to invent one.** No `patient.getEncounters()`, no `Patient.encounters`, and the `encounter` namespace reaches only the encounter in current context. The hospital stay comes from `POST /api/discharge-record`, which is a named boundary an implementer wires to an ADT feed, HIE, or claims source. Nor is an app-owned store of observed clinical history the workaround — the EHR is the system of record.

2. **The app cannot see whether a follow-up visit happened, and must never imply it can.** It resolves a recommended *window* and reports where today sits in it. Every follow-up card and the stay header carry that caveat, and `presentation.test.ts` asserts it. A title saying "visit missed" or "overdue" would be a claim no source made.

3. **Findings are named for what the data shows, never for the clinical conclusion.** "Not found on the chart medication list" describes two lists. "Needs to be restarted" would be a judgement. An honest evidence label does not rescue an overclaiming title, because the title is what a busy reader actually reads. All finding copy lives in `src/lib/toc/presentation.ts`, and the test suite greps every title for judgement tokens.

4. **Reserve "stated" for what a source asserts about THIS patient; everything through `vocabulary.ts` is `inferred_*`.** `chart_stated` is what the EHR chart asserts, `record_stated` what the discharge record asserts. A drug class or a TCM complexity is a population-level association applied to an individual, however exactly the name or code matched. The evidence label reflects the weakest link from source to claim, not the confidence of the lookup.

5. **Three "we couldn't tell" outcomes are distinct from every negative, and must stay distinct on screen.** `source_unavailable` (couldn't ask) ≠ `no_discharge_record` (source has nothing) ≠ "no hospital stay happened" (unknowable). `followUpStatus: 'undetermined'` ≠ "no follow-up needed". An `ExcludedItem` ≠ a negative finding. This is why `nothing_outstanding` still carries `excluded`, and why `follow_up_window_elapsed` is withheld entirely when the window is undetermined.

6. **Never gate logic on an optional entity field.** Real sandbox problem lists return `code` and `description` with **no `system` at all** — `codeMayBeIcd10()` therefore bails only when the system explicitly names a non-ICD-10 vocabulary. `isConsideredActive()` treats an absent status as active. `onSetDate` absent yields `startedAtOrAfterDischarge: null`, never `false`.

7. **Watch BOTH patient context keys, and wait out the settle window.** `chart_open` is entry-only; teardown comes from the context keys emptying. Opening an encounter from inside a chart empties `chart_open:patient` while `encounter_open:patient` populates — the patient has not left — and the two updates arrive in an unspecified order. `src/lib/presence-tracker.ts` is pure and fully tested; change it there, with a test, never inline in `vim-client.ts`. The tracker reports **presence as well as clearance** — the context key is the mount fallback, because a panel that opens after the chart did will never receive `chart_open`.

8. **The domain layer is pure, and that includes the clock.** Nothing under `src/lib/toc/` may import `@vimconnect/app-sdk`, React, or the network, and `evaluateTransition()` takes `today` as an argument. The impure layers (`use-transition-summary.ts`, the API route) are the only places `new Date()` appears.

9. **Secrets are server-only.** `CLIENT_SECRET` lives behind `/token` and `/api/auth/token`, never in the client bundle or a `NEXT_PUBLIC_*` var.

10. **One OAuth implementation.** Both surfaces go through `src/lib/launch-auth.ts`. Do not grow a second copy — that is precisely how cds-app ended up reading different env vars and destructuring `accessToken` from a response returning `access_token`.

11. **Never persist observed patient or clinical data.** The `/api/discharge-record` route is stateless. The EHR is the system of record.

12. **The simulator must drive the real path.** Fixtures are raw `Patient`/`Medication`/`Diagnosis` payloads injected at the `vim-client.ts` boundary and resolved by `resolveRawChartPayload` — the same function `fetchChartContext` calls — and the discharge lookup hits the real route. Never dispatch a pre-built domain object or reducer input from the harness: a harness that hand-builds what a correct mapper would have produced passes while the app is broken.

## The reads this app makes

1. **Workflow event** — `chart_open`, an accelerator for the case where the panel was already open.
2. **Context** — both patient keys, for present-state and teardown (golden rule 7).
3. **Entity API** — `getMedications()` and `getProblems()`, no-arg overloads, retried with backoff.

## Writeback

**None.** No writable target was available for these findings, so they display for the provider to act on in the chart. This was checked against `getManifest().contextWriteback`, not assumed; re-check for the current session rather than trusting this line.

## Layout
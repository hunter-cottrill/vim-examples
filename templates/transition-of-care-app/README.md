# Transition of Care App — Vim App SDK starter

On `chart_open`, this app tells a provider whether their patient was recently
hospitalized, what the stay was for, and which discharge diagnoses/medications
aren't yet reflected on the current chart — so nothing important from a
hospital stay gets lost on the way back to primary care.

The SDK has **no encounter-history API and no admission/discharge fields on
Encounter** — confirmed absent from the installed types, not just
undocumented. So "recent hospital stay" is answered by a small bundled
dataset this app owns, standing in for a real ADT/HIE/claims feed. Every
other real patient (outside that bundled set) correctly shows "no recent
hospital stay on record," not an error. See `CLAUDE.md` for the full
reasoning and every platform gap this app works around.

There is no writeback (no confirmed writable target for the findings) and no
Worker (`chart_open` already puts the provider in front of the panel).

## Run

```bash
cp .env.local.example .env.local     # fill CLIENT_ID / CLIENT_SECRET
npm install
npm run dev                          # http://localhost:8080
```

Register App URL / Launch (`/launch`) / Token (`/token`) / Allowed URLs with
the port you run on. No Worker Launch URL is needed — this app has no Worker.

### Running without a live EHR (SIM_MODE)

```bash
NEXT_PUBLIC_SIM_MODE=true npm run dev
# then open http://localhost:8080/dev/harness
```

`/dev/harness` drives the real SDK client boundary (`simulateChartOpen`,
`simulateContextPresence` in `src/lib/vim-client.ts`) with raw SDK-shaped
`Patient`/`Diagnosis[]`/`Medication[]` fixtures, so they pass through the same
retry + mapping code the live path uses, and renders the real
`TransitionSummaryCard`. The hospitalization lookup itself calls the real
`/api/hospitalization` route against the real bundled dataset — nothing about
that path is mocked. Twelve fixtures cover every branch of the domain model
(found/not_found/unavailable/error hospitalization outcomes, high/ambiguous/
none reconciliation confidence, per-section EHR faults), plus manual previews
for the `connecting`/page-`error`/hospitalization-`error` states no pure
function emits on its own, plus controls to exercise the dual-context
teardown rule (open an encounter from inside the chart vs. actually leaving
the patient).

This proves the app handles a `chart_open` event, an Entity API fault, and a
context teardown correctly. It does **not** prove that `chart_open` fires, or
that `getProblems()`/`getMedications()` are populated, in a live EHR — that
still needs verifying against a real sandbox.

`NEXT_PUBLIC_SIM_MODE` must stay unset (or `false`) in staging/production —
with it unset, `/dev/harness` 404s and no dev-only code is reachable.

## Layout

- `src/app/launch` — OAuth launcher · `src/app/app` — the UI (`chart_open` →
  summary card)
- `src/app/token` + `src/app/api/auth/token` — token exchange (client secret
  server-only)
- `src/lib/transition/*` — pure domain logic (types, hospitalization
  recency/lookup, diagnosis/medication reconciliation, page status) — SDK-free,
  unit-tested
- `src/lib/hospitalizationDataset.ts` — the bundled ~15-record hospitalization
  dataset + its pure lookup, and `src/app/api/hospitalization/route.ts` — the
  read-only route fronting it (the seam a real deployment rewires to an actual
  ADT/HIE/claims source)
- `src/lib/vim-client.ts` — the only module that imports `@vimconnect/app-sdk`
  at runtime, plus the dev-simulator injection seam
- `src/lib/use-transition-summary.ts` — the one fetch-reason-render hook
  shared by the real app and the dev harness
- `src/components/TransitionSummaryCard.tsx` — the UI, in the four required
  states (connecting/waiting/result/error)
- `src/dev/*` + `src/app/dev/harness` — the SIM_MODE dev simulator

## Test

`npm test` — Vitest over the domain logic (`src/lib/transition/*.test.ts`,
`src/lib/hospitalizationDataset.test.ts`, `src/lib/vim-client.test.ts`), no
EHR/SDK/`.env` needed. UI and integration are verified live in an EHR (or via
the harness for the domain-logic/UI wiring, which is not the same as a
live-EHR proof — see above).

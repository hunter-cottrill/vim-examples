# Medication Reconciliation — Vim Connect app template

When a provider opens a patient's chart, this app compares the chart's **medication list** against the chart's **problem list** and shows where the two disagree, so the provider can fix the list in the EHR.

It reports three things, and names them for what the data shows rather than for the clinical conclusion they might suggest:

| Finding | What it means |
|---|---|
| **Two medications in the same class** | Two or more entries resolve to the same therapeutic class. |
| **No medication on the list in the class typically used for this problem** | An active problem is coded, and no medication on the list falls in a class charts commonly carry for it. |
| **No problem on the list matching this medication** | A medication resolves to a class, and no active problem on the list is typically treated with it. |

Two outcomes are deliberately kept distinct from "nothing found", because a provider has to be able to tell *no action needed* from *we couldn't tell*:

- **Not analyzed — outside this app's drug vocabulary** (the name didn't resolve)
- **Not analyzed — no medication name on the record** (the EHR sent no `medicationName`)

There is **no writeback**. The SDK exposes no medication or problem-list write, and the EHR support matrix currently reports read support only, so findings are displayed for the provider to act on in the chart.

## What this app does NOT do

Stated plainly because the gap matters:

- **It does not see what the patient is actually filling.** The Vim SDK exposes no dispense, fill, or claims data. This compares the chart's two lists *with each other*. See [Wiring up fill history](#wiring-up-fill-history).
- **It cannot tell active from discontinued medications.** The SDK's `Medication` entity has no `status` field, so the list may include entries already stopped in the chart.
- **It does not check drug interactions, dosing, renal adjustment, or allergies.**
- **Its drug vocabulary is partial** — roughly 60–75% of ambulatory prescription volume by ingredient. Everything outside it is listed under "Not analyzed", never silently dropped.

## Running it locally, with no EHR

The dev simulator lets you exercise every branch of the domain model without a Vim connection.

```bash
npm install
cp .env.local.example .env.local     # CLIENT_ID/CLIENT_SECRET can stay as placeholders for SIM mode
# set NEXT_PUBLIC_SIM_MODE=true in .env.local
npm run dev
```

Then open <http://localhost:8080/dev/harness>.

Pick a fixture to open a chart, drive the two patient context keys, and preview the exact notification text the Worker would push. Fixtures are **raw SDK-shaped payloads** injected at the SDK client boundary (`src/lib/vim-client.ts`), so they travel through the same extraction, mapping and normalisation the live path uses — the harness does not dispatch pre-built domain objects.

**What the harness proves:** that the app handles a `chart_open` event, an Entity API exhaustion, and a context teardown correctly.
**What it does not prove:** that `chart_open` fires, or that `getMedications()` returns data, in a live EHR.

With `NEXT_PUBLIC_SIM_MODE` unset (the default), `/dev/harness` returns 404 and the simulator is dead code the bundler eliminates.

```bash
npm test          # domain + render tests — no EHR, no SDK, no .env file needed
npm run type-check
npm run build
```

## Running it against a real EHR

1. **Handoff — register the app** in the Vim developer portal. You need:
   - **App URL** → `http://localhost:8080/launch`
   - **Worker URL** → `http://localhost:8080/offscreen`
2. Put the issued `CLIENT_ID` and `CLIENT_SECRET` in `.env.local`. `CLIENT_SECRET` is read only by `/token` and `/api/auth/token` and never reaches the client bundle.
3. `npm run dev`, then launch the app from the Vim Connect extension.

## Architecture

```
UI surface                              Worker surface
/launch → authorize → /app → initVimSDK  /offscreen → initWorkerVimSDK
      │                                        │
src/lib/vim-client.ts  ← SDK boundary    src/lib/worker-client.ts ← SDK boundary
      │                                        │
      └──────────► src/lib/med-rec/ ◄──────────┘
                   pure rules, vocabulary, copy
                   (no SDK, no React, no network)
```

`src/lib/med-rec/` is unit-testable in isolation and is called identically by both surfaces — the rules and the provider-facing copy are shared, never forked.

| Path | Role |
|---|---|
| `src/lib/med-rec/vocabulary.ts` | The controlled data set: 38 therapeutic classes, ~197 ingredients incl. brand aliases, 40 ICD-10 problem groups. |
| `src/lib/med-rec/crosswalk.ts` | Resolves free-text drug names and loosely-coded problems, always with an explicit `high \| ambiguous \| none`. |
| `src/lib/med-rec/engine.ts` | `reconcile(context) → ReconciliationResult`. The rules. |
| `src/lib/med-rec/presentation.ts` | Finding titles and evidence labels, shared by the panel and the notification. |
| `src/lib/app-state.ts` | The lifecycle as a discriminated union plus a pure reducer. |
| `src/lib/presence-tracker.ts` | Teardown detection across both patient context keys. |
| `src/lib/vim-client.ts` | The UI's only SDK import, plus the SIM_MODE injection seam. |
| `src/lib/worker-client.ts` | The Worker's only SDK import. |

### The Worker

`chart_open` does not open the app panel, so a panel-only app would compute findings nobody sees. The offscreen Worker registers on `chart_open:patient`, runs the same `reconcile()`, and pushes one notification whose `launchPayload` opens the panel.

It is scoped and throttled:

- **Scoped** to one patient by `notificationId: medrec-${patientId}` and by `launchPayload.patientId`, which the panel checks against the chart actually on screen before acknowledging it.
- **Suppressed** entirely when `worker.hub.appState.isAppOpen` — checked both on entry and again after the reads — and when there are no findings.
- **Throttled** to one notification per patient per worker session, re-armed only when the findings themselves change.

The dedupe map holds a patient id and a signature built from finding kinds and this app's own vocabulary labels — never a medication name or an ICD code. It lives in the tab's memory for the session and is never written to disk or to a backend. The EHR is the system of record.

## Wiring up fill history

The "what is the patient actually filling" half of medication reconciliation has no SDK read behind it. Rather than ship synthetic fill data that would render as real beside the chart, this template names the boundary:

```
GET /api/fill-history?patientRef=<opaque>
  → { fills: Array<{ ingredient: string; lastFillDate: string; daysSupply: number }> }
```

Implement that route against your own source of truth — your EHR's medication-history API, an HIE, or a PBM/claims feed — and add a fourth rule to `reconcile()`. The UI and the state machine do not change. Note that the Vim SDK exposes no patient identifier a pharmacy API would accept, so supplying that correlation is part of the integration.

## Verified against

`@vimconnect/app-sdk@0.4.56`. See `llms.txt` for the exact SDK surface this app uses and what does not exist.

## License

MIT — see `LICENSE`.

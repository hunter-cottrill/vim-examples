# Vim App SDK — Examples

Starter templates for building apps on the [Vim App SDK](https://developer-docs.getvim.ai/docs/)
(`@vimconnect/app-sdk`). Each is a working, buildable Next.js app aligned to the official
[Vim demo app](https://github.com/vimconnect/vim-demo-app) baseline — same `src/` structure,
config helpers, OAuth flow, and tooling — then branched for its use case.

## Templates

| Template | Use case | Fires when | Shows |
|---|---|---|---|
| [`cds-app`](templates/cds-app) | Clinical decision support | a chart opens | UI + worker, LLM-ranked (vocabulary-bound) code suggestions, permission-gated writeback |
| [`sdoh-app`](templates/sdoh-app) | Social determinants of health | a chart opens | UI + worker, deterministic rules, ZIP-level risk, Z-code writeback, dev simulator |
| [`care-coordination-app`](templates/care-coordination-app) | Care coordination | a chart opens | UI only, honest current-session snapshot of activity and providers referenced |
| [`med-reconciliation-app`](templates/med-reconciliation-app) | Medication reconciliation | a chart opens | UI + worker, where the medication list and problem list disagree, dev simulator |
| [`transition-of-care-app`](templates/transition-of-care-app) | Transition of care | a chart opens | UI only, recent hospital stay and what's still unreconciled, app-owned discharge feed boundary |
| [`clinical-trials-app`](templates/clinical-trials-app) | Clinical trial matching | a chart opens | UI only, ZIP-distance trial matching against a live external API, bundled condition crosswalk |
| [`referral-leakage-app`](templates/referral-leakage-app) | Referral guidance | a referral starts | UI + worker, in-network guidance, optional LLM rationale, notes-only writeback, dev simulator |
| [`price-transparency-app`](templates/price-transparency-app) | Price transparency | an order is placed | UI + worker, patient cost estimate, deterministic pricing and GFE eligibility |
| [`prior-auth-app`](templates/prior-auth-app) | Prior authorization | an order is placed | UI + worker, PA determination, pre-filled submission, state machine with bounded polling, dev simulator |

## Grab one template

```bash
npx degit hunter-cottrill/vim-examples/templates/sdoh-app my-app
cd my-app
cp .env.local.example .env.local   # fill in from the Vim developer portal
npm install
npm run dev                         # http://localhost:8080
```

## Try it without an EHR

Most templates ship a dev-only simulator. Set `NEXT_PUBLIC_SIM_MODE=true` in `.env.local`
and open `/dev/harness` to drive the app with built-in fixtures and click through the real
UI without provisioning an EHR.

Two things to know. It proves the app handles an event correctly, not that the event fires
in a live EHR. And **turn it off before testing against a real EHR** — with the flag on,
subscriptions go to the simulator instead of the SDK, so the app connects, reports no
error, and stays inert. Templates surface a banner when the flag is active; `NEXT_PUBLIC_*`
is inlined at build time, so restart the dev server after changing it.

## Aligned to the source of truth

Every template follows the Vim demo app's standards: `src/app` layout with `launch/`,
`app/`, `token/` + `/api/auth/token`, and `offscreen/` where a worker is warranted; shared
`lib/` helpers (`sdk-config`, `client-config`, `url-constants`, `config`, `token-exchange`);
the `CLIENT_ID` / `CLIENT_SECRET` / `APP_ENV` env convention; Node ≥18; Vitest; MIT. They
branch from that baseline only where the use case requires.

Each template also strips the demo app's own scaffolding — no SDK Explorer, status chrome,
or demo styling carries into a template. What you clone is the use case, not a demo.

Four conventions worth knowing, because they're deliberate and each one came from getting
it wrong first:

- **A worker is built only when it earns its place.** A UI app runs only while its panel is
  open, so an app whose value depends on reaching a provider with the panel closed ships a
  worker and a Hub notification. `care-coordination-app`, `transition-of-care-app`, and
  `clinical-trials-app` decline one, because their trigger already puts the provider in
  front of the panel.
- **Present-state comes from context, not events.** Workflow events are one-shot and report
  a moment. A panel that opens after the chart did never sees `chart_open`, so every
  template derives "is a patient here" from the context keys — watching both patient-scoped
  keys, since opening an encounter empties one while populating the other.
- **No patient data is stored outside the EHR.** Templates persist app-generated state only.
  Where a use case seems to need accumulated clinical history, the template scopes to what's
  readable at the trigger, labels it honestly, and names the missing platform capability
  rather than building its own store.
- **Nothing is written back on an unverified target, and nothing overclaims.** Where no
  writable field is confirmed, the app displays the value instead of inventing a field.
  Findings state what the data shows, not the clinical conclusion it suggests.

## For AI coding agents

Every template ships a `CLAUDE.md` and an `llms.txt`. The SDK's own
[`llms.txt`](https://developer-docs.getvim.ai/llms.txt) is the upstream index; each
template's copy records the verified surface behind it — exact signatures, the writeback
ceremony, and the negative space (what does *not* exist), which an index can't carry.

For the live reference, install the docs skill that ships with the SDK:

```bash
mkdir -p .claude/skills
cp -r node_modules/@vimconnect/app-sdk/skills/vim-app-sdk-docs .claude/skills/vim-app-sdk-docs
```

## Building your own app?

Start from the reusable prompt in [`docs/build-a-vim-app-prompt.md`](docs/build-a-vim-app-prompt.md).
Fill in five lines describing your use case; the agent researches the SDK and the sibling
templates, asks a short round of scoping questions, and returns a build plan you can execute
without hand-editing it.

## Freshness

CI reinstalls, type-checks, tests, and builds every template weekly
(`.github/workflows/template-freshness.yml`). A second workflow
(`.github/workflows/sdk-bump.yml`) bumps every template to the latest SDK, runs the same
checks, and opens a PR with per-template pass/fail. Note what that can and can't prove: the
Vitest suites are SDK-free by design, so only type-check and build touch the SDK surface. CI
proves a template still compiles; a human confirms it still works.

## Backend tests

Each template's pure domain logic is covered by Vitest (`npm test`), runnable with no EHR
and no SDK connection:

| Template | What's tested |
|---|---|
| `cds-app` | ICD-10 vocabulary retrieval/lookup, module trigger gating |
| `sdoh-app` | SDOH rules, Z-code vocabulary, ZIP risk, payer coverage, writeback state, retry |
| `care-coordination-app` | Session summary assembly, provider mentions, order-type labels |
| `med-reconciliation-app` | Drug/condition crosswalks, duplicate and gap rules, coverage accounting, presence tracking |
| `transition-of-care-app` | Hospitalization recency, discharge reconciliation, page status, dataset integrity |
| `clinical-trials-app` | Condition crosswalk, ZIP centroid lookup, haversine distance, trial matching |
| `referral-leakage-app` | Network directory matching, referral appropriateness, nudge engine, payer mapping |
| `price-transparency-app` | Cost estimation, procedure crosswalk, GFE eligibility, pricing data integrity |
| `prior-auth-app` | Procedure crosswalk, PA rules, payer mapping, job resolution, state-machine transitions |

UI, writeback, and EHR integration are verified live in an EHR.

## Contributing a template

Open a PR adding a folder under `templates/`. Requirements: builds clean (`npm run
type-check` and `npm run build`), tests pass (`npm test`), ships `.env.local.example`
(never `.env.local`), includes `CLAUDE.md` + `llms.txt` + `README.md`, follows the
`src/`-based structure, carries none of the demo app's scaffolding or identity, stores no
patient data outside the EHR, and surfaces a banner when `NEXT_PUBLIC_SIM_MODE` is active.

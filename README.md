# Vim App SDK — Examples

Starter templates for building apps on the [Vim App SDK](https://developer-docs.getvim.ai/docs/)
(`@vimconnect/app-sdk`). Each is a working, buildable Next.js app aligned to the official
[Vim demo app](https://github.com/vimconnect/vim-demo-app) baseline — same `src/` structure,
config helpers, OAuth flow, and tooling — then branched for its use case.

## Templates

| Template | Use case | Shows |
|---|---|---|
| [`cds-app`](templates/cds-app) | Clinical Decision Support | UI + offscreen worker, LLM-ranked (vocabulary-bound) code suggestions, permission-gated writeback |
| [`sdoh-app`](templates/sdoh-app) | Social Determinants of Health | UI app, deterministic rules, Z-code writeback, referral-aware detection |
| [`referral-leakage-app`](templates/referral-leakage-app) | Referral leakage prevention | UI + worker, in-network guidance at referral creation, optional LLM rationale, notes-only writeback, dev simulator |
| [`price-transparency-app`](templates/price-transparency-app) | Price transparency | UI + worker, patient cost estimate at order placement, deterministic pricing and GFE eligibility |

## Grab one template

```bash
npx degit hunter-cottrill/vim-examples/templates/sdoh-app my-app
cd my-app
cp .env.local.example .env.local   # fill in from the Vim developer portal
npm install
npm run dev                         # http://localhost:8080
```

## Aligned to the source of truth

Every template follows the Vim demo app's standards: `src/app` layout with `launch/`, `app/`,
`token/` + `/api/auth/token`, and `offscreen/` (worker); shared `lib/` helpers
(`sdk-config`, `client-config`, `url-constants`, `config`, `token-exchange`, `sdk-invoke`);
`CLIENT_ID` / `CLIENT_SECRET` / `APP_ENV` env; Node ≥18; Vitest; MIT. They branch from that
baseline only where the use case requires.

Each template also strips the demo app's own scaffolding — no SDK Explorer, status chrome, or
demo styling carries into a template. What you clone is the use case, not a demo.

## Try it without an EHR

`referral-leakage-app` ships a dev-only simulator: set `NEXT_PUBLIC_SIM_MODE=true` and open
`/dev/harness` to drive the app with built-in fixtures and click through the real UI without
provisioning an EHR. It's inert when the flag is unset. Useful for developing and demoing, but
it proves the app handles an event correctly — not that events fire in a live EHR.

## For AI coding agents

Every template ships a `CLAUDE.md` and an `llms.txt` so Claude Code / Cursor build against real
SDK methods instead of hallucinating them. For the live SDK reference, install the docs skill
that ships with the SDK — it points the agent at the site's `llms.txt` / `llms-full.txt`:

```bash
mkdir -p .claude/skills
cp -r node_modules/@vimconnect/app-sdk/skills/vim-app-sdk-docs .claude/skills/vim-app-sdk-docs
```

## Building your own app?

Start from the reusable prompt in [`docs/build-a-vim-app-prompt.md`](docs/build-a-vim-app-prompt.md).
Fill in your use case and an AI agent will plan a Vim SDK app grounded in the official SDK
reference. Works for any use case — CDS, SDOH, prior auth, price transparency, referral
management, and more.

## Freshness

CI reinstalls, type-checks, tests (Vitest), and builds every template against the latest SDK
weekly (`.github/workflows/template-freshness.yml`). If a template drifts, CI goes red.

## Backend tests

Each template's pure domain logic is covered by Vitest (`npm test`), runnable with no EHR and
no SDK connection:

| Template | What's tested |
|---|---|
| `cds-app` | ICD-10 vocabulary retrieval/lookup, module trigger gating |
| `sdoh-app` | SDOH rules, controlled Z-code vocabulary |
| `referral-leakage-app` | Network directory matching, referral appropriateness, nudge engine, payer mapping |
| `price-transparency-app` | Cost estimation, procedure crosswalk, GFE eligibility, pricing data integrity |

UI, writeback, and EHR integration are verified live in an EHR.

## Contributing a template

Open a PR adding a folder under `templates/`. Requirements: builds clean (`npm run type-check`
and `npm run build`), tests pass (`npm test`), ships `.env.local.example` (never `.env.local`),
includes `CLAUDE.md` + `llms.txt` + `README.md`, follows the `src/`-based structure, and carries
none of the demo app's scaffolding or identity.

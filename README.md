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

## Grab one template

```bash
npx degit hunter-cottrill/vim-examples/templates/sdoh-app my-app
cd my-app
cp .env.local.example .env.local   # fill in from the Vim developer portal
npm install
npm run dev                         # http://localhost:8080
```

## Aligned to the source of truth
Both templates follow the Vim demo app's standards: `src/app` layout with `launch/`, `app/`,
`token/` + `/api/auth/token`, and `offscreen/` (worker); shared `lib/` helpers
(`sdk-config`, `client-config`, `url-constants`, `config`, `token-exchange`, `sdk-invoke`);
`CLIENT_ID` / `CLIENT_SECRET` / `APP_ENV` env; SDK `0.4.53`; Node ≥18; Vitest; MIT. They
branch from that baseline only where the use case requires.

## For AI coding agents
Every template ships `CLAUDE.md` + `llms.txt` with the **verified** SDK surface, so Claude
Code / Cursor build against real methods instead of hallucinating them. If a docs page and the
installed types disagree, the types win (`node_modules/@vimconnect/app-sdk/dist/index.d.ts`).

## Freshness
CI reinstalls, type-checks, tests (Vitest), and builds every template against the latest SDK
weekly (`.github/workflows/template-freshness.yml`). If a template drifts, CI goes red.

## Backend tests
Each template's pure domain logic is covered by Vitest (`npm test`), runnable with no EHR or
SDK connection — `cds-app` tests the ICD-10 vocabulary retrieval/lookup and the module trigger
gating; `sdoh-app` tests the SDOH rules and the controlled Z-code vocabulary. UI/integration is
verified live in an EHR.

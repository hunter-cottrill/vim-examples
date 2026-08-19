# CDS App — Clinical Decision Support (Vim App SDK starter)

A UI + offscreen-worker app that suggests ICD-10 diagnosis codes at the point of care:
a deterministic module gates *when* to suggest, an LLM ranks a **vocabulary-bound** shortlist
(never free text), and writeback is permission-gated. Aligned to the Vim demo app baseline.

## Run
```bash
cp .env.local.example .env.local     # fill CLIENT_ID / CLIENT_SECRET / ANTHROPIC_API_KEY
npm install
npm run dev                          # http://localhost:8080
```
Register App URL / Launch (`/launch`) / Worker Launch (`/offscreen`) / Token (`/token`) /
Allowed URLs with the port you run on.

## Layout
- `src/app/launch` — OAuth launcher · `src/app/app` — UI · `src/app/offscreen` — worker
- `src/app/token` + `src/app/api/auth/token` — token exchange · `src/app/api/cds/evaluate` — LLM ranking (server-side key)
- `src/lib/cds/*` — vocabulary, modules, engine (pure, unit-tested) · `src/lib/*` — shared SDK/config helpers

## Test
`npm test` — Vitest over the ICD-10 vocabulary and module trigger gating (no EHR/SDK needed).
UI/integration is verified live in an EHR.

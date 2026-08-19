# SDOH App — Social Determinants of Health (Vim App SDK starter)

A UI app that surfaces social-need Z-codes at the point of care: deterministic rules derive
insights from patient/referral fields (transportation, financial, language, existing Z-codes),
codes come from a fixed Z-code table, and writeback is permission-gated. Aligned to the Vim
demo app baseline.

## Run
```bash
cp .env.local.example .env.local     # fill CLIENT_ID / CLIENT_SECRET
npm install
npm run dev                          # http://localhost:8080
```
Register App URL / Launch (`/launch`) / Token (`/token`) / Allowed URLs with the port you run
on. (UI-only — no Worker Launch endpoint.)

## Layout
- `src/app/launch` — OAuth launcher · `src/app/app` — UI · `src/app/token` + `/api/auth/token` — token exchange
- `src/lib/sdoh-rules.ts` + `sdoh-codes.ts` — pure rules + Z-code table (unit-tested)
- `src/lib/vim-client.ts` — the only SDK-importing file · `src/lib/*` — shared config helpers

## Test
`npm test` — Vitest over the SDOH rules and the controlled Z-code vocabulary (no EHR/SDK needed).
UI/integration is verified live in an EHR.

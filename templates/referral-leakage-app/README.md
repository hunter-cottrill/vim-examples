# Referral Guidance App — Referral leakage prevention (Vim App SDK starter)

A UI app that intervenes at the moment a referral is created: it reads the in-flight referral
and the patient's plan, checks the target against an app-owned network directory and
referral-appropriateness rules, and surfaces an in-workflow nudge offering a higher-value
in-network alternative or an async e-consult, before the referral is sent. Aligned to the Vim
demo app baseline.

## Run
```bash
cp .env.local.example .env.local     # fill CLIENT_ID / CLIENT_SECRET
npm install
npm run dev
```
Register App URL / Launch (`/launch`) / Token (`/token`) / Allowed URLs with the port you run
on. A Worker entry point is included at `/offscreen` for background notifications.

## Try it without an EHR
Set `NEXT_PUBLIC_SIM_MODE=true` in `.env.local` and open `/dev/harness` to drive the app with
built-in referral fixtures. This is dev-only and inert when the flag is unset; it lets you see
and click the real UI without provisioning an EHR. It proves the app handles a referral
correctly, not that events fire in a live EHR.

## Layout
- `src/app/launch` — OAuth launcher · `src/app/app` — UI · `src/app/offscreen` — Worker
- `src/app/token` + `/api/auth/token` — token exchange
- `src/app/api/network/match` — in-network lookup (app-owned data; the SDK has no provider network)
- `src/app/api/econsult/request` — simulated e-consult routing (app-owned)
- `src/app/api/referral/explain` — optional LLM rationale over the deterministic shortlist; falls back cleanly when `ANTHROPIC_API_KEY` is unset
- `src/lib/referral-engine.ts`, `network-directory.ts`, `referral-appropriateness.ts`, `payer-network-map.ts` — pure domain logic (unit-tested)
- `src/lib/vim-client.ts` — the only SDK-importing module

## Test
`npm test` — Vitest over the pure domain logic (no EHR/SDK needed). UI and writeback are
verified live in an EHR.

## Scope notes
Writeback is notes-only (`basicInformation.notes`, permission-gated, `mode: 'append'`).
Steering the structured `targetProvider` is undocumented and unverified, so the in-network
alternative is surfaced for the provider to act on rather than written back.

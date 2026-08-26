# SDOH Assistant (Vim App SDK)

Flags social needs that could get in the way of a patient's care, and points the provider
to help — triggered when they open a patient's chart. Reads the patient's address,
insurance, and problem list; runs four deterministic rules (coverage risk, neighborhood
risk, language access, existing-Z-code detection); shows the provider what was flagged,
why, and a Z-code they can add to the encounter. A headless Worker mirrors the same read
and notifies the provider if a need is flagged while the app panel is closed.

## Run

```bash
cp .env.local.example .env.local     # fill CLIENT_ID / CLIENT_SECRET
npm install
npm run dev                          # http://localhost:8080
```

Register App URL / Launch (`/launch`) / Token (`/token`) / Worker Launch (`/offscreen`) /
Allowed URLs in the Vim developer portal, matching the port you run on.

## Try it without an EHR

Set `NEXT_PUBLIC_SIM_MODE=true` in `.env.local`, then open `/dev/harness`. It drives the
real UI components against bundled fixtures — no SDK, no network, no live chart. This
proves the app handles a `chart_open` event and its data correctly; it does **not** prove
`chart_open` fires in your specific sandbox EHR yet (some events are mapped but not yet
live everywhere — see `CLAUDE.md`).

## Layout

- `src/app/launch` — OAuth launcher · `src/app/app` — UI panel · `src/app/offscreen` —
  headless Worker · `src/app/token` + `/api/auth/token` — token exchange
- `src/lib/sdoh/` — pure domain logic: types, controlled Z-code vocabulary, the
  payer-coverage and ZIP-risk crosswalks, the rules engine, and the writeback state
  machine (all unit-tested, no SDK)
- `src/lib/app-state.ts` — the panel's top-level state machine (connecting → waiting →
  result/error)
- `src/lib/vim-client.ts` — the only file importing the SDK for the UI surface
- `src/lib/worker-client.ts` — the only file importing the SDK for the Worker surface
- `src/lib/patient-mapping.ts` — the patient → domain-context mapping shared by both
  surfaces, so neither forks it
- `src/dev/` — the SIM_MODE fixtures and harness UI

## Known limitation

The installed SDK (0.4.56) exposes no `language`/`preferredLanguage` field anywhere on
`Patient`. The language-access rule is fully built and fixture-tested, but against a live
EHR today it will never have a language value to evaluate — see `CLAUDE.md` for detail.
This is a platform gap, not something this app works around by inventing a value.

## Test

`npm test` — Vitest over the rules engine, both crosswalks, the app-level state machine,
the writeback state machine, and the retry helper. No EHR/SDK/`.env` needed.
UI/integration and the Worker's registration/notify path are verified live in an EHR.

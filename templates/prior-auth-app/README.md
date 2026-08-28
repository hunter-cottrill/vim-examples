# Prior Authorization App (Vim App SDK starter)

Tells a provider whether an order needs prior authorization the moment they select or sign
it, and lets them submit and track the request without leaving the chart. A deterministic
crosswalk resolves the order's free-text name to a CPT code, a bundled payer-name map
resolves the patient's insurance to a payer id, and a bundled prior-auth rules table decides
required / not-required / undetermined — all pure, unit-tested logic with zero SDK
dependency. Submission and adjudication are simulated by the app's own backend (no real
payer connectivity exists anywhere in the SDK); a headless worker notifies the provider once,
at the moment auth is found to be required, if the panel is closed.

## Run

```bash
cp .env.local.example .env.local     # fill CLIENT_ID / CLIENT_SECRET
npm install
npm run dev                          # http://localhost:8080
```

Register App URL / Launch (`/launch`) / Worker Launch (`/offscreen/launch`) / Token (`/token`)
/ Allowed URLs with the Vim developer portal, using the port you run on.

## Try it without an EHR

Set `NEXT_PUBLIC_SIM_MODE=true` in `.env.local`, then visit `/dev/harness`. It drives the
real domain logic and the real UI components with bundled fixtures covering every branch —
approved, denied, not-required, and each undetermined reason — through the same simulator
controls surfaced inside `/app` itself when `SIM_MODE` is on. This proves the app handles
each case correctly; it does not prove the underlying EHR events fire live (see `CLAUDE.md`
for what's still unverified).

## Layout

- `src/app/launch`, `src/app/app` — UI: OAuth launcher + the prior-auth card
- `src/app/offscreen/launch`, `src/app/offscreen/app` — headless worker: same determination
  logic, fires a push notification instead of rendering, only when the UI app is closed
- `src/app/api/prior-auth/requests` — the app's own simulated payer-adjudication backend
  (`POST` submits, `GET /:requestId` polls); job state is pinned to `globalThis` so it
  survives route re-instantiation in dev/serverless
- `src/app/token` + `src/app/api/auth/token` — token exchange
- `src/lib/vim/` — the only modules that import `@vimconnect/app-sdk` (order events,
  insurance/diagnosis reads, patient-context) — one client for the UI, one for the worker
- `src/lib/priorAuth/` — the procedure crosswalk, payer map, rules table, the pure PA
  lifecycle state machine (`transition`), and job-resolution logic — no SDK dependency
- `src/hooks/usePriorAuthLifecycle.ts` — wires the state machine to the SDK boundary (or the
  simulator seam); shared by the real UI page and the dev harness so they never drift
- `src/components/PriorAuthCard.tsx`, `PriorAuthForm.tsx` — the UI
- `src/dev/` — fixtures and the dev-only harness content, gated behind `NEXT_PUBLIC_SIM_MODE`

## Test

`npm test` — Vitest over the prior-auth domain logic (crosswalk, payer map, rule
determination, the state machine's full transition table, job-resolution boundary,
bundled-data referential integrity) — no EHR/SDK needed. UI/integration is verified live in
an EHR.

## Scope notes

- No SDK writeback target exists for an authorization number (checked every documented
  writable target — none fit); the approval number is displayed to the provider, not written
  to the chart. See `CLAUDE.md`.
- If a submitted request resolves while the panel is closed, the provider sees the result
  the next time they open that patient's chart with the panel open — the worker notifies
  once, at the "auth may be required" moment, not on later async resolution. See `CLAUDE.md`.

## License

[MIT](LICENSE)

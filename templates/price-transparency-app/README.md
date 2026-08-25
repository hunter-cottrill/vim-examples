# Price Transparency App (Vim App SDK starter)

Shows a patient's estimated out-of-pocket cost the moment a provider selects or signs an
order — before the bill ever goes out, and even when the sidepanel is closed. A deterministic
crosswalk resolves the order to a CPT code, a bundled payer/plan price table computes the
exact patient-responsibility math, and a Good Faith Estimate eligibility rule flags
self-pay/out-of-network cases — all pure, unit-tested logic with zero SDK dependency. A
headless worker app mirrors the same pipeline to fire a push notification with the estimate
when the UI isn't open.

## Run

```bash
cp .env.local.example .env.local     # fill CLIENT_ID / CLIENT_SECRET
npm install
npm run dev                          # http://localhost:8080
```

Register App URL / Launch (`/launch`) / Worker Launch (`/offscreen/launch`) / Token (`/token`)
/ Allowed URLs with the Vim developer portal, using the port you run on.

## Layout

- `src/app/launch`, `src/app/app` — UI: OAuth launcher + the price-transparency card
- `src/app/offscreen/launch`, `src/app/offscreen/app` — headless worker: same pipeline,
  fires a push notification instead of rendering, only when the UI app is closed
- `src/app/token` + `src/app/api/auth/token` — token exchange
- `src/lib/vim/` — the only modules that import `@vimconnect/app-sdk` (order events,
  insurance reads, encounter self-pay context) — one client for the UI, one for the worker
- `src/lib/pricing/` — CPT crosswalk, estimate calculator, GFE eligibility rule, and the
  bundled payer/plan price table (pure, unit-tested, no SDK dependency)
- `src/components/PriceTransparencyView.tsx` — the UI: order summary, procedure picker,
  estimate card, and a dev-only debug/simulate panel

## Test

`npm test` — Vitest over the pricing domain logic (crosswalk, estimate math, GFE eligibility,
bundled-data integrity) — no EHR/SDK needed. UI/integration is verified live in an EHR.

## License

[MIT](LICENSE)

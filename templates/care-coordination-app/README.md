# Care Coordination App — Vim App SDK starter

A read-only app that shows a provider, at the moment they open a patient's chart, an
honest snapshot of what's already on record **for the current session's context** —
patient + problem list, the current visit, any order or referral already in view, and
the providers named on those — so nobody repeats work that's already been done.

There is no writeback, no LLM, and no backend data store. The platform has no
cross-visit history API, no bulk open-orders list, and no care-team entity, so this
app deliberately does not fabricate any of those — it shows what's actually
verifiable and says so. See `CLAUDE.md` for the full reasoning and the platform gaps
this app works around.

## Run

```bash
cp .env.local.example .env.local     # fill CLIENT_ID / CLIENT_SECRET
npm install
npm run dev                          # http://localhost:8080
```

Register App URL / Launch (`/launch`) / Token (`/token`) / Allowed URLs with the port
you run on. No Worker Launch URL is needed — this app has no Worker.

### Running without a live EHR (SIM_MODE)

```bash
NEXT_PUBLIC_SIM_MODE=true npm run dev
# then open http://localhost:8080/dev/harness
```

`/dev/harness` drives the real domain logic (`buildSummary`/`derivePageStatus`) and
the real `CareSummaryCard` UI against 8 bundled fixtures, plus two manual previews
for the `connecting`/`error` lifecycle states. No SDK, no OAuth, no live EHR needed.
This proves the app handles every branch of the domain model correctly — it does
**not** prove any particular workflow event or context key actually fires in a live
EHR; that still needs to be verified against a real sandbox (see `CLAUDE.md`).

`NEXT_PUBLIC_SIM_MODE` must stay unset (or `false`) in staging/production — with it
unset, `/dev/harness` 404s and no dev-only code is reachable.

## Layout

- `src/app/launch` — OAuth launcher · `src/app/app` — the UI (chart_open → summary card)
- `src/app/token` + `src/app/api/auth/token` — token exchange (client secret server-only)
- `src/lib/care/*` — pure domain logic (types, summary assembly, provider-mention
  derivation, order-type labels) — SDK-free, unit-tested
- `src/lib/vim-client.ts` — the only module that imports `@vimconnect/app-sdk`
- `src/components/CareSummaryCard.tsx` — the UI, in the four required states
  (connecting/waiting/result/error), each section independently loading/loaded/
  empty/unsupported/error
- `src/dev/*` + `src/app/dev/harness` — the SIM_MODE dev simulator

## Test

`npm test` — Vitest over the domain logic (`src/lib/care/*.test.ts`), no EHR/SDK/
`.env` needed. UI and integration are verified live in an EHR (or via the harness
for the domain-logic/UI wiring, which is not the same as a live-EHR proof — see
above).
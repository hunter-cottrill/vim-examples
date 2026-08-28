# Trial Match (Vim App SDK)

Matches a patient to recruiting clinical trials on ClinicalTrials.gov, ranked by distance —
triggered when a provider opens a patient's chart. Reads the patient's ZIP code and active
problem list; maps problems to trial-relevant conditions and the ZIP to an approximate
coordinate via two bundled crosswalks; searches the live ClinicalTrials.gov API v2 per
matched condition; shows the provider a distance-sorted, read-only list. There is no
writeback — no confirmed writable target exists for "trials of interest" (see `CLAUDE.md`).

## Run

```bash
cp .env.local.example .env.local     # fill CLIENT_ID / CLIENT_SECRET
npm install
npm run dev                          # http://localhost:8080
```

Register App URL / Launch (`/launch`) / Token (`/token`) / Allowed URLs in the Vim
developer portal, matching the port you run on.

## Try it without an EHR

Set `NEXT_PUBLIC_SIM_MODE=true` in `.env.local`, then open `/dev/harness`. It drives the
real UI components against bundled fixtures — no SDK, no live chart, and no live network
call to ClinicalTrials.gov (canned responses stand in). This proves the app handles a
`chart_open` event and the full match pipeline correctly; it does **not** prove
`chart_open` fires in your specific sandbox EHR yet (the platform is in alpha — see
`CLAUDE.md`).

## Layout

- `src/app/launch` — OAuth launcher · `src/app/app` — UI panel · `src/app/token` +
  `/api/auth/token` — token exchange · `src/app/api/trials/search` — the only route that
  calls ClinicalTrials.gov
- `src/lib/trial-match/` — pure domain logic: shared types, the ICD-10→condition
  crosswalk, the ZIP3→centroid crosswalk (and its generated data file), the haversine
  distance helper, and the match-building/selection logic (all unit-tested, no SDK, no
  network)
- `src/lib/app-state.ts` — the panel's top-level state machine (connecting → waiting →
  searching → result/error)
- `src/lib/vim-client.ts` — the only file importing the SDK for the UI surface
- `src/lib/trials-client.ts` — the only file calling this app's own `/api/trials/search`
  backend route from the client
- `src/lib/patient-mapping.ts` — the patient → domain-context mapping
- `src/dev/` — the SIM_MODE fixtures (patients and canned trial-search responses) and
  harness UI
- `scripts/build-zip3-centroids.ts` — one-time data-prep script that generated
  `src/lib/trial-match/zip3-centroids.ts` from the public-domain U.S. Census Bureau ZCTA
  Gazetteer file; not part of the runtime app

## Known limitations

- **No writeback.** The Vim SDK reference confirms no dedicated writable target exists
  for "trials of interest" (no Task/Flag entity) — only field-path updates on existing
  entities. Rather than repurpose one, this app displays matches for the provider instead.
- **ZIP-based distance is an estimate**, not an exact address. It's computed from a
  ZIP3-prefix centroid (an area-level average covering many patients), never a confirmed
  individual location — see `src/lib/trial-match/zip3-centroids.ts`'s header comment.
- **Trial results come from a live external source**, not a bundled dataset like this
  repo's other templates — see `CLAUDE.md` for why, and the tradeoffs that come with it.

## Test

`npm test` — Vitest over both crosswalks, the distance and match-building logic, and the
app-level state machine. No EHR/SDK/`.env`/network needed. UI/integration and the live
ClinicalTrials.gov call are verified live (through the harness for the match pipeline, and
against a live EHR sandbox for the SDK trigger).

# Referral Leakage Prevention App — Build Plan

## Context

Risk-bearing entities (ACOs/IPAs/MSOs) lose margin and speed when referrals leak
out-of-network or go to a full specialist visit when an async e-consult would do —
and today they only find out weeks later in a retrospective report. This app moves
the intervention to the moment of referral creation: while a provider is building a
referral in the EHR, the app reads the target specialty/provider and the clinical
reason, checks them against the org's own network directory and referral-appropriateness
rules, and surfaces an in-workflow nudge offering a better in-network alternative or an
async e-consult — before the referral is sent.

This plan was produced after directly verifying the SDK surface three ways: (1) reading
`@vimconnect/app-sdk`'s installed `.d.ts` in full, (2) reading this developer's own
existing, git-tracked sibling templates (`sdoh-app`, `cds-app` in
`~/vim-examples/templates/`, which already implement and unit-test the exact
referral-context-read and permission-gated-writeback patterns this app needs), and (3)
cross-checking the public `vim-demo-app` repo and `developer-docs.getvim.ai`. Every SDK
claim below is annotated with where it was confirmed. Two scope questions were resolved
with the user: **writeback is notes-only + display prompt for v1** (no attempt at
structured `targetProvider` writeback — that field's writability is undocumented and
unverified for any EHR), and **an optional LLM rationale/ranking layer is in scope**,
mirroring `cds-app`'s pattern of using an LLM only to explain/rank a deterministically
retrieved shortlist, never to invent a provider or code.

Recommended location: a new sibling template, `~/vim-examples/templates/referral-guidance-app`,
alongside `sdoh-app` and `cds-app` in the same git-tracked repo, using the same
`src/` layout and `lib/` helper conventions.

---

## 1. Summary & the clearest demo moment

The app is a Vim Hub sidebar app (UI app, not a Worker app — same architecture as
`sdoh-app`) that stays open while a provider works a chart. It subscribes to the
`referral_start:referral` context key. The instant a referral is being composed, the
app's pure domain logic checks the target specialty/provider against a bundled network
directory and a controlled referral-appropriateness rule set, and renders a nudge panel
in the Hub sidebar: *"Dr. Smith (Cardiology) is out of network. In-network alternative:
Dr. Patel, Cardiology, 4.8 value tier — 12 min away"* or *"This diagnosis is often
resolved via e-consult. Request an async e-consult instead?"* The provider can accept a
network alternative or request an e-consult (both app-owned actions), and — regardless
of what they choose — can have the app append a structured note onto the referral's
notes field via the standard permission ceremony. **The demo moment**: a provider starts
an out-of-network referral; before they hit send, a specific named in-network alternative
(or e-consult offer) appears in the sidebar, sourced entirely from controlled data, with
one click to accept.

---

## 2. Architecture

```
EHR (referral being composed)
   │  referral_start:referral context change (curr.fields)
   │  chart_open:patient context change (curr.fields, incl. insurances)
   ▼
src/lib/vim-client.ts            ◄── ONLY file that imports @vimconnect/app-sdk
   │  onReferralStart(cb), onPatient(cb) — narrow local types out (ReferralLike, PatientLike)
   │  writeReferralNote(text) — permission-gated writeback
   ▼
src/lib/referral-engine.ts        (pure orchestration, SDK-free)
   │  calls referral-appropriateness.ts (pure, controlled vocabulary)
   │  calls POST /api/network/match (app backend) for in-network alternatives
   │  optionally calls POST /api/referral/explain (app backend, LLM rank/explain only)
   ▼
src/components/ReferralNudgePanel.tsx   (human-in-the-loop UI)
   │  renders 0–2 NudgeSuggestion cards; provider clicks to accept
   ▼
src/lib/vim-client.ts  → sdk.ehr.context.referral permission ceremony → EHR
```

**App's own backend** (Next.js API routes, no SDK import):
- `POST /api/network/match` — looks up in-network alternatives from the bundled sample
  directory given `{ specialty, insuranceNetworkId, excludeNpi? }`. This is the
  "bring-your-own-backend" boundary the use case calls out — the SDK has no provider
  network concept at all.
- `POST /api/econsult/request` — simulated e-consult case creation. Entirely app-owned;
  the SDK has no e-consult/specialist-routing concept.
- `POST /api/referral/explain` (optional, LLM layer) — given the deterministically
  retrieved shortlist from `/api/network/match` plus the referral's diagnosis, asks an
  LLM only to rank/pick among the shortlist and phrase a one-line rationale. Server-only
  `ANTHROPIC_API_KEY`. Never allowed to return a provider/code not already in the
  shortlist it was given — mirrors `cds-app`'s `/api/cds/evaluate` membership-enforcement
  pattern exactly (`vocabulary.lookup(selection.code)` gate).
- `POST /token` + `POST /api/auth/token` — OAuth code exchange (`exchangeAuthCode`),
  copied verbatim from `sdoh-app`/`cds-app`/`vim-demo-app`; `CLIENT_SECRET` never leaves
  the server.

**SDK boundary, explicit**: `src/lib/vim-client.ts` is the only module that imports
`@vimconnect/app-sdk`. Everything downstream (`referral-engine.ts`,
`referral-appropriateness.ts`, `network-directory.ts`, the panel component) depends only
on locally declared narrow types (`ReferralLike`, `PatientLike`, `NetworkMatch`,
`NudgeSuggestion`) — same discipline as `sdoh-app`'s `PatientLike`/`ReferralLike` in
`sdoh-rules.ts`. This keeps 100% of the decision logic unit-testable with no SDK/EHR
present.

---

## 3. Exact SDK reads, events, and writes — each verified

| Surface | Verified against | Notes |
|---|---|---|
| `initVimSDK({ accessToken })`, `getVimSDK()` | ✅ installed `.d.ts` (0.4.50) + `vim-demo-app` + docs | Entry point; resolves `VimSDK`. |
| `sdk.hub.setActivationStatus('ENABLED')` | ✅ installed `.d.ts` + all sibling apps | Called once after init. |
| Event `referral_start` (`sdk.ehr.workflow.on('referral_start', cb)`) | ✅ installed `.d.ts` (`EventTypeSchema` enum) + docs `api-reference.json` | Fires when the provider starts a referral. This is the trigger the use case asks for. |
| Event `referral_save` | ✅ installed `.d.ts` + docs | One-shot, fires on save. **No matching context key** (see below) — not used as the live read; noted for completeness only. |
| Context key `referral_start:referral` (`sdk.ehr.context.onChange('referral_start:referral', cb)`) | ✅ installed `.d.ts` (`ContextKey` union) + docs `api-reference.json` contextKeys list + **live in `sdoh-app`'s `vim-client.ts`** (`onReferralStart`) | Primary read. Data arrives under `curr.fields`, shaped per `Referral` schema. This is the actual mechanism used — `referral_save` has no continuous-read equivalent, confirmed absent from the docs' generated `contextKeys` list. |
| Context key `chart_open:patient` (`sdk.ehr.context.onChange('chart_open:patient', cb)`) | ✅ installed `.d.ts` + **live in `sdoh-app`'s `vim-client.ts`** (`onPatient`) | Used to read `patient.insurances[]` for network/plan lookup — `Patient` context payload already includes `insurances`, confirmed by `sdoh-app`'s `PatientLike.insurances` usage; no separate Entity API call needed. |
| `Referral` schema fields: `targetProvider.{npi,specialty,firstName,lastName,ehrProviderId}`, `conditions[].{code,system,description,status,onSetDate}`, `basicInformation.{reasons,notes,specialty,...}`, `referringProvider`, `identifiers.ehrReferralId` | ✅ installed `.d.ts` (`ReferralSchema`, `DiagnosisSchema`) + docs `api-reference.json` entity `referral` | The clinical-reason input is `conditions[].code` (structured, controlled) primarily; `basicInformation.reasons` is a single free-text string, used for display context only, never as a rule-matching key (rules must stay deterministic over controlled codes). |
| `sdk.ehr.api.patient.*`, `.encounter.*`, `.order.*` | ✅ installed `.d.ts` (`ApiNamespaceMap`) | **`sdk.ehr.api.referral` does NOT exist** in the actual exposed type — confirmed by three independent sources (installed `.d.ts`'s `ApiNamespaceMap`, docs' generated `api-reference.json` `apiNamespaces` list, and `sdoh-app/CLAUDE.md`'s explicit "No `sdk.ehr.api.referral` namespace" line). The docs' prose guide shows `sdk.ehr.api.referral.getReferral()` as an example — **that example is unconfirmed/likely wrong**; do not use it. Referral reads go through context only. |
| Writeback ceremony: `getCapability('update')` → `requestPermission('update', {fields})` if `requestable` → `hasPermission('update')` → `update(data, {mode})` | ✅ installed `.d.ts` + docs + **live in `sdoh-app`'s `writeZCodes`** and `cds-app`'s `handleConfirmCdsSelections` | Exact ceremony to copy. |
| `sdk.ehr.context.referral.update({ basicInformation: { notes: '...' } }, { mode: 'append' })` | ✅ docs' bulk-permission example names `referral.basicInformation.notes` as a real, documented writable field | **Confirmed-safe writeback target for v1**, per the user's decision. This is the only referral field with a documented example anywhere. |
| `update()` `mode` values | ⚠️ **conflicting sources** | Installed `.d.ts` has two different writeback interfaces: `ContextWriteback<T>` (the one actually wired to `sdk.ehr.context.referral`) types `mode` as `'override'\|'merge'\|'append'`; the sibling apps' `CLAUDE.md` and their working code assert only `'override'\|'append'` exist and that dot-notation/`'merge'` throws. The docs site's inline code comment also lists `'merge'` but never explains or demonstrates it, and the demo app's own UI only offers `override`/`append`. **Decision: use `mode: 'append'` only** (confirmed, demoed, and what every sibling app uses); do not use `'merge'` without confirming with Vim directly first. |
| `targetProvider` (structured) writeback | ❌ **unverified — not built in v1** | No documented example, no demo usage, EHR Support Matrix explicitly states write support is not yet characterized at all. Per the user's decision, v1 does not attempt this; the in-network alternative is a display-only prompt the provider must act on manually in the native EHR UI. |
| Blocking/preventing referral creation | ❌ **confirmed not possible** | Docs' Worker Apps page is explicit: the SDK is observe-then-request-permission-then-write only, never a blocking interceptor, on either UI or Worker apps. "Prevention" in the UX sense is achieved by nudging early and clearly, not by stopping the native EHR flow. |

---

## 4. Domain model (SDK-free, pure, unit-tested)

New pure modules under `src/lib/`, following the exact separation `sdoh-app` and
`cds-app` already use (controlled vocabulary module + pure rules module + thin
orchestration):

- **`network-directory.ts` + `network-data.ts`** — the controlled provider vocabulary.
  `network-data.ts` bundles a small sample directory (~5 specialties × 3–5 providers each:
  `{ npi, firstName, lastName, specialty, networkId, valueTier (1–5), distanceMinutes }`).
  `network-directory.ts` exports a pure `matchNetwork(specialty, networkId, excludeNpi?): ProviderRecord[]`
  (filter by specialty+network, exclude the referral's current target NPI if already
  in-network, sort by `valueTier` desc) and `isInNetwork(npi, networkId): boolean`. Every
  suggested provider must come from this module — never free text, never LLM-authored.
- **`payer-network-map.ts`** — small config mapping `payerName` substrings → `networkId`
  (same string-matching approach as `sdoh-app`'s `isMedicaid()`/`MEDICAID_HINTS`, since
  the SDK's `Insurance`/`Patient` context payload has no structured network/plan ID
  field — this mapping is necessarily app-owned).
- **`referral-appropriateness.ts`** — the controlled e-consult-eligibility vocabulary: a
  small bundled list of `{ specialty, icd10Prefix, description }` entries representing
  conditions typically resolvable via async e-consult (e.g., stable chronic dermatology,
  routine endocrine follow-up). Exports pure `isEconsultCandidate(specialty, conditions: Diagnosis[]): EconsultMatch | null`
  — matches only on structured `conditions[].code` against the bundled list, never on
  free-text `basicInformation.reasons`.
- **`referral-engine.ts`** — pure decision composition (I/O for the network lookup is
  injected as a parameter, not called internally, so this stays synchronous and testable):
  ```ts
  type NudgeSuggestion =
    | { kind: 'in_network_alternative'; provider: ProviderRecord; reason: string }
    | { kind: 'econsult_candidate'; condition: EconsultMatch; reason: string };

  function evaluateReferral(
    referral: ReferralLike,
    patient: PatientLike,
    networkMatches: ProviderRecord[]   // pre-fetched by the caller from /api/network/match
  ): NudgeSuggestion[]
  ```
  Priority rule: if `isEconsultCandidate` fires, surface `econsult_candidate` (higher
  margin/faster-answer value than any referral at all); independently, if the referral's
  `targetProvider` NPI is not in `networkMatches`' in-network set and a same-or-better
  `valueTier` alternative exists, surface `in_network_alternative` too. If neither
  condition holds (already in-network, top-tier, not e-consult-eligible): return `[]`
  (the explicit "stay silent" case (c) from the use case).
- **`vim-client.ts`** — the SDK boundary (Section 2). `onReferralStart`, `onPatient`,
  `writeReferralNote(text): Promise<WritebackOutcome>` (mirrors `sdoh-app`'s
  `writeZCodes` ceremony exactly, targeting `basicInformation.notes` with `mode: 'append'`).

Optional LLM layer (`/api/referral/explain`, server route): given the `networkMatches`
shortlist `referral-engine.ts` already computed, an LLM may only pick among those exact
records and phrase a rationale — same membership-enforcement pattern as `cds-app`'s
`/api/cds/evaluate` (`vocabulary.lookup(selection.code)` gate before accepting anything
the model returns). It never invents an NPI, provider name, or code. If the call fails
or returns something outside the shortlist, degrade to the plain rule-based rationale
already produced by `referral-engine.ts` — no 500s, no blocking the panel.

---

## 5. Build order

Mirrors `sdoh-app`/`cds-app`'s own documented build order ("domain logic first...
auth/connection... then vertical slices, read → reason → render → write — do not build
all reads, then all UI, then all writeback").

**Step 0 — Scaffold & re-verify (do this before writing any app code).**
Copy the project skeleton and unmodified `lib/` helpers (`client-config.ts`, `config.ts`,
`sdk-config.ts`, `url-constants.ts`, `token-exchange.ts`, `sdk-invoke.ts`),
`launch/page.tsx`, `token/route.ts`, `api/auth/token/route.ts`, `vitest.config.mts`, and
`.env.local.example` verbatim from `~/vim-examples/templates/sdoh-app`. Pin
`"@vimconnect/app-sdk": "^0.4.53"` (matches both canonical sibling templates). **Then
run `npm install` and diff the freshly installed `node_modules/@vimconnect/app-sdk/dist/index.d.ts`
against every claim in Section 3** — this plan was verified against 0.4.50; confirm no
drift before writing `vim-client.ts`.

**Step 1 — Parallel track A: pure domain logic (no SDK, no auth needed).**
Build and unit-test `network-data.ts`, `network-directory.ts`, `payer-network-map.ts`,
`referral-appropriateness.ts`, `referral-engine.ts` fully in isolation with Vitest (see
Section 7). This can start immediately and proceed independent of the auth work.

**Step 1 — Parallel track B: auth/connection (highest-risk piece, front-loaded).**
Copy the OAuth flow verbatim (`launch/page.tsx`, `app/page.tsx`'s callback skeleton,
`token/route.ts`). Register the app in the Vim developer portal, get a real
`launch_id` in a sandbox EHR, and prove `initVimSDK` connects end-to-end and
`sdk.hub.setActivationStatus('ENABLED')` shows the app live in the Hub — before writing
any referral-specific code. This is the piece most likely to have environment-specific
surprises (redirect URI registration, CSP, sandbox EHR access) and should be de-risked
first, in parallel with Step 1A.

**Step 2 — Vertical slice 1: read → reason → render (no writeback, no network backend yet).**
Write `vim-client.ts`'s `onReferralStart`/`onPatient`. Wire `app/page.tsx` to call
`evaluateReferral()` with a *hardcoded* `networkMatches` array (skip the API route for
now). Render `ReferralNudgePanel.tsx` showing whatever `evaluateReferral` returns. Prove
in a real sandbox EHR that starting a referral produces a real `Referral` payload and
that a plausible nudge renders. This is the single most valuable checkpoint — it proves
the entire read→reason→render path before adding any further moving parts.

**Step 3 — Vertical slice 2: real network backend.**
Build `POST /api/network/match` wrapping `network-directory.ts`. Replace the hardcoded
array in `app/page.tsx` with a real `fetch('/api/network/match', ...)` call, gated with
a loading state in the panel.

**Step 4 — Vertical slice 3: writeback.**
Add `writeReferralNote` to `vim-client.ts` and wire an "Add note to referral" button in
`ReferralNudgePanel.tsx`, following the exact ceremony from Section 3. Verify live: does
`requestPermission` prompt correctly, does `hasPermission` reflect it, does the note
actually land in the sandbox EHR's referral. Handle `denied`/`not_configured`/`error`
outcomes visibly in the panel (mirror `sdoh-app`'s `WritebackOutcome` union and status
text).

**Step 5 — Vertical slice 4: e-consult path + optional LLM layer.**
Add `POST /api/econsult/request` (simulated) and the "Request e-consult instead" button.
Then, only if time allows, add `POST /api/referral/explain` and wire it in as a
progressive enhancement behind a try/catch that falls back to the rule-based rationale.

**Step 6 — Write `CLAUDE.md`** for the new app, mirroring `sdoh-app`/`cds-app`'s
golden-rules format, documenting this app's specific verified facts (the `referral_start`
vs `referral_save` distinction, the `notes`-only writeback scope, "no `sdk.ehr.api.referral`"
reminder) so a future coding agent working in this repo doesn't have to re-derive them.

---

## 6. What the SDK does NOT support here, and how the backend covers it

- **No provider network / network-adequacy concept at all** — confirmed absent from the
  installed types, the docs, and the demo app. Covered by `network-directory.ts` +
  `POST /api/network/match`, entirely app-owned bundled data.
- **No e-consult / specialist-routing concept** — confirmed absent. Covered by
  `POST /api/econsult/request`, a simulated app-owned action with no SDK involvement.
- **No `sdk.ehr.api.referral` Entity API namespace** — despite one docs prose example
  suggesting otherwise, it's absent from both the installed types and the docs' own
  generated API catalog. All referral reads go through the `referral_start:referral`
  context key instead.
- **No mechanism to block or prevent the native referral-creation flow** — the SDK is
  observe/nudge/write-with-consent only. The app cannot stop the provider from sending
  an out-of-network referral; it can only make the better option maximally visible and
  one click away before they do.
- **No confirmed structured `targetProvider` writeback** — undocumented, unverified,
  explicitly out of scope for v1 per the user's decision. The in-network alternative is
  surfaced as information the provider acts on manually in the EHR's native referral UI;
  the only writeback v1 performs is appending a note to `basicInformation.notes`.

---

## 7. Vitest test plan (pure domain logic — no SDK/EHR required)

- **`network-directory.test.ts`**
  - Exact specialty match returns candidates sorted by `valueTier` descending.
  - Excludes the referral's own target NPI when that NPI is itself in-network.
  - Empty specialty (no directory entries) returns `[]`, not an error.
  - `isInNetwork` true/false cases including NPI not present at all.
  - Property check: every returned record's `npi`/`specialty` traces back to a literal
    entry in `network-data.ts` (no synthesized records).
- **`referral-appropriateness.test.ts`**
  - Each bundled e-consult-eligible `{specialty, icd10Prefix}` entry matches a referral
    whose `conditions[].code` starts with that prefix and whose specialty matches.
  - A code that doesn't match any bundled prefix returns `null` (no false positive).
  - Confirms matching is keyed only on `conditions[].code`, never on
    `basicInformation.reasons` (a test referral with a suggestive free-text reason but no
    matching structured code must return `null`).
- **`referral-engine.test.ts`** (network lookup result passed in, so fully synchronous)
  - Already-in-network, top-tier, non-econsult-eligible referral → `[]` (silent case).
  - Out-of-network target with a better in-network alternative available →
    `in_network_alternative` suggestion referencing that exact alternative record.
  - Out-of-network target with no in-network alternative in that specialty → no
    `in_network_alternative` suggestion (don't suggest a provider that doesn't exist).
  - E-consult-eligible diagnosis → `econsult_candidate` suggestion present regardless of
    network status.
  - Both conditions true simultaneously → both suggestions present, econsult first.
  - Every suggestion's provider/code is checked to literally equal an object returned by
    `network-directory.ts`/`referral-appropriateness.ts` — mirrors `sdoh-rules.test.ts`'s
    "every suggested code resolves via `lookupZCode`" pattern, adapted to this domain.
- **`payer-network-map.test.ts`** — payer-name substring matching, case-insensitivity,
  no match → `undefined` rather than throwing.
- Not unit-tested with Vitest (per the established convention — verify live instead):
  `vim-client.ts` (SDK-dependent), `app/page.tsx` (OAuth/glue), the API routes' HTTP
  wiring (thin wrappers around the already-tested pure functions — worth a smoke test at
  most, not exhaustive coverage), and `ReferralNudgePanel.tsx` rendering (optionally a
  Testing-Library smoke test in the style of the demo app's `ErrorScreen.test.tsx`, not
  required).

---

## 8. Open questions / unverified items

1. **`update()` `mode: 'merge'`** — present in the type signature and in one docs code
   comment, but unexplained anywhere and unexercised by any sibling app. Plan uses
   `'append'` only; do not introduce `'merge'` without confirming semantics with Vim.
2. **Two conflicting writeback interface shapes in the installed `.d.ts`** (`ContextWriteback<T>`
   vs. `ContextWritebackNamespace`) disagree on whether `getCapability`/`hasPermission`
   accept a `fields` option. `sdk-invoke.ts`'s `getWritebackNamespace` helper (copied from
   `sdoh-app`) already handles this defensively via runtime feature-detection — keep that
   pattern rather than hardcoding either shape.
3. **Per-EHR support for `referral_start`/`referral_save` and referral writeback** is not
   published anywhere (the EHR Support Matrix explicitly says write support isn't
   characterized yet). This app's behavior on any specific target EHR beyond the sandbox
   used for development is unverified until tested live there.
4. **`claim` as a context/writeback entity** exists in the compiled SDK client but nowhere
   in the docs or installed `.d.ts` prose — irrelevant to this use case, noted only so it
   isn't mistaken for a documented feature later.
5. **Version drift between 0.4.50 (verified in depth) and 0.4.53 (recommended pin)** —
   Step 0 explicitly calls for re-diffing the installed `.d.ts` after `npm install`
   before trusting Section 3's signatures verbatim.
6. **Exact field names on the SDK's `Insurance` type** were not read directly from the
   raw `.d.ts` during this research pass — `payer-network-map.ts`'s reliance on
   `payerName` is inferred from `sdoh-app`'s working `PatientLike.insurances` usage, not
   from a direct read of `InsuranceSchema`. Confirm this in Step 0's re-verification pass.
7. A prompt-injection attempt was found embedded in one fetched GitHub file during
   research (text formatted to look like tool-call instructions telling the researching
   agent to "archive" a code snippet via unrelated publishing tools). It was not acted on
   and has no bearing on this plan — noted here only for the record.

---

## Verification (once implemented)

1. `npm run build` / `tsc --noEmit` — must pass with zero errors.
2. `npx vitest run` — all domain-logic tests in Section 7 green, with zero SDK/network
   dependency (should pass with no `.env` file at all).
3. Live in the Vim sandbox EHR: launch the app, confirm `chart_open:patient` and
   `referral_start:referral` payloads log real data (temporary console output during
   Step 2), confirm the nudge panel renders the expected suggestion for a known
   out-of-network specialty + known e-consult-eligible diagnosis code from the bundled
   test data, confirm the "Add note to referral" button completes the permission ceremony
   and the note appears on the referral in the sandbox EHR, confirm denial/error paths
   show a clean message rather than a crash.

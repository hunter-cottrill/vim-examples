# CLAUDE.md

Guidance for AI coding agents working in this app. Read this before writing any SDK code.

> **SDK reference:** the shared surface, conventions, and known runtime gotchas live in
> [`docs/vim-sdk-notes.md`](https://github.com/hunter-cottrill/vim-examples/blob/main/docs/vim-sdk-notes.md)
> — read it before writing any SDK code. Live upstream reference:
> https://developer-docs.getvim.ai/llms.txt. Where either disagrees with the installed types,
> the types win: `node_modules/@vimconnect/app-sdk/dist/index.d.ts`.
>
> This file covers only what is specific to **this app**.

## What this is

A referral-guidance app on `@vimconnect/app-sdk`. When a provider starts a referral, it reads
the in-flight referral and the patient's coverage, checks the target against an app-owned
network directory and referral-appropriateness rules, and surfaces an in-workflow nudge
offering a higher-value in-network alternative or an async e-consult — before the referral is
sent. A headless Worker notifies when the panel is closed.

## Golden rules (do not violate)

1. **Every suggested provider comes from the bundled directory in
   `src/lib/network-data.ts`**, never free text, never model-authored. The optional LLM layer
   (`/api/referral/explain`) may only rank or explain an already-retrieved shortlist, behind a
   membership check, with a deterministic fallback when it fails or is unconfigured.
2. **`distanceMinutes` on a provider record is fabricated demo data**, not a computed
   distance. Never present it as a real travel time in UI copy or a demo narration.
3. **Referral data arrives only via the `referral_start:referral` context key.** There is no
   referral Entity API namespace — do not attempt a `getReferral()`-style read.
4. **Secrets are server-only.** `CLIENT_SECRET` and the optional `ANTHROPIC_API_KEY` live
   behind server routes, never in the client bundle or a `NEXT_PUBLIC_*` var. `.env.local` is
   gitignored — never commit it; only `.env.local.example` (placeholders) ships.
5. **`src/lib/vim-client.ts` is the only SDK boundary for the UI**, `worker-client.ts` for the
   Worker. Everything else depends on the narrow local types, never on SDK entity types.
6. **The UI and the Worker call the same `evaluateReferral()`.** Never fork the rules.
7. **The simulator must drive the real path.** Fixtures are injected at the `vim-client.ts`
   boundary and pass through the same mapping the live path uses — never dispatch a pre-built
   domain object.

## The reads this app makes

1. `referral_start:referral` context — the referral in flight, the only source.
2. `chart_open:patient` context — coverage and patient signal, and teardown detection.
3. Entity API reads for patient coverage, retried with backoff.

## Writeback

**Referral notes only** (`basicInformation.notes`), permission-gated, `mode: 'append'`. The
structured `targetProvider` is *not* written — the alternative is surfaced for the provider to
act on rather than steering the referral silently. Note that `EntityTypeMap` declares writeback
for `referral` generally, so the notes-only scope may be narrower than what a session allows —
check `getManifest().contextWriteback` rather than assuming this line is the ceiling.

## What does NOT exist (don't invent)

- No provider-network or directory API — `src/lib/network-data.ts` is entirely app-owned.
- No e-consult service — `/api/econsult/request` is a simulated boundary an implementer wires
  to their own routing.
- No structured plan/network id on `Insurance` — only a bare `payerName`, hence
  `payer-network-map.ts`.

## Build order (each step testable before the next)

Pure domain logic first (`src/lib/referral-engine.ts`, `network-directory.ts`,
`referral-appropriateness.ts`, `payer-network-map.ts` — no SDK, unit-tested offline) →
auth/connection → dev simulator (`NEXT_PUBLIC_SIM_MODE=true`, `/dev/harness`) → vertical
slices verified through the harness → Worker → convention files.

## Commands

- `npm install` — installs deps (needs Zod v4).
- `npm run dev` — dev server on port 8080. Confirm the port matches your registered App URL.
- `npm test` — Vitest over the domain logic. No `.env`, no SDK, no network required.
- `npm run type-check` / `npm run build` — run before claiming any change done.
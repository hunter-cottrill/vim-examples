# CLAUDE.md

Guidance for AI coding agents (Claude Code, Cursor, etc.) working in this Vim App
SDK starter template. Read this before writing any SDK code.

> **SDK reference:** the shared surface, conventions, and known runtime gotchas live in
> [`docs/vim-sdk-notes.md`](https://github.com/hunter-cottrill/vim-examples/blob/main/docs/vim-sdk-notes.md)
> — read it before writing any SDK code. Live upstream reference:
> https://developer-docs.getvim.ai/llms.txt. Where either disagrees with the installed types,
> the types win: `node_modules/@vimconnect/app-sdk/dist/index.d.ts`.
>
> This file covers only what is specific to **this app**.

## What this is

A read-only app on `@vimconnect/app-sdk` (Next.js / React / TypeScript). It runs as
an iframe inside the Vim Hub, and on `chart_open` shows a provider an honest
snapshot of what's already on record for **the current session's context**. There
is no writeback and no Worker in this app — see "What this deliberately does not
build" below for why.

## Golden rules (do not violate)

1. **Never fabricate what the platform doesn't expose.** There is no cross-visit
   history API, no bulk open-orders list, and no care-team entity. This app shows
   only what's verifiable from the current session's context and labels it
   honestly ("on record this session," "other providers referenced this
   session") — it does not accumulate its own history store as a workaround. If
   you're asked to add a "recent visits" list or a "full care team" feature,
   that requires a real backend integration (the implementer's own EHR history
   API, an HIE, a claims feed) — name it as a boundary, don't fill it with
   fabricated or app-accumulated clinical data.
2. **No order-status claims.** The Order entity carries no confirmed open/closed
   status field. Do not infer one from name/reason text — a wrong guess here
   recreates exactly the repeated-work risk this app exists to prevent.
3. **Secrets are server-only.** `CLIENT_SECRET` lives behind `/token` and
   `/api/auth/token`, never in the client bundle or a `NEXT_PUBLIC_*` var.
   `.env.local` is gitignored — never commit it; only `.env.local.example` ships.
4. **One thin SDK client.** `src/lib/vim-client.ts` is the only module that
   imports `@vimconnect/app-sdk`. Everything else — domain logic, UI — depends
   only on the local types in `src/lib/care/types.ts`. If you need a new SDK
   read, add it to `vim-client.ts` and translate its result into a local type
   there; don't reach into `@vimconnect/app-sdk` from a component.

## The reads this app makes

1. `chart_open` workflow event — trigger only, carries a bare id reference.
2. `chart_open:patient` / `encounter_open:patient` context — the source of
   present-state, and the teardown signal. Both keys are watched, because they
   interleave (see the shared notes); the workflow event is an accelerator, not
   the only path in.
3. `patient.getPatient()` / `patient.getProblems()` Entity API (no-arg — resolves
   from current context) — retried with backoff on transient failure,
   `NOT_IMPLEMENTED` treated as `unsupported`, not `error`.
4. `encounter_open:encounter` context — current visit fields (`cc`,
   `assessment.diagnoses`, or the legacy flat equivalents — read both).
5. `order_select` workflow event → `order.getOrderById()` Entity API (no-arg) —
   whatever single order happens to be in context this session; never a list.
6. `referral_start:referral` context — the only source of referral data.

## Writeback

**None.** The manifest reported no writable target appropriate for these findings, so the app
displays them for the provider to act on in the chart. This was checked, not assumed — if you
add writeback later, re-check `getManifest().contextWriteback` for the current session rather
than trusting this line.

## What this app deliberately does not build

- **No state machine.** This is a single-shot read-evaluate-render flow; there's
  no pending stage and no user-driven multi-step lifecycle. `src/lib/care/types.ts`
  uses derived-status unions (`SectionStatus<T>`, `PageStatus`) instead.
- **No Worker.** `chart_open` already puts the provider in front of the open
  panel — there's nothing to reach them with the panel closed.
- **No order-status crosswalk.** See golden rule 2 — the app makes no status
  claim at all, so there's no value to resolve.

## Build order

Pure domain logic first (`src/lib/care/*`, no SDK — unit-test offline) → dev
simulator (`src/dev/*`, so every later step can verify through the harness) →
auth/connection (prove `initVimSDK` connects and logs a real `chart_open` payload)
→ then vertical slices (patient+problems → current visit → orders+referral+
provider mentions) one at a time, verified through `/dev/harness` at each step.

## Commands

- `npm install` — installs deps.
- `npm run dev` — dev server. Confirm the port matches your registered App URL.
- `npm run build` / `npm run type-check` — build / type-check; run before
  claiming done.
- `npm test` — Vitest over `src/lib/care/*` only; no EHR/SDK/`.env` needed.

<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
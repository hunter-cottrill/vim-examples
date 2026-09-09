# CLAUDE.md

Guidance for AI coding agents (Claude Code, Cursor, etc.) working in this Vim App SDK
starter template. Read this before writing any SDK code.

> **SDK reference:** the shared surface, conventions, and known runtime gotchas live in
> [`docs/vim-sdk-notes.md`](https://github.com/hunter-cottrill/vim-examples/blob/main/docs/vim-sdk-notes.md)
> — read it before writing any SDK code. Live upstream reference:
> https://developer-docs.getvim.ai/llms.txt. Where either disagrees with the installed types,
> the types win: `node_modules/@vimconnect/app-sdk/dist/index.d.ts`.
>
> This file covers only what is specific to **this app**.

## What this is

A starter app on `@vimconnect/app-sdk` (Next.js / React / TypeScript). It runs as an
iframe inside the Vim Hub (a sidebar the Vim Connect Chrome extension injects into a web
EHR), reads clinical context, and writes back to the chart through a permission gate.

## Golden rules (do not violate)

1. **Secrets are server-only.** `CLIENT_SECRET` and any LLM key live behind `/api/*` routes,
   never in the client bundle or a `NEXT_PUBLIC_*` var. `.env.local` is gitignored — never
   commit it; only the example file (empty placeholders) ships.
2. **Codes come from a controlled vocabulary**, never free text or model invention. Any
   LLM ranks/explains a shortlist; it never authors a code that isn't in the list.

## The reads this app makes

1. `chart_open` / `order_select` workflow events — triggers, carrying id references.
2. `chart_open:patient` / `encounter_open:encounter` context.
3. `sdk.ehr.api.patient.getProblems()` and related Entity API reads.

## Writeback

Encounter diagnoses, permission-gated, `mode: 'append'`. Confirm the target against
`getManifest().contextWriteback` for the current session rather than assuming it from this
line — coverage expands as the platform adds capabilities.

## What does NOT exist (don't invent)

No insights/gaps API for this app to publish into. See the shared notes for the full list of
structural absences.

## Build order (each step testable before the next)

Domain logic first (pure functions, no SDK — unit-test offline) → auth/connection (prove
`initVimSDK` connects and logs a real `chart_open` payload) → then vertical slices
(read → reason → render → write) one at a time. Do not build all reads, then all UI, then
all writeback — build one insight end-to-end first.

## Commands

- `npm install` — installs deps (needs Zod v4).
- `npm run dev` — dev server. Confirm the port matches your registered App URL.
- `npm run build` / `tsc --noEmit` — type-check + build; run before claiming done.
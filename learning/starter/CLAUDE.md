# CLAUDE.md

> **SDK reference:** the shared surface, conventions, and known runtime gotchas live in
> [`docs/vim-sdk-notes.md`](https://github.com/hunter-cottrill/vim-examples/blob/main/docs/vim-sdk-notes.md)
> — read it before writing any SDK code. Live upstream reference:
> https://developer-docs.getvim.ai/llms.txt. Where either disagrees with the installed types,
> the types win: `node_modules/@vimconnect/app-sdk/dist/index.d.ts`.

## What this is

A **learning starter**, not an app template. It exists to teach the Vim App SDK one building block at a time. If the person is learning, use the `learn-vim-sdk` skill (`/vim-app-builder:learn`) — it paces the modules and holds the verified reference implementation for each one.

## Rules for working in this repo

1. **Only `src/lib/vim-client.ts` changes during Modules 1–6, and only `src/lib/worker-client.ts` in Module 9.** The hook (`use-learning.ts`), the panel, and the harness are already written and work with every module. If a module seems to need a change elsewhere, that's a sign something's wrong.
2. **Don't build ahead of the learner.** Each unbuilt function throws `NotBuiltError` on purpose — the panel and the checks depend on it. Build one module at a time, when asked.
3. **Never edit `src/checks/` to make a check pass.** The checks define what "done" means for each module.
4. **Every function needs a simulator branch.** Read from `src/dev/fixtures.ts` when `SIM_MODE` is true, through the same mapping code the live path uses.
5. **Check errors by property, not class.** `isNotBuilt(err)` rather than `instanceof NotBuiltError`; `err.code` rather than `instanceof SDKError`. A class check fails when two copies of a module are loaded.

## Commands

```bash
npm run dev          # localhost:8080
npm test             # module checks: skipped until built, then passed
npm run type-check
npm run build
```

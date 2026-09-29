# Vim SDK Learning Starter

A small Vim Connect app for learning the Vim App SDK one building block at a time.

The authentication flow and a simulator are already working. What's missing is the SDK code itself: six functions in `src/lib/vim-client.ts`, one per building block. You build them in order, and the app's panel fills in as you go.

This isn't a template for a real app. When you're ready to build one, use `/vim-app-builder:new-vim-app` — which is also the last module of the course.

## Start

```bash
npx degit hunter-cottrill/vim-examples/learning/starter vim-learning
cd vim-learning
npm install
NEXT_PUBLIC_SIM_MODE=true npm run dev
```

Open http://localhost:8080/dev/harness. You'll see a yellow **Simulator on** banner, simulator controls on the left, and six module cards on the right reading **Not built yet**.

No Vim account is needed until Module 7.

## Learn with Claude Code

The Vim plugin guides you through it:

```text
/plugin marketplace add hunter-cottrill/vim-examples
/plugin install vim-app-builder@vim-examples
```

Then, from inside this folder:

```text
/vim-app-builder:learn
```

Each module follows the same loop: predict what the SDK will do, build it, check it, then break it in the simulator to see why it works the way it does.

## The modules

| # | Building block | What you'll build in `vim-client.ts` |
|---|---|---|
| 0 | Orientation | Nothing — a tour of the starter |
| 1 | Starting a session | `connectToVim` |
| 2 | The manifest | `describeSession` |
| 3 | Workflow events | `onWorkflowEvent` |
| 4 | Context and presence | `onPatientPresence` |
| 5 | The Entity API | `fetchPatient`, `fetchProblems` |
| 6 | Writeback | `checkEncounterWriteback`, `appendEncounterNote` |
| 7 | Going live | Register in Vim Console and connect to the sandbox EHR |
| 8 | One-shot a real app | Build a full app, then find every building block in it |

## Check your progress

```bash
npm test
```

There's one check per module. A check is **skipped** until you build its function, then **passes**. That's how you know a module is done.

## What's already built

- `src/app/launch/`, `src/app/token/` — the OAuth launch flow
- `src/lib/presence-tracker.ts` — follows a patient across both patient context keys (used in Module 4)
- `src/lib/retry.ts` — retries reads through the brief race right after a chart opens (used in Module 5)
- `src/app/dev/harness/` and `src/dev/fixtures.ts` — the simulator and its sample patients
- `src/lib/use-learning.ts`, `src/components/` — the panel. You don't need to change these.

## Turning the simulator off

Module 7 covers this. The short version: set `NEXT_PUBLIC_SIM_MODE=false` and **restart** the dev server — the flag is read at startup. With the simulator still on, the app connects and reports no error but listens to sample data instead of the EHR, so nothing seems to happen. The banner is there to catch that.

## Reference

- SDK docs: https://developer-docs.getvim.ai/docs/
- Verified SDK notes for coding agents: https://github.com/hunter-cottrill/vim-examples/blob/main/docs/vim-sdk-notes.md

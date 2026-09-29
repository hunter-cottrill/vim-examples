# Module 0 · Orientation

**Goal:** understand how the starter is put together before changing anything.

## Tour — show these, briefly

- **`src/lib/vim-client.ts`** — the only file that talks to the SDK, and the only file they'll change in Modules 1–6. Six functions, each throwing `NotBuiltError` for now.
- **`src/app/dev/harness/`** — the simulator. The left side plays the part of the EHR; the right side is the real app panel. Under the buttons, a feedback line reports what each click sent and whether anything received it. Right now every signal says *nothing listening yet* — nothing has subscribed. Watch that line change as modules get built.
- **`src/dev/fixtures.ts`** — the sample data. Point out that the second patient is deliberately sparse: no name, no MRN, problems with no system or status. Real EHRs send records like this.
- **`src/checks/`** — one check per module. `npm test` is how they'll know a module is done.
- **`src/app/launch/`, `src/app/token/`** — the authentication flow. Already built; covered properly in Module 7.

## Predict

> The whole app talks to the SDK through one file. Why might that be worth the trouble, rather than calling the SDK from wherever it's needed?

## The point

One boundary means the rest of the app works with plain local types. It's easier to test (the checks run with no EHR at all), easier to read, and when the SDK changes, only one file changes. It's also what makes the simulator possible: every function has a simulator branch in that one place.

## Break

Have them turn the simulator off — set `NEXT_PUBLIC_SIM_MODE=false`, restart the dev server, and reload `/dev/harness`. It returns 404. Turn it back on and restart.

Ask: *why did it need a restart, not just a reload?* The flag is read when the dev server starts and built into the page, so changing it needs a restart. Worth knowing now — it's the most common reason a live test "does nothing" later.

## Takeaway

All SDK access lives in one file, and the simulator lets everything run without an EHR.

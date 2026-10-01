# Module 0 · Orientation

## Why it matters

Before any code, the learner needs the picture of what a Vim app *is*. Give it in a few sentences:

> A provider works inside their EHR. The Vim Connect extension sits alongside it, and your app runs in its panel. Vim's job is to make every EHR look the same to your app — so you write one integration instead of one per EHR. Your app reacts to moments in the clinical workflow, reads what's on screen, and can write back into the chart with the provider's permission.

Everything in the course is one piece of that picture.

## Tour

Show these briefly — the point is orientation, not detail:

- **`src/lib/vim-client.ts`** — the only file that talks to the SDK, and the file they'll build in Modules 1–6.
- **The harness** (`/dev/harness`) — the left side plays the EHR, the right side is the real app panel. Under the buttons, a feedback line reports what each click sent and whether anything received it.
- **`src/dev/fixtures.ts`** — two sample patients. The second is deliberately incomplete, because real EHR data often is.
- **`npm test`** — one check per module. It's how they'll know a module is done.

## The simulator — say this plainly

The simulator is a **development and learning tool**. It feeds the app sample data so you can build and test without an EHR, an account, or real patients. It never ships: real apps run with it off, and the harness page doesn't exist in production. The yellow banner shows whenever it's on, so it's never mistaken for a live EHR.

## Predict

> The whole app talks to the SDK through one file. Why might that be worth doing?

### Answer key — for you, not the learner

- **Credit fully:** separation of concerns; changes to the SDK touch one place; easier to test; the rest of the app doesn't depend on Vim directly.
- **Then add, if they didn't say it:** it's also what makes the simulator possible — every function's simulator branch lives in that one file.

## Break

Have them click **Open chart** and read the feedback line. Every signal says *nothing listening yet*. Ask why: nothing has been built to receive it. That line will change as they go.

## Your app

> In one sentence, what would your app show a provider, and at what moment in their day?

Keep their answer. Refer back to it at the end of each module.

## Takeaway

A Vim app reacts to the clinical workflow, through one integration that works across EHRs.

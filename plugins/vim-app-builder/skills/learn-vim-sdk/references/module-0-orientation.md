# Module 0 · Orientation — the Vim landscape

## Why it matters

Start with the picture, before any code. Give it in a few sentences, then the table — don't lecture:

> A provider spends their day inside an EHR. Every EHR is different, and building an app that works inside each one is slow, expensive integration work. Vim does that work once. The Vim Connect extension sits alongside the EHR, your app runs in its panel, and the Vim SDK gives your app one consistent way to work with every EHR Vim supports. Your app reacts to moments in the clinical workflow, reads what's on screen, and can write back into the chart with the provider's permission.

## Predict

> Imagine your app has to run inside three different EHRs your customers use. Without Vim, what would you have to build — and what does Vim take off your plate?

### Answer key — for you, not the learner

- **Credit fully:** a separate integration for each EHR — different data formats, different ways to get your app on screen, different sign-in, and ongoing maintenance every time an EHR changes. Vim replaces that with one SDK and one integration.
- **Credit partly:** "an integration" or "an API connection" — right; push on *how many*, and what happens when an EHR updates.
- **Then add the one thing Vim can't do:** it normalizes the EHRs, but it can't add a capability an EHR doesn't have. So what's available can vary — which is why Module 2 teaches checking.

## The pieces

| Piece | What it is |
|---|---|
| **The EHR** | The provider's system of record. Vim reads from it and, with permission, writes to it. |
| **Vim Connect** | The extension providers use. It sits alongside the EHR and hosts your app in a panel. |
| **Your app — UI** | Runs in the Vim Connect panel while the provider has it open. Modules 1–6 build this. |
| **Your app — Worker** | Optional. Runs in the background and can notify the provider when the panel is closed. Module 9. |
| **The Vim SDK** | The library your app uses to talk to the EHR through Vim — the same calls whichever EHR it is. |
| **Vim Console** | Where you register your app, get credentials, and configure it. Module 7. |

Then name what they'll learn, as one sentence: the course builds each way an app works with the EHR — knowing when something happens, what's on screen, reading data, and writing back.

## The starter — briefly

- **`src/lib/vim-client.ts`** — where the app talks to the SDK, and the file they'll build in Modules 1–6. Keeping all SDK calls in one place is a convention the templates follow.
- **The harness** (`/dev/harness`) — the left side plays the EHR; the right side is the real app panel. A feedback line under the buttons reports what each click sent, and whether anything received it.
- **`npm test`** — one check per module. It's how they'll know a module is done.

## The simulator — say this plainly

The simulator is a **development and learning tool**. It feeds the app sample data so you can build and test without an EHR, an account, or real patients. It never ships: real apps run with it off, and the harness doesn't exist in production. The yellow banner shows whenever it's on.

## Break

Have them click **Open chart** and read the feedback line. Every signal says *nothing listening yet*. Ask why: nothing has been built to receive it yet. That line will change as they build.

## Your app

> In one sentence, what would your app show a provider, and at what moment in their day?

Keep their answer. Refer back to it at the end of each module.

## Takeaway

Vim turns many EHR integrations into one. Your app joins the provider's workflow through it.

# Module 8 · One-shot a real app

**Goal:** see how fast a full Vim app gets built with an agent — and recognise every building block in what it produces.

## Predict

> You've now built each SDK building block by hand. How long do you think it takes an agent to build a complete app that uses all of them?

## Build

In a fresh, empty folder — not inside the learning starter — have them run:

    /vim-app-builder:new-vim-app

and describe an app in a sentence. Encourage them to pick something from their own world, not a toy. The agent will ask a few scoping questions, propose a plan, and build it.

Let the build run. Time it.

## Recognise

This is the payoff of the whole course. When the build finishes, open the generated app's SDK client file together and ask them to find each building block:

- Where does it **start the session**? (Module 1)
- Does it **check the manifest**, or assume what's available? (Module 2)
- What **events** does it listen for? (Module 3)
- How does it know a **patient is present**, and when they've **left**? Does it watch both patient keys? (Module 4)
- How does it **fetch** data, and does it cope with **missing fields**? (Module 5)
- Does it **write back**, and does it follow the **ceremony**? (Module 6)

If any of those is missing or wrong in the generated app, that's the real lesson: they can now see it, and fix it.

## Break

Run the generated app in its simulator (`NEXT_PUBLIC_SIM_MODE=true npm run dev`, then `/dev/harness`) and have them try the Module 4 exercises on it: open a chart, open an encounter, leave. Does it handle them correctly?

## Takeaway

An agent can build a Vim app in minutes. Knowing the building blocks is what lets you trust what it built.

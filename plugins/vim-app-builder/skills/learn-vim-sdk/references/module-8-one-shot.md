# Module 8 · One-shot a real app

## Why it matters

This is the payoff. With an agent, a complete Vim app takes minutes. Having built each building block by hand, the learner can now tell whether what the agent built is right.

## Predict

> How long do you think it takes an agent to build a complete app using everything you've learned?

No answer key — any guess works. Time it and compare.

## Build

In a fresh, empty folder — not inside the learning starter — have them start the build skill and describe the app from their Module 0 answer. In Claude Code, that's:

    /vim-app-builder:new-vim-app

In other agents, ask it to build a new Vim Connect app, and it will pick up the same skill. Let the build run, and time it.

## Recognise

Open the generated app's SDK client together and find each building block:

- Where does it **start the session**? (Module 1)
- Does it **check what's available**, or assume? (Module 2)
- Which **events** does it react to? (Module 3)
- How does it know a **patient is on screen**, and when they've moved on? (Module 4)
- How does it **fetch data**, and does it cope with **missing fields**? (Module 5)
- Does it **write back**, with the provider's **permission**? (Module 6)
- Did it build a **Worker**? Should it have? (Module 9 covers this, if there's time.)

If anything is missing or wrong, that's the lesson: they can see it now, and fix it.

## Break

Run the generated app in its simulator, and try the Module 4 sequence on it: open a chart, open an encounter, leave. Does it hold up?

## Your app

> What would you change about what the agent built, before showing it to anyone?

## Takeaway

An agent can build a Vim app in minutes. Knowing the building blocks is what lets you trust it.

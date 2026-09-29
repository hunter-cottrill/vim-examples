---
description: Start guided, hands-on training on the Vim App SDK
argument-hint: [optional — a module number to jump to]
---

The user wants to learn the Vim App SDK. Use the learn-vim-sdk skill.

Start with the setup: make sure they're in the learning starter, the dev server is running with the simulator on, and they've run `npm test` once to see the starting point. Then begin Module 0.

If they named a module in the arguments, check that the modules before it are built — `npm test` shows which checks pass — and start there. If earlier modules they depend on aren't built, say which, and offer to start from the first missing one.

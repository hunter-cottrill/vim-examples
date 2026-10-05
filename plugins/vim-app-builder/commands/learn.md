---
description: Start guided, hands-on training on the Vim App SDK
argument-hint: [optional — "workshop" if a facilitator is leading, and/or a module number]
---

The user wants to learn the Vim App SDK. Use the learn-vim-sdk skill.

Start with the setup: make sure they're in the learning starter, the dev server is running with the simulator on, and they've run `npm test` once to see the starting point. Then begin Module 0.

If the arguments include "workshop", a facilitator is leading the session: follow the skill's <workshop_mode> section for the whole session, and tell the learner once, briefly, that you'll follow the facilitator's pace.

If they named a module in the arguments, check that the modules before it are built — `npm test` shows which checks pass — and start there. If earlier modules they depend on aren't built, say which, and offer to start from the first missing one.

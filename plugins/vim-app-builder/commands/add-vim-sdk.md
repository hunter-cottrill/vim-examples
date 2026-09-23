---
description: Add Vim Connect to an app that already exists, or migrate from the older Vim SDK
argument-hint: [optional — what the app should do inside the EHR]
---

The user wants to integrate the Vim App SDK into an application that already exists in this
working directory. Use the integrate-vim-sdk skill.

Start with discovery — read the codebase before asking anything. Establish the framework and
router, whether a server-side route is available for the token exchange, and whether Vim's
older SDK is already present. Do not scaffold a new app and do not restructure the existing
one.

If they gave a description in the arguments, treat it as what the app should do once it's
running inside the EHR, and use it to propose a trigger during intake.

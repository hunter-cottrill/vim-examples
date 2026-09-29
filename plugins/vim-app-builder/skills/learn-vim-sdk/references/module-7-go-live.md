# Module 7 · Going live

**Goal:** register the app, connect it to the sandbox EHR, and see which of the simulator's lessons hold up for real.

This module needs a Vim Console account and the Vim Connect Chrome extension. If the learner doesn't have access yet, this is the point to pause.

## Predict

> Everything so far has run against sample data. What do you expect to be different when you connect to a real sandbox EHR?

## Step 1 — Register the app in Vim Console

Walk them through creating an app in Vim Console. Explain each field as they fill it in:

| Field | Value for local development | Why |
|---|---|---|
| Name, tooltip | Their choice | Shown to providers in the Vim Connect panel |
| Icon | Square SVG, transparent background, single-colour outline, no fills | Vim recolours it for each panel state |
| Allowed iframe URLs | `http://localhost:8080` | Where the app is served from |
| Launch Endpoint | `http://localhost:8080/launch` | Where Vim starts the sign-in handshake |
| Token Endpoint | `http://localhost:8080/token` | The server route that exchanges a code for a token |
| Worker Launch Endpoint | *Leave blank* | Only for background Worker apps. If set, Vim requests it on every load and fails |

Stress that **these must match what the app actually serves**. The URLs, the port, and the redirect URI all have to agree. A mismatch produces a generic sign-in failure that looks like a bug in the code.

## Step 2 — Credentials

Generate a client ID and secret under the app's credentials, then:

    cp .env.local.example .env.local

and add them to `.env.local`. Explain that the secret must stay on the server — it's used in the token exchange and must never reach the browser — and that `.env.local` is never committed.

## Step 3 — Turn the simulator off

Set `NEXT_PUBLIC_SIM_MODE=false` in `.env.local`, then **restart the dev server**.

Ask them to predict what happens if they forget the restart. The app connects and shows no error, but it's still listening to the simulator instead of the EHR, so it looks as though nothing happens at all. This is the single most common "it doesn't work" in live testing. The banner is there to catch it.

## Step 4 — Launch it

Install the Vim Connect extension, sign in to the sandbox EHR, open a patient chart, and click the app in the Vim Connect panel.

**If several apps are registered pointing at the same localhost port, have them enable only this one.** Every registered app will try to launch on that port and fail with a `client_id` mismatch.

## What to look at

- **Module 1** now runs for real: the panel says *Connected*. This is the first time Module 1 has been tested.
- **Module 2** shows the real sandbox manifest. Have them compare it with the simulator's. Which events are actually supported here? Is writeback configured for the encounter? This is the manifest lesson paying off — they're discovering the environment's real capabilities themselves.
- **Module 4:** open the chart first, *then* the app. Presence still appears — context works regardless of order, exactly as Module 4 predicted.
- **Module 5:** does the sandbox patient have every field? Many don't.
- **Module 6:** is writeback available? If Module 2 showed no encounter writeback, Module 6 should say "Not available here".

## Takeaway

The simulator teaches the behaviour; the sandbox confirms it. Where they differ, the manifest tells you why.

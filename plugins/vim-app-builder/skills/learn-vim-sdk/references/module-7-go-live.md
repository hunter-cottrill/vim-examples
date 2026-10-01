# Module 7 · Going live

## Why it matters

Everything so far has run against sample data. This is where the app meets a real EHR: registered with Vim, signed in for real, reading a real sandbox patient. It's also where the earlier lessons get confirmed — or corrected.

This module needs a Vim Console account and the Vim Connect Chrome extension.

## Predict

> What do you expect to be different in a real sandbox EHR?

### Answer key

- **Credit fully:** the data and capabilities may differ from the simulator — different events, missing fields, different write support.
- **Then add:** that's why Module 2's manifest check matters. They're about to find out what this environment actually supports.

## Step 1 — Register the app in Vim Console

| Field | Value for local development | Why |
|---|---|---|
| Name, tooltip | Their choice | Shown to providers in the Vim Connect panel |
| Icon | Square SVG, transparent background, single-colour outline, no fills | Vim recolours it for each panel state |
| Allowed iframe URLs | `http://localhost:8080` | Where the app is served from |
| Launch Endpoint | `http://localhost:8080/launch` | Where Vim starts the sign-in |
| Token Endpoint | `http://localhost:8080/token` | The server route that exchanges a code for a token |
| Worker Launch Endpoint | *Leave blank* — unless they do Module 9 | If set without a Worker, Vim requests it on every load and fails |

**These must match what the app actually serves.** A mismatch produces a generic sign-in failure that looks like a bug in the code.

## Step 2 — Credentials

Generate a client ID and secret, then `cp .env.local.example .env.local` and add them. The secret stays on the server, and `.env.local` is never committed.

## Step 3 — Turn the simulator off

Set `NEXT_PUBLIC_SIM_MODE=false` in `.env.local`, then **restart** the dev server — a reload isn't enough.

Ask them to predict what happens if they forget the restart. The app connects and shows no error, but it's still running on sample data, so nothing seems to happen. It's the most common "it doesn't work" in live testing, and the banner is there to catch it.

## Step 4 — Launch it

Sign in to the sandbox EHR, open a patient chart, and launch the app from the Vim Connect panel.

If several apps are registered on the same localhost port, enable only this one — the others will try to launch there and fail.

## What to look at

- **Module 1:** *Connected* — the first time it has run for real.
- **Module 2:** the real manifest. Compare it with the simulator's. Which events are supported? Is writeback configured?
- **Module 4:** open the chart *first*, then the app. Presence still appears.
- **Module 5:** does the sandbox patient have every field?
- **Module 6:** is writeback available here?

## Your app

> Which of the differences you just found would matter most for your app?

## Takeaway

The simulator teaches the behaviour; the live EHR confirms it. Where they differ, the manifest tells you why.

# Module 7 · Going live

Self-paced only. It needs a Vim Console account and the Vim Connect Chrome extension.

**Say:** "Everything so far ran on sample data. Now we connect your app to a real test EHR."

**1 · Register the app in Vim Console.** Walk them through it, one line per field:

| Field | Value | Why |
|---|---|---|
| Name and tooltip | Their choice | Shown to providers |
| Icon | Square SVG, one-colour outline, no fills | Vim recolours it |
| Allowed iframe URLs | `http://localhost:8080` | Where the app runs |
| Launch endpoint | `http://localhost:8080/launch` | Where sign-in starts |
| Token endpoint | `http://localhost:8080/token` | Where the server gets the token |
| Worker launch endpoint | Leave blank, unless they do Module 9 | Only for background apps |

These must match what the app actually serves, or sign-in fails with an unhelpful error.

**2 · Credentials.** Generate a client ID and secret, then `cp .env.local.example .env.local` and have them add both. The secret stays on the server and is never committed. Don't ask them to paste the secret into this conversation.

**3 · Turn the simulator off.** Set `NEXT_PUBLIC_SIM_MODE=false`, then restart the dev server — a reload isn't enough.

**4 · Launch it.** Sign in to the sandbox EHR, open a patient, and open the app from the Vim Connect panel. Module 1 now says *Connected*.

**Then have them compare:** what does this EHR support (Module 2), versus the simulator? Does the patient have every field (Module 5)?

**Takeaway:** The simulator teaches; the real EHR confirms.

## In the Mock EHR

Skip it — the app is already registered and running.

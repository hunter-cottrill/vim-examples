# Module 4 · Context — what's on screen now

## Why it matters

Context is how an app stays in step with the provider. It reports what's true *right now* — which patient is open — however and whenever the app was opened. An app that follows context shows the right patient's information, and clears it when the provider moves on.

## Predict

> Module 3 showed an event can't tell you what's on screen. What could?

### Answer key

- **"Context" or "something that reports current state" — credit fully.**
- **"The patient record" or "check whether there's a patient" — credit partly.** Right idea: the patient in view *is* what context holds. Refine it: context gives you the patient that's on screen, and tells you when that changes; the Entity API, in Module 5, then fetches their details.

## Build

`onPatientPresence(onPresent, onCleared)` — watch the patient context keys, and report when a patient arrives and leaves.

Reference implementation — Verified against `@vimconnect/app-sdk` 0.4.56. Build toward it in small steps; don't paste it wholesale.

```typescript
// ─── MODULE 4 · Context ─────────────────────────────────────────────────────

/**
 * Report when a patient comes into view and when they leave.
 *
 * Context reports what is true NOW, so this works however the app was opened.
 * Both patient keys are watched: opening an encounter clears chart_open:patient
 * while encounter_open:patient fills in. The tracker treats the patient as gone
 * only when both are empty, after a short settle.
 */
export function onPatientPresence(onPresent: () => void, onCleared: () => void): () => void {
  const tracker = createPresenceTracker({ onPresent, onCleared });

  if (SIM_MODE) {
    const listener = (key: PresenceKey, present: boolean) => tracker.set(key, present);
    simPresenceListeners.push(listener);
    return () => {
      const i = simPresenceListeners.indexOf(listener);
      if (i !== -1) simPresenceListeners.splice(i, 1);
      tracker.dispose();
    };
  }

  const sdk = requireSdk();
  const offChart = sdk.ehr.context.onChange('chart_open:patient', (_prev, curr) => tracker.set('chart', Boolean(curr)));
  const offEncounter = sdk.ehr.context.onChange('encounter_open:patient', (_prev, curr) => tracker.set('encounter', Boolean(curr)));
  return () => {
    offChart();
    offEncounter();
    tracker.dispose();
  };
}
```

Point at two things:

- **Context reports current state**, so this works however the app was opened. It's the fix for what Module 3 couldn't do.
- **It watches two keys.** Opening an encounter from a chart moves the patient from one context key to another. They haven't left, so the app shouldn't clear. The presence tracker, already written, handles that.

## Check

`npm test` — the three Module 4 checks should pass. Read their names aloud; they're the module's lessons.

## Break

Have them predict, then click each in turn:

1. **Open chart** — a patient is on screen.
2. **Open an encounter** — still on screen. They moved into a visit; they didn't leave.
3. **Back to the chart** — still on screen.
4. **Leave the patient** — cleared.

Then the sharpest one: **"Context only: chart present"**, then **"Context only: chart empty"**. Presence appears and clears with no event at all. Context alone is enough.

## Your app

> When the provider switches to a different patient, what should your app do with what it was showing?

## Under the hood — only if asked

The two keys are `chart_open:patient` and `encounter_open:patient`. Their updates can arrive in either order, so the tracker waits briefly before deciding the patient has gone. If the platform adds an explicit "chart closed" event in future, context-based tracking still works.

## Takeaway

Context tells your app what's on screen now, and when it changes.

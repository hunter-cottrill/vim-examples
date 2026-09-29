# Module 4 · Context and patient presence

**Goal:** learn how an app knows what's true right now — and how it knows when the patient has left.

This is the module most apps get wrong, including ones written by agents. Give it time.

## Predict — two questions

> 1. Module 3 showed an event can't tell you a patient is on screen. What could?
> 2. There's no "chart closed" event. How would your app know the provider has moved on to someone else?

## Build

`onPatientPresence(onPresent, onCleared)`. Subscribe to **both** patient context keys — `chart_open:patient` and `encounter_open:patient` — and feed each into the presence tracker from `./presence-tracker`. In the simulator, add a listener to `simPresenceListeners`.

**Reference implementation** — verified against `@vimconnect/app-sdk` 0.4.56. Build toward this in small steps and explain as you go; don't paste it wholesale.

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

Three things to explain:

- **Context reports what's true now**, so it works however the app was opened. That answers predict question 1.
- **An empty context key is the "patient left" signal.** There's no close event — `current` becoming empty is the only teardown signal. That answers question 2.
- **Why both keys, and why the tracker.** Opening an encounter from inside a chart *empties* `chart_open:patient` while `encounter_open:patient` *fills in*. The patient hasn't gone anywhere. And the two updates can arrive in either order. So the tracker treats the patient as gone only when both keys are empty, and waits a short moment to be sure. Open `presence-tracker.ts` and show them — it's already written and fully tested.

## Check

`npm test` — three Module 4 checks should pass. Read their names aloud; they're the three lessons of this module.

## Break

Work through these in the harness, one at a time, asking what they expect before each click:

1. **Open chart.** Module 4 says a patient is on screen, and Module 5 starts loading — well, it will once Module 5 is built.
2. **Open an encounter.** Module 4 should *still* say a patient is on screen. This is the case single-key apps get wrong: they tear everything down every time a provider opens a visit.
3. **Back to the chart.** Still present.
4. **Leave the patient.** Now it clears.

Then the sharpest one. Under *Raw signals*, click **"Context only: chart present"**, then **"Context only: chart empty"**. Presence appears, then clears — with no event involved at all. Context alone is enough.

## Takeaway

Context tells you what's true now. Watch both patient keys, and treat an empty key as the patient leaving.

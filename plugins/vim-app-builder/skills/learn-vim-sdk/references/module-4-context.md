# Module 4 · What's on screen

**Why it matters, in one sentence:** Context tells your app what's on screen right now, whenever it opens.

**Ask exactly:**
> Your app opens after a patient's chart is already open. How could it know which patient is on screen?

**Build** `onPatientPresence`. One or two sentences: it watches the two places a patient can be open — their chart, and an encounter — and reports when a patient appears or leaves.

Reference implementation — verified against the SDK version pinned in the reference solution. Build toward it; don't paste it at the learner.

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

**Check:** `npm test`.

**Try it (simulator):** click, in order: **Open chart**, **Open an encounter**, **Back to the chart**, **Leave the patient**. Watch the panel's presence card each time.

**Then ask:** "Does that match what you predicted?"

**Explain, in two or three sentences:** context reports what's true *now*, so it works however the app was opened. Opening an encounter moves the patient from the chart to the encounter — they haven't left, so the app keeps them. Only when both are empty has the patient gone.

**Takeaway:** Context tells you what's on screen now, and when it changes.

## In the Mock EHR

Open a patient's chart *first*, then open the app — it already knows the patient. Then open an encounter, go back to the chart, and finally leave the patient. Watch the presence card at each step.

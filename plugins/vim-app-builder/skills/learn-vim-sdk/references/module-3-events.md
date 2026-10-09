# Module 3 · Events

**Why it matters, in one sentence:** Events tell your app the moment something happens — like a provider opening a chart.

**Ask exactly:**
> If a provider opens a patient's chart, and only then opens your app, does your app find out the chart was opened?

**Build** `onWorkflowEvent`. One or two sentences: it listens for moments in the provider's workflow — a chart opening, an order being signed — and reports each one.

Reference implementation — verified against the SDK version pinned in the reference solution. Build toward it; don't paste it at the learner.

```typescript
// ─── MODULE 3 · Workflow events ─────────────────────────────────────────────

const ALL_EVENTS: EventType[] = ['chart_open', 'encounter_open', 'referral_start', 'referral_save', 'order_select', 'order_sign'];

/**
 * Report every workflow event by type. An event is a MOMENT and fires once —
 * it carries a reference, not the full record, so we only log what happened.
 */
export function onWorkflowEvent(cb: (type: string) => void): () => void {
  if (SIM_MODE) {
    simEventListeners.push(cb);
    return () => {
      const i = simEventListeners.indexOf(cb);
      if (i !== -1) simEventListeners.splice(i, 1);
    };
  }
  return requireSdk().ehr.workflow.on(ALL_EVENTS, (event) => cb(event.type));
}
```

**Check:** `npm test`.

**Try it (simulator):** click **Event only: chart_open** — the line under the buttons says *delivered*, and it shows in the panel's event log. Then click **Open chart**: the event is delivered, but the patient line still says *nothing listening yet*.

**Then ask:** "Does that match what you predicted?"

**Explain, in two or three sentences:** an event goes out once, to whoever is listening at that moment. An app that opens later has already missed it — so an event can't tell you who's on screen now. That's what Module 4 is for.

If they said a background app would hear it: they're right. That's a Worker, and Module 9 builds one.

**Takeaway:** Events tell you *when* something happened — once, to whoever's listening.

## In the Mock EHR

With the app's panel open, open a patient's chart: the event appears in the app. Then close the panel, open a different patient, and reopen the panel. No event for that patient — the app wasn't open to hear it.

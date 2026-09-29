# Module 3 · Workflow events

**Goal:** understand what an event is — and, just as important, what it isn't.

## Predict

> When a provider opens a patient's chart, the SDK can fire a `chart_open` event. Suppose the provider opens the chart first, and only *then* clicks your app's icon. Does your app hear about the chart opening?

Let them commit to an answer. Most people say yes.

## Build

`onWorkflowEvent(cb)`. Subscribe to all six event types and report each one by type. Return the unsubscribe function. In the simulator, add the callback to `simEventListeners`.

**Reference implementation** — verified against `@vimconnect/app-sdk` 0.4.56. Build toward this in small steps and explain as you go; don't paste it wholesale.

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

Point out that the callback only reports `event.type`. An event carries a reference to the entity, not the full record — details come from the Entity API in Module 5.

## Check

`npm test` — the Module 3 check should pass.

## Break

This is one of the two most important exercises in the course.

1. Pick a patient, then click **"Event only: chart_open"** under *Raw signals*. The feedback line says the event was **delivered**, and it appears in Module 3's log.
2. Now click **"Open chart"**. Read the feedback line carefully: the event is *delivered*, but `chart_open:patient` says **nothing listening yet**. That's why Module 4 still can't tell a patient is here — the signal that says so has no one to receive it.

Now the real question. Ask: *if your app had only this event to go on, and the provider had opened the chart before opening your app, what would your app show?* Nothing, forever. The event fired once, before the app was listening, and it doesn't fire again.

That's the answer to the predict question. An event reports a **moment**, once. It can't tell you what's true *now*. Module 4 fixes that.

## Takeaway

An event is a one-time notification of a moment. It can't tell you what's currently on screen.

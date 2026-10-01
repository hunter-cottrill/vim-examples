# Module 3 · Workflow events

## Why it matters

Events are how an app joins the clinical workflow. The moment a provider opens a chart, signs an order, or starts a referral is when an insight is worth the most — so events are what let an app speak up at exactly the right time.

## Predict

> A provider opens a patient's chart, and only *then* opens your app. Does your app hear about the chart opening?

### Answer key

- **"No" — credit fully.** An event goes to whoever is listening when it happens. A UI app that wasn't open yet wasn't listening.
- **"It depends — a Worker would" — credit fully; this is the sharpest answer.** A UI app only runs while its panel is open. A **Worker** is a background part of the app that runs whether or not the panel is open, so it *does* hear the event. That's exactly what Workers are for, and Module 9 builds one.
- **"Yes"** — the common first guess. Don't just correct it; let the break exercise show them.

## Build

`onWorkflowEvent(cb)` — subscribe to the six event types and report each one.

Reference implementation — Verified against `@vimconnect/app-sdk` 0.4.56. Build toward it in small steps; don't paste it wholesale.

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

Point at one thing: it only reports the event's *type*. An event tells you a moment happened. The details come from the Entity API, in Module 5.

## Check

`npm test` — the Module 3 check should pass.

## Break

1. Click **"Event only: chart_open"**. The feedback line says the event was **delivered**, and it appears in Module 3's log.
2. Click **"Open chart"**. The event is delivered, but `chart_open:patient` says **nothing listening yet**.

Ask: *the provider opened the chart before the app. What would a UI app that only listened for events show?*

- **Credit fully:** nothing. The event happened once, before the app was there to hear it.

That's why Module 4 exists: an event tells you a moment happened, not what's on screen now.

## Your app

> What's the moment in the workflow your app should react to? Would your provider ever have the panel closed at that moment?

If they answer yes to the second, note it — that's their reason to do Module 9.

## Under the hood — only if asked

The returned function unsubscribes; components call it when they unmount. An event's entities are references (`{ type: 'existing', id }`), not full records.

## Takeaway

Events tell your app *when* something happened in the workflow — once, to whoever is listening.

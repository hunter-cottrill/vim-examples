# Module 9 · Workers — optional

## Why it matters

A UI app only runs while its panel is open. A **Worker** is the part of an app that runs in the background, whether or not the panel is open — so it can notice the right moment and tap the provider on the shoulder. It's the difference between a tool the provider has to remember to open and one that reaches them when it matters.

This module is **optional**: do it if there's time after Module 8, or as a stretch goal for a team that finishes early. It builds in the learning starter, in a new file: `src/lib/worker-client.ts`.

## Predict

> Your Worker can notify the provider whenever a chart opens. When should it stay quiet?

### Answer key

- **Credit fully:** when the panel is already open, and when it has just notified about the same thing.
- **Credit partly:** "when it's not relevant" — right; ask what that means concretely.
- **Then add:** notifications are a trust budget. A Worker that nags gets switched off.

## Build

`decideNotification()` — the decision, as plain logic — then `startWorker()`, which registers for `chart_open` and notifies when the decision says to.

Reference implementation — Verified against `@vimconnect/app-sdk` 0.4.56. Build toward it in small steps; don't paste it wholesale.

```typescript
// ─── MODULE 9 · Workers ─────────────────────────────────────────────────────

/**
 * Should the Worker notify? Never while the panel is open — the provider is
 * already looking at the app — and not again for the same patient until the
 * throttle window has passed. Notifications are a trust budget: a Worker that
 * nags gets switched off.
 */
export function decideNotification(input: { panelOpen: boolean; lastNotifiedAt: number | undefined; now: number }): NotifyDecision {
  if (input.panelOpen) return { notify: false, reason: 'panel_open' };
  if (input.lastNotifiedAt !== undefined && input.now - input.lastNotifiedAt < NOTIFY_THROTTLE_MS) {
    return { notify: false, reason: 'throttled' };
  }
  return { notify: true };
}

const NOTIFICATION = {
  title: 'Vim learning app',
  text: 'A patient chart was opened. Open the app to see their details.',
};

/**
 * Start the Worker. It registers for chart_open — registers, not subscribes:
 * a Worker is set up once, and the hub calls it for every matching event,
 * whether or not the UI panel is open. Returns a function that stops it.
 */
export async function startWorker(tokens: LaunchTokens): Promise<() => void> {
  const lastNotified = new Map<string, number>();

  // One decision path, shared by the simulator and the live Worker.
  function decide(patientId: string | null, panelOpen: boolean): NotifyDecision {
    const key = patientId ?? 'unknown';
    const decision = decideNotification({ panelOpen, lastNotifiedAt: lastNotified.get(key), now: Date.now() });
    if (decision.notify) lastNotified.set(key, Date.now());
    return decision;
  }

  if (SIM_MODE) {
    const handler = async (patientId: string | null) => {
      const decision = decide(patientId, simPanelOpen);
      if (decision.notify) simNotifications.push({ ...NOTIFICATION, at: new Date().toLocaleTimeString() });
      return decision;
    };
    simWorkerHandlers.push(handler);
    return () => {
      const i = simWorkerHandlers.indexOf(handler);
      if (i !== -1) simWorkerHandlers.splice(i, 1);
    };
  }

  const worker = await initWorkerVimSDK({ accessToken: tokens.accessToken, idToken: tokens.idToken });

  // operations: ['notify'] is what gives each event's handle a hub to notify through.
  return worker.ehr.workflow.register('chart_open', { operations: ['notify'] }, async (event: WorkflowEvent, handle) => {
    // The handle is short-lived. If it has already expired, do nothing.
    const hub = handle.hub;
    if (!hub?.isValid()) {
      handle.close();
      return;
    }
    // The event carries a reference to the patient, not the record.
    const ref = event.entities.patient;
    const patientId = ref?.type === 'existing' ? ref.id : null;

    // Whether the panel is open lives on the Worker SDK, not on the handle.
    const decision = decide(patientId, worker.hub.appState.isAppOpen);
    if (!decision.notify) {
      handle.close();
      return;
    }
    await hub.pushNotification.show({
      notificationId: `learning-${patientId ?? 'unknown'}`,
      ...NOTIFICATION,
      type: 'info',
      launchPayload: patientId ? { patientId } : undefined,
    });
    handle.close();
  });
}
```

Point at two things:

- **A Worker is a different SDK object.** It starts with `initWorkerVimSDK`, and it *registers* for events rather than subscribing — set up once, the hub calls it for every matching event, panel open or not. That's why it lives in its own file.
- **It only notifies when it should.** Never while the panel is open, and not again for the same patient until the throttle window passes.

## Check

`npm test` — the three Module 9 checks should pass.

## Break

The Worker box in the harness, under the controls, now shows the Worker running.

1. Leave **UI panel open** ticked, then **Open chart**. The Worker stays quiet: the panel is already open.
2. Untick it, then **Open chart**. A notification appears.
3. **Open chart** again straight away. Quiet — it notified about this patient a moment ago.
4. Pick the other patient and **Open chart**. A notification: different patient.

Ask: *why is stage 3 right, even though a chart just opened?*

## Go live

1. In Vim Console, set the **Worker Launch Endpoint** to `http://localhost:8080/offscreen`. In Module 7 it was left blank, because the app served no Worker. Now it does — registration must match what the app serves.
2. Restart the dev server with the simulator off.
3. In the sandbox, close the app's panel, then open a patient chart. A notification arrives.
4. Open the panel and open another chart. No notification.

## Your app

> Would your provider miss something if your app only ran with the panel open? If not, your app doesn't need a Worker — and that's a fine answer.

## Under the hood — only if asked

Each event gives the Worker a short-lived handle. Declaring `operations: ['notify']` is what gives the handle a hub to notify through, and the handle should be closed when the Worker decides not to act. Whether the panel is open is read from the Worker SDK itself, `worker.hub.appState.isAppOpen`, not from the handle. The notification carries a `launchPayload`, so tapping it opens the app on the right patient. The `/offscreen` page runs the same sign-in as the UI app; it's prebuilt.

## Takeaway

A Worker reaches the provider when the panel is closed — and earns their trust by knowing when to stay quiet.

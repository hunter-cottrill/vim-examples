# Module 9 · Background apps — optional

**Why it matters, in one sentence:** A Worker is the part of an app that runs in the background, so it can notify the provider even when the app isn't open.

**Ask exactly:**
> A background app could notify the provider every time a chart opens. When should it stay quiet?

**Build** `decideNotification`, then `startWorker`. One or two sentences: the Worker listens for charts opening, and notifies only when the panel is closed and it hasn't just notified about the same patient.

Reference implementation — verified against the SDK version pinned in the reference solution. Build toward it; don't paste it at the learner.

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

**Check:** `npm test`.

**Try it (simulator)**, in the Worker box under the controls:
1. Leave **UI panel open** ticked, then **Open chart** — the Worker stays quiet.
2. Untick it, then **Open chart** — a notification appears.
3. **Open chart** again straight away — quiet, since it just notified.
4. Pick the other patient, then **Open chart** — a notification.

**Then ask:** "Does that match what you predicted?"

**Explain, in two or three sentences:** notifications are a trust budget. A Worker that nags gets switched off, so it stays quiet when the provider's already looking, and doesn't repeat itself. Only build one if the provider would miss something with the app closed.

**Takeaway:** A Worker reaches the provider when the app is closed — and knows when to stay quiet.

## In the Mock EHR

Only if the facilitator says so. The Worker also needs its launch endpoint — `http://localhost:8080/offscreen` — registered for the app; the facilitator will confirm it is.

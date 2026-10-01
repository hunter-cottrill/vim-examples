/**
 * The Worker's SDK boundary — the only file that talks to the Worker SDK, just
 * as vim-client.ts is the UI app's. A Worker is a different SDK object with a
 * different surface, which is why it gets its own file.
 *
 * Module 9 (optional) builds this file. When the simulator is on, the Worker's
 * events come from the harness instead of the EHR — through the same decision
 * code the live path uses.
 */
import { initWorkerVimSDK, type WorkflowEvent } from '@vimconnect/app-sdk';
import type { LaunchTokens } from './launch-auth';
import { NOTIFY_THROTTLE_MS, NotBuiltError, type NotifyDecision } from './learning-types';
import { SIM_MODE } from './vim-client';

// ─── Simulator state (dev only) — already built ─────────────────────────────

export interface SimNotification {
  title: string;
  text: string;
  at: string;
}

let simPanelOpen = true;
const simWorkerHandlers: Array<(patientId: string | null) => Promise<NotifyDecision>> = [];
const simNotifications: SimNotification[] = [];

/** DEV-ONLY. Whether the simulated UI panel is open — what a real Worker reads from the hub. */
export function setSimPanelOpen(open: boolean): void {
  simPanelOpen = open;
}

/**
 * DEV-ONLY. Deliver a workflow event to the Worker, as the hub would. Returns
 * each registered handler's decision — an empty array means no Worker is
 * running yet (Module 9).
 */
export async function simulateWorkerEvent(type: string, patientId: string | null): Promise<NotifyDecision[]> {
  if (!SIM_MODE || type !== 'chart_open') return [];
  return Promise.all(simWorkerHandlers.map((handler) => handler(patientId)));
}

/** DEV-ONLY. Every notification the simulated Worker has shown. */
export function simulatedNotifications(): SimNotification[] {
  return [...simNotifications];
}

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

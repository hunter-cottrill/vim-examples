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
 * Should the Worker notify? Return { notify: false, reason: 'panel_open' } if
 * the panel is open, { notify: false, reason: 'throttled' } if this patient
 * was notified less than NOTIFY_THROTTLE_MS ago, and { notify: true } otherwise.
 */
export function decideNotification(input: { panelOpen: boolean; lastNotifiedAt: number | undefined; now: number }): NotifyDecision {
  void input;
  throw new NotBuiltError(9);
}

/**
 * Start the Worker: register for chart_open, and notify when decideNotification
 * says to. Return a function that stops it. In the simulator, push a handler
 * onto simWorkerHandlers and record notifications in simNotifications.
 */
export async function startWorker(tokens: LaunchTokens): Promise<() => void> {
  void tokens;
  throw new NotBuiltError(9);
}

// Imported for use as you build Module 9.
void [initWorkerVimSDK, NOTIFY_THROTTLE_MS];
export type { WorkflowEvent };

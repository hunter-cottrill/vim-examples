/**
 * Local types for the learning app. Only vim-client.ts imports from the SDK;
 * everything else — the hook, the panel, the harness — depends on these.
 */

/** Anything fetched on demand is in exactly one of these states. */
export type Loadable<T> =
  | { kind: 'idle' }
  | { kind: 'loading' }
  | { kind: 'loaded'; data: T }
  | { kind: 'unsupported' }
  | { kind: 'error'; message: string };

/** Module 2 — what the current session supports, read from the manifest. */
export interface SessionSummary {
  events: string[];
  contexts: string[];
  entities: string[];
  writable: string[];
}

/** Module 3 — one entry in the event log. */
export interface EventEntry {
  type: string;
  at: string;
}

/** Module 5 — the patient in view, reduced to what the panel shows. */
export interface PatientCard {
  name: string | null;
  mrn: string | null;
  ehrPatientId: string | null;
}

export interface ProblemRow {
  code: string | null;
  description: string | null;
}

/** Module 6 — whether this session can write to the encounter. */
export interface WritebackCheck {
  available: boolean;
  permissionState: string | null;
  reason: string | null;
}

export type WriteResult = 'written' | 'denied' | 'unavailable' | 'failed';

/**
 * Thrown by a function whose module hasn't been built yet. The panel catches
 * it and shows "Not built yet" for that module, so the app runs from the very
 * first step and fills in as each module is completed.
 */
export class NotBuiltError extends Error {
  constructor(public readonly module: number) {
    super(`Not built yet — this is Module ${module}.`);
    this.name = 'NotBuiltError';
  }
}

/**
 * Check by name, not instanceof: a class check fails when two copies of a
 * module are loaded (tests that reset modules do this). It's the same reason
 * SDK errors are checked by err.code rather than instanceof SDKError.
 */
export function isNotBuilt(err: unknown): err is NotBuiltError {
  return err instanceof Error && err.name === 'NotBuiltError';
}

/** Module 9 — how long to wait before notifying about the same patient again. */
export const NOTIFY_THROTTLE_MS = 30_000;

/** Module 9 — whether the Worker should notify, and if not, why not. */
export type NotifyDecision =
  | { notify: true }
  | { notify: false; reason: 'panel_open' | 'throttled' };

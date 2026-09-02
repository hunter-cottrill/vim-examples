/**
 * Tracks whether a patient is present in EITHER patient-scoped context key,
 * and reports only a genuine present-to-absent transition.
 *
 * SDK-free and timer-injectable so the whole thing is unit-testable offline.
 *
 * WHY THE SETTLE DELAY. Opening an encounter from inside a chart empties
 * chart_open:patient while encounter_open:patient populates — the patient has
 * NOT left. The two updates arrive as separate callbacks and the reference
 * does not promise an order, so between them both keys can be momentarily
 * absent. Firing on that instant would tear down in-flight work every time a
 * provider opens an encounter, which is a worse bug than the stale panel this
 * tracker exists to prevent. So an all-absent reading must survive a short
 * settle window before it counts as a teardown.
 */
export const PRESENCE_SETTLE_MS = 150;

export type PresenceKey = 'chart' | 'encounter';

export interface Scheduler {
  /** Runs fn after ms. Returns a cancel function. */
  schedule(fn: () => void, ms: number): () => void;
}

const realScheduler: Scheduler = {
  schedule(fn, ms) {
    const handle = setTimeout(fn, ms);
    return () => clearTimeout(handle);
  },
};

export interface PresenceTracker {
  set(key: PresenceKey, present: boolean): void;
  /** Cancels any pending settle. Call from the subscription cleanup. */
  dispose(): void;
}

export interface PresenceHandlers {
  /**
   * Fires on a genuine absent-to-present transition. This is the mount
   * fallback: chart_open is a one-shot workflow event, so a panel that opens
   * after the chart did will never see it. The context key is the only signal
   * that reports current state rather than a moment.
   */
  onPresent: () => void;
  /** Fires on a genuine present-to-absent transition, after the settle window. */
  onCleared: () => void;
}

export function createPresenceTracker(
  handlers: PresenceHandlers,
  settleMs: number = PRESENCE_SETTLE_MS,
  scheduler: Scheduler = realScheduler,
): PresenceTracker {
  const present: Record<PresenceKey, boolean> = { chart: false, encounter: false };
  let wasPresent = false;
  let cancelPending: (() => void) | null = null;

  function clearPending(): void {
    if (cancelPending) {
      cancelPending();
      cancelPending = null;
    }
  }

  return {
    set(key, isPresent) {
      present[key] = isPresent;

      if (present.chart || present.encounter) {
        // Presence restored (or never lost) — any pending teardown was the
        // gap between two context updates, not a departure.
        clearPending();
        const wasAbsent = !wasPresent;
        wasPresent = true;
        if (wasAbsent) handlers.onPresent();
        return;
      }

      // Nothing has ever been present: this is startup or context churn, not
      // a departure. Firing here would reset the panel spuriously.
      if (!wasPresent) return;
      if (cancelPending) return;

      cancelPending = scheduler.schedule(() => {
        cancelPending = null;
        if (present.chart || present.encounter) return;
        wasPresent = false;
        handlers.onCleared();
      }, settleMs);
    },

    dispose() {
      clearPending();
    },
  };
}

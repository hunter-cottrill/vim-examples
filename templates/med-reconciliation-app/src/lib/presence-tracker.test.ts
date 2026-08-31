import { describe, expect, it, vi } from 'vitest';
import { createPresenceTracker, type Scheduler } from './presence-tracker';

/** Manual scheduler so the settle window is driven explicitly, with no timers. */
function manualScheduler() {
  const pending: Array<{ fn: () => void; cancelled: boolean }> = [];
  const scheduler: Scheduler = {
    schedule(fn) {
      const entry = { fn, cancelled: false };
      pending.push(entry);
      return () => {
        entry.cancelled = true;
      };
    },
  };
  return {
    scheduler,
    settle() {
      const due = pending.splice(0, pending.length);
      due.filter((entry) => !entry.cancelled).forEach((entry) => entry.fn());
    },
    pendingCount: () => pending.filter((entry) => !entry.cancelled).length,
  };
}

describe('createPresenceTracker', () => {
  it('fires once the patient leaves both context keys', () => {
    const onCleared = vi.fn();
    const clock = manualScheduler();
    const tracker = createPresenceTracker(onCleared, 150, clock.scheduler);

    tracker.set('chart', true);
    tracker.set('chart', false);
    expect(onCleared).not.toHaveBeenCalled(); // still inside the settle window

    clock.settle();
    expect(onCleared).toHaveBeenCalledTimes(1);
  });

  it('does NOT fire when an encounter opens from inside a chart', () => {
    // The interleaving the SDK actually produces: chart empties, encounter
    // populates. The patient has not left.
    const onCleared = vi.fn();
    const clock = manualScheduler();
    const tracker = createPresenceTracker(onCleared, 150, clock.scheduler);

    tracker.set('chart', true);
    tracker.set('chart', false);
    tracker.set('encounter', true);
    clock.settle();

    expect(onCleared).not.toHaveBeenCalled();
  });

  it('does NOT fire when the two updates arrive in the other order', () => {
    const onCleared = vi.fn();
    const clock = manualScheduler();
    const tracker = createPresenceTracker(onCleared, 150, clock.scheduler);

    tracker.set('chart', true);
    tracker.set('encounter', true);
    tracker.set('chart', false);
    clock.settle();

    expect(onCleared).not.toHaveBeenCalled();
  });

  it('never fires when nothing was ever present, however much churn arrives', () => {
    const onCleared = vi.fn();
    const clock = manualScheduler();
    const tracker = createPresenceTracker(onCleared, 150, clock.scheduler);

    tracker.set('chart', false);
    tracker.set('encounter', false);
    tracker.set('chart', false);
    clock.settle();

    expect(onCleared).not.toHaveBeenCalled();
    expect(clock.pendingCount()).toBe(0);
  });

  it('fires again on a second visit, not just the first', () => {
    const onCleared = vi.fn();
    const clock = manualScheduler();
    const tracker = createPresenceTracker(onCleared, 150, clock.scheduler);

    tracker.set('chart', true);
    tracker.set('chart', false);
    clock.settle();

    tracker.set('chart', true);
    tracker.set('chart', false);
    clock.settle();

    expect(onCleared).toHaveBeenCalledTimes(2);
  });

  it('collapses repeated absent readings into a single teardown', () => {
    const onCleared = vi.fn();
    const clock = manualScheduler();
    const tracker = createPresenceTracker(onCleared, 150, clock.scheduler);

    tracker.set('chart', true);
    tracker.set('chart', false);
    tracker.set('encounter', false);
    tracker.set('chart', false);
    clock.settle();

    expect(onCleared).toHaveBeenCalledTimes(1);
  });

  it('cancels a pending teardown when disposed', () => {
    const onCleared = vi.fn();
    const clock = manualScheduler();
    const tracker = createPresenceTracker(onCleared, 150, clock.scheduler);

    tracker.set('chart', true);
    tracker.set('chart', false);
    tracker.dispose();
    clock.settle();

    expect(onCleared).not.toHaveBeenCalled();
  });
});

/**
 * These tests back the Module 4 "break it" exercises: each one proves the
 * behaviour the learner is told they'll see in the simulator.
 */
import { describe, expect, it, vi } from 'vitest';
import { createPresenceTracker, PRESENCE_SETTLE_MS } from './presence-tracker';

function setup() {
  vi.useFakeTimers();
  const onPresent = vi.fn();
  const onCleared = vi.fn();
  const tracker = createPresenceTracker({ onPresent, onCleared });
  return { tracker, onPresent, onCleared };
}

describe('patient presence (Module 4)', () => {
  it('reports presence as soon as the chart key fills in', () => {
    const { tracker, onPresent } = setup();
    tracker.set('chart', true);
    expect(onPresent).toHaveBeenCalledTimes(1);
  });

  it('does NOT report the patient leaving when they move from chart to encounter', () => {
    const { tracker, onCleared } = setup();
    tracker.set('chart', true);
    // Opening an encounter: chart empties, then encounter fills in.
    tracker.set('chart', false);
    tracker.set('encounter', true);
    vi.advanceTimersByTime(PRESENCE_SETTLE_MS * 2);
    expect(onCleared).not.toHaveBeenCalled();
  });

  it('survives the two keys updating in the opposite order', () => {
    const { tracker, onCleared } = setup();
    tracker.set('chart', true);
    tracker.set('encounter', true);
    tracker.set('chart', false);
    vi.advanceTimersByTime(PRESENCE_SETTLE_MS * 2);
    expect(onCleared).not.toHaveBeenCalled();
  });

  it('reports the patient leaving only once both keys are empty, after the settle window', () => {
    const { tracker, onCleared } = setup();
    tracker.set('chart', true);
    tracker.set('chart', false);
    expect(onCleared).not.toHaveBeenCalled(); // still settling
    vi.advanceTimersByTime(PRESENCE_SETTLE_MS);
    expect(onCleared).toHaveBeenCalledTimes(1);
  });

  it('does not re-report presence while the patient stays on screen', () => {
    const { tracker, onPresent } = setup();
    tracker.set('chart', true);
    tracker.set('encounter', true);
    tracker.set('chart', false);
    expect(onPresent).toHaveBeenCalledTimes(1);
  });
});

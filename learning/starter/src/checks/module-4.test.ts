import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { PRESENCE_SETTLE_MS } from '../lib/presence-tracker';
import { loadClient, unlessNotBuilt } from './harness';

beforeEach(() => vi.useFakeTimers());
afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllEnvs();
});

it('Module 4 — an event alone does not mean a patient is present', async ({ skip }) => {
  const client = await loadClient();
  await unlessNotBuilt(skip, () => {
    const onPresent = vi.fn();
    client.onPatientPresence(onPresent, vi.fn());
    client.simulateEvent('chart_open');
    expect(onPresent).not.toHaveBeenCalled();
  });
});

it('Module 4 — moving from chart to encounter does not count as leaving', async ({ skip }) => {
  const client = await loadClient();
  await unlessNotBuilt(skip, () => {
    const onCleared = vi.fn();
    client.onPatientPresence(vi.fn(), onCleared);
    client.simulateContext('chart', 0);
    client.simulateContext('chart', null);
    client.simulateContext('encounter', 0);
    vi.advanceTimersByTime(PRESENCE_SETTLE_MS * 2);
    expect(onCleared).not.toHaveBeenCalled();
  });
});

it('Module 4 — leaving both chart and encounter counts as leaving', async ({ skip }) => {
  const client = await loadClient();
  await unlessNotBuilt(skip, () => {
    const onCleared = vi.fn();
    client.onPatientPresence(vi.fn(), onCleared);
    client.simulateContext('chart', 0);
    client.simulateContext('chart', null);
    vi.advanceTimersByTime(PRESENCE_SETTLE_MS * 2);
    expect(onCleared).toHaveBeenCalledTimes(1);
  });
});

import { afterEach, expect, it, vi } from 'vitest';
import { NOTIFY_THROTTLE_MS } from '../lib/learning-types';
import { loadWorker, unlessNotBuilt } from './harness';

afterEach(() => vi.unstubAllEnvs());

it('Module 9 — never notifies while the panel is open', async ({ skip }) => {
  const worker = await loadWorker();
  await unlessNotBuilt(skip, () => {
    expect(worker.decideNotification({ panelOpen: true, lastNotifiedAt: undefined, now: 0 })).toEqual({ notify: false, reason: 'panel_open' });
  });
});

it('Module 9 — notifies with the panel closed, then throttles repeats for the same patient', async ({ skip }) => {
  const worker = await loadWorker();
  await unlessNotBuilt(skip, () => {
    expect(worker.decideNotification({ panelOpen: false, lastNotifiedAt: undefined, now: 1000 })).toEqual({ notify: true });
    expect(worker.decideNotification({ panelOpen: false, lastNotifiedAt: 1000, now: 1000 + NOTIFY_THROTTLE_MS - 1 })).toEqual({ notify: false, reason: 'throttled' });
    expect(worker.decideNotification({ panelOpen: false, lastNotifiedAt: 1000, now: 1000 + NOTIFY_THROTTLE_MS })).toEqual({ notify: true });
  });
});

it('Module 9 — the running Worker hears chart_open with the panel closed, and stays quiet with it open', async ({ skip }) => {
  const worker = await loadWorker();
  await unlessNotBuilt(skip, async () => {
    await worker.startWorker({ accessToken: 'simulator', idToken: 'simulator' });
    worker.setSimPanelOpen(false);
    expect(await worker.simulateWorkerEvent('chart_open', 'sim-1001')).toEqual([{ notify: true }]);
    expect(await worker.simulateWorkerEvent('chart_open', 'sim-1001')).toEqual([{ notify: false, reason: 'throttled' }]);
    worker.setSimPanelOpen(true);
    expect(await worker.simulateWorkerEvent('chart_open', 'sim-1002')).toEqual([{ notify: false, reason: 'panel_open' }]);
    expect(worker.simulatedNotifications()).toHaveLength(1);
  });
});

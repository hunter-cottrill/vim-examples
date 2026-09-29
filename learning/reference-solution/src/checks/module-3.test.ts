import { afterEach, expect, it, vi } from 'vitest';
import { loadClient, unlessNotBuilt } from './harness';

afterEach(() => vi.unstubAllEnvs());

it('Module 3 — delivers events to subscribers, and stops after unsubscribing', async ({ skip }) => {
  const client = await loadClient();
  await unlessNotBuilt(skip, () => {
    const seen: string[] = [];
    const off = client.onWorkflowEvent((t) => seen.push(t));
    expect(client.simulateEvent('chart_open')).toBe(1); // the harness shows "delivered"
    off();
    expect(client.simulateEvent('encounter_open')).toBe(0); // and "nothing listening" after unsubscribing
    expect(seen).toEqual(['chart_open']);
  });
});

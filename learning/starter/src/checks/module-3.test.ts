import { afterEach, expect, it, vi } from 'vitest';
import { loadClient, unlessNotBuilt } from './harness';

afterEach(() => vi.unstubAllEnvs());

it('Module 3 — delivers events to subscribers, and stops after unsubscribing', async ({ skip }) => {
  const client = await loadClient();
  await unlessNotBuilt(skip, () => {
    const seen: string[] = [];
    const off = client.onWorkflowEvent((t) => seen.push(t));
    client.simulateEvent('chart_open');
    off();
    client.simulateEvent('encounter_open');
    expect(seen).toEqual(['chart_open']);
  });
});

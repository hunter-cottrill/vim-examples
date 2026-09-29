/**
 * Not a module check — this always runs. It proves the simulator's feedback is
 * honest: with nothing subscribed, every signal reports that nothing received it.
 */
import { afterEach, expect, it, vi } from 'vitest';
import { loadClient } from './harness';

afterEach(() => vi.unstubAllEnvs());

it('simulator — reports zero listeners when nothing has subscribed', async () => {
  const client = await loadClient();
  expect(client.simulateEvent('chart_open')).toBe(0);
  expect(client.simulateContext('chart', 0)).toBe(0);
  expect(client.simulateContext('chart', null)).toBe(0);
});

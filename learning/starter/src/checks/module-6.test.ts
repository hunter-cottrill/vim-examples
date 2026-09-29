import { afterEach, expect, it, vi } from 'vitest';
import { loadClient, unlessNotBuilt } from './harness';

afterEach(() => vi.unstubAllEnvs());

it('Module 6 — checks capability, then appends a note', async ({ skip }) => {
  const client = await loadClient();
  await unlessNotBuilt(skip, async () => {
    expect(client.checkEncounterWriteback().available).toBe(true);
    expect(await client.appendEncounterNote('Reviewed with patient')).toBe('written');
    expect(client.simulatedWrites()).toEqual(['Reviewed with patient']);
  });
});

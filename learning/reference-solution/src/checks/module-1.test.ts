import { afterEach, expect, it, vi } from 'vitest';
import { loadClient, unlessNotBuilt } from './harness';

afterEach(() => vi.unstubAllEnvs());

it('Module 1 — returns cleanly in the simulator, where there is no session to start', async ({ skip }) => {
  const client = await loadClient();
  await unlessNotBuilt(skip, async () => {
    // Called directly, not via expect().resolves, so a NotBuiltError reaches
    // unlessNotBuilt and skips the check instead of failing it.
    expect(await client.connectToVim('simulator')).toBeUndefined();
  });
});

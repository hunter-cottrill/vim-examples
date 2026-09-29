import { afterEach, expect, it, vi } from 'vitest';
import { loadClient, unlessNotBuilt } from './harness';

afterEach(() => vi.unstubAllEnvs());

it('Module 2 — summarises what the session supports from the manifest', async ({ skip }) => {
  const client = await loadClient();
  await unlessNotBuilt(skip, () => {
    const session = client.describeSession();
    expect(session.events).toContain('chart_open');
    expect(session.contexts).toContain('encounter_open:patient');
    expect(session.writable).toEqual(['encounter']);
  });
});

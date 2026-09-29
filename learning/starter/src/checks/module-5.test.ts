import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { loadClient, unlessNotBuilt } from './harness';

beforeEach(() => vi.useFakeTimers({ shouldAdvanceTime: true }));
afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllEnvs();
});

it('Module 5 — reads a full patient record', async ({ skip }) => {
  const client = await loadClient();
  await unlessNotBuilt(skip, async () => {
    client.simulateContext('chart', 0);
    expect(await client.fetchPatient()).toEqual({
      kind: 'loaded',
      data: { name: 'Ada Morales', mrn: 'MRN-1001', ehrPatientId: 'sim-1001' },
    });
  });
});

it('Module 5 — copes with a sparse record: missing fields become null, not a crash', async ({ skip }) => {
  const client = await loadClient();
  await unlessNotBuilt(skip, async () => {
    client.simulateContext('chart', 1);
    expect(await client.fetchPatient()).toEqual({
      kind: 'loaded',
      data: { name: null, mrn: null, ehrPatientId: 'sim-1002' },
    });
    expect(await client.fetchProblems()).toEqual({ kind: 'loaded', data: [{ code: 'J45.909', description: null }] });
  });
});

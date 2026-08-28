import { describe, expect, it } from 'vitest';
import type { PriorAuthJob } from './types';
import { computeJobStatus } from './jobResolution';

function job(overrides: Partial<PriorAuthJob> = {}): PriorAuthJob {
  return {
    requestId: 'req-1',
    ehrOrderId: 'order-1',
    payerId: 'aetna',
    cpt: '72148',
    createdAt: 1000,
    resolvesAt: 5000,
    resolution: { status: 'approved', authNumber: 'PA-ABCD1234' },
    ...overrides,
  };
}

describe('computeJobStatus', () => {
  it('returns pending before resolvesAt', () => {
    expect(computeJobStatus(job(), 4999)).toEqual({ requestId: 'req-1', status: 'pending' });
  });

  it('reveals the approved resolution at resolvesAt', () => {
    expect(computeJobStatus(job(), 5000)).toEqual({ requestId: 'req-1', status: 'approved', authNumber: 'PA-ABCD1234' });
  });

  it('reveals the denied resolution after resolvesAt', () => {
    const denied = job({ resolution: { status: 'denied', denialReason: 'Not medically necessary.' } });
    expect(computeJobStatus(denied, 6000)).toEqual({
      requestId: 'req-1',
      status: 'denied',
      denialReason: 'Not medically necessary.',
    });
  });
});

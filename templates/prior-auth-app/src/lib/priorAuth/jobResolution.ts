import type { PriorAuthJob, PriorAuthStatusResponse } from './types';

/**
 * Pure boundary check — takes `nowMs` as a parameter rather than calling
 * Date.now() itself, so the pending/resolved boundary is testable without a
 * real clock. The job's `resolution` is precomputed at creation time (see
 * src/lib/server/priorAuthJobStore.ts); this only decides whether it may be
 * revealed yet.
 */
export function computeJobStatus(job: PriorAuthJob, nowMs: number): PriorAuthStatusResponse {
  if (nowMs < job.resolvesAt) {
    return { requestId: job.requestId, status: 'pending' };
  }
  if (job.resolution.status === 'approved') {
    return { requestId: job.requestId, status: 'approved', authNumber: job.resolution.authNumber };
  }
  return { requestId: job.requestId, status: 'denied', denialReason: job.resolution.denialReason };
}

import type { PriorAuthJob } from '@/lib/priorAuth/types';

/**
 * In-memory job store for simulated PA adjudication. Pinned to `globalThis`
 * because a bare module-level Map does not survive Next.js route
 * re-instantiation in dev or serverless deployments (see build plan §6). Only
 * app-generated workflow state is kept here — no diagnosis codes or
 * clinical-justification text outlive the single POST request that creates a
 * job (see PriorAuthSubmissionRequest in src/lib/priorAuth/types.ts).
 */
declare global {
  // eslint-disable-next-line no-var
  var __priorAuthJobs: Map<string, PriorAuthJob> | undefined;
}

function jobs(): Map<string, PriorAuthJob> {
  globalThis.__priorAuthJobs ??= new Map<string, PriorAuthJob>();
  return globalThis.__priorAuthJobs;
}

export function saveJob(job: PriorAuthJob): void {
  jobs().set(job.requestId, job);
}

export function getJob(requestId: string): PriorAuthJob | undefined {
  return jobs().get(requestId);
}

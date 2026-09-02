import type { PageStatus, TransitionSummary } from './types';

/**
 * 'connecting' and 'error' are lifecycle states the page component assigns
 * directly (SDK init, OAuth failure, or a patient fetch that itself failed) —
 * this function never returns them. `patientContextPresent` answers "is a
 * patient's chart currently in view this session" (from chart_open / the
 * dual-context presence tracker) — a different question from the
 * hospitalization lookup's own patientKey (the MRN/EHR id used to query the
 * bundled dataset), which can be null even while a patient is present.
 */
export function derivePageStatus(patientContextPresent: boolean, summary: TransitionSummary | null): PageStatus {
  if (!patientContextPresent || !summary) return { kind: 'waiting' };
  return { kind: 'result', summary };
}

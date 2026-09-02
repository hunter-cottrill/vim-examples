import { RECENCY_WINDOW_DAYS } from './constants';
import type { HospitalizationLookupResult, HospitalizationRecord, PatientSnapshot } from './types';

/**
 * The identifier used to look up a hospitalization record. Never invented —
 * null means the chart genuinely carries no MRN or EHR patient id, which the
 * caller must surface as HospitalizationLookupResult.unavailable rather than
 * ever calling the backend with a fabricated key.
 */
export function resolvePatientKey(patient: PatientSnapshot): string | null {
  return patient.patientKey;
}

function daysBetween(earlierIso: string, laterIso: string): number {
  const earlier = new Date(earlierIso).getTime();
  const later = new Date(laterIso).getTime();
  return Math.round((later - earlier) / (1000 * 60 * 60 * 24));
}

/**
 * Turns a raw backend answer into the lookup result the UI renders.
 *
 * Only ever called after a patientKey was resolved and the backend call
 * succeeded — 'unavailable' (no key to look up) and 'error' (the backend call
 * itself failed) are assigned by the caller, not this function.
 */
export function evaluateHospitalization(
  record: HospitalizationRecord | null,
  nowIso: string,
  windowDays: number = RECENCY_WINDOW_DAYS,
): HospitalizationLookupResult {
  if (record === null) return { kind: 'not_found' };
  const daysSinceDischarge = daysBetween(record.dischargeDate, nowIso);
  if (daysSinceDischarge > windowDays) return { kind: 'not_found' };
  return { kind: 'found', record, daysSinceDischarge };
}

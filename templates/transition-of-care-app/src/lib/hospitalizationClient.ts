import type { HospitalizationRecord } from './transition/types';

/**
 * Client-side fetch against this app's own /api/hospitalization route. Used
 * as-is by both the real app and the dev harness — the harness calls the
 * real route with fixture-chosen patient keys rather than mocking this
 * function, since the bundled dataset behind the route already exists to
 * serve both. Throws on a network/server failure; the caller turns that into
 * HospitalizationLookupResult.error.
 */
export async function fetchHospitalizationRecord(patientKey: string): Promise<HospitalizationRecord | null> {
  const response = await fetch(`/api/hospitalization?patientKey=${encodeURIComponent(patientKey)}`);
  if (!response.ok) {
    throw new Error(`Hospitalization lookup failed with status ${response.status}`);
  }
  const body = (await response.json()) as { record: HospitalizationRecord | null };
  return body.record;
}

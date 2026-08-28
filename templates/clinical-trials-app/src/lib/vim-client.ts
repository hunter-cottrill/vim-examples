/**
 * UI-surface Vim SDK connection layer. This is the ONLY file that imports
 * @vimconnect/app-sdk for the UI app — everything else (domain logic, state
 * machine, components) depends only on the narrow local types in
 * src/lib/trial-match/types.ts, never on the SDK's own types.
 */
import { initVimSDK, getVimSDK, type VimSDK, type Patient } from '@vimconnect/app-sdk';
import { retryWithBackoff } from './retry';
import { extractPatientId, hasUsableSignal, toPatientContext } from './patient-mapping';
import { RETRY_DELAYS_MS } from './trial-match/constants';
import type { PatientContext } from './trial-match/types';

/** Initialize the SDK with an access token and mark the app ENABLED in the Hub. */
export async function initSdk(accessToken: string): Promise<VimSDK> {
  const sdk = await initVimSDK({ accessToken });
  sdk.hub.setActivationStatus('ENABLED');
  return sdk;
}

export function requireSdk(): VimSDK {
  const sdk = getVimSDK();
  if (!sdk) throw new Error('SDK not initialized — call initSdk(token) first.');
  return sdk;
}

/** Subscribe to the chart_open workflow event. Returns an unsubscribe function. */
export function onChartOpen(cb: (patient: Patient, patientId: string) => void): () => void {
  const sdk = requireSdk();
  return sdk.ehr.workflow.on('chart_open', (event) => {
    const patient = event.entities.patient;
    cb(patient, extractPatientId(patient));
  });
}

/**
 * Subscribe to the patient leaving chart context (provider navigates away
 * from the chart). There is no "chart closed" workflow event — chart_open is
 * one-shot and only fires on open — so this is detected via the
 * chart_open:patient context key transitioning from populated to empty.
 *
 * Deliberately does NOT try to report which patient closed: the context
 * payload is a Partial<Patient> and isn't guaranteed to carry `identifiers`,
 * unlike the workflow event's inline patient. An earlier version tried to
 * extract one and fall back to a sentinel when absent, which meant a real
 * close event could never be matched against the tracked patientId and
 * silently no-opped. The bare signal is sufficient: chart_open:patient only
 * transitions from populated to empty when a chart genuinely closes, and the
 * SDK bridge delivers events over a single ordered channel, so a close for
 * patient A can't arrive after patient B's chart has already opened.
 */
export function onChartClosed(cb: () => void): () => void {
  const sdk = requireSdk();
  return sdk.ehr.context.onChange('chart_open:patient', (previousData, currentData) => {
    if (previousData && !currentData) cb();
  });
}

async function unwrap<T>(call: Promise<{ success: boolean; data: T }>): Promise<T> {
  const response = await call;
  if (!response.success) throw new Error('Entity API call returned success: false');
  return response.data;
}

/**
 * Build a PatientContext for the given patient. Prefers the Entity API
 * (fresher, retried with backoff for the ENTITY_NOT_IN_CONTEXT cache race
 * right after chart_open fires); falls back to whatever chart_open carried
 * inline only if the Entity API is exhausted AND the fallback has some
 * usable signal. Throws (surfacing a retryable error) only when neither
 * source produces anything to evaluate.
 */
export async function fetchPatientContext(patientId: string, fallbackPatient: Patient): Promise<PatientContext> {
  const sdk = requireSdk();

  try {
    const [patient, problems] = await Promise.all([
      retryWithBackoff(() => unwrap(sdk.ehr.api.patient.getPatient()), RETRY_DELAYS_MS),
      retryWithBackoff(() => unwrap(sdk.ehr.api.patient.getProblems()), RETRY_DELAYS_MS),
    ]);
    return toPatientContext(patient, patientId, problems);
  } catch {
    const fallback = toPatientContext(fallbackPatient, patientId, fallbackPatient.problems ?? []);
    if (!hasUsableSignal(fallback)) {
      throw new Error('Could not read patient data from the Entity API or the chart_open event after retrying.');
    }
    return fallback;
  }
}

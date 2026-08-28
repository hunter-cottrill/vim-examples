/**
 * UI-surface Vim SDK connection layer. This is the ONLY file that imports
 * @vimconnect/app-sdk for the UI app — everything else (domain logic, state
 * machines, components) depends only on the narrow local types in
 * src/lib/sdoh/*, never on the SDK's own types.
 *
 * Unlike v1 sdoh-app's sdk-invoke.ts, this file calls the SDK's typed
 * surface directly rather than through a dynamic-dispatch guard layer — the
 * installed @vimconnect/app-sdk@0.4.56 .d.ts fully types sdk.ehr.api.* and
 * sdk.ehr.context.* statically, so there's no runtime string indexing left
 * to guard against.
 */
import { initVimSDK, getVimSDK, type VimSDK, type Patient } from '@vimconnect/app-sdk';
import { retryWithBackoff } from './retry';
import { extractPatientId, hasUsableSignal, toPatientContext } from './patient-mapping';
import type { PatientContext } from './sdoh/types';
import type { WritebackOutcome } from './sdoh/writeback-state';

const RETRY_DELAYS_MS = [200, 500, 1000];

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
 * Subscribe to the patient leaving context. Workflow events fire on entry only —
 * there is no chart_close — so the teardown signal comes from the context key
 * going empty. Don't try to identify which patient left: the closing payload is
 * partial and may carry no identifiers. The transition to empty is the signal.
 */
export function onChartClosed(cb: () => void): () => void {
  const sdk = requireSdk();
  return sdk.ehr.context.onChange('chart_open:patient', (_prev, curr) => {
    if (!curr) cb();
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
    const [patient, insurances, problems] = await Promise.all([
      retryWithBackoff(() => unwrap(sdk.ehr.api.patient.getPatient()), RETRY_DELAYS_MS),
      retryWithBackoff(() => unwrap(sdk.ehr.api.patient.getInsurances()), RETRY_DELAYS_MS),
      retryWithBackoff(() => unwrap(sdk.ehr.api.patient.getProblems()), RETRY_DELAYS_MS),
    ]);
    return toPatientContext(patient, patientId, insurances, problems);
  } catch {
    const fallback = toPatientContext(fallbackPatient, patientId, fallbackPatient.insurances ?? [], fallbackPatient.problems ?? []);
    if (!hasUsableSignal(fallback)) {
      throw new Error('Could not read patient data from the Entity API or the chart_open event after retrying.');
    }
    return fallback;
  }
}

/** Read a tapped Worker notification's launchPayload, if the UI was opened that way. */
export function consumeLaunchPayload(): Record<string, unknown> | null {
  const sdk = requireSdk();
  return sdk.consumeLaunchContext()?.launchPayload ?? null;
}

/**
 * Write SDOH Z-codes to the encounter as diagnoses, gated by the permission
 * ceremony: getCapability('update') -> requestPermission -> hasPermission ->
 * update(). update() takes a NESTED object; mode 'append' preserves existing
 * diagnoses. This is the only confirmed writable target for these codes —
 * there is no problem-list write.
 */
export async function writeZCodes(codes: Array<{ code: string; description: string }>): Promise<WritebackOutcome> {
  const sdk = requireSdk();
  const encounterWriteback = sdk.ehr.context.encounter;

  const capability = encounterWriteback.getCapability('update');
  if (!capability.available) return { ok: false, reason: 'not_configured' };

  try {
    if (capability.disruptive && capability.permissionState === 'requestable') {
      const result = await encounterWriteback.requestPermission('update', { fields: ['assessment.diagnoses'] });
      if (result === 'denied') return { ok: false, reason: 'denied' };
    }
    if (!encounterWriteback.hasPermission('update')) return { ok: false, reason: 'denied' };

    await encounterWriteback.update(
      { assessment: { diagnoses: codes.map((c) => ({ code: c.code, description: c.description })) } },
      { mode: 'append' },
    );
    return { ok: true };
  } catch (err) {
    const detail = err instanceof Error ? err.message : String(err);
    return { ok: false, reason: 'error', detail };
  }
}

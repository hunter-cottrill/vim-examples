/**
 * Thin SDK client — the ONLY module in this app that imports runtime values
 * from @vimconnect/app-sdk. Everything downstream (domain logic, UI) depends
 * only on the local types in src/lib/transition/types.ts.
 *
 * It also holds the dev-simulator seam. NEXT_PUBLIC_SIM_MODE is inlined as a
 * build-time literal by Next.js, so with the flag unset SIM_MODE collapses to
 * the literal `false` and every SIM branch below is eliminated by the
 * bundler. The simulator feeds RAW SDK-shaped payloads (Patient/Diagnosis[]/
 * Medication[]) in at this boundary so they pass through the exact same
 * retryEntityFetch + mapping code the live path uses — it never dispatches a
 * pre-built SectionStatus or TransitionSummary directly.
 */
import { getVimSDK, initVimSDK, type Diagnosis, type Medication, type Patient, type VimSDK } from '@vimconnect/app-sdk';
import { retryEntityFetch, type RetryOutcome } from './retry';
import { createPresenceTracker, type PresenceKey } from './presence-tracker';
import type { MedicationEntry, PatientSnapshot, ProblemEntry, SectionStatus } from './transition/types';

const SIM_MODE = process.env.NEXT_PUBLIC_SIM_MODE === 'true';

// --- Connection ---

export async function initSdk(accessToken: string): Promise<VimSDK> {
  const sdk = await initVimSDK({ accessToken });
  sdk.hub.setActivationStatus('ENABLED');
  return sdk;
}

function requireSdk(): VimSDK {
  const sdk = getVimSDK();
  if (!sdk) throw new Error('SDK not initialized — call initSdk(token) first.');
  return sdk;
}

// --- Mapping (pure translation, no I/O) ---

function joinName(firstName?: string, lastName?: string): string | null {
  const name = [firstName, lastName].filter(Boolean).join(' ');
  return name.length > 0 ? name : null;
}

export function toPatientSnapshot(patient: Patient): PatientSnapshot {
  return {
    displayName: joinName(patient.demographics?.firstName, patient.demographics?.lastName),
    patientKey: patient.identifiers?.mrn ?? patient.identifiers?.ehrPatientId ?? null,
  };
}

/**
 * Shared RetryOutcome -> SectionStatus mapping for list-shaped reads
 * (problems/medications) — pulled out so it's directly unit-testable without
 * needing a live or simulated SDK.
 */
export function sectionStatusFromListOutcome<T>(outcome: RetryOutcome<T[]>): SectionStatus<T[]> {
  if (outcome.outcome === 'unsupported') return { kind: 'unsupported' };
  if (outcome.outcome === 'error') return { kind: 'error', message: outcome.message };
  return outcome.data.length === 0 ? { kind: 'empty' } : { kind: 'loaded', data: outcome.data };
}

// --- Simulator seam ---

/**
 * What a fixture stands in for a section's Entity API response. `'error'`
 * simulates retries-exhausted; `'unsupported'` simulates a NOT_IMPLEMENTED
 * EHR. A plain array/object simulates a successful response.
 */
export type SimResult<T> = T | 'error' | 'unsupported';

export interface SimFixture {
  patient: SimResult<Patient>;
  problems: SimResult<Diagnosis[]>;
  medications: SimResult<Medication[]>;
}

let currentFixture: SimFixture | null = null;
const simChartOpenListeners: Array<() => void> = [];
const simPresenceListeners: Array<(key: PresenceKey, present: boolean) => void> = [];

/** DEV-ONLY, no-op unless NEXT_PUBLIC_SIM_MODE === 'true'. */
export function simulateChartOpen(fixture: SimFixture): void {
  if (!SIM_MODE) return;
  currentFixture = fixture;
  simChartOpenListeners.forEach((cb) => cb());
}

/** DEV-ONLY. Drives one of the two patient context keys populated/empty. */
export function simulateContextPresence(key: PresenceKey, present: boolean): void {
  if (!SIM_MODE) return;
  simPresenceListeners.forEach((cb) => cb(key, present));
}

function simFetchOnce<T>(value: SimResult<T> | undefined): () => Promise<{ success: boolean; data?: T }> {
  return async () => {
    if (value === undefined) throw new Error('No simulated chart is open.');
    if (value === 'error') throw new Error('Simulated EHR error.');
    if (value === 'unsupported') throw { code: 'NOT_IMPLEMENTED' };
    return { success: true, data: value };
  };
}

// --- Workflow events (one-shot triggers; no inline fields relied upon —
// Entity API reads below resolve their id from the current context, so
// nothing needs to be extracted from the event payload itself) ---

export function onChartOpen(cb: () => void): () => void {
  if (SIM_MODE) {
    simChartOpenListeners.push(cb);
    return () => {
      const index = simChartOpenListeners.indexOf(cb);
      if (index !== -1) simChartOpenListeners.splice(index, 1);
    };
  }
  return requireSdk().ehr.workflow.on('chart_open', () => cb());
}

/**
 * Fires when the patient leaves EHR context.
 *
 * chart_open is entry-only — there is no chart_close event — so teardown is
 * detected from the context keys emptying. Both patient-scoped keys must be
 * watched, not one: opening an encounter from inside a chart empties
 * chart_open:patient while encounter_open:patient populates, and the patient
 * has not left. Presence is read as Boolean(currentData) only — the closing
 * payload may carry no identifiers at all, so there is nothing to match
 * against; the transition to empty is itself the signal.
 */
export function onPatientPresenceChange(onPresent: () => void, onCleared: () => void): () => void {
  const tracker = createPresenceTracker({ onPresent, onCleared });

  if (SIM_MODE) {
    const listener = (key: PresenceKey, present: boolean) => tracker.set(key, present);
    simPresenceListeners.push(listener);
    return () => {
      const index = simPresenceListeners.indexOf(listener);
      if (index !== -1) simPresenceListeners.splice(index, 1);
      tracker.dispose();
    };
  }

  const sdk = requireSdk();
  const unsubscribeChart = sdk.ehr.context.onChange('chart_open:patient', (_prev, curr) => {
    console.log('[toc] ctx chart_open:patient', Boolean(curr), curr);
    tracker.set('chart', Boolean(curr));
  });
  const unsubscribeEncounter = sdk.ehr.context.onChange('encounter_open:patient', (_prev, curr) => {
    console.log('[toc] ctx encounter_open:patient', Boolean(curr), curr);
    tracker.set('encounter', Boolean(curr));
  });

  return () => {
    unsubscribeChart();
    unsubscribeEncounter();
    tracker.dispose();
  };
}

// --- Entity API reads (on-demand; retried with backoff on transient failure) ---

export async function fetchPatientSnapshot(): Promise<SectionStatus<PatientSnapshot>> {
  const fetchOnce = SIM_MODE ? simFetchOnce(currentFixture?.patient) : () => requireSdk().ehr.api.patient.getPatient();
  const result = await retryEntityFetch<Patient>(fetchOnce);
  if (result.outcome === 'unsupported') return { kind: 'unsupported' };
  if (result.outcome === 'error') return { kind: 'error', message: result.message };
  return { kind: 'loaded', data: toPatientSnapshot(result.data) };
}

export async function fetchProblems(): Promise<SectionStatus<ProblemEntry[]>> {
  const fetchOnce = SIM_MODE ? simFetchOnce(currentFixture?.problems) : () => requireSdk().ehr.api.patient.getProblems();
  return sectionStatusFromListOutcome(await retryEntityFetch<Diagnosis[]>(fetchOnce));
}

export async function fetchMedications(): Promise<SectionStatus<MedicationEntry[]>> {
  const fetchOnce = SIM_MODE ? simFetchOnce(currentFixture?.medications) : () => requireSdk().ehr.api.patient.getMedications();
  return sectionStatusFromListOutcome(await retryEntityFetch<Medication[]>(fetchOnce));
}

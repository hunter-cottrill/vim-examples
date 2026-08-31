'use client';

/**
 * UI-surface Vim SDK connection layer. This is the ONLY file that imports
 * runtime values from @vimconnect/app-sdk for the UI app — everything else
 * (domain logic, state machine, components) depends on the narrow local types
 * in src/lib/med-rec/types.ts, never on the SDK's own surface.
 *
 * It also holds the dev-simulator seam. NEXT_PUBLIC_SIM_MODE is inlined as a
 * build-time literal by Next.js, so with the flag unset SIM_MODE collapses to
 * the literal `false`, every branch below is eliminated by the bundler, and
 * each exported function reduces to exactly its real-SDK body.
 *
 * The simulator feeds RAW SDK-shaped payloads in at this boundary so they pass
 * through the same extraction, mapping and normalisation the live path uses.
 * It never dispatches pre-built domain objects — a harness that hand-builds
 * the value a broken mapper would have produced passes while the app is broken.
 */
import { getVimSDK, initVimSDK, type Patient, type VimSDK } from '@vimconnect/app-sdk';
import { unwrap } from './api-response';
import { RETRY_DELAYS_MS } from './med-rec/constants';
import type { ChartContext } from './med-rec/types';
import {
  extractPatientId,
  resolveChartContext,
  resolveRawChartPayload,
  type RawChartPayload,
} from './entity-mapping';
import { createPresenceTracker, type PresenceKey } from './presence-tracker';
import { retryWithBackoff } from './retry';

const SIM_MODE = process.env.NEXT_PUBLIC_SIM_MODE === 'true';

// ---------------------------------------------------------------------------
// Connection
// ---------------------------------------------------------------------------

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

/**
 * The patient a Worker notification was about, if the app was opened by
 * tapping one. Consume-once by contract; null on every later call and
 * whenever the app was opened normally.
 */
export function consumeLaunchPatientId(): string | null {
  if (SIM_MODE) return null;
  const launch = requireSdk().consumeLaunchContext();
  const patientId = launch?.launchPayload?.patientId;
  return typeof patientId === 'string' ? patientId : null;
}

// ---------------------------------------------------------------------------
// Simulator seam
// ---------------------------------------------------------------------------

/**
 * What a fixture stands in for. `medications`/`problems` are what the Entity
 * API would return; setting either to null simulates the Entity API failing
 * so the chart_open fallback path is exercised for real.
 */
export type SimEntitySource = RawChartPayload;

/**
 * The page receives only a patient id — the raw Patient the event carried is
 * retained here, behind the boundary, purely as the degraded fallback for
 * fetchChartContext. Nothing outside this file ever holds an SDK entity.
 */
type ChartOpenListener = (patientId: string) => void;

let lastChartOpenPatient: { patientId: string; patient: Patient } | null = null;

const simChartOpenListeners: ChartOpenListener[] = [];
const simPresenceListeners: Array<(key: PresenceKey, present: boolean) => void> = [];
let simEntitySource: SimEntitySource | null = null;

/**
 * DEV-ONLY, no-op unless NEXT_PUBLIC_SIM_MODE === 'true'. Fires a raw Patient
 * through the exact listeners onChartOpen() registered — indistinguishable
 * downstream from a real chart_open event.
 */
export function simulateChartOpen(source: SimEntitySource): void {
  if (!SIM_MODE) return;
  simEntitySource = source;
  const patientId = extractPatientId(source.patient);
  lastChartOpenPatient = { patientId, patient: source.patient };
  simChartOpenListeners.forEach((cb) => cb(patientId));
}

/** DEV-ONLY. Drives one of the two patient context keys populated/empty. */
export function simulateContextPresence(key: PresenceKey, present: boolean): void {
  if (!SIM_MODE) return;
  simPresenceListeners.forEach((cb) => cb(key, present));
}

// ---------------------------------------------------------------------------
// Subscriptions
// ---------------------------------------------------------------------------

export function onChartOpen(cb: ChartOpenListener): () => void {
  if (SIM_MODE) {
    simChartOpenListeners.push(cb);
    return () => {
      const index = simChartOpenListeners.indexOf(cb);
      if (index !== -1) simChartOpenListeners.splice(index, 1);
    };
  }

  const sdk = requireSdk();
  return sdk.ehr.workflow.on('chart_open', (event) => {
    const patient = event.entities.patient;
    const patientId = extractPatientId(patient);
    lastChartOpenPatient = { patientId, patient };
    cb(patientId);
  });
}

/**
 * Fires when the patient leaves EHR context.
 *
 * chart_open is entry-only — there is no chart_close event — so teardown is
 * detected from the context keys emptying. Both patient-scoped keys must be
 * watched, not one: opening an encounter from inside a chart empties
 * chart_open:patient while encounter_open:patient populates, and the patient
 * has not left. Watching a single key produces a worse bug than the stale
 * panel it was meant to fix.
 *
 * Presence is read as Boolean(currentData) only. The closing payload is a
 * Partial<Patient> that may carry no identifiers at all, so there is nothing
 * to match against — the transition to empty is itself the signal.
 */
export function onPatientContextCleared(cb: () => void): () => void {
  // The same tracker instance backs both paths, so the simulator exercises
  // the real interleaving logic rather than standing in for it.
  const tracker = createPresenceTracker(cb);

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
    tracker.set('chart', Boolean(curr));
  });
  const unsubscribeEncounter = sdk.ehr.context.onChange('encounter_open:patient', (_prev, curr) => {
    tracker.set('encounter', Boolean(curr));
  });

  return () => {
    unsubscribeChart();
    unsubscribeEncounter();
    tracker.dispose();
  };
}

// ---------------------------------------------------------------------------
// Reads
// ---------------------------------------------------------------------------

/**
 * Read the chart's medication and problem lists for the patient a chart_open
 * event just named.
 *
 * Prefers the Entity API, retried with backoff for the ENTITY_NOT_IN_CONTEXT
 * cache race that can reject in the same tick the event fires. Falls back to
 * whatever chart_open carried inline only when the Entity API is exhausted AND
 * that fallback has something in it — an empty fallback after a failed read is
 * indistinguishable from a failed read, so we raise the error instead of
 * reporting an empty medication list the provider might believe.
 */
export async function fetchChartContext(patientId: string): Promise<ChartContext> {
  if (SIM_MODE) {
    const source = simEntitySource;
    if (!source) throw new Error('No simulated chart is open.');
    // The same resolver the live path uses below, so a fixture exercises the
    // real Entity-API-vs-fallback decision rather than a stand-in for it.
    return resolveRawChartPayload(source);
  }

  // Only usable if it is the same patient the event named — a retained
  // payload from a previous chart must never stand in for this one.
  const eventPatient = lastChartOpenPatient?.patientId === patientId ? lastChartOpenPatient.patient : null;
  const inline = {
    medications: eventPatient?.medications ?? [],
    problems: eventPatient?.problems ?? [],
  };

  const sdk = requireSdk();

  try {
    const [medications, problems] = await Promise.all([
      retryWithBackoff(() => unwrap(sdk.ehr.api.patient.getMedications()), RETRY_DELAYS_MS),
      retryWithBackoff(() => unwrap(sdk.ehr.api.patient.getProblems()), RETRY_DELAYS_MS),
    ]);
    return resolveChartContext(patientId, { medications, problems }, inline);
  } catch {
    return resolveChartContext(patientId, null, inline);
  }
}

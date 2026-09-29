/**
 * The ONLY file in this app that imports runtime values from the Vim SDK.
 * Everything else depends on the local types in learning-types.ts.
 *
 * Each section below is one module of the learning path. When the simulator
 * is on (NEXT_PUBLIC_SIM_MODE=true), every function takes its SIM branch and
 * reads from src/dev/fixtures.ts instead of the EHR — through the same mapping
 * code the live path uses.
 */
import { getVimSDK, initVimSDK, type AppManifest, type Diagnosis, type EventType, type Patient, type VimSDK } from '@vimconnect/app-sdk';
import { createPresenceTracker, type PresenceKey } from './presence-tracker';
import { retryEntityFetch, type RetryOutcome } from './retry';
import type { Loadable, PatientCard, ProblemRow, SessionSummary, WritebackCheck, WriteResult } from './learning-types';
import { SIM_MANIFEST, SIM_PATIENTS, type SimPatient } from '../dev/fixtures';

export const SIM_MODE = process.env.NEXT_PUBLIC_SIM_MODE === 'true';

function requireSdk(): VimSDK {
  const sdk = getVimSDK();
  if (!sdk) throw new Error('Not connected — call connectToVim() first.');
  return sdk;
}

// ─── Simulator state (dev only) ─────────────────────────────────────────────

let simPatient: SimPatient | null = null;
const simEventListeners: Array<(type: string) => void> = [];
const simPresenceListeners: Array<(key: PresenceKey, present: boolean) => void> = [];

/** DEV-ONLY. Fire a workflow event, as the EHR would. */
export function simulateEvent(type: EventType): void {
  if (!SIM_MODE) return;
  simEventListeners.forEach((cb) => cb(type));
}

/** DEV-ONLY. Put a patient in or out of a context key, as the EHR would. */
export function simulateContext(key: PresenceKey, patientIndex: number | null): void {
  if (!SIM_MODE) return;
  if (patientIndex !== null) simPatient = SIM_PATIENTS[patientIndex] ?? null;
  simPresenceListeners.forEach((cb) => cb(key, patientIndex !== null));
}

export const SIM_PATIENT_LABELS = SIM_PATIENTS.map((p) => p.label);

// ─── MODULE 1 · Starting a session ──────────────────────────────────────────

/**
 * Start an SDK session with the access token from the OAuth launch flow,
 * then tell the Vim hub the app is ready.
 */
export async function connectToVim(accessToken: string): Promise<void> {
  if (SIM_MODE) return;
  const sdk = await initVimSDK({ accessToken });
  sdk.hub.setActivationStatus('ENABLED');
}

// ─── MODULE 2 · Checking what's available ───────────────────────────────────

/**
 * Read what this session supports. The manifest is the source of truth —
 * not the type definitions, and not the documentation.
 */
export function describeSession(): SessionSummary {
  const manifest: AppManifest = SIM_MODE ? SIM_MANIFEST : requireSdk().ehr.getManifest();
  return {
    events: manifest.supportedEvents.map((e) => e.id),
    contexts: manifest.supportedContexts.map((c) => c.contextKey),
    entities: manifest.supportedEntities.map((e) => e.type),
    writable: Object.entries(manifest.contextWriteback ?? {})
      .filter(([, entity]) => Boolean(entity?.update))
      .map(([type]) => type),
  };
}

// ─── MODULE 3 · Workflow events ─────────────────────────────────────────────

const ALL_EVENTS: EventType[] = ['chart_open', 'encounter_open', 'referral_start', 'referral_save', 'order_select', 'order_sign'];

/**
 * Report every workflow event by type. An event is a MOMENT and fires once —
 * it carries a reference, not the full record, so we only log what happened.
 */
export function onWorkflowEvent(cb: (type: string) => void): () => void {
  if (SIM_MODE) {
    simEventListeners.push(cb);
    return () => {
      const i = simEventListeners.indexOf(cb);
      if (i !== -1) simEventListeners.splice(i, 1);
    };
  }
  return requireSdk().ehr.workflow.on(ALL_EVENTS, (event) => cb(event.type));
}

// ─── MODULE 4 · Context ─────────────────────────────────────────────────────

/**
 * Report when a patient comes into view and when they leave.
 *
 * Context reports what is true NOW, so this works however the app was opened.
 * Both patient keys are watched: opening an encounter clears chart_open:patient
 * while encounter_open:patient fills in. The tracker treats the patient as gone
 * only when both are empty, after a short settle.
 */
export function onPatientPresence(onPresent: () => void, onCleared: () => void): () => void {
  const tracker = createPresenceTracker({ onPresent, onCleared });

  if (SIM_MODE) {
    const listener = (key: PresenceKey, present: boolean) => tracker.set(key, present);
    simPresenceListeners.push(listener);
    return () => {
      const i = simPresenceListeners.indexOf(listener);
      if (i !== -1) simPresenceListeners.splice(i, 1);
      tracker.dispose();
    };
  }

  const sdk = requireSdk();
  const offChart = sdk.ehr.context.onChange('chart_open:patient', (_prev, curr) => tracker.set('chart', Boolean(curr)));
  const offEncounter = sdk.ehr.context.onChange('encounter_open:patient', (_prev, curr) => tracker.set('encounter', Boolean(curr)));
  return () => {
    offChart();
    offEncounter();
    tracker.dispose();
  };
}

// ─── MODULE 5 · Entity API ──────────────────────────────────────────────────

function toLoadable<T, U>(outcome: RetryOutcome<T>, map: (data: T) => U): Loadable<U> {
  if (outcome.outcome === 'loaded') return { kind: 'loaded', data: map(outcome.data) };
  if (outcome.outcome === 'unsupported') return { kind: 'unsupported' };
  return { kind: 'error', message: outcome.message };
}

/** Every field is optional — read defensively and fall back to null. */
function toPatientCard(patient: Patient): PatientCard {
  const first = patient.demographics?.firstName;
  const last = patient.demographics?.lastName;
  const name = [first, last].filter(Boolean).join(' ');
  return {
    name: name.length > 0 ? name : null,
    mrn: patient.identifiers?.mrn ?? null,
    ehrPatientId: patient.identifiers?.ehrPatientId ?? null,
  };
}

function toProblemRows(problems: Diagnosis[]): ProblemRow[] {
  return problems.map((d) => ({ code: d.code ?? null, description: d.description ?? null }));
}

/**
 * Reads resolve their target from the current context — no id is passed.
 * retryEntityFetch absorbs the brief ENTITY_NOT_IN_CONTEXT race right after
 * a chart opens, and maps NOT_IMPLEMENTED to "unsupported".
 */
export async function fetchPatient(): Promise<Loadable<PatientCard>> {
  const outcome = await retryEntityFetch<Patient>(() =>
    SIM_MODE
      ? Promise.resolve({ success: Boolean(simPatient), data: simPatient?.patient })
      : requireSdk().ehr.api.patient.getPatient(),
  );
  return toLoadable(outcome, toPatientCard);
}

export async function fetchProblems(): Promise<Loadable<ProblemRow[]>> {
  const outcome = await retryEntityFetch<Diagnosis[]>(() =>
    SIM_MODE
      ? Promise.resolve({ success: Boolean(simPatient), data: simPatient?.problems })
      : requireSdk().ehr.api.patient.getProblems(),
  );
  return toLoadable(outcome, toProblemRows);
}

// ─── MODULE 6 · Writeback ───────────────────────────────────────────────────

const simWrites: string[] = [];

/** DEV-ONLY. What the simulator has "written" so far. */
export function simulatedWrites(): string[] {
  return [...simWrites];
}

/**
 * Can this session write to the encounter? The writeback namespace only exists
 * for entity types configured for writeback — so it can be missing at runtime
 * even though the types say it's always there.
 */
export function checkEncounterWriteback(): WritebackCheck {
  if (SIM_MODE) return { available: true, permissionState: 'granted', reason: null };
  const encounter = requireSdk().ehr.context.encounter;
  if (!encounter) return { available: false, permissionState: null, reason: 'No encounter writeback is configured for this session.' };
  const capability = encounter.getCapability('update');
  return {
    available: capability.available,
    permissionState: capability.permissionState ?? null,
    reason: capability.reason ?? null,
  };
}

/**
 * The writeback ceremony: check → request permission if needed → confirm →
 * write, using a nested object. 'append' adds to the note rather than
 * replacing it.
 */
export async function appendEncounterNote(text: string): Promise<WriteResult> {
  if (SIM_MODE) {
    simWrites.push(text);
    return 'written';
  }
  const encounter = requireSdk().ehr.context.encounter;
  if (!encounter) return 'unavailable';

  const capability = encounter.getCapability('update');
  if (!capability.available) return 'unavailable';
  if (capability.permissionState === 'requestable') {
    await encounter.requestPermission('update', { fields: ['plan'] });
  }
  if (!encounter.hasPermission('update')) return 'denied';

  try {
    await encounter.update({ plan: { generalNotes: text } }, { mode: 'append' });
    return 'written';
  } catch {
    return 'failed';
  }
}

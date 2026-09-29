/**
 * The ONLY file in this app that imports runtime values from the Vim SDK.
 * Everything else depends on the local types in learning-types.ts.
 *
 * You'll build this file one module at a time. Each MODULE section below has
 * the function signature already written; your job is the body. Until a
 * module is built, its function throws NotBuiltError, and the panel shows
 * "Not built yet" for it.
 *
 * Check your work with `npm test`: each module's check skips until you build
 * it, then passes.
 *
 * When the simulator is on (NEXT_PUBLIC_SIM_MODE=true), every function should
 * take its SIM branch and read from src/dev/fixtures.ts instead of the EHR —
 * through the same mapping code the live path uses.
 */
import { getVimSDK, initVimSDK, type AppManifest, type Diagnosis, type EventType, type Patient, type VimSDK } from '@vimconnect/app-sdk';
import { createPresenceTracker, type PresenceKey } from './presence-tracker';
import { retryEntityFetch, type RetryOutcome } from './retry';
import { NotBuiltError, type Loadable, type PatientCard, type ProblemRow, type SessionSummary, type WritebackCheck, type WriteResult } from './learning-types';
import { SIM_MANIFEST, SIM_PATIENTS, type SimPatient } from '../dev/fixtures';

export const SIM_MODE = process.env.NEXT_PUBLIC_SIM_MODE === 'true';

function requireSdk(): VimSDK {
  const sdk = getVimSDK();
  if (!sdk) throw new Error('Not connected — call connectToVim() first.');
  return sdk;
}

// ─── Simulator state (dev only) — already built ─────────────────────────────

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
 *
 * In the simulator there's no session to start, so return straight away.
 */
export async function connectToVim(accessToken: string): Promise<void> {
  if (SIM_MODE) return;
  void accessToken;
  throw new NotBuiltError(1);
}

// ─── MODULE 2 · Checking what's available ───────────────────────────────────

/**
 * Read what this session supports from the manifest, and summarise it.
 * In the simulator, use SIM_MANIFEST.
 */
export function describeSession(): SessionSummary {
  throw new NotBuiltError(2);
}

// ─── MODULE 3 · Workflow events ─────────────────────────────────────────────

/**
 * Report every workflow event by type. Return a function that unsubscribes.
 * In the simulator, add the callback to simEventListeners.
 */
export function onWorkflowEvent(cb: (type: string) => void): () => void {
  void cb;
  throw new NotBuiltError(3);
}

// ─── MODULE 4 · Context ─────────────────────────────────────────────────────

/**
 * Report when a patient comes into view and when they leave. Return a
 * function that unsubscribes. Use createPresenceTracker from ./presence-tracker.
 * In the simulator, add a listener to simPresenceListeners.
 */
export function onPatientPresence(onPresent: () => void, onCleared: () => void): () => void {
  void onPresent;
  void onCleared;
  throw new NotBuiltError(4);
}

// ─── MODULE 5 · Entity API ──────────────────────────────────────────────────

/**
 * Fetch the patient in context and map it to a PatientCard. Wrap the read in
 * retryEntityFetch from ./retry. In the simulator, read simPatient.
 */
export async function fetchPatient(): Promise<Loadable<PatientCard>> {
  throw new NotBuiltError(5);
}

/** Fetch the patient's problem list and map it to ProblemRow[]. */
export async function fetchProblems(): Promise<Loadable<ProblemRow[]>> {
  throw new NotBuiltError(5);
}

// ─── MODULE 6 · Writeback ───────────────────────────────────────────────────

const simWrites: string[] = [];

/** DEV-ONLY. What the simulator has "written" so far. */
export function simulatedWrites(): string[] {
  return [...simWrites];
}

/** Can this session write to the encounter? */
export function checkEncounterWriteback(): WritebackCheck {
  throw new NotBuiltError(6);
}

/**
 * Append a note to the encounter, following the writeback ceremony.
 * In the simulator, push the text onto simWrites.
 */
export async function appendEncounterNote(text: string): Promise<WriteResult> {
  void text;
  throw new NotBuiltError(6);
}

// Imported for use as you build the modules above.
void [initVimSDK, createPresenceTracker, retryEntityFetch, SIM_MANIFEST];
export type { AppManifest, Diagnosis, Patient, RetryOutcome };

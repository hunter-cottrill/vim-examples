/**
 * Worker-surface Vim SDK connection layer. This is the ONLY file that
 * imports @vimconnect/app-sdk for the Worker (offscreen) app — a different
 * SDK object from the UI's, with a different surface (handles instead of
 * subscriptions, TTL-scoped access, no direct return value).
 */
import {
  initWorkerVimSDK,
  getWorkerVimSDK,
  type WorkerSDK,
  type WorkerWorkflowHandle,
  type NotificationDetails,
  type PatientApi,
  type Patient,
} from '@vimconnect/app-sdk';
import { retryWithBackoff } from './retry';
import { extractPatientId, hasUsableSignal, toPatientContext } from './patient-mapping';
import type { PatientContext } from './sdoh/types';

export type { WorkerWorkflowHandle, NotificationDetails };

const RETRY_DELAYS_MS = [200, 500, 1000];

/** Initialize the Worker SDK. Omit accessToken to let the SDK auto-fetch via a
 * token_endpoint query param on the page URL (mirrors the UI's fallback path). */
export async function initWorker(accessToken?: string): Promise<WorkerSDK> {
  return initWorkerVimSDK(accessToken ? { accessToken } : {});
}

export function requireWorker(): WorkerSDK {
  const worker = getWorkerVimSDK();
  if (!worker) throw new Error('Worker SDK not initialized — call initWorker(token) first.');
  return worker;
}

/**
 * Registers on the same chart_open workflow event the UI subscribes to via
 * onChartOpen — never a different trigger for the Worker. WorkerWorkflowCallback's
 * declared `event` type doesn't carry the chart_open-specific entities shape
 * (only the UI's typed workflow.on<E> does), so this extracts `patient` the
 * same way onChartOpen does, keeping the cast confined to this one call site.
 */
export function registerChartOpen(cb: (patient: Patient, patientId: string, handle: WorkerWorkflowHandle) => void): () => void {
  const worker = requireWorker();
  return worker.ehr.workflow.register('chart_open', { operations: ['notify'] }, (event, handle) => {
    const patient = (event.entities as unknown as { patient: Patient }).patient;
    cb(patient, extractPatientId(patient), handle);
  });
}

/** handle.api is dynamically indexed (ApiNamespace has no static `patient`
 * property, unlike the UI's sdk.ehr.api.patient) — confine the cast here. */
function getPatientApi(handle: WorkerWorkflowHandle): PatientApi | null {
  const api = handle.api.patient;
  return api && typeof api === 'object' ? (api as PatientApi) : null;
}

async function unwrap<T>(call: Promise<{ success: boolean; data: T }>): Promise<T> {
  const response = await call;
  if (!response.success) throw new Error('Entity API call returned success: false');
  return response.data;
}

/**
 * Build a PatientContext through the Worker handle's Entity API, retried
 * with backoff, falling back to the event's inline patient — same shape and
 * same fallback rule as vim-client.ts's fetchPatientContext. Returns null
 * (rather than throwing) if the handle goes invalid mid-fetch, since the
 * Worker has nothing to surface an error to — it just drops the event.
 */
export async function fetchPatientContextViaWorker(
  patientId: string,
  fallbackPatient: Parameters<typeof toPatientContext>[0],
  handle: WorkerWorkflowHandle,
): Promise<PatientContext | null> {
  const patientApi = getPatientApi(handle);

  if (patientApi && handle.api.isValid()) {
    try {
      const [patient, insurances, problems] = await Promise.all([
        retryWithBackoff(() => unwrap(patientApi.getPatient()), RETRY_DELAYS_MS),
        retryWithBackoff(() => unwrap(patientApi.getInsurances()), RETRY_DELAYS_MS),
        retryWithBackoff(() => unwrap(patientApi.getProblems()), RETRY_DELAYS_MS),
      ]);
      if (!handle.api.isValid()) return null; // superseded/expired while the fetch was in flight
      return toPatientContext(patient, patientId, insurances, problems);
    } catch {
      // fall through to the inline fallback below
    }
  }

  if (!handle.api.isValid()) return null;
  const fallback = toPatientContext(fallbackPatient, patientId, fallbackPatient.insurances ?? [], fallbackPatient.problems ?? []);
  return hasUsableSignal(fallback) ? fallback : null;
}

/**
 * Fires a Hub push notification through a handle, gated on the handle's own
 * validity (TTL/supersession) — never assumes a handle is still live.
 * notificationId is stable per patient, so the SDK's own native dedup
 * ('deduped' TriggerResult) suppresses repeat notifications for a chart the
 * provider keeps reopening, rather than this app tracking that itself.
 */
export async function firePushNotification(handle: WorkerWorkflowHandle, details: NotificationDetails): Promise<boolean> {
  if (!handle.hub?.isValid()) return false;
  const result = await handle.hub.pushNotification.show(details);
  return result.status === 'sent';
}

/** Whether the UI panel is already open — checked at the top-level Worker
 * SDK (not per-handle) to suppress a notification that would just duplicate
 * what the provider is already looking at. */
export function isUiAppOpen(): boolean {
  return requireWorker().hub.appState.isAppOpen;
}

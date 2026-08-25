/**
 * Referral guidance app — Vim Worker SDK connection layer.
 *
 * This is the ONLY file that imports Worker-side @vimconnect/app-sdk exports —
 * mirrors vim-client.ts's role for the UI SDK exactly, including the same
 * init/requireX singleton-getter pattern. src/app/offscreen/page.tsx (the Worker
 * entry) depends only on the narrow local types re-exported below, never on the
 * SDK package directly.
 *
 * IMPORTANT (empirically confirmed by cds-app's own Worker, not just the installed
 * .d.ts): despite WorkerContextCallback<T>'s doc comment claiming `curr` IS `T`
 * directly, the real wire payload is wrapped the same way the UI's
 * context.onChange is — `{ id, type, identifier, fields: T }`. Every registration
 * below reads `curr?.fields`, never `curr` itself.
 */
import { initWorkerVimSDK, getWorkerVimSDK, type WorkerSDK, type WorkerContextHandle, type NotificationDetails } from '@vimconnect/app-sdk';
import type { PatientLike, ReferralLike } from './referral-engine';

export type { WorkerContextHandle, NotificationDetails };

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
 * Subscribe to patient context. Requests 'notify' so the handle carries a real,
 * hub-capable HubNamespace even though this registration doesn't push a
 * notification on its own — the offscreen page uses that live handle only for
 * the SIM_MODE debug test path (see its comments); production always closes it
 * immediately since there's nothing to act on from patient context alone.
 */
export function registerPatient(cb: (patient: PatientLike | null, handle: WorkerContextHandle) => void): () => void {
  const worker = requireWorker();
  return worker.ehr.context.register<{ fields?: PatientLike }>(
    'chart_open:patient',
    { operations: ['notify'] },
    (_prev, curr, handle) => cb(curr?.fields ?? null, handle),
  );
}

/** Subscribe to a referral being started. */
export function registerReferralStart(
  cb: (referral: ReferralLike | null, handle: WorkerContextHandle) => void,
): () => void {
  const worker = requireWorker();
  return worker.ehr.context.register<{ fields?: ReferralLike }>(
    'referral_start:referral',
    { operations: ['notify'] },
    (_prev, curr, handle) => cb(curr?.fields ?? null, handle),
  );
}

/** Fires a Hub push notification through a handle, gated on the handle's own
 * validity (TTL/supersession) — never assumes a handle is still live. Returns
 * whether it actually fired. */
export function firePushNotification(handle: WorkerContextHandle, details: NotificationDetails): boolean {
  if (!handle.hub?.isValid()) return false;
  handle.hub.pushNotification.show(details);
  return true;
}
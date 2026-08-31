'use client';

/**
 * Worker-surface Vim SDK connection layer — the ONLY file importing runtime
 * SDK values for the offscreen app.
 *
 * The Worker SDK is a different object with a different surface, not the UI
 * SDK running headless: it REGISTERS handlers rather than subscribing, one
 * registration per key, and each invocation gets a short-lived scoped handle
 * whose API differs from the UI sdk's.
 *
 * It runs the SAME reconcile() the panel does. The rules are never forked.
 */
import {
  initWorkerVimSDK,
  type Patient,
  type PatientApi,
  type TypedContextData,
  type WorkerContextHandle,
} from '@vimconnect/app-sdk';
import { unwrap } from './api-response';
import { extractPatientId, toChartContext } from './entity-mapping';
import type { LaunchTokens } from './launch-auth';
import { RETRY_DELAYS_MS, WORKER_DEBOUNCE_MS } from './med-rec/constants';
import { reconcile } from './med-rec/engine';
import { buildNotificationSummary } from './med-rec/notification';
import { retryWithBackoff } from './retry';

export interface RunningWorker {
  stop(): void;
}

/**
 * The Worker handle types `api` as ApiNamespace — an index signature of
 * `unknown` — whereas the UI SDK exposes the typed ApiNamespaceMap. The
 * namespaces are the same objects at runtime, so this narrows once, here at
 * the boundary, instead of scattering casts through the worker logic.
 */
function patientApiOf(handle: WorkerContextHandle): PatientApi {
  return handle.api.patient as PatientApi;
}

export async function startWorker(tokens: LaunchTokens): Promise<RunningWorker> {
  const worker = await initWorkerVimSDK({ accessToken: tokens.accessToken, idToken: tokens.idToken });
  worker.hub.setActivationStatus('ENABLED');

  /**
   * Dedupe markers only: patient id -> the signature of the findings we last
   * notified about. The signature is built from finding kinds and this app's
   * own vocabulary labels — never a medication name or an ICD code. It lives
   * in this tab's memory for the session and is never written to disk, to a
   * backend, or anywhere else. The EHR remains the system of record.
   */
  const notifiedSignatures = new Map<string, string>();

  let debounceTimer: ReturnType<typeof setTimeout> | null = null;
  let pendingHandle: WorkerContextHandle | null = null;

  function cancelPending(): void {
    if (debounceTimer !== null) {
      clearTimeout(debounceTimer);
      debounceTimer = null;
    }
    // A superseded handle must be closed, not just dropped — it holds a TTL.
    pendingHandle?.close();
    pendingHandle = null;
  }

  async function evaluate(patientId: string, handle: WorkerContextHandle): Promise<void> {
    try {
      const patientApi = patientApiOf(handle);
      const [medications, problems] = await Promise.all([
        retryWithBackoff(() => unwrap(patientApi.getMedications()), RETRY_DELAYS_MS),
        retryWithBackoff(() => unwrap(patientApi.getProblems()), RETRY_DELAYS_MS),
      ]);

      // Re-check the handle AFTER the awaits: a newer context change may have
      // superseded it, or its TTL may simply have run out, while the reads
      // were in flight.
      const hub = handle.hub;
      if (!hub?.isValid()) {
        handle.close();
        return;
      }

      // Re-check the panel too — the provider may have opened it while we read,
      // and a notification duplicating what they are already looking at is noise.
      if (worker.hub.appState.isAppOpen) {
        handle.close();
        return;
      }

      const result = reconcile(toChartContext(patientId, medications, problems, 'entity-api'));
      const summary = buildNotificationSummary(result);

      if (!summary) {
        worker.hub.notificationBadge.hide();
        handle.close();
        return;
      }

      // Throttle: one notification per patient per worker session, re-armed
      // only when the findings themselves change.
      if (notifiedSignatures.get(patientId) === summary.signature) {
        handle.close();
        return;
      }
      notifiedSignatures.set(patientId, summary.signature);

      worker.hub.notificationBadge.set(summary.count);
      // Scoped to this patient by notificationId and by launchPayload, which
      // the UI app checks against the chart actually on screen before showing
      // "opened from a notification".
      await hub.pushNotification.show({
        title: summary.title,
        text: summary.text,
        notificationId: `medrec-${patientId}`,
        type: 'info',
        launchPayload: { patientId },
      });
      // show() auto-closes the handle (HookDeclaration.autoCloseAfterAction
      // defaults to true), so there is no close() here.
    } catch {
      handle.close();
    }
  }

  const unregister = worker.ehr.context.register<TypedContextData<Patient>>(
    'chart_open:patient',
    // `fields` and `debounceMs` are deliberately unused. cds-app documented
    // empirically that a fields-gated registration never fired on the real
    // event and instead fired later carrying stale state, and the SDK's own
    // doc comment marks debounceMs "Phase 1 — implemented last". The debounce
    // below is hand-rolled instead.
    { operations: ['notify'] },
    (_previous, current, handle) => {
      cancelPending();

      if (!current) {
        // The patient left context — nothing to reason about.
        handle.close();
        return;
      }

      if (worker.hub.appState.isAppOpen) {
        // Suppressed: the provider already has the panel open. Note this reads
        // the top-level worker SDK — WorkerHubState carries appState, while the
        // HubNamespace on the handle does not.
        handle.close();
        return;
      }

      const patientId = extractPatientId(current.fields ?? {});
      pendingHandle = handle;
      debounceTimer = setTimeout(() => {
        debounceTimer = null;
        pendingHandle = null;
        void evaluate(patientId, handle);
      }, WORKER_DEBOUNCE_MS);
    },
  );

  return {
    stop() {
      cancelPending();
      unregister();
    },
  };
}

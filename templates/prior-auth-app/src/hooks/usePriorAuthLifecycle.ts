import { useCallback, useEffect, useReducer, useRef } from 'react';
import type { VimSDK } from '@vimconnect/app-sdk';
import { loadOrderContext, subscribeChartPatient, subscribeEncounterPatient, subscribeOrderEvents } from '@/lib/vim/client';
import { transition } from '@/lib/priorAuth/transition';
import { consumeForcedSubmitFailure } from '@/dev/simControls';
import type { PriorAuthState, PriorAuthSubmissionRequest, PriorAuthSubmissionResponse, PriorAuthStatusResponse } from '@/lib/priorAuth/types';

const SIM_MODE = process.env.NEXT_PUBLIC_SIM_MODE === 'true';
const POLL_INTERVAL_MS = 3000;
const MAX_POLL_ATTEMPTS = 20;

const INITIAL_PA_STATE: PriorAuthState = { kind: 'idle' };

/**
 * Wires the PA state machine to the SDK boundary (or, under SIM_MODE, to the
 * simulator seam inside lib/vim/client.ts — the caller doesn't need to know
 * which). Shared by src/app/app/page.tsx (real SDK) and
 * src/dev/HarnessContent.tsx (SIM_MODE only, no real SDK) so the two never
 * drift — see build plan §5 step 6/step 8.
 */
export function usePriorAuthLifecycle(vimSDK: VimSDK | null) {
  const [paState, dispatch] = useReducer(transition, INITIAL_PA_STATE);
  const chartPatientPresentRef = useRef(false);
  const encounterPatientPresentRef = useRef(false);
  const patientWasPresentRef = useRef(false);

  useEffect(() => {
    if (!vimSDK && !SIM_MODE) return;
    return subscribeOrderEvents(vimSDK as VimSDK, (ehrOrderId) => {
      dispatch({ type: 'ORDER_EVENT_RECEIVED', ehrOrderId });
    });
  }, [vimSDK]);

  useEffect(() => {
    function reconcilePatientPresence() {
      const present = chartPatientPresentRef.current || encounterPatientPresentRef.current;
      if (patientWasPresentRef.current && !present) {
        dispatch({ type: 'RESET' });
      }
      patientWasPresentRef.current = present;
    }
    
    if (!vimSDK && !SIM_MODE) return;
    const unsubChart = subscribeChartPatient(vimSDK as VimSDK, (present) => {
      chartPatientPresentRef.current = present;
      reconcilePatientPresence();
    });
    const unsubEncounter = subscribeEncounterPatient(vimSDK as VimSDK, (present) => {
      encounterPatientPresentRef.current = present;
      reconcilePatientPresence();
    });
    return () => { unsubChart(); unsubEncounter(); };
  }, [vimSDK]);

  // Depends on the whole `paState` object (not a derived primitive) so a
  // RETRY_CONTEXT re-entry into `loadingContext` with the *same* ehrOrderId
  // still re-triggers the fetch — transition() always returns a fresh object.
  useEffect(() => {
    if ((!vimSDK && !SIM_MODE) || paState.kind !== 'loadingContext') return;
    let cancelled = false;
    const ehrOrderId = paState.ehrOrderId;
    loadOrderContext(vimSDK as VimSDK, ehrOrderId).then((result) => {
      if (cancelled) return;
      if (result.ok) {
        dispatch({ type: 'CONTEXT_LOADED', ehrOrderId, order: result.order, insurance: result.insurance, diagnoses: result.diagnoses });
      } else {
        dispatch({ type: 'CONTEXT_FAILED', ehrOrderId, message: result.message });
      }
    });
    return () => {
      cancelled = true;
    };
  }, [vimSDK, paState]);

  useEffect(() => {
    if (paState.kind !== 'submitting') return;
    let cancelled = false;
    const body: PriorAuthSubmissionRequest = {
      ehrOrderId: paState.ehrOrderId,
      ehrEncounterId: paState.ehrEncounterId,
      payerId: paState.payer.payerId,
      cpt: paState.procedure.cpt,
      serviceTypeCode: paState.procedure.orderType,
      diagnosisCodes: paState.diagnoses.map((d) => d.code),
      clinicalJustification: paState.diagnoses.map((d) => d.description).join('; '),
      requestedUnits: 1,
      orderingProviderNpi: paState.orderingProviderNpi,
    };
    (async () => {
      if (SIM_MODE && consumeForcedSubmitFailure()) {
        if (!cancelled) dispatch({ type: 'SUBMIT_FAILED', message: 'Simulated submission failure.' });
        return;
      }
      try {
        const res = await fetch('/api/prior-auth/requests', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
        });
        if (!res.ok) throw new Error('Submission failed.');
        const data = (await res.json()) as PriorAuthSubmissionResponse;
        if (!cancelled) dispatch({ type: 'SUBMIT_SUCCEEDED', requestId: data.requestId });
      } catch (err) {
        if (!cancelled) dispatch({ type: 'SUBMIT_FAILED', message: err instanceof Error ? err.message : 'Submission failed.' });
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [paState]);

  useEffect(() => {
    if (paState.kind !== 'pending') return;
    const requestId = paState.requestId;
    let attempts = 0;
    const intervalId = setInterval(async () => {
      attempts += 1;
      if (attempts > MAX_POLL_ATTEMPTS) {
        clearInterval(intervalId);
        dispatch({ type: 'POLL_EXHAUSTED' });
        return;
      }
      try {
        const res = await fetch(`/api/prior-auth/requests/${requestId}`);
        if (!res.ok) return;
        const data = (await res.json()) as PriorAuthStatusResponse;
        if (data.status === 'approved') {
          clearInterval(intervalId);
          dispatch({ type: 'POLL_RESULT_APPROVED', authNumber: data.authNumber });
        } else if (data.status === 'denied') {
          clearInterval(intervalId);
          dispatch({ type: 'POLL_RESULT_DENIED', denialReason: data.denialReason });
        }
      } catch {
        // Transient network error — the next tick retries within the same bound.
      }
    }, POLL_INTERVAL_MS);
    return () => clearInterval(intervalId);
  }, [paState]);

  const handleRetryContext = useCallback(() => dispatch({ type: 'RETRY_CONTEXT' }), []);
  const handleSubmit = useCallback(() => dispatch({ type: 'SUBMIT_REQUESTED' }), []);
  const handleRecheck = useCallback(() => dispatch({ type: 'RECHECK_REQUESTED' }), []);

  return { paState, dispatch, handleRetryContext, handleSubmit, handleRecheck };
}

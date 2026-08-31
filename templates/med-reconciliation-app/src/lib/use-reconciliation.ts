'use client';

/**
 * The app's read -> reason -> render wiring, in one place.
 *
 * Both the real /app page and the SIM_MODE dev harness use this hook, so the
 * harness exercises the same subscription, fetch, mapping and reduction path
 * the live app does — it differs only in how the connection is established.
 */
import { useEffect, useReducer, useRef, useState } from 'react';
import { INITIAL_APP_STATE, transition, type AppState } from './app-state';
import { reconcile } from './med-rec/engine';
import { consumeLaunchPatientId, fetchChartContext, onChartOpen, onPatientContextCleared } from './vim-client';

export interface Reconciliation {
  state: AppState;
  /**
   * The patient a Worker notification was about, when one opened this panel.
   * The caller compares it against the patient actually on screen — a
   * notification must never surface over a different patient's chart.
   */
  launchPatientId: string | null;
}

/**
 * @param connect Establishes the SDK connection. Rejecting puts the app in the
 *   sdk_init_failed error state. The harness passes a resolved no-op because
 *   there is no real connection to make.
 */
export function useReconciliation(connect: () => Promise<void>): Reconciliation {
  const [state, dispatch] = useReducer(transition, INITIAL_APP_STATE);
  const [launchPatientId, setLaunchPatientId] = useState<string | null>(null);

  const initRef = useRef(false);
  const unsubscribesRef = useRef<Array<() => void>>([]);
  // Tracks the exact state object a load was kicked off for, by reference
  // rather than by patientId, so re-opening the same chart (a fresh state
  // object) loads again while StrictMode's double-invoke of one effect does not.
  const handledLoadStateRef = useRef<AppState | null>(null);

  useEffect(() => {
    if (initRef.current) return;
    initRef.current = true;

    void (async () => {
      try {
        await connect();
        setLaunchPatientId(consumeLaunchPatientId());
        unsubscribesRef.current = [
          onChartOpen((patientId) => dispatch({ type: 'CHART_OPENED', patientId })),
          onPatientContextCleared(() => dispatch({ type: 'PATIENT_CONTEXT_CLEARED' })),
        ];
        dispatch({ type: 'SDK_READY' });
      } catch {
        dispatch({ type: 'SDK_INIT_FAILED' });
      }
    })();

    // Under StrictMode this cleanup runs before the async body has populated
    // the ref, so it is a no-op there and the subscriptions made afterwards
    // survive — which is what we want, since the second effect pass returns
    // early. On a real unmount the panel iframe is torn down with it.
    return () => {
      unsubscribesRef.current.forEach((unsubscribe) => unsubscribe());
      unsubscribesRef.current = [];
    };
    // connect is captured once, deliberately: re-connecting on every render
    // would re-initialise the SDK.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (state.status !== 'loading_chart') return;
    if (handledLoadStateRef.current === state) return;
    handledLoadStateRef.current = state;

    const { patientId } = state;
    fetchChartContext(patientId)
      .then((context) => dispatch({ type: 'CHART_DATA_LOADED', patientId, context, result: reconcile(context) }))
      .catch(() => dispatch({ type: 'CHART_LOAD_FAILED', patientId }));
  }, [state]);

  return { state, launchPatientId };
}

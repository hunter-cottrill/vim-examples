/**
 * The app lifecycle as a pure discriminated union plus a pure reducer. No SDK,
 * no React, no network — so the whole lifecycle, including the stale-patient
 * guards, is unit-testable offline.
 *
 * Out-of-order inputs are no-ops, never throws: the Hub delivers workflow
 * events and context changes on independent channels, so a late arrival from
 * a chart the provider has already left is normal, not exceptional.
 */
import type { ChartContext, ReconciliationResult } from './med-rec/types';

export type ErrorReason = 'sdk_init_failed' | 'chart_load_failed';

export type AppState =
  | { status: 'connecting' }
  | { status: 'awaiting_chart' }
  | { status: 'loading_chart'; patientId: string }
  | { status: 'ready'; patientId: string; context: ChartContext; result: ReconciliationResult }
  | {
      status: 'error';
      reason: ErrorReason;
      /**
       * null for a global connection failure, which is unrelated to any chart
       * and therefore must NOT be cleared when the patient context empties.
       */
      patientId: string | null;
    };

export type AppInput =
  | { type: 'SDK_READY' }
  | { type: 'SDK_INIT_FAILED' }
  | { type: 'CHART_OPENED'; patientId: string }
  | { type: 'CHART_DATA_LOADED'; patientId: string; context: ChartContext; result: ReconciliationResult }
  | { type: 'CHART_LOAD_FAILED'; patientId: string }
  | { type: 'PATIENT_CONTEXT_CLEARED' };

export const INITIAL_APP_STATE: AppState = { status: 'connecting' };

export function transition(state: AppState, input: AppInput): AppState {
  switch (input.type) {
    case 'SDK_READY':
      return state.status === 'connecting' ? { status: 'awaiting_chart' } : state;

    case 'SDK_INIT_FAILED':
      return state.status === 'connecting'
        ? { status: 'error', reason: 'sdk_init_failed', patientId: null }
        : state;

    case 'CHART_OPENED':
      // Not reachable from 'connecting': the SDK must be up before a workflow
      // event can arrive, so a chart_open there would be out of order.
      if (state.status === 'connecting') return state;
      return { status: 'loading_chart', patientId: input.patientId };

    case 'CHART_DATA_LOADED':
      if (state.status !== 'loading_chart' && state.status !== 'ready') return state;
      if (state.patientId !== input.patientId) return state; // stale fetch — ignore
      return {
        status: 'ready',
        patientId: input.patientId,
        context: input.context,
        result: input.result,
      };

    case 'CHART_LOAD_FAILED':
      if (state.status !== 'loading_chart') return state;
      if (state.patientId !== input.patientId) return state; // stale failure — ignore
      return { status: 'error', reason: 'chart_load_failed', patientId: input.patientId };

    case 'PATIENT_CONTEXT_CLEARED':
      if (state.status === 'connecting' || state.status === 'awaiting_chart') return state;
      if (state.status === 'error' && state.patientId === null) return state;
      return { status: 'awaiting_chart' };
  }
}

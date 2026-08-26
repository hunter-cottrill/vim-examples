// Top-level application lifecycle: SDK init -> waiting for a chart -> fetch
// (with retry) -> result, any step of which can fail. Modeled as a pure
// discriminated union + reducer so it's testable with no SDK and no network.
// Out-of-order inputs (e.g. a fetch result for a chart the provider already
// navigated away from) are no-ops, never throws.

import type { SdohEvaluation } from './sdoh/types';

export type AppState =
  | { status: 'connecting' }
  | { status: 'awaiting_chart' }
  | { status: 'loading_patient_data'; patientId: string }
  | { status: 'ready'; patientId: string; evaluation: SdohEvaluation }
  | { status: 'error'; message: string; retryable: boolean; patientId?: string };

export type AppInput =
  | { type: 'SDK_READY' }
  | { type: 'SDK_INIT_FAILED'; message: string }
  | { type: 'CHART_OPENED'; patientId: string }
  | { type: 'PATIENT_DATA_FETCHED'; patientId: string; evaluation: SdohEvaluation }
  | { type: 'PATIENT_DATA_FETCH_FAILED'; patientId: string; message: string };

export function transition(state: AppState, input: AppInput): AppState {
  switch (input.type) {
    case 'SDK_READY':
      if (state.status !== 'connecting') return state;
      return { status: 'awaiting_chart' };

    case 'SDK_INIT_FAILED':
      if (state.status !== 'connecting') return state;
      return { status: 'error', message: input.message, retryable: false };

    case 'CHART_OPENED':
      // Reachable from awaiting_chart, ready, or error — a new/refocused
      // chart always (re)starts the fetch, regardless of where we were.
      if (state.status === 'connecting') return state;
      return { status: 'loading_patient_data', patientId: input.patientId };

    case 'PATIENT_DATA_FETCHED':
      if (state.status !== 'loading_patient_data') return state;
      if (state.patientId !== input.patientId) return state; // stale fetch, ignore
      return { status: 'ready', patientId: input.patientId, evaluation: input.evaluation };

    case 'PATIENT_DATA_FETCH_FAILED':
      if (state.status !== 'loading_patient_data') return state;
      if (state.patientId !== input.patientId) return state; // stale fetch, ignore
      return { status: 'error', message: input.message, retryable: true, patientId: input.patientId };

    default:
      return state;
  }
}

export const INITIAL_APP_STATE: AppState = { status: 'connecting' };

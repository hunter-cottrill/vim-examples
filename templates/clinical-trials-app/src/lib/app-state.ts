// Top-level application lifecycle: SDK init -> waiting for a chart -> fetch
// patient data (with retry) -> search trials -> result, any step of which
// can fail. Modeled as a pure discriminated union + reducer so it's testable
// with no SDK and no network. The crosswalk lookups called from
// PATIENT_DATA_FETCHED are themselves pure (no I/O), so transition() stays a
// pure function of (state, input) despite computing derived data inline.
// Out-of-order inputs (e.g. a trial-search result for a chart the provider
// already navigated away from) are no-ops, never throws.
import { matchConditionCrosswalk } from './trial-match/condition-crosswalk';
import { matchZipCrosswalk } from './trial-match/zip-crosswalk';
import type { ConditionMatch, PatientContext, ReadyResult, ZipMatch } from './trial-match/types';

export type ErrorReason = 'sdk_init_failed' | 'patient_fetch_failed' | 'trial_search_failed';

export type AppState =
  | { status: 'connecting' }
  | { status: 'awaiting_chart' }
  | { status: 'loading_patient_data'; patientId: string }
  | {
      status: 'searching_trials';
      patientId: string;
      context: PatientContext;
      conditionMatches: ConditionMatch[];
      zipMatch: ZipMatch;
    }
  | { status: 'ready'; patientId: string; result: ReadyResult }
  | { status: 'error'; patientId: string | null; reason: ErrorReason };

export type AppInput =
  | { type: 'SDK_READY' }
  | { type: 'SDK_INIT_FAILED' }
  | { type: 'CHART_OPENED'; patientId: string }
  | { type: 'PATIENT_DATA_FETCHED'; patientId: string; context: PatientContext }
  | { type: 'PATIENT_DATA_FETCH_FAILED'; patientId: string }
  | { type: 'TRIAL_SEARCH_SUCCEEDED'; patientId: string; result: ReadyResult }
  | { type: 'TRIAL_SEARCH_FAILED'; patientId: string }
  | { type: 'CHART_CLOSED' };

export const INITIAL_APP_STATE: AppState = { status: 'connecting' };

export function transition(state: AppState, input: AppInput): AppState {
  switch (input.type) {
    case 'SDK_READY':
      if (state.status !== 'connecting') return state;
      return { status: 'awaiting_chart' };

    case 'SDK_INIT_FAILED':
      if (state.status !== 'connecting') return state;
      return { status: 'error', reason: 'sdk_init_failed', patientId: null };

    case 'CHART_OPENED':
      // Reachable from awaiting_chart, loading_patient_data, searching_trials,
      // ready, or error — a new/refocused chart always (re)starts the fetch.
      if (state.status === 'connecting') return state;
      return { status: 'loading_patient_data', patientId: input.patientId };

    case 'PATIENT_DATA_FETCHED': {
      if (state.status !== 'loading_patient_data') return state;
      if (state.patientId !== input.patientId) return state; // stale fetch, ignore
      const conditionMatches = input.context.problems.map(matchConditionCrosswalk);
      const zipMatch = matchZipCrosswalk(input.context.zipCode);
      return {
        status: 'searching_trials',
        patientId: input.patientId,
        context: input.context,
        conditionMatches,
        zipMatch,
      };
    }

    case 'PATIENT_DATA_FETCH_FAILED':
      if (state.status !== 'loading_patient_data') return state;
      if (state.patientId !== input.patientId) return state; // stale fetch, ignore
      return { status: 'error', reason: 'patient_fetch_failed', patientId: input.patientId };

    case 'TRIAL_SEARCH_SUCCEEDED':
      if (state.status !== 'searching_trials') return state;
      if (state.patientId !== input.patientId) return state; // stale search, ignore
      return { status: 'ready', patientId: input.patientId, result: input.result };

    case 'TRIAL_SEARCH_FAILED':
      if (state.status !== 'searching_trials') return state;
      if (state.patientId !== input.patientId) return state; // stale search, ignore
      return { status: 'error', reason: 'trial_search_failed', patientId: input.patientId };

    case 'CHART_CLOSED':
      // Nothing to clear if we were never showing a patient in the first
      // place, or if the error is a global connection failure (patientId
      // null) unrelated to any specific chart. No patientId to compare here
      // — see onChartClosed's doc comment in vim-client.ts for why that
      // matching was dropped rather than fixed.
      if (state.status === 'connecting' || state.status === 'awaiting_chart') return state;
      if (state.patientId === null) return state;
      return { status: 'awaiting_chart' };

    default:
      return state;
  }
}

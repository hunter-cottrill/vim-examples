import { describe, expect, it } from 'vitest';
import { INITIAL_APP_STATE, transition } from './app-state';
import type { PatientContext } from './trial-match/types';

const DIABETES_DENVER: PatientContext = {
  patientId: 'p1',
  zipCode: '80202',
  problems: [{ code: 'E11.9', system: 'ICD-10', status: 'active', description: 'Type 2 diabetes', onSetDate: '2024-01-01' }],
};

const NO_PROBLEMS: PatientContext = { patientId: 'p1', zipCode: null, problems: [] };

describe('transition', () => {
  it('walks the full happy path: connecting -> awaiting_chart -> loading -> searching_trials', () => {
    let state = INITIAL_APP_STATE;
    state = transition(state, { type: 'SDK_READY' });
    expect(state).toEqual({ status: 'awaiting_chart' });

    state = transition(state, { type: 'CHART_OPENED', patientId: 'p1' });
    expect(state).toEqual({ status: 'loading_patient_data', patientId: 'p1' });

    state = transition(state, { type: 'PATIENT_DATA_FETCHED', patientId: 'p1', context: DIABETES_DENVER });
    expect(state.status).toBe('searching_trials');
    if (state.status !== 'searching_trials') throw new Error('expected searching_trials');
    expect(state.conditionMatches[0].confidence).toBe('high');
    expect(state.zipMatch.confidence).toBe('high');

    const result = { kind: 'matches_found' as const, conditionMatches: [], zipMatch: state.zipMatch, trials: [], truncated: false };
    state = transition(state, { type: 'TRIAL_SEARCH_SUCCEEDED', patientId: 'p1', result });
    expect(state).toEqual({ status: 'ready', patientId: 'p1', result });
  });

  it('derives no crosswalk matches for a patient with no problems and no zip', () => {
    const loading = transition({ status: 'awaiting_chart' }, { type: 'CHART_OPENED', patientId: 'p1' });
    const state = transition(loading, { type: 'PATIENT_DATA_FETCHED', patientId: 'p1', context: NO_PROBLEMS });
    expect(state).toEqual({
      status: 'searching_trials',
      patientId: 'p1',
      context: NO_PROBLEMS,
      conditionMatches: [],
      zipMatch: { zip3: '', confidence: 'none' },
    });
  });

  it('SDK_INIT_FAILED from connecting produces a sdk_init_failed error with no patientId', () => {
    const state = transition(INITIAL_APP_STATE, { type: 'SDK_INIT_FAILED' });
    expect(state).toEqual({ status: 'error', reason: 'sdk_init_failed', patientId: null });
  });

  it('a fetch failure produces a patient_fetch_failed error', () => {
    const loading = transition({ status: 'awaiting_chart' }, { type: 'CHART_OPENED', patientId: 'p1' });
    const state = transition(loading, { type: 'PATIENT_DATA_FETCH_FAILED', patientId: 'p1' });
    expect(state).toEqual({ status: 'error', reason: 'patient_fetch_failed', patientId: 'p1' });
  });

  it('a trial search failure produces a trial_search_failed error', () => {
    const loading = transition({ status: 'awaiting_chart' }, { type: 'CHART_OPENED', patientId: 'p1' });
    const searching = transition(loading, { type: 'PATIENT_DATA_FETCHED', patientId: 'p1', context: NO_PROBLEMS });
    const state = transition(searching, { type: 'TRIAL_SEARCH_FAILED', patientId: 'p1' });
    expect(state).toEqual({ status: 'error', reason: 'trial_search_failed', patientId: 'p1' });
  });

  it('ignores a PATIENT_DATA_FETCHED for a stale patientId while loading a newer one', () => {
    const loading = transition({ status: 'awaiting_chart' }, { type: 'CHART_OPENED', patientId: 'p2' });
    const state = transition(loading, { type: 'PATIENT_DATA_FETCHED', patientId: 'p1', context: NO_PROBLEMS });
    expect(state).toEqual(loading); // unchanged — no-op
  });

  it('ignores a PATIENT_DATA_FETCH_FAILED for a stale patientId while loading a newer one', () => {
    const loading = transition({ status: 'awaiting_chart' }, { type: 'CHART_OPENED', patientId: 'p2' });
    const state = transition(loading, { type: 'PATIENT_DATA_FETCH_FAILED', patientId: 'p1' });
    expect(state).toEqual(loading); // unchanged — no-op
  });

  it('ignores a TRIAL_SEARCH_SUCCEEDED for a stale patientId', () => {
    const loading = transition({ status: 'awaiting_chart' }, { type: 'CHART_OPENED', patientId: 'p1' });
    const searching = transition(loading, { type: 'PATIENT_DATA_FETCHED', patientId: 'p1', context: NO_PROBLEMS });
    const result = { kind: 'no_problems' as const };
    const state = transition(searching, { type: 'TRIAL_SEARCH_SUCCEEDED', patientId: 'stale', result });
    expect(state).toEqual(searching); // unchanged — no-op
  });

  it('ignores a TRIAL_SEARCH_FAILED for a stale patientId', () => {
    const loading = transition({ status: 'awaiting_chart' }, { type: 'CHART_OPENED', patientId: 'p1' });
    const searching = transition(loading, { type: 'PATIENT_DATA_FETCHED', patientId: 'p1', context: NO_PROBLEMS });
    const state = transition(searching, { type: 'TRIAL_SEARCH_FAILED', patientId: 'stale' });
    expect(state).toEqual(searching); // unchanged — no-op
  });

  it('CHART_OPENED interrupts an in-flight search and restarts loading for the new patient', () => {
    const loading = transition({ status: 'awaiting_chart' }, { type: 'CHART_OPENED', patientId: 'p1' });
    const searching = transition(loading, { type: 'PATIENT_DATA_FETCHED', patientId: 'p1', context: NO_PROBLEMS });
    const state = transition(searching, { type: 'CHART_OPENED', patientId: 'p2' });
    expect(state).toEqual({ status: 'loading_patient_data', patientId: 'p2' });
  });

  it('re-enters loading_patient_data when CHART_OPENED arrives from ready', () => {
    const ready = { status: 'ready' as const, patientId: 'p1', result: { kind: 'no_problems' as const } };
    const state = transition(ready, { type: 'CHART_OPENED', patientId: 'p2' });
    expect(state).toEqual({ status: 'loading_patient_data', patientId: 'p2' });
  });

  it('re-enters loading_patient_data when CHART_OPENED arrives from error', () => {
    const error = { status: 'error' as const, reason: 'patient_fetch_failed' as const, patientId: 'p1' };
    const state = transition(error, { type: 'CHART_OPENED', patientId: 'p1' });
    expect(state).toEqual({ status: 'loading_patient_data', patientId: 'p1' });
  });

  it('CHART_OPENED is a no-op while still connecting', () => {
    const state = transition(INITIAL_APP_STATE, { type: 'CHART_OPENED', patientId: 'p1' });
    expect(state).toEqual(INITIAL_APP_STATE);
  });

  it('a duplicate SDK_READY once already past connecting is a no-op', () => {
    const awaiting = { status: 'awaiting_chart' as const };
    const state = transition(awaiting, { type: 'SDK_READY' });
    expect(state).toEqual(awaiting);
  });

  it('any other unmatched (state, input) pair is a no-op default, never a throw', () => {
    const ready = { status: 'ready' as const, patientId: 'p1', result: { kind: 'no_problems' as const } };
    const state = transition(ready, { type: 'SDK_READY' });
    expect(state).toEqual(ready);
  });

  it('CHART_CLOSED resets a ready state back to awaiting_chart', () => {
    const ready = { status: 'ready' as const, patientId: 'p1', result: { kind: 'no_problems' as const } };
    const state = transition(ready, { type: 'CHART_CLOSED' });
    expect(state).toEqual({ status: 'awaiting_chart' });
  });

  it('CHART_CLOSED resets loading_patient_data, searching_trials, and a patient-scoped error back to awaiting_chart', () => {
    const loading = { status: 'loading_patient_data' as const, patientId: 'p1' };
    expect(transition(loading, { type: 'CHART_CLOSED' })).toEqual({ status: 'awaiting_chart' });

    const searching = transition(loading, { type: 'PATIENT_DATA_FETCHED', patientId: 'p1', context: NO_PROBLEMS });
    expect(transition(searching, { type: 'CHART_CLOSED' })).toEqual({ status: 'awaiting_chart' });

    const fetchError = { status: 'error' as const, reason: 'patient_fetch_failed' as const, patientId: 'p1' };
    expect(transition(fetchError, { type: 'CHART_CLOSED' })).toEqual({ status: 'awaiting_chart' });
  });

  it('CHART_CLOSED is a no-op from connecting or awaiting_chart — nothing to clear', () => {
    expect(transition(INITIAL_APP_STATE, { type: 'CHART_CLOSED' })).toEqual(INITIAL_APP_STATE);
    const awaiting = { status: 'awaiting_chart' as const };
    expect(transition(awaiting, { type: 'CHART_CLOSED' })).toEqual(awaiting);
  });

  it('CHART_CLOSED is a no-op for a global sdk_init_failed error (patientId null, unrelated to any chart)', () => {
    const globalError = { status: 'error' as const, reason: 'sdk_init_failed' as const, patientId: null };
    const state = transition(globalError, { type: 'CHART_CLOSED' });
    expect(state).toEqual(globalError);
  });
});

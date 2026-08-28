import { describe, expect, it } from 'vitest';
import { INITIAL_APP_STATE, transition } from './app-state';
import type { SdohEvaluation } from './sdoh/types';

const EMPTY_EVAL: SdohEvaluation = { insights: [], dataCompleteness: 'full' };

describe('transition', () => {
  it('walks the full happy path: connecting -> awaiting_chart -> loading -> ready', () => {
    let state = INITIAL_APP_STATE;
    state = transition(state, { type: 'SDK_READY' });
    expect(state).toEqual({ status: 'awaiting_chart' });

    state = transition(state, { type: 'CHART_OPENED', patientId: 'p1' });
    expect(state).toEqual({ status: 'loading_patient_data', patientId: 'p1' });

    state = transition(state, { type: 'PATIENT_DATA_FETCHED', patientId: 'p1', evaluation: EMPTY_EVAL });
    expect(state).toEqual({ status: 'ready', patientId: 'p1', evaluation: EMPTY_EVAL });
  });

  it('SDK_INIT_FAILED from connecting produces a non-retryable error', () => {
    const state = transition(INITIAL_APP_STATE, { type: 'SDK_INIT_FAILED', message: 'auth failed' });
    expect(state).toEqual({ status: 'error', message: 'auth failed', retryable: false });
  });

  it('a fetch failure produces a retryable error', () => {
    const loading = transition({ status: 'awaiting_chart' }, { type: 'CHART_OPENED', patientId: 'p1' });
    const state = transition(loading, { type: 'PATIENT_DATA_FETCH_FAILED', patientId: 'p1', message: 'timed out' });
    expect(state).toEqual({ status: 'error', message: 'timed out', retryable: true, patientId: 'p1' });
  });

  it('ignores a PATIENT_DATA_FETCHED for a stale patientId while loading a newer one', () => {
    const loading = transition({ status: 'awaiting_chart' }, { type: 'CHART_OPENED', patientId: 'p2' });
    const state = transition(loading, { type: 'PATIENT_DATA_FETCHED', patientId: 'p1', evaluation: EMPTY_EVAL });
    expect(state).toEqual(loading); // unchanged — no-op
  });

  it('ignores a PATIENT_DATA_FETCH_FAILED for a stale patientId while loading a newer one', () => {
    const loading = transition({ status: 'awaiting_chart' }, { type: 'CHART_OPENED', patientId: 'p2' });
    const state = transition(loading, { type: 'PATIENT_DATA_FETCH_FAILED', patientId: 'p1', message: 'oops' });
    expect(state).toEqual(loading); // unchanged — no-op
  });

  it('re-enters loading_patient_data when CHART_OPENED arrives from ready', () => {
    const ready = { status: 'ready' as const, patientId: 'p1', evaluation: EMPTY_EVAL };
    const state = transition(ready, { type: 'CHART_OPENED', patientId: 'p2' });
    expect(state).toEqual({ status: 'loading_patient_data', patientId: 'p2' });
  });

  it('re-enters loading_patient_data when CHART_OPENED arrives from error', () => {
    const error = { status: 'error' as const, message: 'oops', retryable: true, patientId: 'p1' };
    const state = transition(error, { type: 'CHART_OPENED', patientId: 'p1' });
    expect(state).toEqual({ status: 'loading_patient_data', patientId: 'p1' });
  });

    it('CHART_CLOSED from ready clears back to awaiting_chart', () => {
    const ready = { status: 'ready' as const, patientId: 'p1', evaluation: EMPTY_EVAL };
    const state = transition(ready, { type: 'CHART_CLOSED' });
    expect(state).toEqual({ status: 'awaiting_chart' });
  });

  it('CHART_CLOSED while still loading abandons the in-flight fetch', () => {
    const loading = transition({ status: 'awaiting_chart' }, { type: 'CHART_OPENED', patientId: 'p1' });
    const state = transition(loading, { type: 'CHART_CLOSED' });
    expect(state).toEqual({ status: 'awaiting_chart' });
  });

  it('CHART_CLOSED from an error state clears it rather than stranding the message', () => {
    const error = { status: 'error' as const, message: 'timed out', retryable: true, patientId: 'p1' };
    const state = transition(error, { type: 'CHART_CLOSED' });
    expect(state).toEqual({ status: 'awaiting_chart' });
  });

  it('CHART_CLOSED is a no-op while still connecting', () => {
    const state = transition(INITIAL_APP_STATE, { type: 'CHART_CLOSED' });
    expect(state).toEqual(INITIAL_APP_STATE);
  });

  it('CHART_CLOSED from awaiting_chart is idempotent', () => {
    const awaiting = { status: 'awaiting_chart' as const };
    const state = transition(awaiting, { type: 'CHART_CLOSED' });
    expect(state).toEqual(awaiting);
  });

  it('a stale patient cannot reappear after the chart closes', () => {
    let state: ReturnType<typeof transition> = { status: 'awaiting_chart' };
    state = transition(state, { type: 'CHART_OPENED', patientId: 'p1' });
    state = transition(state, { type: 'CHART_CLOSED' });
    // The fetch for p1 was already in flight when the provider navigated away.
    state = transition(state, { type: 'PATIENT_DATA_FETCHED', patientId: 'p1', evaluation: EMPTY_EVAL });
    expect(state).toEqual({ status: 'awaiting_chart' });
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
});

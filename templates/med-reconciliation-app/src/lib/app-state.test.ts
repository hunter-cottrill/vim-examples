import { describe, expect, it } from 'vitest';
import { INITIAL_APP_STATE, transition, type AppInput, type AppState } from './app-state';
import type { ChartContext, ReconciliationResult } from './med-rec/types';

const context: ChartContext = { patientId: 'p1', medications: [], problems: [], source: 'entity-api' };
const result: ReconciliationResult = { kind: 'no_medications', problemCount: 0 };

const loaded = (patientId: string): AppInput => ({ type: 'CHART_DATA_LOADED', patientId, context, result });

const READY: AppState = { status: 'ready', patientId: 'p1', context, result };
const LOADING: AppState = { status: 'loading_chart', patientId: 'p1' };
const GLOBAL_ERROR: AppState = { status: 'error', reason: 'sdk_init_failed', patientId: null };
const CHART_ERROR: AppState = { status: 'error', reason: 'chart_load_failed', patientId: 'p1' };

describe('transition — connecting', () => {
  it('starts connecting', () => {
    expect(INITIAL_APP_STATE).toEqual({ status: 'connecting' });
  });

  it('moves to awaiting_chart on SDK_READY', () => {
    expect(transition(INITIAL_APP_STATE, { type: 'SDK_READY' })).toEqual({ status: 'awaiting_chart' });
  });

  it('moves to a global error on SDK_INIT_FAILED, with no patient attached', () => {
    expect(transition(INITIAL_APP_STATE, { type: 'SDK_INIT_FAILED' })).toEqual(GLOBAL_ERROR);
  });

  it('ignores every chart input while still connecting', () => {
    for (const input of [
      { type: 'CHART_OPENED', patientId: 'p1' } as const,
      loaded('p1'),
      { type: 'CHART_LOAD_FAILED', patientId: 'p1' } as const,
      { type: 'PATIENT_CONTEXT_CLEARED' } as const,
    ]) {
      expect(transition(INITIAL_APP_STATE, input)).toBe(INITIAL_APP_STATE);
    }
  });
});

describe('transition — opening and loading a chart', () => {
  it('moves from awaiting_chart to loading_chart', () => {
    expect(transition({ status: 'awaiting_chart' }, { type: 'CHART_OPENED', patientId: 'p1' })).toEqual(LOADING);
  });

  it('restarts loading when a different chart opens over a ready one', () => {
    expect(transition(READY, { type: 'CHART_OPENED', patientId: 'p2' })).toEqual({
      status: 'loading_chart',
      patientId: 'p2',
    });
  });

  it('restarts loading when the same chart is re-opened', () => {
    expect(transition(READY, { type: 'CHART_OPENED', patientId: 'p1' })).toEqual(LOADING);
  });

  it('recovers from an error state when a new chart opens', () => {
    expect(transition(CHART_ERROR, { type: 'CHART_OPENED', patientId: 'p2' })).toEqual({
      status: 'loading_chart',
      patientId: 'p2',
    });
  });

  it('becomes ready when the matching chart data arrives', () => {
    const next = transition(LOADING, loaded('p1'));
    expect(next.status).toBe('ready');
    if (next.status !== 'ready') throw new Error('expected ready');
    expect(next.patientId).toBe('p1');
  });

  it('ignores chart data for a patient we are no longer loading', () => {
    expect(transition(LOADING, loaded('p2'))).toBe(LOADING);
  });

  it('ignores a load failure for a patient we are no longer loading', () => {
    expect(transition(LOADING, { type: 'CHART_LOAD_FAILED', patientId: 'p2' })).toBe(LOADING);
  });

  it('moves to a chart-scoped error when the matching load fails', () => {
    expect(transition(LOADING, { type: 'CHART_LOAD_FAILED', patientId: 'p1' })).toEqual(CHART_ERROR);
  });

  it('ignores a load failure once already ready', () => {
    expect(transition(READY, { type: 'CHART_LOAD_FAILED', patientId: 'p1' })).toBe(READY);
  });

  it('accepts refreshed data for the patient already on screen', () => {
    const next = transition(READY, loaded('p1'));
    expect(next.status).toBe('ready');
  });
});

describe('transition — teardown', () => {
  it('resets to awaiting_chart from ready, loading and a chart-scoped error', () => {
    for (const state of [READY, LOADING, CHART_ERROR]) {
      expect(transition(state, { type: 'PATIENT_CONTEXT_CLEARED' })).toEqual({ status: 'awaiting_chart' });
    }
  });

  it('leaves a global connection error alone — it is not about any chart', () => {
    expect(transition(GLOBAL_ERROR, { type: 'PATIENT_CONTEXT_CLEARED' })).toBe(GLOBAL_ERROR);
  });

  it('is a no-op when already waiting', () => {
    const waiting: AppState = { status: 'awaiting_chart' };
    expect(transition(waiting, { type: 'PATIENT_CONTEXT_CLEARED' })).toBe(waiting);
  });
});

describe('transition — out-of-order inputs', () => {
  it('returns the identical state object rather than throwing or cloning', () => {
    const cases: Array<[AppState, AppInput]> = [
      [READY, { type: 'SDK_READY' }],
      [READY, { type: 'SDK_INIT_FAILED' }],
      [{ status: 'awaiting_chart' }, loaded('p1')],
      [{ status: 'awaiting_chart' }, { type: 'CHART_LOAD_FAILED', patientId: 'p1' }],
      [GLOBAL_ERROR, loaded('p1')],
      [LOADING, { type: 'SDK_READY' }],
    ];
    for (const [state, input] of cases) {
      expect(transition(state, input)).toBe(state);
    }
  });
});

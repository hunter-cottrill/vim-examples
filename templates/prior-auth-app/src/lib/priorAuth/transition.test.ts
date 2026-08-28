import { describe, expect, it } from 'vitest';
import type { InsuranceRead, OrderRead } from '@/lib/vim/types';
import type { PriorAuthState, RequiredRule, ProcedureCode } from './types';
import { transition } from './transition';

const requiredOrder: OrderRead = { ehrOrderId: 'order-1', orderType: 'DI', orderName: 'MRI lumbar spine' };
const notRequiredOrder: OrderRead = { ehrOrderId: 'order-1', orderType: 'PROCEDURE', orderName: 'EKG' };
const unmatchedOrder: OrderRead = { ehrOrderId: 'order-1', orderType: 'LAB', orderName: 'routine venipuncture' };
const insurance: InsuranceRead = { payerName: 'Aetna', isPrimary: true };

const procedure: ProcedureCode = { cpt: '72148', description: 'MRI lumbar spine without contrast', aliases: [], orderType: 'DI' };
const rule: RequiredRule = {
  payerId: 'aetna',
  cpt: '72148',
  requirement: 'required',
  formFields: ['clinicalJustification'],
  simulatedOutcome: 'approved',
  simulatedDelayMs: 4000,
};

const readyToSubmit: PriorAuthState = {
  kind: 'readyToSubmit',
  ehrOrderId: 'order-1',
  procedure,
  payer: { payerId: 'aetna', displayName: 'Aetna', nameMatches: ['aetna'] },
  rule,
  diagnoses: [],
};

describe('transition — idle', () => {
  it('ORDER_EVENT_RECEIVED moves to loadingContext', () => {
    const result = transition({ kind: 'idle' }, { type: 'ORDER_EVENT_RECEIVED', ehrOrderId: 'order-1' });
    expect(result).toEqual({ kind: 'loadingContext', ehrOrderId: 'order-1' });
  });

  it('every other input is a no-op', () => {
    expect(transition({ kind: 'idle' }, { type: 'SUBMIT_REQUESTED' })).toEqual({ kind: 'idle' });
    expect(transition({ kind: 'idle' }, { type: 'RETRY_CONTEXT' })).toEqual({ kind: 'idle' });
  });
});

describe('transition — loadingContext', () => {
  const loading: PriorAuthState = { kind: 'loadingContext', ehrOrderId: 'order-1' };

  it('CONTEXT_LOADED branches to readyToSubmit for a required determination', () => {
    const result = transition(loading, {
      type: 'CONTEXT_LOADED',
      ehrOrderId: 'order-1',
      order: requiredOrder,
      insurance,
      diagnoses: [],
    });
    expect(result).toMatchObject({ kind: 'readyToSubmit', procedure: { cpt: '72148' }, payer: { payerId: 'aetna' } });
  });

  it('CONTEXT_LOADED branches to notRequired', () => {
    const result = transition(loading, {
      type: 'CONTEXT_LOADED',
      ehrOrderId: 'order-1',
      order: notRequiredOrder,
      insurance,
      diagnoses: [],
    });
    expect(result).toMatchObject({ kind: 'notRequired', procedure: { cpt: '93000' } });
  });

  it('CONTEXT_LOADED branches to undetermined', () => {
    const result = transition(loading, {
      type: 'CONTEXT_LOADED',
      ehrOrderId: 'order-1',
      order: unmatchedOrder,
      insurance,
      diagnoses: [],
    });
    expect(result).toEqual({ kind: 'undetermined', ehrOrderId: 'order-1', reason: 'procedure-unmatched', candidates: undefined });
  });

  it('ignores a CONTEXT_LOADED for a stale, different order id', () => {
    const result = transition(loading, {
      type: 'CONTEXT_LOADED',
      ehrOrderId: 'order-STALE',
      order: requiredOrder,
      insurance,
      diagnoses: [],
    });
    expect(result).toEqual(loading);
  });

  it('CONTEXT_FAILED moves to contextError', () => {
    const result = transition(loading, { type: 'CONTEXT_FAILED', ehrOrderId: 'order-1', message: 'boom' });
    expect(result).toEqual({ kind: 'contextError', ehrOrderId: 'order-1', message: 'boom' });
  });

  it('ignores a CONTEXT_FAILED for a stale, different order id', () => {
    const result = transition(loading, { type: 'CONTEXT_FAILED', ehrOrderId: 'order-STALE', message: 'boom' });
    expect(result).toEqual(loading);
  });
});

describe('transition — contextError', () => {
  const errored: PriorAuthState = { kind: 'contextError', ehrOrderId: 'order-1', message: 'boom' };

  it('RETRY_CONTEXT moves back to loadingContext with the same order id', () => {
    expect(transition(errored, { type: 'RETRY_CONTEXT' })).toEqual({ kind: 'loadingContext', ehrOrderId: 'order-1' });
  });

  it('every other input is a no-op', () => {
    expect(transition(errored, { type: 'SUBMIT_REQUESTED' })).toEqual(errored);
  });
});

describe('transition — readyToSubmit / submitError / submitting', () => {
  it('SUBMIT_REQUESTED from readyToSubmit moves to submitting, preserving context', () => {
    const result = transition(readyToSubmit, { type: 'SUBMIT_REQUESTED' });
    expect(result).toEqual({ ...readyToSubmit, kind: 'submitting' });
  });

  it('every other input on readyToSubmit is a no-op', () => {
    expect(transition(readyToSubmit, { type: 'RETRY_CONTEXT' })).toEqual(readyToSubmit);
  });

  it('SUBMIT_REQUESTED from submitError moves to submitting, dropping the message', () => {
    const errored: PriorAuthState = { ...readyToSubmit, kind: 'submitError', message: 'network error' };
    const result = transition(errored, { type: 'SUBMIT_REQUESTED' });
    expect(result).toEqual({ ...readyToSubmit, kind: 'submitting' });
  });

  it('SUBMIT_SUCCEEDED from submitting moves to pending', () => {
    const submitting: PriorAuthState = { ...readyToSubmit, kind: 'submitting' };
    const result = transition(submitting, { type: 'SUBMIT_SUCCEEDED', requestId: 'req-1' });
    expect(result).toEqual({ kind: 'pending', ehrOrderId: 'order-1', requestId: 'req-1', procedure });
  });

  it('SUBMIT_FAILED from submitting moves to submitError with the message', () => {
    const submitting: PriorAuthState = { ...readyToSubmit, kind: 'submitting' };
    const result = transition(submitting, { type: 'SUBMIT_FAILED', message: 'network error' });
    expect(result).toEqual({ ...readyToSubmit, kind: 'submitError', message: 'network error' });
  });

  it('every other input on submitting is a no-op', () => {
    const submitting: PriorAuthState = { ...readyToSubmit, kind: 'submitting' };
    expect(transition(submitting, { type: 'RETRY_CONTEXT' })).toEqual(submitting);
  });
});

describe('transition — pending / pendingTimedOut', () => {
  const pending: PriorAuthState = { kind: 'pending', ehrOrderId: 'order-1', requestId: 'req-1', procedure };

  it('POLL_RESULT_APPROVED moves to approved', () => {
    const result = transition(pending, { type: 'POLL_RESULT_APPROVED', authNumber: 'PA-ABCD1234' });
    expect(result).toEqual({ kind: 'approved', ehrOrderId: 'order-1', requestId: 'req-1', procedure, authNumber: 'PA-ABCD1234' });
  });

  it('POLL_RESULT_DENIED moves to denied', () => {
    const result = transition(pending, { type: 'POLL_RESULT_DENIED', denialReason: 'nope' });
    expect(result).toEqual({ kind: 'denied', ehrOrderId: 'order-1', requestId: 'req-1', procedure, denialReason: 'nope' });
  });

  it('POLL_EXHAUSTED moves to pendingTimedOut', () => {
    const result = transition(pending, { type: 'POLL_EXHAUSTED' });
    expect(result).toEqual({ kind: 'pendingTimedOut', ehrOrderId: 'order-1', requestId: 'req-1', procedure });
  });

  it('every other input on pending is a no-op', () => {
    expect(transition(pending, { type: 'SUBMIT_REQUESTED' })).toEqual(pending);
  });

  it('RECHECK_REQUESTED from pendingTimedOut moves back to pending', () => {
    const timedOut: PriorAuthState = { kind: 'pendingTimedOut', ehrOrderId: 'order-1', requestId: 'req-1', procedure };
    expect(transition(timedOut, { type: 'RECHECK_REQUESTED' })).toEqual(pending);
  });

  it('every other input on pendingTimedOut is a no-op', () => {
    const timedOut: PriorAuthState = { kind: 'pendingTimedOut', ehrOrderId: 'order-1', requestId: 'req-1', procedure };
    expect(transition(timedOut, { type: 'SUBMIT_REQUESTED' })).toEqual(timedOut);
  });
});

describe('transition — terminal states, RESET, and same/different order ids', () => {
  const terminalStates: PriorAuthState[] = [
    { kind: 'notRequired', ehrOrderId: 'order-1', procedure },
    { kind: 'undetermined', ehrOrderId: 'order-1', reason: 'payer-unmatched' },
    { kind: 'approved', ehrOrderId: 'order-1', requestId: 'req-1', procedure, authNumber: 'PA-ABCD1234' },
    { kind: 'denied', ehrOrderId: 'order-1', requestId: 'req-1', procedure, denialReason: 'nope' },
    readyToSubmit,
    { kind: 'pending', ehrOrderId: 'order-1', requestId: 'req-1', procedure },
    { kind: 'loadingContext', ehrOrderId: 'order-1' },
    { kind: 'contextError', ehrOrderId: 'order-1', message: 'boom' },
  ];

  it('RESET returns idle from every state', () => {
    for (const state of terminalStates) {
      expect(transition(state, { type: 'RESET' })).toEqual({ kind: 'idle' });
    }
  });

  it('ORDER_EVENT_RECEIVED with the same order id is a no-op from every non-idle state', () => {
    for (const state of terminalStates) {
      expect(transition(state, { type: 'ORDER_EVENT_RECEIVED', ehrOrderId: 'order-1' })).toEqual(state);
    }
  });

  it('ORDER_EVENT_RECEIVED with a different order id moves to loadingContext for every state', () => {
    for (const state of terminalStates) {
      expect(transition(state, { type: 'ORDER_EVENT_RECEIVED', ehrOrderId: 'order-2' })).toEqual({
        kind: 'loadingContext',
        ehrOrderId: 'order-2',
      });
    }
  });
});

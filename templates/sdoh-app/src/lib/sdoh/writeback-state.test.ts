import { describe, expect, it } from 'vitest';
import { writebackTransition } from './writeback-state';
import type { WritebackState } from './writeback-state';

const IDLE: WritebackState = { status: 'idle' };
const SUBMITTING: WritebackState = { status: 'submitting' };

describe('writebackTransition', () => {
  it('idle -> submitting -> success', () => {
    const submitting = writebackTransition(IDLE, { type: 'SUBMIT' });
    expect(submitting).toEqual(SUBMITTING);
    const result = writebackTransition(submitting, { type: 'RESULT', outcome: { ok: true } });
    expect(result).toEqual({ status: 'success' });
  });

  it('submitting -> denied', () => {
    const result = writebackTransition(SUBMITTING, { type: 'RESULT', outcome: { ok: false, reason: 'denied' } });
    expect(result).toEqual({ status: 'denied' });
  });

  it('submitting -> not_configured', () => {
    const result = writebackTransition(SUBMITTING, {
      type: 'RESULT',
      outcome: { ok: false, reason: 'not_configured' },
    });
    expect(result).toEqual({ status: 'not_configured' });
  });

  it('submitting -> error with detail', () => {
    const result = writebackTransition(SUBMITTING, {
      type: 'RESULT',
      outcome: { ok: false, reason: 'error', detail: 'network blip' },
    });
    expect(result).toEqual({ status: 'error', detail: 'network blip' });
  });

  it('a second SUBMIT while already submitting is a no-op', () => {
    const result = writebackTransition(SUBMITTING, { type: 'SUBMIT' });
    expect(result).toEqual(SUBMITTING);
  });

  it('a RESULT arriving while idle (out of order) is a no-op', () => {
    const result = writebackTransition(IDLE, { type: 'RESULT', outcome: { ok: true } });
    expect(result).toEqual(IDLE);
  });

  it('RESET returns to idle from any state', () => {
    expect(writebackTransition({ status: 'success' }, { type: 'RESET' })).toEqual(IDLE);
    expect(writebackTransition({ status: 'error', detail: 'x' }, { type: 'RESET' })).toEqual(IDLE);
  });
});
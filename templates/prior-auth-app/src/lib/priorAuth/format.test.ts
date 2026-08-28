import { describe, expect, it } from 'vitest';
import { formatAuthNumber, formatUndeterminedReason } from './format';

describe('formatAuthNumber', () => {
  it('prefixes the raw auth number', () => {
    expect(formatAuthNumber('PA-ABCD1234')).toBe('Authorization #PA-ABCD1234');
  });
});

describe('formatUndeterminedReason', () => {
  it('returns a distinct message per reason', () => {
    const messages = new Set([
      formatUndeterminedReason('procedure-unmatched'),
      formatUndeterminedReason('procedure-ambiguous'),
      formatUndeterminedReason('payer-unmatched'),
      formatUndeterminedReason('no-rule-for-payer-and-procedure'),
    ]);
    expect(messages.size).toBe(4);
  });
});

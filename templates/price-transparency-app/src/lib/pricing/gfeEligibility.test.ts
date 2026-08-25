import { describe, expect, it } from 'vitest';
import { evaluateGfeEligibility } from './gfeEligibility';

describe('evaluateGfeEligibility', () => {
  it('requires a GFE for self-pay patients regardless of contracted-rate status', () => {
    expect(evaluateGfeEligibility({ selfPay: true, contractedRateFound: true })).toBe('required');
    expect(evaluateGfeEligibility({ selfPay: true, contractedRateFound: false })).toBe('required');
  });

  it('recommends a GFE for insured patients with no contracted rate (effectively out-of-network)', () => {
    expect(evaluateGfeEligibility({ selfPay: false, contractedRateFound: false })).toBe('recommended');
  });

  it('marks a GFE not applicable for insured patients with a contracted rate', () => {
    expect(evaluateGfeEligibility({ selfPay: false, contractedRateFound: true })).toBe('not-applicable');
  });

  it('fails toward disclosure when self-pay status could not be determined', () => {
    expect(evaluateGfeEligibility({ selfPay: 'unknown', contractedRateFound: true })).toBe('recommended');
    expect(evaluateGfeEligibility({ selfPay: 'unknown', contractedRateFound: false })).toBe('recommended');
  });
});

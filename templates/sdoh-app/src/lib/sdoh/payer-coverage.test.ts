import { describe, expect, it } from 'vitest';
import { matchCoverage } from './payer-coverage';

describe('matchCoverage', () => {
  it('matches an exact Medicaid hint with high confidence', () => {
    const result = matchCoverage([{ payerName: 'State Medicaid Plan' }]);
    expect(result).toEqual({ confidence: 'high', coverageType: 'medicaid' });
  });

  it('matches a "dual" hint with ambiguous confidence', () => {
    const result = matchCoverage([{ payerName: 'Dual Eligible Special Needs Plan' }]);
    expect(result).toEqual({ confidence: 'ambiguous', coverageType: 'medicaid' });
  });

  it('returns none for a commercial-sounding payer name with no hint match', () => {
    const result = matchCoverage([{ payerName: 'Acme Regional Insurance Co' }]);
    expect(result).toEqual({ confidence: 'none' });
  });

  it('returns none for an empty insurances list', () => {
    expect(matchCoverage([])).toEqual({ confidence: 'none' });
  });

  it('prefers the highest-confidence match across multiple insurance lines', () => {
    const result = matchCoverage([{ payerName: 'Dual Eligible Plan' }, { payerName: 'State Medicaid' }]);
    expect(result).toEqual({ confidence: 'high', coverageType: 'medicaid' });
  });
});

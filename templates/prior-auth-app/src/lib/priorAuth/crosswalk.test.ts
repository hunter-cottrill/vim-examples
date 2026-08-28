import { describe, expect, it } from 'vitest';
import { matchOrderToProcedure } from './crosswalk';

describe('matchOrderToProcedure', () => {
  it('resolves a known alias with high confidence', () => {
    const result = matchOrderToProcedure('MRI lumbar spine');
    expect(result).toMatchObject({ confidence: 'high', procedure: { cpt: '72148' } });
  });

  it('resolves a generic "MRI spine" order as ambiguous between lumbar and cervical', () => {
    const result = matchOrderToProcedure('MRI spine');
    expect(result.confidence).toBe('ambiguous');
    if (result.confidence === 'ambiguous') {
      const cpts = result.candidates.map((c) => c.cpt).sort();
      expect(cpts).toEqual(['72141', '72148']);
    }
  });

  it('resolves an unmatched order (e.g. a LAB-style order text) as none', () => {
    const result = matchOrderToProcedure('routine venipuncture blood draw');
    expect(result).toEqual({ confidence: 'none' });
  });

  it('resolves an empty order text as none', () => {
    expect(matchOrderToProcedure('')).toEqual({ confidence: 'none' });
  });

  it('matches a surgical procedure alias with high confidence', () => {
    const result = matchOrderToProcedure('Total knee arthroplasty');
    expect(result).toMatchObject({ confidence: 'high', procedure: { cpt: '27447' } });
  });
});

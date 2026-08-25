import { describe, it, expect } from 'vitest';
import { isEconsultCandidate, ECONSULT_ELIGIBLE } from './referral-appropriateness';

describe('isEconsultCandidate', () => {
  it('matches every bundled entry on its specialty and a code starting with its icd10Prefix', () => {
    for (const entry of ECONSULT_ELIGIBLE) {
      const match = isEconsultCandidate(entry.specialty, [{ code: `${entry.icd10Prefix}9` }]);
      expect(match).toEqual(entry);
    }
  });

  it('returns null for a code that matches no bundled prefix', () => {
    expect(isEconsultCandidate('Cardiology', [{ code: 'Z00.0' }])).toBeNull();
  });

  it('returns null when specialty is missing', () => {
    expect(isEconsultCandidate(undefined, [{ code: 'L309' }])).toBeNull();
  });

  it('returns null when conditions is missing', () => {
    expect(isEconsultCandidate('Dermatology', undefined)).toBeNull();
  });

  it('matches only on conditions[].code, never on free-text reasons', () => {
    // A referral-shaped input with a suggestive free-text reason but no matching
    // structured code must not match — isEconsultCandidate never sees `reasons`
    // at all, since it isn't part of its signature.
    const match = isEconsultCandidate('Dermatology', [{ code: 'Z00.0', description: 'often resolved via e-consult' }]);
    expect(match).toBeNull();
  });
});

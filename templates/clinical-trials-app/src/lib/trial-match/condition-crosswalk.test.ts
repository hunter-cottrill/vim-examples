import { describe, expect, it } from 'vitest';
import { matchConditionCrosswalk } from './condition-crosswalk';
import type { Diagnosis } from './types';

function diagnosis(overrides: Partial<Diagnosis>): Diagnosis {
  return { code: 'E11.9', system: 'ICD-10', status: 'active', description: '', onSetDate: null, ...overrides };
}

describe('matchConditionCrosswalk', () => {
  it('resolves an exact ICD-10 prefix to high confidence with the correct search term', () => {
    const match = matchConditionCrosswalk(diagnosis({ code: 'E11.9', description: 'Type 2 diabetes mellitus' }));
    expect(match.confidence).toBe('high');
    expect(match.conditionKey).toBe('type2_diabetes');
    expect(match.searchTerm).toBe('Type 2 Diabetes Mellitus');
  });

  it('resolves a combination code prefix to ambiguous with both candidate keys', () => {
    const match = matchConditionCrosswalk(
      diagnosis({ code: 'I13.0', description: 'Hypertensive heart and chronic kidney disease' }),
    );
    expect(match.confidence).toBe('ambiguous');
    expect(match.candidateConditionKeys).toEqual(['hypertension', 'heart_failure']);
    expect(match.conditionKey).toBeUndefined();
  });

  it('resolves a known non-ICD-10 system to none, regardless of code value', () => {
    const match = matchConditionCrosswalk(diagnosis({ code: '44054006', system: 'SNOMED-CT' }));
    expect(match.confidence).toBe('none');
  });

  it('still attempts the table lookup when system is missing entirely — confirmed live: some EHRs do not populate this field', () => {
    const match = matchConditionCrosswalk(diagnosis({ code: 'I10', description: 'Essential Hypertension', system: '' }));
    expect(match.confidence).toBe('high');
    expect(match.conditionKey).toBe('hypertension');
  });

  it('treats an unrecognized (but not known-non-ICD-10) system the same way — attempts the lookup', () => {
    const match = matchConditionCrosswalk(diagnosis({ code: 'E11.9', system: 'some-unknown-system' }));
    expect(match.confidence).toBe('high');
  });

  it('resolves an ICD-10 code outside the curated table to none', () => {
    const match = matchConditionCrosswalk(diagnosis({ code: 'M54.5', description: 'Low back pain' }));
    expect(match.confidence).toBe('none');
  });

  it('covers every curated condition prefix', () => {
    const codes = ['E11.9', 'J44.9', 'I10', 'I50.9', 'F32.9', 'F33.1', 'E66.9'];
    for (const code of codes) {
      expect(matchConditionCrosswalk(diagnosis({ code })).confidence).toBe('high');
    }
  });
});

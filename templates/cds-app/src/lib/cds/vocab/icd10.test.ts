import { describe, it, expect } from 'vitest';
import { icd10Vocabulary } from './icd10';

describe('icd10 vocabulary', () => {
  it('retrieves relevant codes for a chief complaint by keyword', () => {
    const hits = icd10Vocabulary.retrieve('sore throat', 5);
    expect(hits.length).toBeGreaterThan(0);
    expect(hits.every((h) => h.system === 'ICD-10-CM')).toBe(true);
  });

  it('retrieves via keyword synonyms not present verbatim in the description', () => {
    // "can't catch my breath" is a keyword on the shortness-of-breath entry (R06.02)
    const hits = icd10Vocabulary.retrieve("can't catch my breath", 5);
    expect(hits.some((h) => h.code === 'R06.02')).toBe(true);
  });

  it('returns an empty shortlist for empty query text (never calls the LLM with nothing)', () => {
    expect(icd10Vocabulary.retrieve('', 5)).toHaveLength(0);
  });

  it('lookup resolves a known code and returns null for an unknown one', () => {
    expect(icd10Vocabulary.lookup('R06.02')).not.toBeNull();
    expect(icd10Vocabulary.lookup('ZZ9.99')).toBeNull();
  });

  it('respects the k limit on retrieve', () => {
    const hits = icd10Vocabulary.retrieve('pain', 2);
    expect(hits.length).toBeLessThanOrEqual(2);
  });
});

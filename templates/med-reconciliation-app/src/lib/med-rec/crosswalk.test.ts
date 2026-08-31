import { describe, expect, it } from 'vitest';
import { isConsideredActive, matchMedicationClass, matchProblemGroup } from './crosswalk';
import type { ProblemRecord } from './types';

function problem(overrides: Partial<ProblemRecord> = {}): ProblemRecord {
  return { id: 'p1', rawCode: null, rawDescription: null, rawStatus: null, rawSystem: null, ...overrides };
}

describe('matchMedicationClass', () => {
  it('resolves an exact generic name with high confidence', () => {
    const match = matchMedicationClass('atorvastatin');
    expect(match.confidence).toBe('high');
    if (match.confidence !== 'high') throw new Error('expected high');
    expect(match.ingredient).toBe('atorvastatin');
    expect(match.classIds).toEqual(['statin']);
  });

  it('resolves a brand alias to its generic ingredient', () => {
    const match = matchMedicationClass('Lipitor 40 MG tablet');
    expect(match.confidence).toBe('high');
    if (match.confidence !== 'high') throw new Error('expected high');
    expect(match.ingredient).toBe('atorvastatin');
  });

  it('ignores case, punctuation and trailing strength/form noise', () => {
    for (const name of ['ATORVASTATIN 40 MG TABLET', 'atorvastatin, 40mg oral tab', 'Atorvastatin Calcium 40 mg']) {
      const match = matchMedicationClass(name);
      expect(match.confidence).toBe('high');
    }
  });

  it('reports a combination product as ambiguous rather than guessing one ingredient', () => {
    const match = matchMedicationClass('Lisinopril-HCTZ 20-12.5 mg tablet');
    expect(match.confidence).toBe('ambiguous');
    if (match.confidence !== 'ambiguous') throw new Error('expected ambiguous');
    expect(match.candidates.map((c) => c.ingredient).sort()).toEqual(['hydrochlorothiazide', 'lisinopril']);
  });

  it('prunes a term contained inside a longer matched term', () => {
    // "amoxicillin" is inside "amoxicillin clavulanate" — reporting both would
    // be a spurious ambiguity, not a real one.
    const match = matchMedicationClass('Amoxicillin-Clavulanate 875-125 mg');
    expect(match.confidence).toBe('high');
    if (match.confidence !== 'high') throw new Error('expected high');
    expect(match.ingredient).toBe('amoxicillin clavulanate');
  });

  it('keeps an ambiguous match whose candidates happen to share a class', () => {
    const match = matchMedicationClass('Aspirin-Dipyridamole 25-200 mg capsule');
    expect(match.confidence).toBe('ambiguous');
    if (match.confidence !== 'ambiguous') throw new Error('expected ambiguous');
    expect(match.candidates.every((c) => c.classIds.includes('antiplatelet'))).toBe(true);
  });

  it('returns none for a drug outside the vocabulary', () => {
    expect(matchMedicationClass('Zolpidem 10 mg tablet').confidence).toBe('none');
  });

  it('returns none for a null or blank name rather than throwing', () => {
    expect(matchMedicationClass(null).confidence).toBe('none');
    expect(matchMedicationClass('   ').confidence).toBe('none');
  });

  it('does not match an ingredient appearing only as part of another word', () => {
    expect(matchMedicationClass('Metforminimab 10 mg').confidence).toBe('none');
  });
});

describe('matchProblemGroup', () => {
  it('matches an ICD-10 code by prefix', () => {
    const match = matchProblemGroup(problem({ rawCode: 'E11.9' }));
    expect(match.confidence).toBe('high');
    if (match.confidence !== 'high') throw new Error('expected high');
    expect(match.groupId).toBe('type-2-diabetes');
    expect(match.matchedOn).toBe('icd10');
  });

  it('matches a dotless code and a more specific child code', () => {
    expect(matchProblemGroup(problem({ rawCode: 'E119' })).confidence).toBe('high');
    expect(matchProblemGroup(problem({ rawCode: 'E11.42' })).confidence).toBe('high');
  });

  it('matches when system is absent — the common real-world case', () => {
    // Real sandbox problem lists return code + description with NO system.
    // Gating on system === 'ICD-10' would discard every one of them.
    const match = matchProblemGroup(problem({ rawCode: 'I10', rawSystem: null }));
    expect(match.confidence).toBe('high');
  });

  it('still matches when system says ICD-10 in any spelling', () => {
    for (const system of ['ICD-10', 'icd10', 'ICD-10-CM']) {
      expect(matchProblemGroup(problem({ rawCode: 'I10', rawSystem: system })).confidence).toBe('high');
    }
  });

  it('skips code matching when the system is explicitly not ICD-10', () => {
    const match = matchProblemGroup(problem({ rawCode: '44054006', rawSystem: 'SNOMED-CT' }));
    expect(match.confidence).toBe('none');
  });

  it('falls back to the description when there is no code', () => {
    const match = matchProblemGroup(problem({ rawCode: null, rawDescription: 'Type 2 diabetes mellitus' }));
    expect(match.confidence).toBe('high');
    if (match.confidence !== 'high') throw new Error('expected high');
    expect(match.groupId).toBe('type-2-diabetes');
    expect(match.matchedOn).toBe('description');
  });

  it('reports a description matching several groups as ambiguous', () => {
    const match = matchProblemGroup(
      problem({ rawCode: null, rawDescription: 'Osteoarthritis of knee with chronic low back pain' }),
    );
    expect(match.confidence).toBe('ambiguous');
    if (match.confidence !== 'ambiguous') throw new Error('expected ambiguous');
    expect(match.groupIds.sort()).toEqual(['chronic-pain', 'osteoarthritis']);
  });

  it('returns none when neither the code nor the description is in the vocabulary', () => {
    const match = matchProblemGroup(
      problem({ rawCode: 'Z00.00', rawDescription: 'Encounter for general adult medical examination' }),
    );
    expect(match.confidence).toBe('none');
  });
});

describe('isConsideredActive', () => {
  it('treats an absent or blank status as active — absence is not evidence of resolution', () => {
    expect(isConsideredActive(problem({ rawStatus: null }))).toBe(true);
    expect(isConsideredActive(problem({ rawStatus: '  ' }))).toBe(true);
  });

  it('treats an explicit active status as active', () => {
    expect(isConsideredActive(problem({ rawStatus: 'active' }))).toBe(true);
  });

  it('treats explicit inactive-sounding statuses as inactive', () => {
    for (const status of ['Resolved', 'inactive', 'In Remission', 'entered-in-error']) {
      expect(isConsideredActive(problem({ rawStatus: status }))).toBe(false);
    }
  });
});

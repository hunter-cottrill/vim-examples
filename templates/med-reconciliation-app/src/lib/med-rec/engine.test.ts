import { describe, expect, it } from 'vitest';
import { reconcile } from './engine';
import type { ChartContext, Finding, FindingKind, MedicationRecord, ProblemRecord } from './types';

let seq = 0;

function med(rawName: string | null, overrides: Partial<MedicationRecord> = {}): MedicationRecord {
  seq += 1;
  return {
    id: `m${seq}`,
    rawName,
    strength: null,
    form: null,
    frequency: null,
    ndcCode: null,
    ...overrides,
  };
}

function prob(rawCode: string | null, rawDescription: string | null, rawStatus: string | null = null): ProblemRecord {
  seq += 1;
  return { id: `p${seq}`, rawCode, rawDescription, rawStatus, rawSystem: null };
}

function chart(medications: MedicationRecord[], problems: ProblemRecord[]): ChartContext {
  return { patientId: 'patient-1', medications, problems, source: 'entity-api' };
}

function kinds(findings: Finding[]): FindingKind[] {
  return findings.map((f) => f.kind);
}

describe('reconcile — result shape', () => {
  it('reports no_medications when the medication list is empty', () => {
    const result = reconcile(chart([], [prob('E11.9', 'Type 2 diabetes mellitus')]));
    expect(result.kind).toBe('no_medications');
    if (result.kind !== 'no_medications') throw new Error('expected no_medications');
    expect(result.problemCount).toBe(1);
  });

  it('reports nothing_to_reconcile with no exclusions for a fully matched chart', () => {
    const result = reconcile(chart([med('Metformin 500 mg')], [prob('E11.9', 'Type 2 diabetes mellitus')]));
    expect(result.kind).toBe('nothing_to_reconcile');
    if (result.kind !== 'nothing_to_reconcile') throw new Error('expected nothing_to_reconcile');
    expect(result.excluded).toEqual([]);
    expect(result.medicationCount).toBe(1);
  });

  it('keeps "nothing found" and "could not look" distinct on the same result', () => {
    // The negative outcome still carries what it could not analyse, so the UI
    // can show "no findings" and "1 medication not analysed" as two things.
    const result = reconcile(
      chart([med('Metformin 500 mg'), med('Zolpidem 10 mg')], [prob('E11.9', 'Type 2 diabetes mellitus')]),
    );
    expect(result.kind).toBe('nothing_to_reconcile');
    if (result.kind !== 'nothing_to_reconcile') throw new Error('expected nothing_to_reconcile');
    expect(result.excluded).toHaveLength(1);
    expect(result.excluded[0].reason).toBe('unrecognized');
  });
});

describe('reconcile — exclusions', () => {
  it('excludes a medication with no name as insufficient_data, never as unrecognized', () => {
    const result = reconcile(chart([med(null, { ndcCode: '00093-7146-56', strength: '40 mg' })], []));
    expect(result.kind).toBe('nothing_to_reconcile');
    if (result.kind !== 'nothing_to_reconcile') throw new Error('expected nothing_to_reconcile');
    expect(result.excluded).toHaveLength(1);
    expect(result.excluded[0].reason).toBe('insufficient_data');
  });

  it('treats a blank name the same as an absent one', () => {
    const result = reconcile(chart([med('   ')], []));
    if (result.kind !== 'nothing_to_reconcile') throw new Error('expected nothing_to_reconcile');
    expect(result.excluded[0].reason).toBe('insufficient_data');
  });

  it('excludes an unknown drug as unrecognized', () => {
    const result = reconcile(chart([med('Zolpidem 10 mg')], []));
    if (result.kind !== 'nothing_to_reconcile') throw new Error('expected nothing_to_reconcile');
    expect(result.excluded[0].reason).toBe('unrecognized');
  });
});

describe('reconcile — duplicate_class', () => {
  it('flags two medications in the same class with high evidence', () => {
    const result = reconcile(
      chart([med('Atorvastatin 40 mg'), med('Simvastatin 20 mg')], [prob('E78.5', 'Hyperlipidemia')]),
    );
    if (result.kind !== 'findings') throw new Error('expected findings');
    expect(kinds(result.findings)).toEqual(['duplicate_class']);
    const finding = result.findings[0];
    if (finding.kind !== 'duplicate_class') throw new Error('expected duplicate_class');
    expect(finding.classId).toBe('statin');
    expect(finding.medications).toHaveLength(2);
    expect(finding.evidence).toBe('inferred_high');
  });

  it('downgrades evidence to ambiguous when a contributing match was ambiguous', () => {
    const result = reconcile(
      chart(
        [med('Clopidogrel 75 mg'), med('Aspirin-Dipyridamole 25-200 mg')],
        [prob('I25.10', 'Coronary artery disease')],
      ),
    );
    if (result.kind !== 'findings') throw new Error('expected findings');
    const finding = result.findings.find((f) => f.kind === 'duplicate_class');
    if (!finding || finding.kind !== 'duplicate_class') throw new Error('expected duplicate_class');
    expect(finding.classId).toBe('antiplatelet');
    expect(finding.evidence).toBe('inferred_ambiguous');
  });

  it('does not flag a duplicate when the ambiguous candidates disagree on class', () => {
    // "Lisinopril-HCTZ" resolves to two ingredients in different classes, so
    // no single class is certain — pairing it with plain lisinopril would be
    // a guess, and a false duplicate is worse than a missed one here.
    const result = reconcile(
      chart([med('Lisinopril 10 mg'), med('Lisinopril-HCTZ 20-12.5 mg')], [prob('I10', 'Essential hypertension')]),
    );
    expect(result.kind).toBe('nothing_to_reconcile');
  });
});

describe('reconcile — problem_without_class_match', () => {
  it('flags an active problem with no medication in an expected class', () => {
    const result = reconcile(
      chart(
        [med('Levothyroxine 50 mcg')],
        [prob('E11.9', 'Type 2 diabetes mellitus'), prob('E03.9', 'Hypothyroidism')],
      ),
    );
    if (result.kind !== 'findings') throw new Error('expected findings');
    expect(kinds(result.findings)).toEqual(['problem_without_class_match']);
    const finding = result.findings[0];
    if (finding.kind !== 'problem_without_class_match') throw new Error('wrong kind');
    expect(finding.groupLabel).toBe('Type 2 diabetes mellitus');
    expect(finding.expectedClassLabels.length).toBeGreaterThan(0);
    expect(finding.evidence).toBe('inferred_high');
  });

  it('does not flag a resolved problem', () => {
    const active = reconcile(
      chart([med('Metformin 500 mg')], [prob('E11.9', 'Type 2 diabetes'), prob('E03.9', 'Hypothyroidism')]),
    );
    expect(active.kind).toBe('findings');

    const resolved = reconcile(
      chart(
        [med('Metformin 500 mg')],
        [prob('E11.9', 'Type 2 diabetes'), prob('E03.9', 'Hypothyroidism', 'resolved')],
      ),
    );
    expect(resolved.kind).toBe('nothing_to_reconcile');
  });

  it('does not flag a problem it could not map, while still flagging one it could', () => {
    // Z00.00 is outside the vocabulary. It must contribute no finding of its
    // own — the mapped diabetes problem beside it is the only one reported.
    const result = reconcile(
      chart(
        [med('Levothyroxine 50 mcg')],
        [prob('E11.9', 'Type 2 diabetes mellitus'), prob('Z00.00', 'Annual physical exam')],
      ),
    );
    if (result.kind !== 'findings') throw new Error('expected findings');
    const problemFindings = result.findings.filter((f) => f.kind === 'problem_without_class_match');
    expect(problemFindings).toHaveLength(1);
    const only = problemFindings[0];
    if (only.kind !== 'problem_without_class_match') throw new Error('wrong kind');
    expect(only.groupLabel).toBe('Type 2 diabetes mellitus');
  });
});

describe('reconcile — medication_without_problem_match', () => {
  it('flags a medication whose class matches no active problem', () => {
    const result = reconcile(
      chart([med('Levothyroxine 50 mcg'), med('Metformin 500 mg')], [prob('E11.9', 'Type 2 diabetes mellitus')]),
    );
    if (result.kind !== 'findings') throw new Error('expected findings');
    expect(kinds(result.findings)).toEqual(['medication_without_problem_match']);
    const finding = result.findings[0];
    if (finding.kind !== 'medication_without_problem_match') throw new Error('wrong kind');
    expect(finding.medication.rawName).toBe('Levothyroxine 50 mcg');
    expect(finding.classLabels).toEqual(['Thyroid hormone replacement']);
  });

  it('is suppressed entirely when any active problem could not be mapped', () => {
    // An unmapped problem is not evidence the medication is unmatched — it is
    // evidence we cannot tell, and the flag says so on the result.
    const result = reconcile(
      chart(
        [med('Levothyroxine 50 mcg'), med('Metformin 500 mg')],
        [prob('E11.9', 'Type 2 diabetes mellitus'), prob('Z00.00', 'Annual physical exam')],
      ),
    );
    expect(result.kind).toBe('nothing_to_reconcile');
    if (result.kind !== 'nothing_to_reconcile') throw new Error('expected nothing_to_reconcile');
    expect(result.unmappedProblemSuppression).toBe(true);
  });

  it('reports no suppression when every active problem mapped', () => {
    const result = reconcile(
      chart([med('Levothyroxine 50 mcg'), med('Metformin 500 mg')], [prob('E11.9', 'Type 2 diabetes mellitus')]),
    );
    if (result.kind !== 'findings') throw new Error('expected findings');
    expect(result.unmappedProblemSuppression).toBe(false);
  });
});

describe('reconcile — the full demo chart', () => {
  it('produces all three finding kinds and both exclusion reasons', () => {
    const result = reconcile(
      chart(
        [
          med('Atorvastatin 40 mg'),
          med('Simvastatin 20 mg'),
          med('Levothyroxine 50 mcg'),
          med('Zolpidem 10 mg'),
          med(null, { ndcCode: '00093-7146-56', strength: '40 mg' }),
        ],
        [prob('E11.9', 'Type 2 diabetes mellitus'), prob('E78.5', 'Hyperlipidemia')],
      ),
    );

    if (result.kind !== 'findings') throw new Error('expected findings');
    expect(kinds(result.findings).sort()).toEqual([
      'duplicate_class',
      'medication_without_problem_match',
      'problem_without_class_match',
    ]);
    expect(result.excluded.map((e) => e.reason).sort()).toEqual(['insufficient_data', 'unrecognized']);
    expect(result.medicationCount).toBe(5);
    expect(result.problemCount).toBe(2);
    expect(result.unmappedProblemSuppression).toBe(false);
  });
});

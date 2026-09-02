import { describe, expect, it } from 'vitest';
import { matchDiagnosis, matchMedication, reconcileDiagnoses, reconcileMedications } from './reconciliation';
import type { DischargeDiagnosis, DischargeMedication, MedicationEntry, ProblemEntry } from './types';

describe('matchDiagnosis', () => {
  const discharge: DischargeDiagnosis = { code: 'J44.1', system: 'ICD-10', description: 'COPD with acute exacerbation' };

  it('returns high confidence on an exact code match', () => {
    const current: ProblemEntry[] = [{ code: 'J44.1', description: 'Some other wording' }];
    expect(matchDiagnosis(discharge, current)).toEqual({ confidence: 'high', matched: current[0] });
  });

  it('returns ambiguous confidence on description overlap with no code match', () => {
    const current: ProblemEntry[] = [{ description: 'Acute exacerbation of COPD' }];
    const result = matchDiagnosis(discharge, current);
    expect(result.confidence).toBe('ambiguous');
    expect(result.matched).toBe(current[0]);
  });

  it('returns none when neither code nor description overlap', () => {
    const current: ProblemEntry[] = [{ code: 'I10', description: 'Essential hypertension' }];
    expect(matchDiagnosis(discharge, current)).toEqual({ confidence: 'none' });
  });

  it('returns none when the discharge diagnosis has no code and no overlapping description', () => {
    const bareDischarge: DischargeDiagnosis = { code: '', system: 'ICD-10', description: 'Hypokalemia' };
    const current: ProblemEntry[] = [{ description: 'Type 2 diabetes mellitus' }];
    expect(matchDiagnosis(bareDischarge, current)).toEqual({ confidence: 'none' });
  });
});

describe('matchMedication', () => {
  const discharge: DischargeMedication = { medicationName: 'Prednisone 20 MG tablet', ndcCode: '00093-1234-56' };

  it('returns high confidence on an exact NDC match', () => {
    const current: MedicationEntry[] = [{ medicationName: 'Different name', ndcCode: '00093-1234-56' }];
    expect(matchMedication(discharge, current)).toEqual({ confidence: 'high', matched: current[0] });
  });

  it('returns high confidence on an exact normalized name match', () => {
    const current: MedicationEntry[] = [{ medicationName: '  prednisone 20 mg tablet  ' }];
    expect(matchMedication(discharge, current)).toEqual({ confidence: 'high', matched: current[0] });
  });

  it('returns ambiguous confidence when only the drug root matches', () => {
    const current: MedicationEntry[] = [{ medicationName: 'Prednisone 10 MG tablet' }];
    const result = matchMedication(discharge, current);
    expect(result.confidence).toBe('ambiguous');
    expect(result.matched).toBe(current[0]);
  });

  it('returns none when nothing matches', () => {
    const current: MedicationEntry[] = [{ medicationName: 'Metoprolol Tartrate 25 MG tablet' }];
    expect(matchMedication(discharge, current)).toEqual({ confidence: 'none' });
  });
});

describe('reconcileDiagnoses / reconcileMedications', () => {
  it('returns an empty array for an empty discharge list', () => {
    expect(reconcileDiagnoses([], [])).toEqual([]);
    expect(reconcileMedications([], [])).toEqual([]);
  });

  it('maps every discharge diagnosis to a reconciliation item, in order', () => {
    const discharge: DischargeDiagnosis[] = [
      { code: 'J44.1', system: 'ICD-10', description: 'COPD with acute exacerbation' },
      { code: 'E87.6', system: 'ICD-10', description: 'Hypokalemia' },
    ];
    const current: ProblemEntry[] = [{ code: 'J44.1', description: 'COPD exacerbation' }];
    const result = reconcileDiagnoses(discharge, current);
    expect(result).toHaveLength(2);
    expect(result[0]).toEqual({ kind: 'diagnosis', discharge: discharge[0], confidence: 'high', matched: current[0] });
    expect(result[1]).toEqual({ kind: 'diagnosis', discharge: discharge[1], confidence: 'none', matched: undefined });
  });

  it('maps every discharge medication to a reconciliation item, in order', () => {
    const discharge: DischargeMedication[] = [{ medicationName: 'Furosemide 40 MG tablet' }];
    const current: MedicationEntry[] = [{ medicationName: 'Furosemide 40 MG tablet' }];
    const result = reconcileMedications(discharge, current);
    expect(result).toEqual([{ kind: 'medication', discharge: discharge[0], confidence: 'high', matched: current[0] }]);
  });
});

import { describe, expect, it } from 'vitest';
import { derivePageStatus } from './pageStatus';
import type { TransitionSummary } from './types';

const SUMMARY: TransitionSummary = {
  patient: { displayName: 'Jane Doe', patientKey: 'MRN-1' },
  problems: { kind: 'empty' },
  medications: { kind: 'empty' },
  hospitalization: { kind: 'not_found' },
  diagnosisReconciliation: [],
  medicationReconciliation: [],
};

describe('derivePageStatus', () => {
  it('returns waiting when no patient is present', () => {
    expect(derivePageStatus(false, SUMMARY)).toEqual({ kind: 'waiting' });
  });

  it('returns waiting when a patient is present but no summary has resolved yet', () => {
    expect(derivePageStatus(true, null)).toEqual({ kind: 'waiting' });
  });

  it('returns result when a patient is present and a summary has resolved', () => {
    expect(derivePageStatus(true, SUMMARY)).toEqual({ kind: 'result', summary: SUMMARY });
  });
});

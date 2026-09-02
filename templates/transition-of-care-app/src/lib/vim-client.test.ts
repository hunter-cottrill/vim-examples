import { describe, expect, it } from 'vitest';
import type { Diagnosis, Patient } from '@vimconnect/app-sdk';
import { sectionStatusFromListOutcome, toPatientSnapshot } from './vim-client';

describe('toPatientSnapshot', () => {
  it('prefers mrn over ehrPatientId', () => {
    const patient: Patient = { identifiers: { mrn: 'MRN-1', ehrPatientId: 'ehr-1' } };
    expect(toPatientSnapshot(patient).patientKey).toBe('MRN-1');
  });

  it('falls back to ehrPatientId when mrn is absent', () => {
    const patient: Patient = { identifiers: { ehrPatientId: 'ehr-1' } };
    expect(toPatientSnapshot(patient).patientKey).toBe('ehr-1');
  });

  it('returns a null patientKey when no identifier is present', () => {
    const patient: Patient = {};
    expect(toPatientSnapshot(patient).patientKey).toBeNull();
  });

  it('joins first and last name into displayName, or null if both are absent', () => {
    expect(toPatientSnapshot({ demographics: { firstName: 'Jane', lastName: 'Doe' } }).displayName).toBe('Jane Doe');
    expect(toPatientSnapshot({}).displayName).toBeNull();
  });
});

describe('sectionStatusFromListOutcome', () => {
  it('maps a non-empty loaded outcome to loaded', () => {
    const data: Diagnosis[] = [{ code: 'I10' }];
    expect(sectionStatusFromListOutcome({ outcome: 'loaded', data })).toEqual({ kind: 'loaded', data });
  });

  it('maps an empty loaded outcome to empty', () => {
    expect(sectionStatusFromListOutcome({ outcome: 'loaded', data: [] })).toEqual({ kind: 'empty' });
  });

  it('maps an unsupported outcome to unsupported', () => {
    expect(sectionStatusFromListOutcome({ outcome: 'unsupported' })).toEqual({ kind: 'unsupported' });
  });

  it('maps an error outcome to error with the message', () => {
    expect(sectionStatusFromListOutcome({ outcome: 'error', message: 'retries exhausted' })).toEqual({
      kind: 'error',
      message: 'retries exhausted',
    });
  });
});

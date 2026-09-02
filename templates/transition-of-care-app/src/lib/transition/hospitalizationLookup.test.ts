import { describe, expect, it } from 'vitest';
import { evaluateHospitalization, resolvePatientKey } from './hospitalizationLookup';
import type { HospitalizationRecord, PatientSnapshot } from './types';

const RECORD: HospitalizationRecord = {
  patientKey: 'MRN-1',
  facilityName: 'Test Hospital',
  admissionDate: '2024-01-01',
  dischargeDate: '2024-01-10',
  dischargeDiagnoses: [],
  dischargeMedications: [],
};

describe('resolvePatientKey', () => {
  it('returns the patient key when present', () => {
    const patient: PatientSnapshot = { displayName: 'Jane Doe', patientKey: 'MRN-1' };
    expect(resolvePatientKey(patient)).toBe('MRN-1');
  });

  it('returns null when no identifier is available', () => {
    const patient: PatientSnapshot = { displayName: 'Jane Doe', patientKey: null };
    expect(resolvePatientKey(patient)).toBeNull();
  });
});

describe('evaluateHospitalization', () => {
  it('returns not_found when there is no record', () => {
    expect(evaluateHospitalization(null, '2024-01-15T00:00:00.000Z', 30)).toEqual({ kind: 'not_found' });
  });

  it('returns found with the correct daysSinceDischarge for a recent record', () => {
    const result = evaluateHospitalization(RECORD, '2024-01-15T00:00:00.000Z', 30);
    expect(result).toEqual({ kind: 'found', record: RECORD, daysSinceDischarge: 5 });
  });

  it('returns found exactly at the recency window boundary', () => {
    const result = evaluateHospitalization(RECORD, '2024-02-09T00:00:00.000Z', 30);
    expect(result).toEqual({ kind: 'found', record: RECORD, daysSinceDischarge: 30 });
  });

  it('returns not_found one day past the recency window boundary', () => {
    const result = evaluateHospitalization(RECORD, '2024-02-10T00:00:00.000Z', 30);
    expect(result).toEqual({ kind: 'not_found' });
  });
});

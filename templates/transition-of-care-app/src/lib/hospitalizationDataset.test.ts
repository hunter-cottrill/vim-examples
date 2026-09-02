import { describe, expect, it } from 'vitest';
import { HOSPITALIZATION_DATASET, lookupHospitalizationRecord } from './hospitalizationDataset';

describe('lookupHospitalizationRecord', () => {
  it('returns the matching record for a known patient key', () => {
    const record = lookupHospitalizationRecord(HOSPITALIZATION_DATASET, 'MRN-10234');
    expect(record?.patientKey).toBe('MRN-10234');
    expect(record?.facilityName).toBe('Riverside Medical Center');
  });

  it('returns null for an unknown patient key', () => {
    expect(lookupHospitalizationRecord(HOSPITALIZATION_DATASET, 'MRN-does-not-exist')).toBeNull();
  });
});

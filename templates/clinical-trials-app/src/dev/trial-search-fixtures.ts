// Canned ClinicalTrials.gov-shaped responses for the SIM_MODE dev harness, so
// it never makes a live network call. Keyed by patient fixture key, then by
// conditionKey — the same grouping the real /api/trials/search route returns.
// Never imported by the real SDK/network path.
import type { TrialApiResult } from '@/lib/trial-match/types';

function trial(nctId: string, briefTitle: string, city: string, lat: number, lon: number): TrialApiResult {
  return {
    nctId,
    briefTitle,
    overallStatus: 'RECRUITING',
    locations: [{ facility: `${city} Clinical Research Center`, city, state: city === 'New York' ? 'NY' : 'CO', lat, lon }],
  };
}

function trialSet(prefix: string, conditionLabel: string, count: number, baseLat: number, baseLon: number): TrialApiResult[] {
  return Array.from({ length: count }, (_, i) =>
    trial(`NCT9${prefix}${String(i).padStart(2, '0')}`, `${conditionLabel} Trial ${i + 1}`, 'Denver', baseLat + i * 0.02, baseLon + i * 0.02),
  );
}

export const TRIAL_SEARCH_FIXTURES: Record<string, Record<string, TrialApiResult[]>> = {
  diabetesDenver: {
    type2_diabetes: [
      trial('NCT90001', 'Semaglutide for Type 2 Diabetes Kidney Outcomes', 'Denver', 39.75, -105.0),
      trial('NCT90002', 'Continuous Glucose Monitoring in Type 2 Diabetes', 'Denver', 39.8, -104.95),
      trial('NCT90003', 'Type 2 Diabetes Remission Study', 'New York', 40.7128, -74.006),
    ],
  },
  copdUnrecognizedZip: {
    copd: [
      trial('NCT90010', 'Inhaled Therapy for COPD Exacerbations', 'Denver', 39.75, -105.0),
      trial('NCT90011', 'Pulmonary Rehabilitation in COPD', 'Denver', 39.8, -104.95),
    ],
  },
  obesityNoTrialsFound: {
    obesity: [],
  },
  manyConditionsTruncated: {
    type2_diabetes: trialSet('1', 'Type 2 Diabetes', 6, 39.7, -105.0),
    copd: trialSet('2', 'COPD', 6, 39.72, -104.98),
    hypertension: trialSet('3', 'Hypertension', 5, 39.74, -104.96),
    heart_failure: trialSet('4', 'Heart Failure', 5, 39.76, -104.94),
    depression: trialSet('5', 'Depression', 5, 39.78, -104.92),
  },
};

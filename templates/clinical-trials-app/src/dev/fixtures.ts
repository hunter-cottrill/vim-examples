// Fixture PatientContexts driving the pure domain logic through every branch
// of the crosswalks and buildTrialMatches (see condition-crosswalk.ts /
// zip-crosswalk.ts / trial-matching.ts). Used only by the SIM_MODE dev
// harness — never imported by the real SDK path.
import type { Diagnosis, PatientContext } from '@/lib/trial-match/types';

export interface PatientFixture {
  key: string;
  label: string;
  patient: PatientContext;
}

function diagnosis(overrides: Partial<Diagnosis>): Diagnosis {
  return { code: '', system: 'ICD-10', status: 'active', description: '', onSetDate: null, ...overrides };
}

export const PATIENT_FIXTURES: PatientFixture[] = [
  {
    key: 'diabetesDenver',
    label: 'Type 2 diabetes, Denver ZIP — headline demo, matches sorted by distance',
    patient: {
      patientId: 'demo-1',
      zipCode: '80202',
      problems: [diagnosis({ code: 'E11.9', description: 'Type 2 diabetes mellitus', onSetDate: '2024-06-01' })],
    },
  },
  {
    key: 'noProblems',
    label: 'No active problems documented — nothing to match',
    patient: { patientId: 'demo-2', zipCode: '80202', problems: [] },
  },
  {
    key: 'diabetesSnomedOnly',
    label: 'Diabetes coded only in SNOMED-CT — crosswalk confidence "none" (no table for this system)',
    patient: {
      patientId: 'demo-3',
      zipCode: '80202',
      problems: [diagnosis({ code: '44054006', system: 'SNOMED-CT', description: 'Diabetes mellitus type 2' })],
    },
  },
  {
    key: 'ambiguousComboCode',
    label: 'Only problem is a combination code (I13.0) — crosswalk confidence "ambiguous"',
    patient: {
      patientId: 'demo-4',
      zipCode: '80202',
      problems: [diagnosis({ code: 'I13.0', description: 'Hypertensive heart and chronic kidney disease' })],
    },
  },
  {
    key: 'copdUnrecognizedZip',
    label: 'COPD, unrecognized ZIP — matches found, but distance unavailable for every trial',
    patient: {
      patientId: 'demo-5',
      zipCode: '00000',
      problems: [diagnosis({ code: 'J44.9', description: 'Chronic obstructive pulmonary disease', onSetDate: '2024-01-01' })],
    },
  },
  {
    key: 'obesityNoTrialsFound',
    label: 'Obesity, valid ZIP — condition resolved, but zero recruiting trials in range',
    patient: {
      patientId: 'demo-6',
      zipCode: '80202',
      problems: [diagnosis({ code: 'E66.9', description: 'Obesity', onSetDate: '2024-01-01' })],
    },
  },
  {
    key: 'manyConditionsTruncated',
    label: '7 high-confidence conditions, Denver ZIP — exercises the 5-condition search bound and result truncation',
    patient: {
      patientId: 'demo-7',
      zipCode: '80202',
      problems: [
        diagnosis({ code: 'E11.9', description: 'Type 2 diabetes mellitus', onSetDate: '2024-06-01' }),
        diagnosis({ code: 'J44.9', description: 'Chronic obstructive pulmonary disease', onSetDate: '2024-05-01' }),
        diagnosis({ code: 'I10', description: 'Essential hypertension', onSetDate: '2024-04-01' }),
        diagnosis({ code: 'I50.9', description: 'Heart failure', onSetDate: '2024-03-01' }),
        diagnosis({ code: 'F32.9', description: 'Major depressive disorder', onSetDate: '2024-02-01' }),
        diagnosis({ code: 'E66.9', description: 'Obesity', onSetDate: '2020-01-01' }), // excluded by the bound
        diagnosis({ code: 'E11.21', description: 'Diabetic nephropathy', onSetDate: '2019-01-01' }), // excluded by the bound
      ],
    },
  },
];

// Fixture PatientContexts driving the pure domain logic through every branch
// (see rules.ts / app-state.ts / writeback-state.ts). Used only by the
// SIM_MODE dev harness — never imported by the real SDK path.

import type { PatientContext } from '@/lib/sdoh/types';

export interface PatientFixture {
  key: string;
  label: string;
  patient: PatientContext;
}

export const PATIENT_FIXTURES: PatientFixture[] = [
  {
    key: 'highRiskMedicaidNonEnglish',
    label: 'Elevated-risk ZIP + Medicaid + non-English — confirmed insights, none already documented',
    patient: {
      patientId: 'demo-1',
      zipCode: '10453',
      city: 'Bronx',
      state: 'NY',
      language: 'Spanish',
      insurances: [{ payerName: 'State Medicaid Plan' }],
      problems: [],
    },
  },
  {
    key: 'ambiguousSignalsOnly',
    label: 'ZIP3-prefix-only elevated + "dual" payer hint + English — inferred insights only',
    patient: {
      patientId: 'demo-2',
      zipCode: '10457', // not in ZIP5 table; ZIP3 "104" -> elevated (ambiguous)
      city: 'Bronx',
      state: 'NY',
      language: 'en',
      insurances: [{ payerName: 'Dual Eligible Special Needs Plan' }],
      problems: [],
    },
  },
  {
    key: 'typicalRiskCommercialEnglish',
    label: 'Typical-risk ZIP + commercial + English — no insights, dataCompleteness "full"',
    patient: {
      patientId: 'demo-3',
      zipCode: '10021',
      city: 'New York',
      state: 'NY',
      language: 'en',
      insurances: [{ payerName: 'Aetna PPO' }],
      problems: [],
    },
  },
  {
    key: 'unknownZipUnknownPayerNoLanguage',
    label: 'Unrecognized ZIP + unrecognized payer + no language — no insights, dataCompleteness "partial"',
    patient: {
      patientId: 'demo-4',
      zipCode: '05001',
      city: 'White River Junction',
      state: 'VT',
      language: null,
      insurances: [{ payerName: 'Acme Regional Insurance Co' }],
      problems: [],
    },
  },
  {
    key: 'alreadyDocumentedOverlay',
    label: 'Elevated risk + Medicaid, but food insecurity already documented on the chart',
    patient: {
      patientId: 'demo-5',
      zipCode: '10453',
      city: 'Bronx',
      state: 'NY',
      language: null,
      insurances: [{ payerName: 'State Medicaid Plan' }],
      problems: [{ code: 'Z59.41', system: 'ICD-10-CM', description: 'Food insecurity' }],
    },
  },
  {
    key: 'synthesizedAlreadyDocumentedOnly',
    label: 'No independent signal, but transportation insecurity already documented on the chart',
    patient: {
      patientId: 'demo-6',
      zipCode: '10021',
      city: 'New York',
      state: 'NY',
      language: 'en',
      insurances: [{ payerName: 'Aetna PPO' }],
      problems: [{ code: 'Z59.82', system: 'ICD-10-CM', description: 'Transportation insecurity' }],
    },
  },
];

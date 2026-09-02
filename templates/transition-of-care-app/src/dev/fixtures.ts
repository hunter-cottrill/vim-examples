/**
 * Dev-simulator fixtures. Used only by the SIM_MODE harness — never imported
 * by the real SDK path.
 *
 * These are RAW SDK-SHAPED PAYLOADS (Patient / Diagnosis / Medication), not
 * domain objects. They are pushed in at the vim-client boundary (via
 * simulateChartOpen) so they travel through the exact same retryEntityFetch +
 * mapping code the live path uses. Several fixtures deliberately omit
 * optional fields, because that is what real EHR builds send.
 *
 * Patient keys are chosen to deliberately hit or miss real entries in the
 * bundled hospitalization dataset (src/lib/hospitalizationDataset.ts) — the
 * harness calls the REAL /api/hospitalization route, so no separate mock of
 * that dataset is needed here.
 */
import type { Diagnosis, Medication, Patient } from '@vimconnect/app-sdk';
import type { SimFixture } from '@/lib/vim-client';

function patient(mrn: string | undefined, firstName: string, lastName: string): Patient {
  return { identifiers: mrn ? { mrn } : undefined, demographics: { firstName, lastName } };
}

function dx(code: string, description: string): Diagnosis {
  return { code, description, status: 'active', system: 'ICD-10' };
}

/** As real sandbox problem lists arrive: a description but no code at all. */
function bareDx(description: string): Diagnosis {
  return { description, status: 'active' };
}

function med(medicationName: string, overrides: Partial<Medication> = {}): Medication {
  return { medicationName, ...overrides };
}

export interface DemoFixture {
  id: string;
  label: string;
  description: string;
  fixture: SimFixture;
}

export const FIXTURES: DemoFixture[] = [
  {
    id: 'mixed-hospitalization',
    label: 'Recent hospital stay — mixed reconciliation',
    description: 'MRN-10234, discharged 9 days ago (COPD exacerbation). Diagnoses span high/ambiguous/none; one medication missing from the chart.',
    fixture: {
      patient: patient('MRN-10234', 'Maria', 'Torres'),
      problems: [
        dx('J44.1', 'Chronic obstructive pulmonary disease with acute exacerbation'),
        bareDx('Acute respiratory failure'),
        dx('I10', 'Essential (primary) hypertension'),
      ],
      medications: [med('Prednisone 20 MG tablet', { strength: '20 mg', frequency: 'once daily, taper' }), med('Lisinopril 10 MG tablet', { strength: '10 mg' })],
    },
  },
  {
    id: 'fully-reconciled',
    label: 'Recent hospital stay — fully reconciled',
    description: 'MRN-20551, discharged 3 days ago (heart failure/AKI). Every discharge diagnosis and medication is already on the chart.',
    fixture: {
      patient: patient('MRN-20551', 'James', 'Whitfield'),
      problems: [dx('I50.9', 'Heart failure, unspecified'), dx('N17.9', 'Acute kidney injury, unspecified')],
      medications: [
        med('Furosemide 40 MG tablet', { strength: '40 mg', frequency: 'twice daily' }),
        med('Metoprolol Succinate ER 50 MG tablet', { strength: '50 mg', frequency: 'once daily' }),
      ],
    },
  },
  {
    id: 'mrn-not-in-dataset',
    label: 'No recent hospital stay on record',
    description: 'A valid MRN that has no entry in the bundled dataset — the honest "not found" negative state.',
    fixture: {
      patient: patient('MRN-99999', 'Alicia', 'Kim'),
      problems: [dx('I10', 'Essential (primary) hypertension')],
      medications: [med('Lisinopril 10 MG tablet', { strength: '10 mg' })],
    },
  },
  {
    id: 'expired-hospitalization',
    label: 'Hospitalization outside the recency window',
    description: 'MRN-30877 has a record, but it was discharged 42 days ago — beyond the 30-day window, so it reads as "not found," not stale data.',
    fixture: {
      patient: patient('MRN-30877', 'Robert', 'Chen'),
      problems: [],
      medications: [],
    },
  },
  {
    id: 'empty-discharge-lists',
    label: 'Hospitalization with no discharge diagnoses/medications',
    description: 'MRN-40112 has a recent record whose discharge lists are both empty — "found" with nothing to reconcile, rendered explicitly rather than left blank.',
    fixture: {
      patient: patient('MRN-40112', 'Dana', 'Ibrahim'),
      problems: [dx('I10', 'Essential (primary) hypertension')],
      medications: [med('Lisinopril 10 MG tablet', { strength: '10 mg' })],
    },
  },
  {
    id: 'no-identifiers',
    label: 'Patient with no MRN or EHR patient id',
    description: 'The chart carries no identifier at all — the lookup is never attempted (kind: "unavailable"), never silently reported as "not found."',
    fixture: {
      patient: patient(undefined, 'Unknown', 'Patient'),
      problems: [dx('I10', 'Essential (primary) hypertension')],
      medications: [],
    },
  },
  {
    id: 'problems-unsupported',
    label: 'Problem list not supported by this EHR',
    description: 'Patient resolved (no dataset match), but getProblems() returns NOT_IMPLEMENTED — distinct from an empty list.',
    fixture: { patient: patient('MRN-70001', 'Sam', 'Reyes'), problems: 'unsupported', medications: [] },
  },
  {
    id: 'problems-error',
    label: 'Problem list fetch fails',
    description: 'Patient resolved, but getProblems() exhausts retries — the section shows its own error, the rest of the card still renders.',
    fixture: { patient: patient('MRN-70002', 'Sam', 'Reyes'), problems: 'error', medications: [] },
  },
  {
    id: 'medications-unsupported',
    label: 'Medication list not supported by this EHR',
    description: 'Patient resolved, but getMedications() returns NOT_IMPLEMENTED.',
    fixture: { patient: patient('MRN-70003', 'Sam', 'Reyes'), problems: [], medications: 'unsupported' },
  },
  {
    id: 'medications-error',
    label: 'Medication list fetch fails',
    description: 'Patient resolved, but getMedications() exhausts retries.',
    fixture: { patient: patient('MRN-70004', 'Sam', 'Reyes'), problems: [], medications: 'error' },
  },
  {
    id: 'patient-unsupported',
    label: 'Patient fetch not supported by this EHR',
    description: 'getPatient() itself returns NOT_IMPLEMENTED — nothing else can be shown, so the whole page reads as an error.',
    fixture: { patient: 'unsupported', problems: [], medications: [] },
  },
  {
    id: 'patient-error',
    label: 'Patient fetch fails',
    description: 'getPatient() exhausts retries — the whole page shows the page-level error state.',
    fixture: { patient: 'error', problems: [], medications: [] },
  },
];

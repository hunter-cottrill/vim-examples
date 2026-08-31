/**
 * Dev-simulator fixtures. Used only by the SIM_MODE harness — never imported
 * by the real SDK path.
 *
 * These are RAW SDK-SHAPED PAYLOADS (Patient / Medication / Diagnosis), not
 * domain objects. They are pushed in at the vim-client boundary so they travel
 * through the same extraction, mapping and normalisation the live path uses.
 * Hand-building the value a correct mapper would have produced would let the
 * harness pass while the real path is broken.
 *
 * Several fixtures deliberately OMIT optional fields — no `system`, no
 * `status`, no `medicationName` — because that is what real EHR builds send,
 * and code that only ever sees fully-populated payloads is untested code.
 */
import type { Diagnosis, Medication, Patient } from '@vimconnect/app-sdk';
import type { RawChartPayload } from '@/lib/entity-mapping';

/** Alias kept for readability at the call sites below. */
type SimEntitySource = RawChartPayload;

export interface PatientFixture {
  key: string;
  label: string;
  source: SimEntitySource;
}

function med(medicationName: string, overrides: Partial<Medication> = {}): Medication {
  return { medicationName, ...overrides };
}

/** A medication record the EHR sent with no name at all — only packaging data. */
const UNNAMED_MEDICATION: Medication = { ndcCode: '00093-7146-56', strength: '40 mg', form: 'tablet' };

function dx(code: string, description: string, overrides: Partial<Diagnosis> = {}): Diagnosis {
  return { code, description, status: 'active', system: 'ICD-10', ...overrides };
}

/** As real sandbox problem lists arrive: a code and a description, nothing else. */
function bareDx(code: string, description: string): Diagnosis {
  return { code, description };
}

function patient(ehrPatientId: string, inline: Partial<Patient> = {}): Patient {
  return { identifiers: { ehrPatientId }, ...inline };
}

/** The normal path: the Entity API answers, so the inline payload is unused. */
function viaEntityApi(id: string, medications: Medication[], problems: Diagnosis[]): SimEntitySource {
  return { patient: patient(id), medications, problems };
}

/** The degraded path: the Entity API is exhausted and chart_open's inline payload stands in. */
function viaChartOpenEvent(id: string, medications: Medication[], problems: Diagnosis[]): SimEntitySource {
  return { patient: patient(id, { medications, problems }), medications: null, problems: null };
}

const ATORVASTATIN = med('Atorvastatin 40 MG tablet', { strength: '40 mg', form: 'tablet', frequency: 'daily' });
const SIMVASTATIN = med('Simvastatin 20 MG tablet', { strength: '20 mg', form: 'tablet', frequency: 'nightly' });
const LEVOTHYROXINE = med('Levothyroxine Sodium 50 MCG tablet', { strength: '50 mcg' });
const METFORMIN = med('Metformin HCl 500 MG tablet', { strength: '500 mg', frequency: 'twice daily' });
const LISINOPRIL = med('Lisinopril 10 MG tablet', { strength: '10 mg' });
const ZOLPIDEM = med('Zolpidem Tartrate 10 MG tablet', { strength: '10 mg' });
const CLOPIDOGREL = med('Clopidogrel 75 MG tablet', { strength: '75 mg' });
const AGGRENOX = med('Aspirin-Dipyridamole 25-200 MG capsule');

const T2DM = dx('E11.9', 'Type 2 diabetes mellitus without complications');
const HYPERLIPIDEMIA = dx('E78.5', 'Hyperlipidemia, unspecified');
const HYPOTHYROIDISM = dx('E03.9', 'Hypothyroidism, unspecified');
const HYPERTENSION = dx('I10', 'Essential (primary) hypertension');
const CAD = dx('I25.10', 'Atherosclerotic heart disease of native coronary artery');
const ANNUAL_EXAM = dx('Z00.00', 'Encounter for general adult medical examination');

export const PATIENT_FIXTURES: PatientFixture[] = [
  {
    key: 'theDemoChart',
    label: 'All three finding kinds plus both exclusion reasons — the end-to-end demo chart',
    source: viaEntityApi(
      'demo-chart',
      [ATORVASTATIN, SIMVASTATIN, LEVOTHYROXINE, ZOLPIDEM, UNNAMED_MEDICATION],
      [T2DM, HYPERLIPIDEMIA],
    ),
  },
  {
    key: 'duplicateStatins',
    label: 'duplicate_class with inferred_high evidence — two statins',
    source: viaEntityApi('dup-statins', [ATORVASTATIN, SIMVASTATIN], [HYPERLIPIDEMIA]),
  },
  {
    key: 'ambiguousCombination',
    label: 'duplicate_class with inferred_ambiguous evidence — a combination product shares the class',
    source: viaEntityApi('ambiguous-combo', [CLOPIDOGREL, AGGRENOX], [CAD]),
  },
  {
    key: 'diabetesNoAntidiabetic',
    label: 'problem_without_class_match — diabetes coded, no antidiabetic on the list',
    source: viaEntityApi('dm-no-med', [LEVOTHYROXINE], [T2DM, HYPOTHYROIDISM]),
  },
  {
    key: 'levothyroxineNoThyroidProblem',
    label: 'medication_without_problem_match — levothyroxine with no thyroid problem coded',
    source: viaEntityApi('levo-no-problem', [LEVOTHYROXINE, METFORMIN], [T2DM]),
  },
  {
    key: 'unrecognizedDrug',
    label: 'unrecognized exclusion shown alongside a real finding',
    source: viaEntityApi('unrecognized', [ATORVASTATIN, SIMVASTATIN, ZOLPIDEM], [HYPERLIPIDEMIA]),
  },
  {
    key: 'medicationNameAbsent',
    label: 'insufficient_data exclusion — medicationName omitted, only NDC and strength present',
    source: viaEntityApi('no-med-name', [METFORMIN, UNNAMED_MEDICATION], [T2DM]),
  },
  {
    key: 'problemsWithoutSystemOrStatus',
    label: 'Problems with no `system` and no `status` — must still map and count as active',
    source: viaEntityApi('bare-problems', [LEVOTHYROXINE], [
      bareDx('E11.9', 'Type 2 diabetes mellitus without complications'),
    ]),
  },
  {
    key: 'unmappedProblemSuppresses',
    label: 'An unmapped active problem suppresses medication_without_problem_match',
    source: viaEntityApi('unmapped-problem', [LEVOTHYROXINE, METFORMIN], [T2DM, ANNUAL_EXAM]),
  },
  {
    key: 'resolvedProblemOnly',
    label: 'A resolved problem produces no problem_without_class_match',
    source: viaEntityApi('resolved-problem', [METFORMIN], [T2DM, dx('E03.9', 'Hypothyroidism', { status: 'resolved' })]),
  },
  {
    key: 'cleanChart',
    label: 'nothing_to_reconcile with no exclusions',
    source: viaEntityApi('clean-chart', [METFORMIN, LISINOPRIL], [T2DM, HYPERTENSION]),
  },
  {
    key: 'cleanChartWithExclusion',
    label: 'nothing_to_reconcile WITH an exclusion — "nothing found" vs "could not look"',
    source: viaEntityApi('clean-with-exclusion', [METFORMIN, ZOLPIDEM], [T2DM]),
  },
  {
    key: 'emptyMedicationList',
    label: 'no_medications — problems coded, medication list empty',
    source: viaEntityApi('no-meds', [], [T2DM, HYPERTENSION]),
  },
  {
    key: 'entityApiFallback',
    label: 'Entity API exhausted — falls back to the chart_open payload (footer says so)',
    source: viaChartOpenEvent(
      'fallback-chart',
      [ATORVASTATIN, SIMVASTATIN, LEVOTHYROXINE],
      [T2DM, HYPERLIPIDEMIA],
    ),
  },
  {
    key: 'chartLoadFailure',
    label: 'Entity API exhausted AND the event carried nothing — surfaces the error, not an empty list',
    source: viaChartOpenEvent('failing-chart', [], []),
  },
];

/**
 * Bundled, app-owned stand-in for a real ADT/HIE/claims feed. The SDK exposes
 * no encounter-history read and no admission/discharge fields on Encounter
 * (confirmed absent from the installed type bundle — see CLAUDE.md), so this
 * dataset is how v1 answers "was this patient recently hospitalized." A real
 * deployment replaces this file's contents (and only this file) with a call
 * to an actual ADT/HIE/claims source, behind the same /api/hospitalization
 * contract — nothing else in the app needs to change.
 *
 * This is authored, fictional reference data — not clinical data observed
 * from a live chart — so it is fine to bundle and ship with the app, unlike
 * anything actually read from a patient's EHR record.
 *
 * Dates are relative to RECENCY_WINDOW_DAYS at read time so the dataset stays
 * meaningful whenever this app is actually run, rather than hardcoding dates
 * that would silently age out.
 */
import type { HospitalizationRecord } from './transition/types';

function daysAgo(days: number): string {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() - days);
  return d.toISOString().slice(0, 10);
}

export const HOSPITALIZATION_DATASET: HospitalizationRecord[] = [
  {
    patientKey: 'MRN-10234',
    facilityName: 'Riverside Medical Center',
    admissionDate: daysAgo(13),
    dischargeDate: daysAgo(9),
    dischargeDiagnoses: [
      { code: 'J44.1', system: 'ICD-10', description: 'Chronic obstructive pulmonary disease with acute exacerbation' },
      { code: 'J96.01', system: 'ICD-10', description: 'Acute respiratory failure with hypoxia' },
      { code: 'E87.6', system: 'ICD-10', description: 'Hypokalemia' },
    ],
    dischargeMedications: [
      { medicationName: 'Albuterol-Ipratropium HFA inhaler', strength: '18-103 MCG/ACT', frequency: 'four times daily' },
      { medicationName: 'Prednisone 20 MG tablet', strength: '20 mg', frequency: 'once daily, taper' },
    ],
  },
  {
    patientKey: 'MRN-20551',
    facilityName: "St. Anne's Hospital",
    admissionDate: daysAgo(6),
    dischargeDate: daysAgo(3),
    dischargeDiagnoses: [
      { code: 'I50.9', system: 'ICD-10', description: 'Heart failure, unspecified' },
      { code: 'N17.9', system: 'ICD-10', description: 'Acute kidney injury, unspecified' },
    ],
    dischargeMedications: [
      { medicationName: 'Furosemide 40 MG tablet', strength: '40 mg', frequency: 'twice daily' },
      { medicationName: 'Metoprolol Succinate ER 50 MG tablet', strength: '50 mg', frequency: 'once daily' },
    ],
  },
  {
    patientKey: 'MRN-30877',
    facilityName: 'Lakeside General Hospital',
    admissionDate: daysAgo(45),
    dischargeDate: daysAgo(42),
    dischargeDiagnoses: [
      { code: 'K35.80', system: 'ICD-10', description: 'Unspecified acute appendicitis' },
    ],
    dischargeMedications: [
      { medicationName: 'Amoxicillin-Clavulanate 875-125 MG tablet', strength: '875-125 mg', frequency: 'twice daily' },
    ],
  },
  {
    patientKey: 'MRN-40112',
    facilityName: 'Riverside Medical Center',
    admissionDate: daysAgo(11),
    dischargeDate: daysAgo(7),
    dischargeDiagnoses: [],
    dischargeMedications: [],
  },
  {
    patientKey: 'MRN-50293',
    facilityName: 'Cedar Point Regional',
    admissionDate: daysAgo(20),
    dischargeDate: daysAgo(16),
    dischargeDiagnoses: [
      { code: 'E11.65', system: 'ICD-10', description: 'Type 2 diabetes mellitus with hyperglycemia' },
    ],
    dischargeMedications: [
      { medicationName: 'Insulin Glargine 100 UNIT/ML pen', strength: '100 unit/mL', frequency: 'once daily' },
      { medicationName: 'Metformin HCl 1000 MG tablet', strength: '1000 mg', frequency: 'twice daily' },
    ],
  },
  {
    patientKey: 'MRN-60418',
    facilityName: "St. Anne's Hospital",
    admissionDate: daysAgo(4),
    dischargeDate: daysAgo(1),
    dischargeDiagnoses: [
      { code: 'I21.4', system: 'ICD-10', description: 'Non-ST elevation myocardial infarction' },
    ],
    dischargeMedications: [
      { medicationName: 'Clopidogrel 75 MG tablet', strength: '75 mg', frequency: 'once daily' },
      { medicationName: 'Atorvastatin 80 MG tablet', strength: '80 mg', frequency: 'nightly' },
      { medicationName: 'Metoprolol Tartrate 25 MG tablet', strength: '25 mg', frequency: 'twice daily' },
    ],
  },
];

/**
 * Pure lookup, kept separate from the API route so it's testable without an
 * HTTP layer. Unknown key -> null, the honest "nothing on record" answer.
 */
export function lookupHospitalizationRecord(
  dataset: HospitalizationRecord[],
  patientKey: string,
): HospitalizationRecord | null {
  return dataset.find((record) => record.patientKey === patientKey) ?? null;
}

import type { DiagnosisRead, InsuranceRead, OrderRead } from '@/lib/vim/types';

export interface OrderFixture {
  id: string;
  label: string;
  description: string;
  order: OrderRead;
  insurance: InsuranceRead | undefined;
  diagnoses: DiagnosisRead[];
  patientId: string;
}

/**
 * One fixture per domain branch — see build plan §8. Each maps to a distinct
 * outcome of determineAuthRequirement (or a distinct failure/edge path).
 */
export const FIXTURES: OrderFixture[] = [
  {
    id: 'approved',
    label: 'MRI lumbar spine — Aetna (approved)',
    description: 'readyToSubmit -> pending -> approved',
    order: {
      ehrOrderId: 'order-approved',
      ehrEncounterId: 'encounter-approved',
      orderType: 'DI',
      orderName: 'MRI lumbar spine without contrast',
      orderingProviderName: 'Dr. Jamie Rivera',
      orderingProviderNpi: '1234567890',
    },
    insurance: { payerName: 'Aetna PPO', memberId: 'AET-001', groupId: 'GRP-1', isPrimary: true },
    diagnoses: [{ code: 'M54.5', system: 'ICD-10', description: 'Low back pain' }],
    patientId: 'patient-1',
  },
  {
    id: 'denied',
    label: 'Total knee arthroplasty — UnitedHealthcare (denied)',
    description: 'readyToSubmit -> pending -> denied',
    order: {
      ehrOrderId: 'order-denied',
      ehrEncounterId: 'encounter-denied',
      orderType: 'PROCEDURE',
      orderName: 'Total knee arthroplasty',
      orderingProviderName: 'Dr. Jamie Rivera',
      orderingProviderNpi: '1234567890',
    },
    insurance: { payerName: 'UnitedHealthcare Choice Plus', memberId: 'UHC-002', isPrimary: true },
    diagnoses: [{ code: 'M17.11', system: 'ICD-10', description: 'Unilateral primary osteoarthritis, right knee' }],
    patientId: 'patient-2',
  },
  {
    id: 'not-required',
    label: 'EKG — Cigna (not required)',
    description: 'notRequired',
    order: {
      ehrOrderId: 'order-not-required',
      orderType: 'PROCEDURE',
      orderName: 'EKG',
      orderingProviderName: 'Dr. Jamie Rivera',
    },
    insurance: { payerName: 'Cigna HealthCare', isPrimary: true },
    diagnoses: [{ code: 'R00.2', system: 'ICD-10', description: 'Palpitations' }],
    patientId: 'patient-3',
  },
  {
    id: 'procedure-unmatched',
    label: 'Routine venipuncture (unmatched procedure)',
    description: 'undetermined/procedure-unmatched',
    order: {
      ehrOrderId: 'order-unmatched',
      orderType: 'LAB',
      orderName: 'Routine venipuncture blood draw',
      orderingProviderName: 'Dr. Jamie Rivera',
    },
    insurance: { payerName: 'Aetna PPO', isPrimary: true },
    diagnoses: [{ code: 'Z00.00', system: 'ICD-10', description: 'Encounter for general adult medical exam' }],
    patientId: 'patient-4',
  },
  {
    id: 'procedure-ambiguous',
    label: 'MRI spine (ambiguous: lumbar vs. cervical)',
    description: 'undetermined/procedure-ambiguous',
    order: {
      ehrOrderId: 'order-ambiguous',
      orderType: 'DI',
      orderName: 'MRI spine',
      orderingProviderName: 'Dr. Jamie Rivera',
    },
    insurance: { payerName: 'Aetna PPO', isPrimary: true },
    diagnoses: [{ code: 'M54.2', system: 'ICD-10', description: 'Cervicalgia' }],
    patientId: 'patient-5',
  },
  {
    id: 'payer-unmatched',
    label: 'MRI lumbar spine — unrecognized payer',
    description: 'undetermined/payer-unmatched',
    order: {
      ehrOrderId: 'order-payer-unmatched',
      orderType: 'DI',
      orderName: 'MRI lumbar spine',
      orderingProviderName: 'Dr. Jamie Rivera',
    },
    insurance: { payerName: 'Acme Regional Health Plan', isPrimary: true },
    diagnoses: [{ code: 'M54.5', system: 'ICD-10', description: 'Low back pain' }],
    patientId: 'patient-6',
  },
  {
    id: 'no-rule',
    label: 'Low-dose CT lung screening — Humana (deliberate gap)',
    description: 'undetermined/no-rule-for-payer-and-procedure',
    order: {
      ehrOrderId: 'order-no-rule',
      orderType: 'DI',
      orderName: 'Low-dose CT lung cancer screening',
      orderingProviderName: 'Dr. Jamie Rivera',
    },
    insurance: { payerName: 'Humana Gold', isPrimary: true },
    diagnoses: [{ code: 'Z87.891', system: 'ICD-10', description: 'Personal history of nicotine dependence' }],
    patientId: 'patient-7',
  },
  {
    id: 'reset-demo',
    label: 'Different patient (exercises RESET)',
    description: 'RESET — fire after any of the above to prove one patient never lingers over another',
    order: {
      ehrOrderId: 'order-reset-demo',
      orderType: 'DI',
      orderName: 'MRI brain without contrast',
      orderingProviderName: 'Dr. Jamie Rivera',
    },
    insurance: { payerName: 'Blue Cross Blue Shield', isPrimary: true },
    diagnoses: [{ code: 'R51.9', system: 'ICD-10', description: 'Headache, unspecified' }],
    patientId: 'patient-8',
  },
];

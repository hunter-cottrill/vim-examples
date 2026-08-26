// DEV-ONLY. Fixture inputs for the /dev/harness page. Each fixture supplies the
// same raw section inputs the real app would derive from SDK reads, so the
// harness can call the real buildSummary()/derivePageStatus() — no SDK involved,
// and no duplicated logic between this file and the live app path.
import type {
  EncounterSnapshot,
  OrderSnapshot,
  PatientSnapshot,
  ProblemEntry,
  ReferralSnapshot,
  SectionStatus,
} from '@/lib/care/types';

export interface CareFixture {
  id: string;
  label: string;
  description: string;
  patientIdResolved: boolean;
  patient: SectionStatus<PatientSnapshot>;
  problems: SectionStatus<ProblemEntry[]>;
  encounter: SectionStatus<EncounterSnapshot>;
  order: SectionStatus<OrderSnapshot>;
  referral: SectionStatus<ReferralSnapshot>;
}

const LOADED_PATIENT: SectionStatus<PatientSnapshot> = {
  kind: 'loaded',
  data: { patientId: 'pat-10234', firstName: 'Maria', lastName: 'Gonzalez' },
};

const LOADED_PROBLEMS: SectionStatus<ProblemEntry[]> = {
  kind: 'loaded',
  data: [
    { code: 'I10', description: 'Essential (primary) hypertension' },
    { code: 'E11.9', description: 'Type 2 diabetes mellitus without complications' },
  ],
};

const LOADED_ENCOUNTER: SectionStatus<EncounterSnapshot> = {
  kind: 'loaded',
  data: {
    encounterId: 'enc-5521',
    type: 'Office visit',
    chiefComplaint: 'Follow-up for blood pressure management',
    diagnoses: ['Essential (primary) hypertension'],
  },
};

const LOADED_ORDER_LAB: SectionStatus<OrderSnapshot> = {
  kind: 'loaded',
  data: {
    orderId: 'ord-9001',
    orderName: 'CBC with differential',
    reason: 'Routine monitoring',
    typeLabel: 'Lab order',
    rawType: 'lab',
    orderingProviderName: 'Dr. Alice Nguyen',
  },
};

const LOADED_REFERRAL_FULL: SectionStatus<ReferralSnapshot> = {
  kind: 'loaded',
  data: {
    referringProviderName: 'Dr. Alice Nguyen',
    targetProviderName: 'Dr. Harold Weiss',
    targetSpecialty: 'Cardiology',
  },
};

export const FIXTURES: CareFixture[] = [
  {
    id: 'full-context',
    label: 'Full context',
    description: 'Every section loaded — patient, problems, current visit, an order, and a referral.',
    patientIdResolved: true,
    patient: LOADED_PATIENT,
    problems: LOADED_PROBLEMS,
    encounter: LOADED_ENCOUNTER,
    order: LOADED_ORDER_LAB,
    referral: LOADED_REFERRAL_FULL,
  },
  {
    id: 'patient-only',
    label: 'Patient only',
    description: 'Patient loaded; encounter/order/referral all confirmed empty (nothing in context).',
    patientIdResolved: true,
    patient: LOADED_PATIENT,
    problems: { kind: 'empty' },
    encounter: { kind: 'empty' },
    order: { kind: 'empty' },
    referral: { kind: 'empty' },
  },
  {
    id: 'problems-unsupported',
    label: 'Problems unsupported',
    description: 'Patient loaded; problem list is not supported by this EHR (distinct from empty).',
    patientIdResolved: true,
    patient: LOADED_PATIENT,
    problems: { kind: 'unsupported' },
    encounter: { kind: 'empty' },
    order: { kind: 'empty' },
    referral: { kind: 'empty' },
  },
  {
    id: 'patient-section-error',
    label: 'Patient section error',
    description: 'Patient fetch retries exhausted — page still renders (partial rendering), just this section errors.',
    patientIdResolved: true,
    patient: { kind: 'error', message: 'retries exhausted after 3 attempts' },
    problems: { kind: 'empty' },
    encounter: { kind: 'empty' },
    order: { kind: 'empty' },
    referral: { kind: 'empty' },
  },
  {
    id: 'waiting-for-context',
    label: 'Waiting for context',
    description: 'chart_open fired but the patient id has not resolved yet — page status is "waiting".',
    patientIdResolved: false,
    patient: { kind: 'loading' },
    problems: { kind: 'loading' },
    encounter: { kind: 'empty' },
    order: { kind: 'empty' },
    referral: { kind: 'empty' },
  },
  {
    id: 'order-only',
    label: 'Order only',
    description: 'An order is in context, no referral — exactly one provider mention (ordering provider).',
    patientIdResolved: true,
    patient: LOADED_PATIENT,
    problems: LOADED_PROBLEMS,
    encounter: LOADED_ENCOUNTER,
    order: LOADED_ORDER_LAB,
    referral: { kind: 'empty' },
  },
  {
    id: 'referral-only',
    label: 'Referral only',
    description: 'A referral is in context, no order — two provider mentions (referring + target).',
    patientIdResolved: true,
    patient: LOADED_PATIENT,
    problems: LOADED_PROBLEMS,
    encounter: LOADED_ENCOUNTER,
    order: { kind: 'empty' },
    referral: LOADED_REFERRAL_FULL,
  },
  {
    id: 'unknown-order-type',
    label: 'Unknown order type',
    description: 'Order type is absent from ORDER_TYPE_LABELS — typeLabel falls back to the raw string.',
    patientIdResolved: true,
    patient: LOADED_PATIENT,
    problems: LOADED_PROBLEMS,
    encounter: LOADED_ENCOUNTER,
    order: {
      kind: 'loaded',
      data: {
        orderId: 'ord-9099',
        orderName: 'Custom EHR-specific order',
        typeLabel: 'durable-medical-equipment', // raw type, unmapped — fallback in action
        rawType: 'durable-medical-equipment',
        orderingProviderName: 'Dr. Alice Nguyen',
      },
    },
    referral: { kind: 'empty' },
  },
];

export function getFixture(id: string): CareFixture | undefined {
  return FIXTURES.find((f) => f.id === id);
}
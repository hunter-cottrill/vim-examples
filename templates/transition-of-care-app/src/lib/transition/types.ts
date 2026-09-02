// Domain types for the transition-of-care summary. SDK-free at runtime —
// Diagnosis/Medication are imported as TYPES ONLY from @vimconnect/app-sdk
// (erased at compile time), so this file needs no SDK runtime, no .env, and
// no EHR to test. The thin SDK client (src/lib/vim-client.ts) is responsible
// for mapping real SDK payloads into these shapes.
import type { Diagnosis, Medication } from '@vimconnect/app-sdk';

export type ProblemEntry = Diagnosis;
export type MedicationEntry = Medication;

export interface PatientSnapshot {
  displayName: string | null; // derived from demographics.firstName/lastName if present
  patientKey: string | null; // identifiers.mrn ?? identifiers.ehrPatientId ?? null
}

// Section-level result: five explicitly distinct outcomes so "confirmed
// empty," "the EHR doesn't expose this," and "couldn't retrieve it" are never
// conflated.
export type SectionStatus<T> =
  | { kind: 'loading' }
  | { kind: 'loaded'; data: T }
  | { kind: 'empty' }
  | { kind: 'unsupported' } // NOT_IMPLEMENTED from the EHR
  | { kind: 'error'; message: string }; // retries exhausted

export interface DischargeDiagnosis {
  code: string;
  system: 'ICD-10';
  description: string;
}

export interface DischargeMedication {
  medicationName: string;
  ndcCode?: string;
  strength?: string;
  frequency?: string;
}

export interface HospitalizationRecord {
  patientKey: string;
  facilityName: string;
  admissionDate: string; // ISO date
  dischargeDate: string; // ISO date
  dischargeDiagnoses: DischargeDiagnosis[];
  dischargeMedications: DischargeMedication[];
}

// 'unavailable' and 'not_found' are kept distinct on purpose: 'unavailable'
// means we never even asked (no identifier to look up), 'not_found' means we
// asked and there is honestly nothing recent on record. Conflating the two
// would tell a provider "no hospitalization" when the true answer is "we
// couldn't check."
export type HospitalizationLookupResult =
  | { kind: 'unavailable' } // no patientKey could be resolved from the chart
  | { kind: 'not_found' } // no record, or the record's dischargeDate is outside the recency window
  | { kind: 'found'; record: HospitalizationRecord; daysSinceDischarge: number }
  | { kind: 'error'; message: string }; // backend fetch failed

export type CrosswalkConfidence = 'high' | 'ambiguous' | 'none';

export interface CrosswalkMatch<T> {
  confidence: CrosswalkConfidence;
  matched?: T;
}

export type ReconciliationItem =
  | { kind: 'diagnosis'; discharge: DischargeDiagnosis; confidence: CrosswalkConfidence; matched?: ProblemEntry }
  | { kind: 'medication'; discharge: DischargeMedication; confidence: CrosswalkConfidence; matched?: MedicationEntry };

export interface TransitionSummary {
  patient: PatientSnapshot;
  problems: SectionStatus<ProblemEntry[]>;
  medications: SectionStatus<MedicationEntry[]>;
  hospitalization: HospitalizationLookupResult;
  diagnosisReconciliation: ReconciliationItem[]; // [] unless hospitalization.kind === 'found'
  medicationReconciliation: ReconciliationItem[]; // [] unless hospitalization.kind === 'found'
}

// Page-level lifecycle. 'connecting' and 'error' are assigned directly by the
// page component (SDK init / OAuth failure / an unreadable patient) and are
// never emitted by derivePageStatus; 'waiting' and 'result' are the two
// values it can return.
export type PageStatus =
  | { kind: 'connecting' }
  | { kind: 'waiting' }
  | { kind: 'result'; summary: TransitionSummary }
  | { kind: 'error'; message: string };

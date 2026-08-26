// Domain types for the care-coordination summary card. SDK-free by design —
// nothing here imports @vimconnect/app-sdk. The thin SDK client (src/lib/vim-client.ts)
// is responsible for mapping real SDK payloads into these shapes.

// Section-level result: five explicitly distinct outcomes so "confirmed absent,"
// "EHR doesn't expose this," and "couldn't retrieve it" are never conflated.
export type SectionStatus<T> =
  | { kind: 'loading' }
  | { kind: 'loaded'; data: T }
  | { kind: 'empty' } // confirmed nothing in context this session
  | { kind: 'unsupported' } // EHR/Entity API returned a NOT_IMPLEMENTED-equivalent
  | { kind: 'error'; message: string }; // retries exhausted

export interface PatientSnapshot {
  patientId: string;
  firstName?: string;
  lastName?: string;
}

export interface ProblemEntry {
  description: string;
  code?: string;
}

export interface EncounterSnapshot {
  encounterId?: string;
  type?: string;
  chiefComplaint?: string;
  diagnoses: string[];
}

export interface OrderSnapshot {
  orderId?: string;
  orderName?: string;
  reason?: string;
  typeLabel: string; // cosmetic display label only — never a status claim
  rawType?: string;
  orderingProviderName?: string;
}

export interface ReferralSnapshot {
  referringProviderName?: string;
  targetProviderName?: string;
  targetSpecialty?: string;
}

export type ProviderRole = 'Ordering provider' | 'Referring provider' | 'Referral target provider';

export interface ProviderMention {
  name: string;
  role: ProviderRole;
}

export interface CareCoordinationSummary {
  patient: SectionStatus<PatientSnapshot>;
  problems: SectionStatus<ProblemEntry[]>;
  encounter: SectionStatus<EncounterSnapshot>;
  order: SectionStatus<OrderSnapshot>;
  referral: SectionStatus<ReferralSnapshot>;
  providerMentions: ProviderMention[]; // derived from order + referral, always present (possibly empty)
}

// Page-level lifecycle. 'connecting' and 'error' are assigned directly by the
// page component (SDK init / OAuth failure) and are never emitted by
// derivePageStatus; 'waiting' and 'result' are the two values it can return.
export type PageStatus =
  | { kind: 'connecting' }
  | { kind: 'waiting' }
  | { kind: 'result'; summary: CareCoordinationSummary }
  | { kind: 'error'; message: string };

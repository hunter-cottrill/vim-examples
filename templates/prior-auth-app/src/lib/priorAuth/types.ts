/**
 * Pure, SDK-free domain types for the prior-authorization workflow. Nothing in
 * this file — or anywhere else under src/lib/priorAuth — imports from
 * @vimconnect/app-sdk or src/lib/vim. See the build plan §4 for the full
 * rationale behind each type.
 */
import type { DiagnosisRead, InsuranceRead, OrderRead } from '@/lib/vim/types';

// ---------------------------------------------------------------------------
// Controlled data sets
// ---------------------------------------------------------------------------

export interface ProcedureCode {
  cpt: string;
  description: string;
  aliases: string[];
  /** The crosswalk deliberately excludes LAB/RX — see build plan §4. */
  orderType: 'DI' | 'PROCEDURE';
}

export type ProcedureMatch =
  | { confidence: 'high'; procedure: ProcedureCode }
  | { confidence: 'ambiguous'; candidates: ProcedureCode[] }
  | { confidence: 'none' };

export interface PayerMapping {
  payerId: string;
  displayName: string;
  /** Substrings matched case-insensitively against InsuranceRead.payerName. */
  nameMatches: string[];
}

export type PayerMatch = { confidence: 'high'; payer: PayerMapping } | { confidence: 'none' };

export type PARequiredField = 'clinicalJustification' | 'requestedUnits' | 'siteOfService' | 'orderingProviderNpi';

export interface NotRequiredRule {
  payerId: string;
  cpt: string;
  requirement: 'not-required';
}

export interface RequiredRule {
  payerId: string;
  cpt: string;
  requirement: 'required';
  formFields: PARequiredField[];
  simulatedOutcome: 'approved' | 'denied';
  simulatedDelayMs: number;
  /** Present if and only if simulatedOutcome === 'denied' — enforced by data.test.ts. */
  simulatedDenialReason?: string;
}

export type PriorAuthRule = NotRequiredRule | RequiredRule;

// ---------------------------------------------------------------------------
// Determination
// ---------------------------------------------------------------------------

export type UndeterminedReason =
  | 'procedure-unmatched'
  | 'procedure-ambiguous'
  | 'payer-unmatched'
  | 'no-rule-for-payer-and-procedure';

export type AuthDetermination =
  | { outcome: 'not-required'; procedure: ProcedureCode }
  | { outcome: 'required'; procedure: ProcedureCode; payer: PayerMapping; rule: RequiredRule }
  | { outcome: 'undetermined'; reason: UndeterminedReason; candidates?: ProcedureCode[] };

// ---------------------------------------------------------------------------
// Async submission contract (X12-lite naming — see build plan §0)
// ---------------------------------------------------------------------------

export interface PriorAuthSubmissionRequest {
  ehrOrderId: string;
  ehrEncounterId?: string;
  payerId: string;
  cpt: string;
  serviceTypeCode: 'DI' | 'PROCEDURE';
  /** Transient — not persisted past this single request. */
  diagnosisCodes: string[];
  /** Transient — not persisted past this single request. */
  clinicalJustification: string;
  requestedUnits: number;
  orderingProviderNpi?: string;
}

export interface PriorAuthSubmissionResponse {
  requestId: string;
  status: 'pending';
}

export type JobResolution =
  | { status: 'approved'; authNumber: string }
  | { status: 'denied'; denialReason: string };

export interface PriorAuthJob {
  requestId: string;
  ehrOrderId: string;
  ehrEncounterId?: string;
  payerId: string;
  cpt: string;
  createdAt: number;
  resolvesAt: number;
  /** Precomputed at creation from the matched RequiredRule; only *revealed* once now >= resolvesAt. */
  resolution: JobResolution;
}

export type PriorAuthStatusResponse =
  | { requestId: string; status: 'pending' }
  | { requestId: string; status: 'approved'; authNumber: string }
  | { requestId: string; status: 'denied'; denialReason: string };

// ---------------------------------------------------------------------------
// PA lifecycle state machine
// ---------------------------------------------------------------------------

interface ReadyContext {
  ehrOrderId: string;
  ehrEncounterId?: string;
  procedure: ProcedureCode;
  payer: PayerMapping;
  rule: RequiredRule;
  diagnoses: DiagnosisRead[];
  orderingProviderNpi?: string;
}

export type PriorAuthState =
  | { kind: 'idle' }
  | { kind: 'loadingContext'; ehrOrderId: string }
  | { kind: 'contextError'; ehrOrderId: string; message: string }
  | { kind: 'notRequired'; ehrOrderId: string; procedure: ProcedureCode }
  | { kind: 'undetermined'; ehrOrderId: string; reason: UndeterminedReason; candidates?: ProcedureCode[] }
  | ({ kind: 'readyToSubmit' } & ReadyContext)
  | ({ kind: 'submitting' } & ReadyContext)
  | ({ kind: 'submitError'; message: string } & ReadyContext)
  | { kind: 'pending'; ehrOrderId: string; requestId: string; procedure: ProcedureCode }
  | { kind: 'pendingTimedOut'; ehrOrderId: string; requestId: string; procedure: ProcedureCode }
  | { kind: 'approved'; ehrOrderId: string; requestId: string; procedure: ProcedureCode; authNumber: string }
  | { kind: 'denied'; ehrOrderId: string; requestId: string; procedure: ProcedureCode; denialReason: string };

export type PriorAuthInput =
  | { type: 'ORDER_EVENT_RECEIVED'; ehrOrderId: string }
  | { type: 'CONTEXT_LOADED'; ehrOrderId: string; order: OrderRead; insurance: InsuranceRead | undefined; diagnoses: DiagnosisRead[] }
  | { type: 'CONTEXT_FAILED'; ehrOrderId: string; message: string }
  | { type: 'RETRY_CONTEXT' }
  | { type: 'SUBMIT_REQUESTED' }
  | { type: 'SUBMIT_SUCCEEDED'; requestId: string }
  | { type: 'SUBMIT_FAILED'; message: string }
  | { type: 'POLL_RESULT_APPROVED'; authNumber: string }
  | { type: 'POLL_RESULT_DENIED'; denialReason: string }
  | { type: 'POLL_EXHAUSTED' }
  | { type: 'RECHECK_REQUESTED' }
  | { type: 'RESET' };

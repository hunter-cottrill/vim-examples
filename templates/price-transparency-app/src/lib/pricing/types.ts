/**
 * Domain types for the price-transparency estimate engine.
 *
 * Deliberately SDK-free — nothing here imports from @vimconnect/app-sdk or React.
 * All monetary values are integer cents to avoid floating-point drift.
 */

export interface ProcedureCode {
  cpt: string;
  description: string;
  /** Normalized (lowercase) alias strings used for orderName matching. */
  aliases: string[];
  /** Cash-pay rate charged when no contracted insurance rate applies, in cents. */
  selfPayCashRateCents: number;
}

export interface PlanPrice {
  payerId: string;
  payerName: string;
  /** Present when a payer has plan-specific (not payer-wide) contracted rates. */
  groupId?: string;
  cpt: string;
  /** Contracted allowed amount for this CPT under this payer/plan, in cents. */
  allowedAmountCents: number;
  /** 0–1, applied to the allowed amount remaining after the deductible. */
  coinsuranceRate?: number;
  /** Flat copay, in cents, added on top of coinsurance. */
  copayAmountCents?: number;
}

export interface PatientBenefitState {
  /** Remaining deductible for the patient's plan year, in cents. */
  deductibleRemainingCents: number;
}

export interface EstimateInput {
  cpt: string;
  payerId?: string;
  groupId?: string;
  selfPay: boolean;
  benefitState?: PatientBenefitState;
}

export type EstimateSource = 'contracted-rate' | 'self-pay-cash-rate' | 'no-rate-found';

export interface EstimateResult {
  cpt: string;
  allowedAmountCents: number;
  insurancePortionCents: number;
  patientResponsibilityCents: number;
  breakdown: {
    deductibleAppliedCents: number;
    coinsuranceCents: number;
    copayCents: number;
  };
  source: EstimateSource;
}

export type MatchConfidence = 'high' | 'ambiguous' | 'none';

export type CrosswalkMatch =
  | { confidence: 'high'; match: ProcedureCode }
  | { confidence: 'ambiguous'; candidates: ProcedureCode[] }
  | { confidence: 'none' };

export type GfeEligibility = 'required' | 'recommended' | 'not-applicable';

export interface GfeEligibilityInput {
  /** true / false / 'unknown' — 'unknown' when EHR context correlation failed. */
  selfPay: boolean | 'unknown';
  /** Whether a contracted rate was found for this patient's insurance. */
  contractedRateFound: boolean;
}

import type { EstimateInput, EstimateResult, PlanPrice, ProcedureCode } from './types';
import { PROCEDURES } from './data/procedures';
import { PLAN_PRICES } from './data/planPrices';

/**
 * Looks up the contracted rate for a CPT under a payer, preferring a
 * plan-specific (groupId) row over the payer-wide default when both exist.
 */
export function findPlanPrice(
  cpt: string,
  payerId: string | undefined,
  groupId: string | undefined,
  table: PlanPrice[] = PLAN_PRICES,
): PlanPrice | undefined {
  if (!payerId) return undefined;
  if (groupId) {
    const groupMatch = table.find((row) => row.cpt === cpt && row.payerId === payerId && row.groupId === groupId);
    if (groupMatch) return groupMatch;
  }
  return table.find((row) => row.cpt === cpt && row.payerId === payerId && !row.groupId);
}

function findProcedure(cpt: string, table: ProcedureCode[]): ProcedureCode | undefined {
  return table.find((p) => p.cpt === cpt);
}

function cashRateResult(cpt: string, cashRateCents: number, source: 'self-pay-cash-rate' | 'no-rate-found'): EstimateResult {
  return {
    cpt,
    allowedAmountCents: cashRateCents,
    insurancePortionCents: 0,
    patientResponsibilityCents: cashRateCents,
    breakdown: { deductibleAppliedCents: 0, coinsuranceCents: 0, copayCents: 0 },
    source,
  };
}

/**
 * Deterministic arithmetic over the bundled table — no approximation, no
 * model in the loop. Two cost-share shapes are modeled, matching how real
 * plan benefits are actually structured:
 *  - copay-based rows (e.g. office visits): a flat copay, deductible bypassed.
 *  - coinsurance-based rows (e.g. imaging, labs): deductible applies first,
 *    coinsurance applies to whatever's left of the allowed amount.
 * Never throws and never fabricates a number: an unresolvable procedure or
 * an insurance/plan absent from the bundled table both fall through to a
 * zero/cash-rate result rather than an exception.
 */
export function calculateEstimate(
  input: EstimateInput,
  options?: { procedures?: ProcedureCode[]; planPrices?: PlanPrice[] },
): EstimateResult {
  const procedures = options?.procedures ?? PROCEDURES;
  const planPrices = options?.planPrices ?? PLAN_PRICES;

  const procedure = findProcedure(input.cpt, procedures);
  if (!procedure) {
    // Unpriceable — no code in the controlled table matches. Report zero
    // rather than throwing or guessing at a number.
    return cashRateResult(input.cpt, 0, 'no-rate-found');
  }

  if (input.selfPay) {
    return cashRateResult(input.cpt, procedure.selfPayCashRateCents, 'self-pay-cash-rate');
  }

  const planPrice = findPlanPrice(input.cpt, input.payerId, input.groupId, planPrices);
  if (!planPrice) {
    return cashRateResult(input.cpt, procedure.selfPayCashRateCents, 'no-rate-found');
  }

  const allowedAmountCents = planPrice.allowedAmountCents;

  let deductibleAppliedCents = 0;
  let coinsuranceCents = 0;
  let copayCents = 0;

  if (planPrice.copayAmountCents != null) {
    copayCents = planPrice.copayAmountCents;
  } else {
    const deductibleRemainingCents = input.benefitState?.deductibleRemainingCents ?? 0;
    deductibleAppliedCents = Math.min(deductibleRemainingCents, allowedAmountCents);
    const remainingAfterDeductible = Math.max(0, allowedAmountCents - deductibleRemainingCents);
    coinsuranceCents = Math.round(remainingAfterDeductible * (planPrice.coinsuranceRate ?? 0));
  }

  const patientResponsibilityCents = deductibleAppliedCents + coinsuranceCents + copayCents;

  return {
    cpt: input.cpt,
    allowedAmountCents,
    insurancePortionCents: allowedAmountCents - patientResponsibilityCents,
    patientResponsibilityCents,
    breakdown: { deductibleAppliedCents, coinsuranceCents, copayCents },
    source: 'contracted-rate',
  };
}

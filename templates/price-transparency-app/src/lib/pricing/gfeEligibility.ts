import type { GfeEligibility, GfeEligibilityInput } from './types';

/**
 * Deterministic Good Faith Estimate eligibility rule (No Surprises Act).
 * Self-pay patients always require a GFE. Insured patients whose payer/plan
 * has no contracted rate in the bundled table are treated as out-of-network
 * for GFE purposes and get a courtesy recommendation. When self-pay status
 * itself couldn't be determined (EHR context correlation failed — see the
 * SDK read notes for encounter_open:encounter), the rule fails toward
 * disclosure rather than silently skipping the GFE offer.
 */
export function evaluateGfeEligibility(input: GfeEligibilityInput): GfeEligibility {
  if (input.selfPay === true) return 'required';
  if (input.selfPay === 'unknown') return 'recommended';
  return input.contractedRateFound ? 'not-applicable' : 'recommended';
}

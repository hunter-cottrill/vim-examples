import type { DiagnosisRead, InsuranceRead, OrderRead } from '@/lib/vim/types';
import type { AuthDetermination, PriorAuthRule } from './types';
import { matchOrderToProcedure } from './crosswalk';
import { matchPayer } from './payerMap';
import { PA_RULES } from './data/rules-table';

export function lookupRule(payerId: string, cpt: string, table: PriorAuthRule[] = PA_RULES): PriorAuthRule | undefined {
  return table.find((rule) => rule.payerId === payerId && rule.cpt === cpt);
}

/**
 * The core, pure evaluator. Diagnoses are accepted but never influence the
 * branch taken — they carry through only for clinical-justification display
 * on the pre-filled form (see build plan §0, confirmed with the requester).
 */
export function determineAuthRequirement(
  order: OrderRead,
  insurance: InsuranceRead | undefined,
  _diagnoses: DiagnosisRead[],
): AuthDetermination {
  const procedureMatch = matchOrderToProcedure([order.orderName, order.reason].filter(Boolean).join(' '));

  if (procedureMatch.confidence === 'none') {
    return { outcome: 'undetermined', reason: 'procedure-unmatched' };
  }
  if (procedureMatch.confidence === 'ambiguous') {
    return { outcome: 'undetermined', reason: 'procedure-ambiguous', candidates: procedureMatch.candidates };
  }

  const payerMatch = insurance ? matchPayer(insurance.payerName) : { confidence: 'none' as const };
  if (payerMatch.confidence === 'none') {
    return { outcome: 'undetermined', reason: 'payer-unmatched' };
  }

  const rule = lookupRule(payerMatch.payer.payerId, procedureMatch.procedure.cpt);
  if (!rule) {
    return { outcome: 'undetermined', reason: 'no-rule-for-payer-and-procedure' };
  }

  if (rule.requirement === 'not-required') {
    return { outcome: 'not-required', procedure: procedureMatch.procedure };
  }

  return { outcome: 'required', procedure: procedureMatch.procedure, payer: payerMatch.payer, rule };
}

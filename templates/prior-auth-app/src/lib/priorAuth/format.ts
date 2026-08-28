import type { UndeterminedReason } from './types';

export function formatAuthNumber(authNumber: string): string {
  return `Authorization #${authNumber}`;
}

const UNDETERMINED_MESSAGES: Record<UndeterminedReason, string> = {
  'procedure-unmatched': "We couldn't match this order to a known procedure.",
  'procedure-ambiguous': 'This order matches more than one possible procedure.',
  'payer-unmatched': "We couldn't recognize this patient's payer.",
  'no-rule-for-payer-and-procedure': "We don't have a prior-authorization rule for this payer and procedure yet.",
};

export function formatUndeterminedReason(reason: UndeterminedReason): string {
  return UNDETERMINED_MESSAGES[reason];
}

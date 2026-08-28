import type { PayerMapping, PayerMatch } from './types';
import { PAYERS } from './data/payers';

/**
 * Matches a bare payer-name string (the only payer data the SDK's Insurance
 * entity carries) against the bundled payer map. Never invents a payer.
 */
export function matchPayer(payerName: string, table: PayerMapping[] = PAYERS): PayerMatch {
  const normalized = payerName.trim().toLowerCase();
  if (!normalized) return { confidence: 'none' };

  const match = table.find((payer) => payer.nameMatches.some((candidate) => normalized.includes(candidate.toLowerCase())));
  return match ? { confidence: 'high', payer: match } : { confidence: 'none' };
}

import type { PayerMapping } from '../types';

/**
 * Bundled payer-name map — the SDK's Insurance entity carries only a bare
 * payerName string, never a structured plan/network id (see build plan §0).
 */
export const PAYERS: PayerMapping[] = [
  { payerId: 'aetna', displayName: 'Aetna', nameMatches: ['aetna'] },
  { payerId: 'uhc', displayName: 'UnitedHealthcare', nameMatches: ['united', 'uhc', 'unitedhealthcare'] },
  { payerId: 'cigna', displayName: 'Cigna', nameMatches: ['cigna'] },
  { payerId: 'bcbs', displayName: 'Blue Cross Blue Shield', nameMatches: ['blue cross', 'bcbs', 'anthem'] },
  { payerId: 'humana', displayName: 'Humana', nameMatches: ['humana'] },
  { payerId: 'medicare', displayName: 'Medicare', nameMatches: ['medicare'] },
];

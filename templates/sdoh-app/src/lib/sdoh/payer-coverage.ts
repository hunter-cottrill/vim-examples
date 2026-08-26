// The SDK gives a payer name, not a structured plan/network id (per the SDK
// reference — do not rely on a payerId/networkId being reliably populated).
// This is an app-owned, best-effort name-matching table, same shape as v1
// sdoh-app's isMedicaid()/MEDICAID_HINTS, extended with an explicit
// confidence level so "no signal" ('none') is never conflated with a real
// negative (a recognized non-Medicaid/uninsured payer).

import type { CoverageMatch, CoverageType, InsuranceInfo } from './types';

interface PayerHint {
  pattern: string; // lowercase substring to match against payerName
  coverageType: CoverageType;
  confidence: 'high' | 'ambiguous';
}

export const PAYER_COVERAGE_HINTS: PayerHint[] = [
  { pattern: 'medicaid', coverageType: 'medicaid', confidence: 'high' },
  { pattern: 'medi-cal', coverageType: 'medicaid', confidence: 'high' },
  { pattern: 'managed medicaid', coverageType: 'medicaid', confidence: 'high' },
  { pattern: 'chip', coverageType: 'medicaid', confidence: 'high' },
  { pattern: 'dual', coverageType: 'medicaid', confidence: 'ambiguous' },
  { pattern: 'uninsured', coverageType: 'uninsured', confidence: 'high' },
  { pattern: 'self-pay', coverageType: 'uninsured', confidence: 'high' },
  { pattern: 'self pay', coverageType: 'uninsured', confidence: 'high' },
  { pattern: 'no insurance', coverageType: 'uninsured', confidence: 'high' },
  { pattern: 'medicare advantage', coverageType: 'medicare', confidence: 'high' },
  { pattern: 'medicare', coverageType: 'medicare', confidence: 'high' },
  { pattern: 'blue cross', coverageType: 'commercial', confidence: 'high' },
  { pattern: 'blue shield', coverageType: 'commercial', confidence: 'high' },
  { pattern: 'aetna', coverageType: 'commercial', confidence: 'high' },
  { pattern: 'cigna', coverageType: 'commercial', confidence: 'high' },
  { pattern: 'united healthcare', coverageType: 'commercial', confidence: 'high' },
  { pattern: 'unitedhealthcare', coverageType: 'commercial', confidence: 'high' },
  { pattern: 'humana', coverageType: 'commercial', confidence: 'high' },
  { pattern: 'kaiser', coverageType: 'commercial', confidence: 'high' },
];

// Highest-confidence hint wins; a 'high' Medicaid/uninsured hint takes
// priority over an 'ambiguous' one on a different insurance line.
const CONFIDENCE_RANK: Record<'high' | 'ambiguous', number> = { high: 2, ambiguous: 1 };

export function matchCoverage(insurances: InsuranceInfo[]): CoverageMatch {
  let best: PayerHint | null = null;

  for (const insurance of insurances) {
    const name = insurance.payerName.toLowerCase();
    for (const hint of PAYER_COVERAGE_HINTS) {
      if (!name.includes(hint.pattern)) continue;
      if (!best || CONFIDENCE_RANK[hint.confidence] > CONFIDENCE_RANK[best.confidence]) {
        best = hint;
      }
    }
  }

  if (!best) return { confidence: 'none' };
  return { confidence: best.confidence, coverageType: best.coverageType };
}

import { describe, expect, it } from 'vitest';
import { PROCEDURES } from './procedures';
import { PLAN_PRICES } from './planPrices';

describe('bundled pricing data — referential integrity', () => {
  it('has no duplicate CPT codes in the procedure table', () => {
    const cpts = PROCEDURES.map((p) => p.cpt);
    expect(new Set(cpts).size).toBe(cpts.length);
  });

  it('has no duplicate payer+group+cpt rows in the plan price table', () => {
    const keys = PLAN_PRICES.map((row) => `${row.payerId}|${row.groupId ?? ''}|${row.cpt}`);
    expect(new Set(keys).size).toBe(keys.length);
  });

  it('references only CPT codes that exist in the procedure table', () => {
    const validCpts = new Set(PROCEDURES.map((p) => p.cpt));
    for (const row of PLAN_PRICES) {
      expect(validCpts.has(row.cpt)).toBe(true);
    }
  });

  it('never lets a flat copay exceed the allowed amount it is charged against', () => {
    for (const row of PLAN_PRICES) {
      if (row.copayAmountCents != null) {
        expect(row.copayAmountCents).toBeLessThanOrEqual(row.allowedAmountCents);
      }
    }
  });

  it('keeps every coinsurance rate within 0–1', () => {
    for (const row of PLAN_PRICES) {
      if (row.coinsuranceRate != null) {
        expect(row.coinsuranceRate).toBeGreaterThanOrEqual(0);
        expect(row.coinsuranceRate).toBeLessThanOrEqual(1);
      }
    }
  });
});

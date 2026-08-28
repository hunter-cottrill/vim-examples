import { describe, expect, it } from 'vitest';
import { PROCEDURES } from './procedures';
import { PAYERS } from './payers';
import { PA_RULES } from './rules-table';

describe('bundled data referential integrity', () => {
  it('every rule references a cpt present in PROCEDURES', () => {
    const cpts = new Set(PROCEDURES.map((p) => p.cpt));
    for (const rule of PA_RULES) {
      expect(cpts.has(rule.cpt)).toBe(true);
    }
  });

  it('every rule references a payerId present in PAYERS', () => {
    const payerIds = new Set(PAYERS.map((p) => p.payerId));
    for (const rule of PA_RULES) {
      expect(payerIds.has(rule.payerId)).toBe(true);
    }
  });

  it('has no duplicate (payerId, cpt) rows', () => {
    const keys = PA_RULES.map((rule) => `${rule.payerId}:${rule.cpt}`);
    expect(new Set(keys).size).toBe(keys.length);
  });

  it('sets simulatedDenialReason if and only if simulatedOutcome is denied', () => {
    for (const rule of PA_RULES) {
      if (rule.requirement !== 'required') continue;
      if (rule.simulatedOutcome === 'denied') {
        expect(rule.simulatedDenialReason).toBeTruthy();
      } else {
        expect(rule.simulatedDenialReason).toBeUndefined();
      }
    }
  });

  it('never gives a PROCEDURES row an orderType outside DI/PROCEDURE', () => {
    for (const procedure of PROCEDURES) {
      expect(['DI', 'PROCEDURE']).toContain(procedure.orderType);
    }
  });

  it('has at least one not-required rule and at least one required rule with each simulated outcome', () => {
    expect(PA_RULES.some((r) => r.requirement === 'not-required')).toBe(true);
    expect(PA_RULES.some((r) => r.requirement === 'required' && r.simulatedOutcome === 'approved')).toBe(true);
    expect(PA_RULES.some((r) => r.requirement === 'required' && r.simulatedOutcome === 'denied')).toBe(true);
  });

  it('leaves at least one covered procedure+payer combination absent from PA_RULES (deliberate gap)', () => {
    const covered = new Set(PA_RULES.map((r) => `${r.payerId}:${r.cpt}`));
    const allCombos = PAYERS.flatMap((payer) => PROCEDURES.map((proc) => `${payer.payerId}:${proc.cpt}`));
    expect(allCombos.some((combo) => !covered.has(combo))).toBe(true);
  });
});

import { describe, expect, it } from 'vitest';
import type { InsuranceRead, OrderRead } from '@/lib/vim/types';
import { determineAuthRequirement, lookupRule } from './rules';

function order(overrides: Partial<OrderRead> = {}): OrderRead {
  return {
    ehrOrderId: 'order-1',
    orderType: 'DI',
    orderName: 'MRI lumbar spine',
    ...overrides,
  };
}

function insurance(overrides: Partial<InsuranceRead> = {}): InsuranceRead {
  return { payerName: 'Aetna', isPrimary: true, ...overrides };
}

describe('lookupRule', () => {
  it('returns the exact matching row', () => {
    expect(lookupRule('aetna', '72148')).toMatchObject({ requirement: 'required', simulatedOutcome: 'approved' });
  });

  it('returns undefined when no row matches', () => {
    expect(lookupRule('humana', '71271')).toBeUndefined();
  });
});

describe('determineAuthRequirement', () => {
  it('returns required with the matched rule for a covered payer/procedure', () => {
    const result = determineAuthRequirement(order(), insurance(), []);
    expect(result).toMatchObject({
      outcome: 'required',
      procedure: { cpt: '72148' },
      payer: { payerId: 'aetna' },
      rule: { requirement: 'required' },
    });
  });

  it('returns not-required for a covered not-required payer/procedure', () => {
    const result = determineAuthRequirement(order({ orderName: 'EKG' }), insurance({ payerName: 'Aetna' }), []);
    expect(result).toEqual({ outcome: 'not-required', procedure: expect.objectContaining({ cpt: '93000' }) });
  });

  it('returns undetermined/procedure-unmatched for an unmatched order', () => {
    const result = determineAuthRequirement(order({ orderName: 'routine venipuncture' }), insurance(), []);
    expect(result).toEqual({ outcome: 'undetermined', reason: 'procedure-unmatched' });
  });

  it('returns undetermined/procedure-ambiguous for a generic spine order', () => {
    const result = determineAuthRequirement(order({ orderName: 'MRI spine' }), insurance(), []);
    expect(result.outcome).toBe('undetermined');
    if (result.outcome === 'undetermined') {
      expect(result.reason).toBe('procedure-ambiguous');
      expect(result.candidates).toHaveLength(2);
    }
  });

  it('returns undetermined/payer-unmatched when insurance is missing', () => {
    const result = determineAuthRequirement(order(), undefined, []);
    expect(result).toEqual({ outcome: 'undetermined', reason: 'payer-unmatched' });
  });

  it('returns undetermined/payer-unmatched for an unrecognized payer name', () => {
    const result = determineAuthRequirement(order(), insurance({ payerName: 'Acme Regional Health Plan' }), []);
    expect(result).toEqual({ outcome: 'undetermined', reason: 'payer-unmatched' });
  });

  it('returns undetermined/no-rule-for-payer-and-procedure for a deliberate gap', () => {
    const result = determineAuthRequirement(
      order({ orderName: 'Low-dose CT lung cancer screening' }),
      insurance({ payerName: 'Humana' }),
      [],
    );
    expect(result).toEqual({ outcome: 'undetermined', reason: 'no-rule-for-payer-and-procedure' });
  });

  it('never conflates not-required with undetermined', () => {
    const notRequired = determineAuthRequirement(order({ orderName: 'EKG' }), insurance({ payerName: 'Aetna' }), []);
    const undetermined = determineAuthRequirement(order({ orderName: 'routine venipuncture' }), insurance(), []);
    expect(notRequired.outcome).not.toBe(undetermined.outcome);
  });
});

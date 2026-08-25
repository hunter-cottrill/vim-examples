import { describe, expect, it } from 'vitest';
import { calculateEstimate, findPlanPrice } from './estimate';

// CPT 73721 (MRI knee) under Aetna PPO: allowedAmountCents 85000, coinsuranceRate 0.2,
// no flat copay — a coinsurance-based row, so deductible logic actually applies.
const MRI_KNEE = { cpt: '73721', payerId: 'aetna-ppo' };

describe('calculateEstimate — insured, coinsurance-based benefit', () => {
  it('applies the full allowed amount to the deductible when the deductible far exceeds it', () => {
    const result = calculateEstimate({ ...MRI_KNEE, selfPay: false, benefitState: { deductibleRemainingCents: 100000 } });
    expect(result).toEqual({
      cpt: '73721',
      allowedAmountCents: 85000,
      insurancePortionCents: 0,
      patientResponsibilityCents: 85000,
      breakdown: { deductibleAppliedCents: 85000, coinsuranceCents: 0, copayCents: 0 },
      source: 'contracted-rate',
    });
  });

  it('splits deductible + coinsurance when the deductible is partially met', () => {
    const result = calculateEstimate({ ...MRI_KNEE, selfPay: false, benefitState: { deductibleRemainingCents: 30000 } });
    expect(result).toEqual({
      cpt: '73721',
      allowedAmountCents: 85000,
      insurancePortionCents: 44000,
      patientResponsibilityCents: 41000,
      breakdown: { deductibleAppliedCents: 30000, coinsuranceCents: 11000, copayCents: 0 },
      source: 'contracted-rate',
    });
  });

  it('applies coinsurance only once the deductible is fully met', () => {
    const result = calculateEstimate({ ...MRI_KNEE, selfPay: false, benefitState: { deductibleRemainingCents: 0 } });
    expect(result).toEqual({
      cpt: '73721',
      allowedAmountCents: 85000,
      insurancePortionCents: 68000,
      patientResponsibilityCents: 17000,
      breakdown: { deductibleAppliedCents: 0, coinsuranceCents: 17000, copayCents: 0 },
      source: 'contracted-rate',
    });
  });

  it('treats a missing benefitState as zero deductible remaining', () => {
    const result = calculateEstimate({ ...MRI_KNEE, selfPay: false });
    expect(result.breakdown.deductibleAppliedCents).toBe(0);
    expect(result.patientResponsibilityCents).toBe(17000);
  });
});

describe('calculateEstimate — copay-based benefit', () => {
  it('charges only the flat copay, bypassing deductible logic entirely', () => {
    const result = calculateEstimate({
      cpt: '99213',
      payerId: 'aetna-ppo',
      selfPay: false,
      benefitState: { deductibleRemainingCents: 100000 },
    });
    expect(result).toEqual({
      cpt: '99213',
      allowedAmountCents: 11000,
      insurancePortionCents: 8500,
      patientResponsibilityCents: 2500,
      breakdown: { deductibleAppliedCents: 0, coinsuranceCents: 0, copayCents: 2500 },
      source: 'contracted-rate',
    });
  });

  it('prefers a group-specific rate over the payer-wide default', () => {
    const result = calculateEstimate({ cpt: '99213', payerId: 'aetna-ppo', groupId: 'GRP100', selfPay: false });
    expect(result.breakdown.copayCents).toBe(1500);
    expect(result.patientResponsibilityCents).toBe(1500);
  });
});

describe('calculateEstimate — self-pay and missing-rate paths', () => {
  it('uses the bundled cash rate for a self-pay patient, with no insurance portion', () => {
    const result = calculateEstimate({ cpt: '73721', selfPay: true });
    expect(result).toEqual({
      cpt: '73721',
      allowedAmountCents: 95000,
      insurancePortionCents: 0,
      patientResponsibilityCents: 95000,
      breakdown: { deductibleAppliedCents: 0, coinsuranceCents: 0, copayCents: 0 },
      source: 'self-pay-cash-rate',
    });
  });

  it('falls back to the cash rate — never throwing, never fabricating a number — when the payer/plan has no contracted rate', () => {
    // Cigna is intentionally absent from the bundled table for CPT 73721.
    const result = calculateEstimate({ cpt: '73721', payerId: 'cigna-oap', selfPay: false });
    expect(result.source).toBe('no-rate-found');
    expect(result.patientResponsibilityCents).toBe(95000);
    expect(result.insurancePortionCents).toBe(0);
  });

  it('never throws and reports zero for a CPT absent from the procedure table', () => {
    expect(() => calculateEstimate({ cpt: '00000', selfPay: false })).not.toThrow();
    const result = calculateEstimate({ cpt: '00000', selfPay: false });
    expect(result).toEqual({
      cpt: '00000',
      allowedAmountCents: 0,
      insurancePortionCents: 0,
      patientResponsibilityCents: 0,
      breakdown: { deductibleAppliedCents: 0, coinsuranceCents: 0, copayCents: 0 },
      source: 'no-rate-found',
    });
  });

  it('is deterministic — identical input always yields byte-identical output', () => {
    const input = { cpt: '73721', payerId: 'aetna-ppo', selfPay: false, benefitState: { deductibleRemainingCents: 30000 } };
    const first = calculateEstimate(input);
    const second = calculateEstimate(input);
    expect(first).toEqual(second);
  });
});

describe('findPlanPrice', () => {
  it('returns undefined when no payerId is given', () => {
    expect(findPlanPrice('73721', undefined, undefined)).toBeUndefined();
  });

  it('returns the payer-wide row when no matching group row exists', () => {
    const row = findPlanPrice('99213', 'aetna-ppo', 'SOME-OTHER-GROUP');
    expect(row?.groupId).toBeUndefined();
    expect(row?.copayAmountCents).toBe(2500);
  });
});

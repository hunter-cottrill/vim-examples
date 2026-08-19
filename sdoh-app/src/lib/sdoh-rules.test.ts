import { describe, it, expect } from 'vitest';
import { evaluateSdoh, type PatientLike, type ReferralLike } from './sdoh-rules';
import { lookupZCode, SDOH_ZCODES } from './sdoh-codes';

describe('evaluateSdoh', () => {
  it('flags a transportation barrier when the referral provider is far from the patient', () => {
    const patient: PatientLike = { address: { zipCode: '10001' } };
    const referral: ReferralLike = { targetProvider: { zipCode: '94105', specialty: 'Cardiology' } };
    const out = evaluateSdoh(patient, referral);
    expect(out.some((i) => i.need === 'transportation')).toBe(true);
  });

  it('flags a financial need for Medicaid coverage', () => {
    const out = evaluateSdoh({ insurances: [{ payerName: 'State Medicaid Plan' }] });
    expect(out.some((i) => i.need === 'financial')).toBe(true);
  });

  it('flags language access as confirmed-data for a non-English preferred language', () => {
    const out = evaluateSdoh({ demographics: { preferredLanguage: 'Spanish' } });
    const lang = out.find((i) => i.need === 'language');
    expect(lang?.evidenceStrength).toBe('confirmed-data');
  });

  it('marks an existing Z-code as already documented', () => {
    const out = evaluateSdoh({ problems: [{ code: 'Z59.41', description: 'Food insecurity' }] });
    expect(out.some((i) => i.alreadyDocumented)).toBe(true);
  });

  it('returns no insights when there are no signals', () => {
    const out = evaluateSdoh({ address: { zipCode: '10001' }, insurances: [{ payerName: 'Aetna PPO' }] });
    expect(out).toHaveLength(0);
  });
});

describe('SDOH Z-code vocabulary', () => {
  it('every suggested code resolves to a dictionary entry (no free-text codes)', () => {
    const patient: PatientLike = { insurances: [{ payerName: 'Medicaid' }] };
    const referral: ReferralLike = { targetProvider: { zipCode: '94105' } };
    for (const insight of evaluateSdoh({ ...patient, address: { zipCode: '10001' } }, referral)) {
      for (const z of insight.suggestedZCodes) {
        expect(lookupZCode(z.code)).toBeDefined();
      }
    }
  });

  it('has a non-empty controlled Z-code table', () => {
    expect(SDOH_ZCODES.length).toBeGreaterThan(0);
  });
});

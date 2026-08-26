import { describe, expect, it } from 'vitest';
import { lookupZCode, SDOH_ZCODES } from './codes';
import { evaluateLanguageAccess, evaluateSdoh } from './rules';
import type { PatientContext, SdohNeed } from './types';

const NEEDS: SdohNeed[] = ['transportation', 'housing', 'food', 'financial', 'language_access'];

function basePatient(overrides: Partial<PatientContext> = {}): PatientContext {
  return {
    patientId: 'patient-1',
    zipCode: null,
    city: null,
    state: null,
    language: null,
    insurances: [],
    problems: [],
    ...overrides,
  };
}

describe('evaluateSdoh', () => {
  it('fires the coverage rule independently for a Medicaid patient', () => {
    const { insights, dataCompleteness } = evaluateSdoh(
      basePatient({ insurances: [{ payerName: 'State Medicaid' }] }),
    );
    const financial = insights.find((i) => i.need === 'financial');
    expect(financial).toBeDefined();
    expect(financial?.evidenceStrength).toBe('confirmed');
    expect(financial?.suggestedZCodes.length).toBeGreaterThan(0);
    expect(dataCompleteness).toBe('partial'); // zip and language still unresolved
  });

  it('fires the neighborhood-risk rule independently for an elevated ZIP, always as inferred', () => {
    const { insights } = evaluateSdoh(basePatient({ zipCode: '10453' }));
    const housing = insights.find((i) => i.need === 'housing');
    expect(housing).toBeDefined();
    // Even an exact ZIP5 match is neighborhood-level data, so any claim about this
    // patient is an inference — never 'confirmed', regardless of match confidence.
    expect(housing?.evidenceStrength).toBe('inferred');
  });

  it('fires the language-access rule independently for a non-English language, with no suggested code', () => {
    const { insights } = evaluateSdoh(basePatient({ language: 'Spanish' }));
    const language = insights.find((i) => i.need === 'language_access');
    expect(language).toBeDefined();
    expect(language?.suggestedZCodes).toEqual([]);
  });

  it('treats English (in either alias form) as no signal, not an insight', () => {
    expect(evaluateLanguageAccess('en')).toBeNull();
    expect(evaluateLanguageAccess('English')).toBeNull();
  });

  it('produces no insights and dataCompleteness "full" when every signal is determinate and negative', () => {
    const { insights, dataCompleteness } = evaluateSdoh(
      basePatient({ zipCode: '10021', insurances: [{ payerName: 'Aetna PPO' }], language: 'en' }),
    );
    expect(insights).toEqual([]);
    expect(dataCompleteness).toBe('full');
  });

  it('marks a rule-produced insight as alreadyDocumented and clears its suggested codes', () => {
    const { insights } = evaluateSdoh(
      basePatient({
        zipCode: '10453', // elevated -> housing AND food insights
        problems: [{ code: 'Z59.41', system: 'ICD-10-CM', description: 'Food insecurity' }],
      }),
    );
    const food = insights.find((i) => i.need === 'food');
    const housing = insights.find((i) => i.need === 'housing');
    expect(food?.alreadyDocumented).toBe(true);
    expect(food?.suggestedZCodes).toEqual([]);
    // The sibling housing insight (same ZIP evidence, different need) is unaffected.
    expect(housing?.alreadyDocumented).toBe(false);
    expect(housing?.suggestedZCodes.length).toBeGreaterThan(0);
  });

  it('synthesizes a new alreadyDocumented insight for a need none of the independent rules detected', () => {
    const { insights } = evaluateSdoh(
      basePatient({
        zipCode: '10021', // typical -> no housing insight
        insurances: [{ payerName: 'Acme Commercial Plan' }], // no coverage insight
        language: 'en', // no language insight
        problems: [{ code: 'Z59.82', system: 'ICD-10-CM', description: 'Transportation insecurity' }],
      }),
    );
    expect(insights).toHaveLength(1);
    expect(insights[0]).toMatchObject({ need: 'transportation', alreadyDocumented: true });
  });

  it('flags dataCompleteness "partial" when the ZIP is unrecognized, even with no insights', () => {
    const { dataCompleteness } = evaluateSdoh(
      basePatient({ zipCode: '05001', insurances: [{ payerName: 'Acme Commercial Plan' }], language: 'en' }),
    );
    expect(dataCompleteness).toBe('partial');
  });
});

describe('SDOH_ZCODES vocabulary integrity', () => {
  it('is non-empty and has at least one code for every billable need', () => {
    expect(SDOH_ZCODES.length).toBeGreaterThan(0);
    for (const need of NEEDS.filter((n) => n !== 'language_access')) {
      expect(SDOH_ZCODES.some((z) => z.need === need)).toBe(true);
    }
  });

  it('resolves every suggested code produced by evaluateSdoh through lookupZCode', () => {
    const { insights } = evaluateSdoh(
      basePatient({ zipCode: '10453', insurances: [{ payerName: 'State Medicaid' }], language: 'Spanish' }),
    );
    for (const insight of insights) {
      for (const zCode of insight.suggestedZCodes) {
        expect(lookupZCode(zCode.code)).toBeDefined();
      }
    }
  });
});

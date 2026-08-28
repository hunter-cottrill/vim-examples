import { describe, expect, it } from 'vitest';
import { matchPayer } from './payerMap';

describe('matchPayer', () => {
  it('resolves a known payer name case-insensitively', () => {
    expect(matchPayer('AETNA HEALTH PLAN')).toMatchObject({ confidence: 'high', payer: { payerId: 'aetna' } });
  });

  it('resolves a substring match (e.g. Anthem under BCBS)', () => {
    expect(matchPayer('Anthem Blue Cross of California')).toMatchObject({
      confidence: 'high',
      payer: { payerId: 'bcbs' },
    });
  });

  it('resolves an unrecognized payer name as none', () => {
    expect(matchPayer('Acme Regional Health Plan')).toEqual({ confidence: 'none' });
  });

  it('resolves an empty payer name as none', () => {
    expect(matchPayer('')).toEqual({ confidence: 'none' });
  });
});

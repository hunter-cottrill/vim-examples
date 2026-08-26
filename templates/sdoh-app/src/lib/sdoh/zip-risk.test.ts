import { describe, expect, it } from 'vitest';
import { matchZipRisk } from './zip-risk';

describe('matchZipRisk', () => {
  it('returns high confidence for a ZIP5 in the exact table (elevated)', () => {
    expect(matchZipRisk('10453')).toEqual({ confidence: 'high', tier: 'elevated', source: 'exact_zip' });
  });

  it('returns high confidence for a ZIP5 in the exact table (typical) — a real negative, not none', () => {
    expect(matchZipRisk('10021')).toEqual({ confidence: 'high', tier: 'typical', source: 'exact_zip' });
  });

  it('falls back to ambiguous ZIP3-prefix match when the ZIP5 is not in the exact table', () => {
    expect(matchZipRisk('10457')).toEqual({ confidence: 'ambiguous', tier: 'elevated', source: 'zip3_prefix' });
  });

  it('returns none when neither the ZIP5 nor its ZIP3 prefix is recognized', () => {
    expect(matchZipRisk('05001')).toEqual({ confidence: 'none' });
  });

  it('returns none for a null ZIP code', () => {
    expect(matchZipRisk(null)).toEqual({ confidence: 'none' });
  });
});

import { describe, expect, it } from 'vitest';
import { matchOrderToCpt } from './crosswalk';
import { PROCEDURES } from './data/procedures';
import type { ProcedureCode } from './types';

describe('matchOrderToCpt', () => {
  it('returns a high-confidence exact match on a known orderName', () => {
    const result = matchOrderToCpt('Comprehensive Metabolic Panel');
    expect(result.confidence).toBe('high');
    expect(result).toMatchObject({ match: { cpt: '80053' } });
  });

  it('matches on an alias phrased differently than the description', () => {
    const result = matchOrderToCpt('knee mri');
    expect(result.confidence).toBe('high');
    expect(result).toMatchObject({ match: { cpt: '73721' } });
  });

  it('tolerates punctuation and casing noise', () => {
    const result = matchOrderToCpt('Chest X-Ray, 2 Views');
    expect(result.confidence).toBe('high');
    expect(result).toMatchObject({ match: { cpt: '71046' } });
  });

  it('returns none when nothing plausible matches', () => {
    const result = matchOrderToCpt('podiatry referral for ingrown toenail');
    expect(result).toEqual({ confidence: 'none' });
  });

  it('returns none for empty or whitespace-only input', () => {
    expect(matchOrderToCpt('')).toEqual({ confidence: 'none' });
    expect(matchOrderToCpt('   ')).toEqual({ confidence: 'none' });
  });

  it('returns ambiguous with multiple candidates when two procedures tie for the top match, never silently guessing', () => {
    const table: ProcedureCode[] = [
      { cpt: '11111', description: 'Left knee brace fitting', aliases: ['brace'], selfPayCashRateCents: 5000 },
      { cpt: '22222', description: 'Right knee brace fitting', aliases: ['brace'], selfPayCashRateCents: 6000 },
    ];
    const result = matchOrderToCpt('brace', table);
    expect(result.confidence).toBe('ambiguous');
    if (result.confidence === 'ambiguous') {
      const codes = result.candidates.map((c) => c.cpt).sort();
      expect(codes).toEqual(['11111', '22222']);
    }
  });

  it('never returns a CPT that is not present in the bundled table', () => {
    const validCpts = new Set(PROCEDURES.map((p) => p.cpt));
    const inputs = [
      'office visit',
      'mri of the knee',
      'cmp',
      'cxr',
      'diagnostic colonoscopy',
      'random unmatched text about nothing medical',
      'knee',
      'panel',
    ];
    for (const input of inputs) {
      const result = matchOrderToCpt(input);
      if (result.confidence === 'high') {
        expect(validCpts.has(result.match.cpt)).toBe(true);
      } else if (result.confidence === 'ambiguous') {
        for (const candidate of result.candidates) {
          expect(validCpts.has(candidate.cpt)).toBe(true);
        }
      }
    }
  });
});

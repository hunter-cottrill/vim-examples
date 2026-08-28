import { describe, expect, it } from 'vitest';
import { buildTrialMatches, selectSearchConditions } from './trial-matching';
import { TRIALS_DISPLAY_LIMIT } from './constants';
import type { ConditionMatch, Diagnosis, TrialApiResult, ZipMatch } from './types';

function diagnosis(overrides: Partial<Diagnosis>): Diagnosis {
  return { code: 'E11.9', system: 'ICD-10', status: 'active', description: '', onSetDate: null, ...overrides };
}

function highMatch(conditionKey: string, onSetDate: string | null): ConditionMatch {
  return {
    diagnosis: diagnosis({ code: 'E11.9', onSetDate }),
    confidence: 'high',
    conditionKey,
    searchTerm: conditionKey,
  };
}

const DENVER_ZIP: ZipMatch = { zip3: '802', confidence: 'high', lat: 39.7392, lon: -104.9903 };
const NO_ZIP: ZipMatch = { zip3: '000', confidence: 'none' };

function trial(nctId: string, lat: number | null, lon: number | null): TrialApiResult {
  return {
    nctId,
    briefTitle: `Trial ${nctId}`,
    overallStatus: 'RECRUITING',
    locations: [{ facility: `Site ${nctId}`, city: 'Denver', state: 'CO', lat, lon }],
  };
}

describe('selectSearchConditions', () => {
  it('filters to only high-confidence matches', () => {
    const matches: ConditionMatch[] = [
      highMatch('a', '2024-01-01'),
      { diagnosis: diagnosis({}), confidence: 'ambiguous', candidateConditionKeys: ['a', 'b'] },
      { diagnosis: diagnosis({}), confidence: 'none' },
    ];
    expect(selectSearchConditions(matches)).toHaveLength(1);
  });

  it('enforces MAX_CONDITIONS_PER_SEARCH, keeping the most recent onSetDate first', () => {
    const matches: ConditionMatch[] = [
      highMatch('c1', '2020-01-01'),
      highMatch('c2', '2024-06-01'),
      highMatch('c3', '2023-01-01'),
      highMatch('c4', '2022-01-01'),
      highMatch('c5', '2021-01-01'),
      highMatch('c6', null),
      highMatch('c7', '2019-01-01'),
    ];
    const selected = selectSearchConditions(matches);
    expect(selected).toHaveLength(5);
    expect(selected.map((m) => m.conditionKey)).toEqual(['c2', 'c3', 'c4', 'c5', 'c1']);
    expect(selected.map((m) => m.conditionKey)).not.toContain('c6'); // missing date sorts last, dropped
    expect(selected.map((m) => m.conditionKey)).not.toContain('c7');
  });
});

describe('buildTrialMatches', () => {
  it('returns no_problems when the patient has zero active problems', () => {
    const result = buildTrialMatches([], [], NO_ZIP, []);
    expect(result).toEqual({ kind: 'no_problems' });
  });

  it('returns no_resolvable_conditions when no condition match is high confidence', () => {
    const problems = [diagnosis({ code: '44054006', system: 'SNOMED-CT' })];
    const conditionMatches: ConditionMatch[] = [{ diagnosis: problems[0], confidence: 'none' }];
    const result = buildTrialMatches(problems, conditionMatches, NO_ZIP, []);
    expect(result).toEqual({ kind: 'no_resolvable_conditions', conditionMatches });
  });

  it('returns no_trials_found when a condition resolved but the search came back empty', () => {
    const problems = [diagnosis({ code: 'E66.9' })];
    const conditionMatches = [highMatch('obesity', '2024-01-01')];
    const result = buildTrialMatches(problems, conditionMatches, DENVER_ZIP, [{ conditionKey: 'obesity', trials: [] }]);
    expect(result).toEqual({ kind: 'no_trials_found', conditionMatches, zipMatch: DENVER_ZIP });
  });

  it('returns matches_found sorted by distance ascending, nulls last, deduped by nctId', () => {
    const problems = [diagnosis({ code: 'E11.9' })];
    const conditionMatches = [highMatch('type2_diabetes', '2024-01-01')];
    const rawResults = [
      {
        conditionKey: 'type2_diabetes',
        trials: [
          trial('NCT-FAR', 40.7128, -74.006), // NYC, far from Denver
          trial('NCT-NEAR', 39.75, -105.0), // near Denver
          trial('NCT-NULL', null, null), // no geocoded location
        ],
      },
    ];
    const result = buildTrialMatches(problems, conditionMatches, DENVER_ZIP, rawResults);
    expect(result.kind).toBe('matches_found');
    if (result.kind !== 'matches_found') throw new Error('expected matches_found');
    expect(result.trials.map((t) => t.nctId)).toEqual(['NCT-NEAR', 'NCT-FAR', 'NCT-NULL']);
    expect(result.trials[2].distanceMiles).toBeNull();
    expect(result.truncated).toBe(false);
  });

  it('dedupes a trial appearing under multiple conditions, unioning matchedConditionKeys', () => {
    const problems = [diagnosis({ code: 'I10' }), diagnosis({ code: 'I50.9' })];
    const conditionMatches = [highMatch('hypertension', '2024-01-01'), highMatch('heart_failure', '2023-01-01')];
    const sharedTrial = trial('NCT-SHARED', 39.75, -105.0);
    const rawResults = [
      { conditionKey: 'hypertension', trials: [sharedTrial] },
      { conditionKey: 'heart_failure', trials: [sharedTrial] },
    ];
    const result = buildTrialMatches(problems, conditionMatches, DENVER_ZIP, rawResults);
    expect(result.kind).toBe('matches_found');
    if (result.kind !== 'matches_found') throw new Error('expected matches_found');
    expect(result.trials).toHaveLength(1);
    expect(result.trials[0].matchedConditionKeys).toEqual(['hypertension', 'heart_failure']);
  });

  it('sets distanceMiles null for every trial when the ZIP could not be resolved', () => {
    const problems = [diagnosis({ code: 'J44.9' })];
    const conditionMatches = [highMatch('copd', '2024-01-01')];
    const rawResults = [{ conditionKey: 'copd', trials: [trial('NCT-1', 39.75, -105.0)] }];
    const result = buildTrialMatches(problems, conditionMatches, NO_ZIP, rawResults);
    expect(result.kind).toBe('matches_found');
    if (result.kind !== 'matches_found') throw new Error('expected matches_found');
    expect(result.trials[0].distanceMiles).toBeNull();
  });

  it('sets truncated true and caps output at TRIALS_DISPLAY_LIMIT when more trials exist', () => {
    const problems = [diagnosis({ code: 'E11.9' })];
    const conditionMatches = [highMatch('type2_diabetes', '2024-01-01')];
    const manyTrials = Array.from({ length: TRIALS_DISPLAY_LIMIT + 5 }, (_, i) => trial(`NCT-${i}`, 39.75, -105.0));
    const result = buildTrialMatches(problems, conditionMatches, DENVER_ZIP, [
      { conditionKey: 'type2_diabetes', trials: manyTrials },
    ]);
    expect(result.kind).toBe('matches_found');
    if (result.kind !== 'matches_found') throw new Error('expected matches_found');
    expect(result.trials).toHaveLength(TRIALS_DISPLAY_LIMIT);
    expect(result.truncated).toBe(true);
  });
});

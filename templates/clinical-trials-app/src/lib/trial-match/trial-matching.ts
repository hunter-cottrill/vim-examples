// Pure trial-matching logic. Shared verbatim by the real path (UI, fed by
// trials-client.ts's live ClinicalTrials.gov response) and the dev-harness
// path (fed by canned fixture responses) — never forked.
import { haversineMiles } from './distance';
import { MAX_CONDITIONS_PER_SEARCH, TRIALS_DISPLAY_LIMIT } from './constants';
import type { ConditionMatch, Diagnosis, ReadyResult, TrialApiResult, TrialMatch, ZipMatch } from './types';

/**
 * Picks which high-confidence conditions to actually search for, bounding
 * external calls to MAX_CONDITIONS_PER_SEARCH. Ties are broken by most
 * recent onSetDate first; diagnoses with no onSetDate sort last.
 */
export function selectSearchConditions(conditionMatches: ConditionMatch[]): ConditionMatch[] {
  const highConfidence = conditionMatches.filter((c) => c.confidence === 'high');

  const sorted = [...highConfidence].sort((a, b) => {
    const dateA = a.diagnosis.onSetDate;
    const dateB = b.diagnosis.onSetDate;
    if (dateA === dateB) return 0;
    if (dateA === null) return 1; // missing date sorts last
    if (dateB === null) return -1;
    return dateB.localeCompare(dateA); // descending — most recent first
  });

  return sorted.slice(0, MAX_CONDITIONS_PER_SEARCH);
}

function nearestLocation(
  trial: TrialApiResult,
  zipMatch: ZipMatch,
): { facility: string | null; city: string | null; state: string | null; distanceMiles: number | null } {
  if (zipMatch.confidence !== 'high' || zipMatch.lat === undefined || zipMatch.lon === undefined) {
    const first = trial.locations[0] ?? null;
    return {
      facility: first?.facility ?? null,
      city: first?.city ?? null,
      state: first?.state ?? null,
      distanceMiles: null,
    };
  }

  let best: { facility: string | null; city: string | null; state: string | null; distanceMiles: number | null } = {
    facility: trial.locations[0]?.facility ?? null,
    city: trial.locations[0]?.city ?? null,
    state: trial.locations[0]?.state ?? null,
    distanceMiles: null,
  };

  for (const location of trial.locations) {
    if (location.lat === null || location.lon === null) continue;
    const distanceMiles = haversineMiles(zipMatch.lat, zipMatch.lon, location.lat, location.lon);
    if (best.distanceMiles === null || distanceMiles < best.distanceMiles) {
      best = { facility: location.facility, city: location.city, state: location.state, distanceMiles };
    }
  }

  return best;
}

export function buildTrialMatches(
  problems: Diagnosis[],
  conditionMatches: ConditionMatch[],
  zipMatch: ZipMatch,
  rawResultsByCondition: Array<{ conditionKey: string; trials: TrialApiResult[] }>,
): ReadyResult {
  if (problems.length === 0) {
    return { kind: 'no_problems' };
  }

  const highConfidenceMatches = conditionMatches.filter((c) => c.confidence === 'high');
  if (highConfidenceMatches.length === 0) {
    return { kind: 'no_resolvable_conditions', conditionMatches };
  }

  const byNctId = new Map<string, TrialMatch>();
  for (const { conditionKey, trials } of rawResultsByCondition) {
    for (const trial of trials) {
      const existing = byNctId.get(trial.nctId);
      if (existing) {
        if (!existing.matchedConditionKeys.includes(conditionKey)) {
          existing.matchedConditionKeys.push(conditionKey);
        }
        continue;
      }
      const nearest = nearestLocation(trial, zipMatch);
      byNctId.set(trial.nctId, {
        nctId: trial.nctId,
        briefTitle: trial.briefTitle,
        overallStatus: trial.overallStatus,
        matchedConditionKeys: [conditionKey],
        nearestFacility: nearest.facility,
        nearestCity: nearest.city,
        nearestState: nearest.state,
        distanceMiles: nearest.distanceMiles,
      });
    }
  }

  const allTrials = [...byNctId.values()].sort((a, b) => {
    if (a.distanceMiles === null && b.distanceMiles === null) return 0;
    if (a.distanceMiles === null) return 1; // nulls last
    if (b.distanceMiles === null) return -1;
    return a.distanceMiles - b.distanceMiles;
  });

  if (allTrials.length === 0) {
    return { kind: 'no_trials_found', conditionMatches, zipMatch };
  }

  const truncated = allTrials.length > TRIALS_DISPLAY_LIMIT;
  return {
    kind: 'matches_found',
    conditionMatches,
    zipMatch,
    trials: allTrials.slice(0, TRIALS_DISPLAY_LIMIT),
    truncated,
  };
}

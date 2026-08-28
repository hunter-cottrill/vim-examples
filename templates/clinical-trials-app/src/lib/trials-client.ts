/**
 * Client-side boundary to the app's own trial-search backend route. This is
 * the only file that calls fetch('/api/trials/search') — the UI never talks
 * to ClinicalTrials.gov directly. Only condition search terms (from the
 * bundled crosswalk) and a coarse ZIP3-centroid coordinate are sent; no ZIP
 * code, diagnosis code, or patient identifier leaves the browser.
 */
import { buildTrialMatches, selectSearchConditions } from './trial-match/trial-matching';
import type {
  ConditionMatch,
  Diagnosis,
  ReadyResult,
  TrialSearchErrorResponse,
  TrialSearchRequest,
  TrialSearchResponse,
  ZipMatch,
} from './trial-match/types';

export async function searchTrials(
  problems: Diagnosis[],
  conditionMatches: ConditionMatch[],
  zipMatch: ZipMatch,
): Promise<ReadyResult> {
  const selected = selectSearchConditions(conditionMatches);

  if (selected.length === 0) {
    // No high-confidence condition to search for — buildTrialMatches resolves
    // this to no_problems or no_resolvable_conditions without hitting the network.
    return buildTrialMatches(problems, conditionMatches, zipMatch, []);
  }

  const request: TrialSearchRequest = {
    conditions: selected.map((c) => ({ conditionKey: c.conditionKey!, searchTerm: c.searchTerm! })),
    lat: zipMatch.confidence === 'high' ? (zipMatch.lat ?? null) : null,
    lon: zipMatch.confidence === 'high' ? (zipMatch.lon ?? null) : null,
  };

  const res = await fetch('/api/trials/search', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(request),
  });

  if (!res.ok) {
    const body: Partial<TrialSearchErrorResponse> = await res.json().catch(() => ({}));
    throw new Error(body.error ?? `Trial search failed: HTTP ${res.status}`);
  }

  const data: TrialSearchResponse = await res.json();
  return buildTrialMatches(problems, conditionMatches, zipMatch, data.results);
}

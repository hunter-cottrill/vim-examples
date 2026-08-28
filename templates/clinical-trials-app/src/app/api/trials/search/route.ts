import { NextRequest, NextResponse } from 'next/server';
import { retryWithBackoff } from '@/lib/retry';
import {
  CT_GOV_STUDIES_ENDPOINT,
  MAX_CONDITIONS_PER_SEARCH,
  SEARCH_RADIUS_MILES,
  TRIAL_SEARCH_MAX_ATTEMPTS,
  TRIAL_SEARCH_RETRY_DELAY_MS,
} from '@/lib/trial-match/constants';
import type { TrialApiResult, TrialSearchErrorResponse, TrialSearchRequest, TrialSearchResponse } from '@/lib/trial-match/types';

// One retry, spaced TRIAL_SEARCH_RETRY_DELAY_MS apart — TRIAL_SEARCH_MAX_ATTEMPTS
// total attempts per condition (1 initial + (MAX_ATTEMPTS - 1) retries).
const RETRY_DELAYS = Array(TRIAL_SEARCH_MAX_ATTEMPTS - 1).fill(TRIAL_SEARCH_RETRY_DELAY_MS);

interface CtGovStudy {
  protocolSection?: {
    identificationModule?: { nctId?: string; briefTitle?: string };
    statusModule?: { overallStatus?: string };
    contactsLocationsModule?: {
      locations?: Array<{
        facility?: string;
        city?: string;
        state?: string;
        geoPoint?: { lat?: number; lon?: number };
      }>;
    };
  };
}

function buildStudiesUrl(searchTerm: string, lat: number | null, lon: number | null): string {
  const url = new URL(CT_GOV_STUDIES_ENDPOINT);
  // Quoted as an exact phrase — confirmed live that an unquoted term (e.g.
  // "Hypertension") matches unrelated conditions that merely share a word
  // (Ocular Hypertension, Pulmonary Hypertension) via the API's term
  // expansion. Quoting is a no-op for a single-word term, so this is safe
  // to apply uniformly to every crosswalk entry, not just the one observed.
  url.searchParams.set('query.cond', `"${searchTerm}"`);
  url.searchParams.set('filter.overallStatus', 'RECRUITING');
  if (lat !== null && lon !== null) {
    url.searchParams.set('filter.geo', `distance(${lat},${lon},${SEARCH_RADIUS_MILES}mi)`);
  }
  url.searchParams.set('pageSize', '20');
  return url.toString();
}

function shapeStudies(studies: CtGovStudy[]): TrialApiResult[] {
  const results: TrialApiResult[] = [];
  for (const study of studies) {
    const nctId = study.protocolSection?.identificationModule?.nctId;
    const briefTitle = study.protocolSection?.identificationModule?.briefTitle;
    if (!nctId || !briefTitle) continue; // can't render or dedupe a trial without an id

    results.push({
      nctId,
      briefTitle,
      overallStatus: study.protocolSection?.statusModule?.overallStatus ?? 'UNKNOWN',
      locations: (study.protocolSection?.contactsLocationsModule?.locations ?? []).map((loc) => ({
        facility: loc.facility ?? 'Unknown facility',
        city: loc.city ?? '',
        state: loc.state ?? '',
        lat: loc.geoPoint?.lat ?? null,
        lon: loc.geoPoint?.lon ?? null,
      })),
    });
  }
  return results;
}

async function searchOneCondition(searchTerm: string, lat: number | null, lon: number | null): Promise<TrialApiResult[]> {
  return retryWithBackoff(async () => {
    const res = await fetch(buildStudiesUrl(searchTerm, lat, lon));
    if (!res.ok) throw new Error(`ClinicalTrials.gov returned HTTP ${res.status}`);
    const data = await res.json();
    return shapeStudies(data.studies ?? []);
  }, RETRY_DELAYS);
}

/**
 * The only route that calls ClinicalTrials.gov. Fans out one call per
 * requested condition (bounded to MAX_CONDITIONS_PER_SEARCH), each retried
 * independently; a condition whose calls all fail is dropped from the
 * response (partial-failure tolerant) rather than failing the whole search.
 */
export async function POST(request: NextRequest) {
  const body: TrialSearchRequest = await request.json();
  const conditions = (body.conditions ?? []).slice(0, MAX_CONDITIONS_PER_SEARCH);
  const lat = body.lat ?? null;
  const lon = body.lon ?? null;

  if (conditions.length === 0) {
    const response: TrialSearchResponse = { results: [] };
    return NextResponse.json(response);
  }

  const settled = await Promise.allSettled(
    conditions.map(async (c) => ({
      conditionKey: c.conditionKey,
      trials: await searchOneCondition(c.searchTerm, lat, lon),
    })),
  );

  const results: TrialSearchResponse['results'] = [];
  let anySucceeded = false;
  for (const outcome of settled) {
    if (outcome.status === 'fulfilled') {
      anySucceeded = true;
      results.push(outcome.value);
    }
  }

  if (!anySucceeded) {
    const errorResponse: TrialSearchErrorResponse = {
      error: 'ClinicalTrials.gov search failed for every condition after retrying.',
    };
    return NextResponse.json(errorResponse, { status: 502 });
  }

  const response: TrialSearchResponse = { results };
  return NextResponse.json(response);
}

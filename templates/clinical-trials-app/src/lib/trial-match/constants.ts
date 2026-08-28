// Entity API cache-race retries (a proven schedule reused across this repo's templates).
export const RETRY_DELAYS_MS = [200, 500, 1000];

// Per-condition backend retry bound when calling ClinicalTrials.gov.
export const TRIAL_SEARCH_MAX_ATTEMPTS = 2;
export const TRIAL_SEARCH_RETRY_DELAY_MS = 500;

// Bounds how many distinct high-confidence conditions get searched per
// chart-open, so a patient with a long problem list doesn't fan out
// unboundedly many external calls.
export const MAX_CONDITIONS_PER_SEARCH = 5;

// Geo-distance filter radius passed to ClinicalTrials.gov's filter.geo param.
export const SEARCH_RADIUS_MILES = 100;

// Caps how many trials are rendered; buildTrialMatches reports whether more
// existed via ReadyResult.truncated so the UI never silently drops results.
export const TRIALS_DISPLAY_LIMIT = 25;

// Empirically verified live in this session — public, unauthenticated,
// no API key. See CLAUDE.md for the confirmed query params and response shape.
export const CT_GOV_STUDIES_ENDPOINT = 'https://clinicaltrials.gov/api/v2/studies';

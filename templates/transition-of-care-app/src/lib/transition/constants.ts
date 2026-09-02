// A hospitalization counts as "recent" only within this many days of discharge.
// Enforced by evaluateHospitalization() in hospitalizationLookup.ts.
export const RECENCY_WINDOW_DAYS = 30;

// Backoff schedule for retryEntityFetch (see src/lib/retry.ts). Shared here so
// the same schedule is visible from both the SDK client and its tests.
export const RETRY_DELAYS_MS = [200, 500, 1000] as const;

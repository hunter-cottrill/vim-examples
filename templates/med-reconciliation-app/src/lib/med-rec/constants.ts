// Tunable constants for the reconciliation app. Everything here is read by
// name somewhere in src/ — nothing is declared "for later".

/**
 * Entity API cache-race retry schedule (a proven schedule reused across this
 * repo's templates). Bound: 1 initial attempt + 3 retries = 4 attempts total,
 * enforced by retryWithBackoff's `attempt === delaysMs.length` break.
 */
export const RETRY_DELAYS_MS = [200, 500, 1000];

/**
 * Hand-rolled debounce for the Worker's context registration.
 * HookDeclaration.debounceMs is NOT used — the SDK's own doc comment marks it
 * "Phase 1 — implemented last", and cds-app documented empirically that a
 * `fields`-gated registration never fired on the real event.
 */
export const WORKER_DEBOUNCE_MS = 800;

/**
 * NotificationDetails.text is a single short line in the Hub. Beyond this many
 * findings the notification says "N items" rather than trying to enumerate.
 */
export const MAX_NOTIFICATION_FINDINGS = 3;

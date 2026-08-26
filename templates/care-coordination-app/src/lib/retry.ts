/**
 * Shared retry-with-backoff for Entity API reads that race the EHR's context
 * population — a follow-up fetch can reject with ENTITY_NOT_IN_CONTEXT in the
 * same tick the triggering event fires, which is a context-population race,
 * not a real absence. NOT_IMPLEMENTED short-circuits immediately (no amount
 * of retrying makes an unimplemented EHR operation implemented) and is
 * reported distinctly from a retry-exhausted transient failure.
 */
import { isSdkErrorCode } from './sdk-error';

export const RETRY_DELAYS_MS = [200, 500, 1000];

export type RetryOutcome<T> =
  | { outcome: 'loaded'; data: T }
  | { outcome: 'unsupported' }
  | { outcome: 'error'; message: string };

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function retryEntityFetch<T>(
  fetchOnce: () => Promise<{ success: boolean; data?: T }>,
): Promise<RetryOutcome<T>> {
  let lastMessage = 'no successful response';
  for (let attempt = 0; attempt <= RETRY_DELAYS_MS.length; attempt += 1) {
    try {
      const response = await fetchOnce();
      if (response.success && response.data !== undefined) return { outcome: 'loaded', data: response.data };
      lastMessage = 'EHR returned an unsuccessful response';
    } catch (err: unknown) {
      if (isSdkErrorCode(err, 'NOT_IMPLEMENTED')) return { outcome: 'unsupported' };
      lastMessage = err instanceof Error ? err.message : String(err);
    }
    if (attempt < RETRY_DELAYS_MS.length) await delay(RETRY_DELAYS_MS[attempt]);
  }
  return { outcome: 'error', message: `retries exhausted — ${lastMessage}` };
}
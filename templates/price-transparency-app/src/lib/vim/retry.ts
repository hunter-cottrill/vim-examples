/**
 * Shared retry-with-backoff for Entity API reads that race the EHR's context
 * population — confirmed live (see subscribeOrderEvents in client.ts) that
 * getOrderById() can reject with "No order is in the current EHR context" in
 * the same tick the triggering event fires. Used by both the UI SDK client
 * and the Worker client, since both hit the same underlying race.
 */

export const RETRY_DELAYS_MS = [200, 500, 1000];

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Retries `fetchOnce` a few times with backoff, stopping early if `isValid`
 * (a TTL/handle-liveness check) goes false. Returns the resolved data, or
 * undefined if every attempt failed or the caller became invalid mid-retry.
 */
export async function retryFetch<T>(
  fetchOnce: () => Promise<{ success: boolean; data?: T }>,
  isValid: () => boolean,
  onDebug?: (message: string) => void,
): Promise<T | undefined> {
  for (let attempt = 0; attempt <= RETRY_DELAYS_MS.length; attempt += 1) {
    if (!isValid()) {
      onDebug?.('retryFetch: caller invalidated before fetch could complete');
      return undefined;
    }
    try {
      const response = await fetchOnce();
      onDebug?.(`retryFetch attempt ${attempt + 1} response: ${JSON.stringify(response)}`);
      if (response.success && response.data) return response.data;
    } catch (err: unknown) {
      onDebug?.(`retryFetch attempt ${attempt + 1} threw: ${err instanceof Error ? err.message : String(err)}`);
    }
    if (attempt < RETRY_DELAYS_MS.length) await delay(RETRY_DELAYS_MS[attempt]);
  }
  return undefined;
}
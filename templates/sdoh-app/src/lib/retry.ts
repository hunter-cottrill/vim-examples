// Generic retry-with-backoff for the Entity API's transient
// "not in current EHR context" cache race right after a workflow event
// fires. SDK-free — takes any async thunk, so it's testable with fake delays.

export async function retryWithBackoff<T>(
  fn: () => Promise<T>,
  delaysMs: number[] = [200, 500, 1000],
  wait: (ms: number) => Promise<void> = (ms) => new Promise((resolve) => setTimeout(resolve, ms)),
): Promise<T> {
  let lastError: unknown;

  for (let attempt = 0; attempt <= delaysMs.length; attempt++) {
    try {
      return await fn();
    } catch (err) {
      lastError = err;
      if (attempt === delaysMs.length) break; // out of retries
      await wait(delaysMs[attempt]);
    }
  }

  throw lastError;
}

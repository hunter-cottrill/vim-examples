/**
 * Shared setup for the module checks. Each check loads the real vim-client with
 * the simulator on. If its module hasn't been built yet, the check skips itself
 * rather than failing — so `npm test` shows your progress as skipped → passed.
 */
import { vi } from 'vitest';
import { isNotBuilt } from '../lib/learning-types';

export async function loadClient() {
  vi.resetModules();
  vi.stubEnv('NEXT_PUBLIC_SIM_MODE', 'true');
  return import('../lib/vim-client');
}

/** Run a check body; skip the test if it hits a module that isn't built yet. */
export async function unlessNotBuilt(skip: (note?: string) => void, body: () => Promise<void> | void) {
  try {
    await body();
  } catch (err) {
    if (isNotBuilt(err)) return skip(err.message);
    throw err;
  }
}

/** Load the Worker client with the simulator on — the Module 9 counterpart of loadClient. */
export async function loadWorker() {
  vi.resetModules();
  vi.stubEnv('NEXT_PUBLIC_SIM_MODE', 'true');
  return import('../lib/worker-client');
}

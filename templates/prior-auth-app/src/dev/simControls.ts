/**
 * DEV-ONLY toggle for the "simulate submit failure" harness control. Lives
 * outside lib/vim/ deliberately: this simulates the app's OWN backend call
 * failing, not an EHR read — not part of the SDK boundary. Checked
 * synchronously at the start of the submit effect, before any real fetch, so
 * there's no race with a real network response (see build plan §8).
 */
const SIM_MODE = process.env.NEXT_PUBLIC_SIM_MODE === 'true';

let forceNextSubmitFailure = false;

export function simulateSubmitFailure(): void {
  if (!SIM_MODE) return;
  forceNextSubmitFailure = true;
}

export function consumeForcedSubmitFailure(): boolean {
  if (!SIM_MODE || !forceNextSubmitFailure) return false;
  forceNextSubmitFailure = false;
  return true;
}

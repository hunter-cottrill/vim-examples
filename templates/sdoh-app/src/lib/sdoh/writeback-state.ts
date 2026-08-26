// Per-insight-card writeback lifecycle. Deliberately a separate, smaller
// reducer from AppState (src/lib/app-state.ts) — it's local to one card and
// one Z-code selection, not the whole panel's lifecycle.

export type WritebackOutcome =
  | { ok: true }
  | { ok: false; reason: 'denied' | 'not_configured' | 'error'; detail?: string };

export type WritebackState =
  | { status: 'idle' }
  | { status: 'submitting' }
  | { status: 'success' }
  | { status: 'denied' }
  | { status: 'not_configured' }
  | { status: 'error'; detail?: string };

export type WritebackInput = { type: 'SUBMIT' } | { type: 'RESULT'; outcome: WritebackOutcome } | { type: 'RESET' };

export function writebackTransition(state: WritebackState, input: WritebackInput): WritebackState {
  if (input.type === 'RESET') return { status: 'idle' };

  if (input.type === 'SUBMIT') {
    if (state.status !== 'idle') return state; // no-op — already in flight or resolved
    return { status: 'submitting' };
  }

  // input.type === 'RESULT'
  if (state.status !== 'submitting') return state; // no-op — result arriving out of order

  const { outcome } = input;
  if (outcome.ok) return { status: 'success' };
  if (outcome.reason === 'denied') return { status: 'denied' };
  if (outcome.reason === 'not_configured') return { status: 'not_configured' };
  return { status: 'error', detail: outcome.detail };
}
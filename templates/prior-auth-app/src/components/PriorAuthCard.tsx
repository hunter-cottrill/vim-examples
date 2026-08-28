'use client';

import type { PriorAuthState } from '@/lib/priorAuth/types';
import { formatAuthNumber, formatUndeterminedReason } from '@/lib/priorAuth/format';
import { PriorAuthForm } from './PriorAuthForm';

interface PriorAuthCardProps {
  state: PriorAuthState;
  onRetryContext: () => void;
  onSubmit: () => void;
  onRecheck: () => void;
}

/**
 * Renders the PA lifecycle. Maps onto the four required UI states (see build
 * plan §4): idle/loadingContext -> empty; contextError -> error;
 * everything else -> result, with notRequired/undetermined/denied each given
 * visually distinct treatment so a provider never confuses "no action
 * needed" with "we couldn't tell" or with "denied."
 */
export function PriorAuthCard({ state, onRetryContext, onSubmit, onRecheck }: PriorAuthCardProps) {
  switch (state.kind) {
    case 'idle':
      return (
        <div className="card">
          <div className="empty-state">Place an order to check prior authorization requirements.</div>
        </div>
      );

    case 'loadingContext':
      return (
        <div className="card">
          <div className="empty-state">
            <div className="spinner" style={{ margin: '0 auto 16px' }} />
            Checking prior authorization requirements…
          </div>
        </div>
      );

    case 'contextError':
      return (
        <div className="card">
          <h2>Couldn&apos;t load order details</h2>
          <p className="field-row">{state.message}</p>
          <button type="button" className="btn btn-primary" onClick={onRetryContext}>
            Try again
          </button>
        </div>
      );

    case 'notRequired':
      return (
        <div className="card">
          <span className="status-badge status-badge-success">No prior authorization required</span>
          <p className="field-row">
            {state.procedure.description} ({state.procedure.cpt})
          </p>
        </div>
      );

    case 'undetermined':
      return (
        <div className="card">
          <span className="status-badge status-badge-warning">We couldn&apos;t determine this</span>
          <p className="field-row">{formatUndeterminedReason(state.reason)}</p>
          {state.candidates && state.candidates.length > 0 && (
            <ul className="candidate-list">
              {state.candidates.map((candidate) => (
                <li key={candidate.cpt}>
                  {candidate.description} ({candidate.cpt})
                </li>
              ))}
            </ul>
          )}
        </div>
      );

    case 'readyToSubmit':
    case 'submitting':
    case 'submitError':
      return <PriorAuthForm state={state} onSubmit={onSubmit} />;

    case 'pending':
      return (
        <div className="card">
          <span className="status-badge status-badge-muted">Pending</span>
          <p className="field-row">Checking with the payer for {state.procedure.description}…</p>
        </div>
      );

    case 'pendingTimedOut':
      return (
        <div className="card">
          <span className="status-badge status-badge-muted">Still pending</span>
          <p className="field-row">This is taking longer than usual for {state.procedure.description}.</p>
          <button type="button" className="btn" onClick={onRecheck}>
            Check status
          </button>
        </div>
      );

    case 'approved':
      return (
        <div className="card">
          <span className="status-badge status-badge-success">Approved</span>
          <p className="field-row auth-number">{formatAuthNumber(state.authNumber)}</p>
          <p className="field-row">{state.procedure.description}</p>
        </div>
      );

    case 'denied':
      return (
        <div className="card">
          <span className="status-badge status-badge-error">Denied</span>
          <p className="field-row">{state.denialReason}</p>
          <p className="field-row">{state.procedure.description}</p>
        </div>
      );

    default:
      return null;
  }
}

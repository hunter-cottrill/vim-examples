import type { PriorAuthInput, PriorAuthState } from './types';
import { determineAuthRequirement } from './rules';

function currentOrderId(state: PriorAuthState): string | undefined {
  return state.kind === 'idle' ? undefined : state.ehrOrderId;
}

/**
 * Pure PA lifecycle reducer — see build plan §4 for the full state/input
 * union and transition table. Out-of-order inputs are no-ops, never throws.
 */
export function transition(state: PriorAuthState, input: PriorAuthInput): PriorAuthState {
  if (input.type === 'RESET') {
    return { kind: 'idle' };
  }

  if (input.type === 'ORDER_EVENT_RECEIVED') {
    // order_select then order_sign for the same order must not restart an
    // in-flight or completed flow.
    if (currentOrderId(state) === input.ehrOrderId) return state;
    return { kind: 'loadingContext', ehrOrderId: input.ehrOrderId };
  }

  switch (state.kind) {
    case 'loadingContext': {
      if (input.type === 'CONTEXT_LOADED' && input.ehrOrderId === state.ehrOrderId) {
        const determination = determineAuthRequirement(input.order, input.insurance, input.diagnoses);
        if (determination.outcome === 'not-required') {
          return { kind: 'notRequired', ehrOrderId: state.ehrOrderId, procedure: determination.procedure };
        }
        if (determination.outcome === 'undetermined') {
          return {
            kind: 'undetermined',
            ehrOrderId: state.ehrOrderId,
            reason: determination.reason,
            candidates: determination.candidates,
          };
        }
        return {
          kind: 'readyToSubmit',
          ehrOrderId: state.ehrOrderId,
          ehrEncounterId: input.order.ehrEncounterId,
          procedure: determination.procedure,
          payer: determination.payer,
          rule: determination.rule,
          diagnoses: input.diagnoses,
          orderingProviderNpi: input.order.orderingProviderNpi,
        };
      }
      if (input.type === 'CONTEXT_FAILED' && input.ehrOrderId === state.ehrOrderId) {
        return { kind: 'contextError', ehrOrderId: state.ehrOrderId, message: input.message };
      }
      return state;
    }

    case 'contextError': {
      if (input.type === 'RETRY_CONTEXT') {
        return { kind: 'loadingContext', ehrOrderId: state.ehrOrderId };
      }
      return state;
    }

    case 'readyToSubmit': {
      if (input.type === 'SUBMIT_REQUESTED') {
        const { kind, ...context } = state;
        void kind;
        return { kind: 'submitting', ...context };
      }
      return state;
    }

    case 'submitError': {
      if (input.type === 'SUBMIT_REQUESTED') {
        const { kind, message, ...context } = state;
        void kind;
        void message;
        return { kind: 'submitting', ...context };
      }
      return state;
    }

    case 'submitting': {
      if (input.type === 'SUBMIT_SUCCEEDED') {
        return { kind: 'pending', ehrOrderId: state.ehrOrderId, requestId: input.requestId, procedure: state.procedure };
      }
      if (input.type === 'SUBMIT_FAILED') {
        const { kind, ...context } = state;
        void kind;
        return { kind: 'submitError', ...context, message: input.message };
      }
      return state;
    }

    case 'pending': {
      if (input.type === 'POLL_RESULT_APPROVED') {
        return {
          kind: 'approved',
          ehrOrderId: state.ehrOrderId,
          requestId: state.requestId,
          procedure: state.procedure,
          authNumber: input.authNumber,
        };
      }
      if (input.type === 'POLL_RESULT_DENIED') {
        return {
          kind: 'denied',
          ehrOrderId: state.ehrOrderId,
          requestId: state.requestId,
          procedure: state.procedure,
          denialReason: input.denialReason,
        };
      }
      if (input.type === 'POLL_EXHAUSTED') {
        return { kind: 'pendingTimedOut', ehrOrderId: state.ehrOrderId, requestId: state.requestId, procedure: state.procedure };
      }
      return state;
    }

    case 'pendingTimedOut': {
      if (input.type === 'RECHECK_REQUESTED') {
        return { kind: 'pending', ehrOrderId: state.ehrOrderId, requestId: state.requestId, procedure: state.procedure };
      }
      return state;
    }

    default:
      return state;
  }
}

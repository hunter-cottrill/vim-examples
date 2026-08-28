'use client';

import type { PriorAuthState } from '@/lib/priorAuth/types';

type ReadyLikeState = Extract<PriorAuthState, { kind: 'readyToSubmit' | 'submitting' | 'submitError' }>;

interface PriorAuthFormProps {
  state: ReadyLikeState;
  onSubmit: () => void;
}

/** Pre-filled prior-auth request, driven by `state.rule.formFields` — never free text the provider must compose from scratch. */
export function PriorAuthForm({ state, onSubmit }: PriorAuthFormProps) {
  const isSubmitting = state.kind === 'submitting';
  const justification =
    state.diagnoses.map((d) => `${d.description} (${d.code})`).join('; ') || 'No diagnoses on file for this patient.';

  return (
    <div className="card">
      <span className="status-badge status-badge-warning">Prior authorization required</span>
      <h2>{state.procedure.description}</h2>

      <div className="field-row">
        <div className="field-label">Procedure</div>
        {state.procedure.description} ({state.procedure.cpt})
      </div>

      <div className="field-row">
        <div className="field-label">Payer</div>
        {state.payer.displayName}
      </div>

      {state.rule.formFields.includes('clinicalJustification') && (
        <div className="field-row">
          <div className="field-label">Clinical justification</div>
          {justification}
        </div>
      )}

      {state.rule.formFields.includes('requestedUnits') && (
        <div className="field-row">
          <div className="field-label">Requested units</div>1
        </div>
      )}

      {state.rule.formFields.includes('siteOfService') && (
        <div className="field-row">
          <div className="field-label">Site of service</div>
          Outpatient
        </div>
      )}

      {state.rule.formFields.includes('orderingProviderNpi') && (
        <div className="field-row">
          <div className="field-label">Ordering provider NPI</div>
          {state.orderingProviderNpi ?? 'Not available'}
        </div>
      )}

      {state.kind === 'submitError' && (
        <p className="field-row" style={{ color: 'var(--color-error)' }}>
          {state.message}
        </p>
      )}

      <button type="button" className="btn btn-primary" onClick={onSubmit} disabled={isSubmitting}>
        {isSubmitting ? 'Submitting…' : state.kind === 'submitError' ? 'Retry submission' : 'Submit for authorization'}
      </button>
    </div>
  );
}

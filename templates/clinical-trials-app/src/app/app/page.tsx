'use client';

import { Suspense, useEffect, useReducer, useRef } from 'react';
import { useSearchParams } from 'next/navigation';
import { INITIAL_APP_STATE, transition, type AppState } from '@/lib/app-state';
import { fetchPatientContext, initSdk, onChartClosed, onChartOpen } from '@/lib/vim-client';
import { searchTrials } from '@/lib/trials-client';
import { ConnectingView, ErrorView, WaitingView } from '@/components/StateViews';
import { TrialResultsPanel } from '@/components/TrialResultsPanel';

function AppContent() {
  const searchParams = useSearchParams();
  const [state, dispatch] = useReducer(transition, INITIAL_APP_STATE);
  const initRef = useRef(false);
  // Tracks the exact state object a search was already kicked off for (by
  // reference, not patientId) so re-opening the same patient's chart a
  // second time — which produces a brand-new state object via transition —
  // still triggers a fresh search, while React StrictMode's double-invoke
  // of the same effect call does not.
  const handledSearchStateRef = useRef<AppState | null>(null);

  useEffect(() => {
    if (initRef.current) return;
    initRef.current = true;

    (async () => {
      try {
        const code = searchParams.get('code');
        const stateParam = searchParams.get('state');
        if (!code || !stateParam) throw new Error('Missing OAuth parameters');

        const [launchId, csrfToken] = stateParam.split(':');
        const stored = sessionStorage.getItem(`oauth_state_${launchId}`);
        if (!stored || stored !== csrfToken) throw new Error('CSRF validation failed');
        sessionStorage.removeItem(`oauth_state_${launchId}`);

        const res = await fetch('/token', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ code }),
        });
        if (!res.ok) throw new Error(`Token exchange failed: ${await res.text()}`);
        const { access_token } = await res.json();
        if (!access_token) throw new Error('No access_token in response');

        await initSdk(access_token);
        dispatch({ type: 'SDK_READY' });

        onChartOpen((patient, patientId) => {
          dispatch({ type: 'CHART_OPENED', patientId });
          fetchPatientContext(patientId, patient)
            .then((context) => dispatch({ type: 'PATIENT_DATA_FETCHED', patientId, context }))
            .catch(() => dispatch({ type: 'PATIENT_DATA_FETCH_FAILED', patientId }));
        });

        onChartClosed(() => dispatch({ type: 'CHART_CLOSED' }));
      } catch {
        dispatch({ type: 'SDK_INIT_FAILED' });
      }
    })();
  }, [searchParams]);

  useEffect(() => {
    if (state.status !== 'searching_trials') return;
    if (handledSearchStateRef.current === state) return;
    handledSearchStateRef.current = state;

    const { patientId, context, conditionMatches, zipMatch } = state;
    searchTrials(context.problems, conditionMatches, zipMatch)
      .then((result) => dispatch({ type: 'TRIAL_SEARCH_SUCCEEDED', patientId, result }))
      .catch(() => dispatch({ type: 'TRIAL_SEARCH_FAILED', patientId }));
  }, [state]);

  switch (state.status) {
    case 'connecting':
      return <ConnectingView />;
    case 'awaiting_chart':
      return <WaitingView text="Waiting for a chart to open…" />;
    case 'loading_patient_data':
      return <WaitingView text="Loading patient data…" />;
    case 'searching_trials':
      return <WaitingView text="Searching ClinicalTrials.gov…" />;
    case 'error':
      return <ErrorView reason={state.reason} />;
    case 'ready':
      return (
        <main style={{ padding: 16, maxWidth: 480 }}>
          <h1 style={{ fontSize: 18, margin: '0 0 12px' }}>Trial Match</h1>
          <TrialResultsPanel result={state.result} />
        </main>
      );
  }
}

export default function AppPage() {
  return (
    <Suspense fallback={<div style={{ padding: 16 }}>Loading…</div>}>
      <AppContent />
    </Suspense>
  );
}

'use client';

import { Suspense, useEffect, useReducer, useRef } from 'react';
import { useSearchParams } from 'next/navigation';
import { INITIAL_APP_STATE, transition } from '@/lib/app-state';
import { evaluateSdoh } from '@/lib/sdoh/rules';
import { fetchPatientContext, initSdk, onChartOpen, onChartClosed, writeZCodes } from '@/lib/vim-client';
import { SdohPanel } from '@/components/SdohPanel';
import { ConnectingView, ErrorView, WaitingView } from '@/components/StateViews';

function AppContent() {
  const searchParams = useSearchParams();
  const [state, dispatch] = useReducer(transition, INITIAL_APP_STATE);
  const initRef = useRef(false);

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
            .then((context) => {
              dispatch({ type: 'PATIENT_DATA_FETCHED', patientId, evaluation: evaluateSdoh(context) });
            })
            .catch((err) => {
              dispatch({
                type: 'PATIENT_DATA_FETCH_FAILED',
                patientId,
                message: err instanceof Error ? err.message : String(err),
              });
            });
        });
        onChartClosed(() => dispatch({ type: 'CHART_CLOSED' }));
      } catch (err) {
        dispatch({ type: 'SDK_INIT_FAILED', message: err instanceof Error ? err.message : String(err) });
      }
    })();
  }, [searchParams]);

  switch (state.status) {
    case 'connecting':
      return <ConnectingView />;
    case 'awaiting_chart':
      return <WaitingView text="Waiting for a chart to open…" />;
    case 'loading_patient_data':
      return <WaitingView text="Loading patient data…" />;
    case 'error':
      return <ErrorView message={state.message} retryable={state.retryable} />;
    case 'ready':
      return (
        <main style={{ padding: 16, maxWidth: 480 }}>
          <h1 style={{ fontSize: 18, margin: '0 0 12px' }}>SDOH Assistant</h1>
          <SdohPanel evaluation={state.evaluation} onWriteback={writeZCodes} />
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

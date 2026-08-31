'use client';

import { Suspense, useCallback } from 'react';
import { useSearchParams } from 'next/navigation';
import { ConnectingView, ErrorView, WaitingView } from '@/components/StateViews';
import { ReconciliationPanel } from '@/components/ReconciliationPanel';
import { completeLaunch } from '@/lib/launch-auth';
import { useReconciliation } from '@/lib/use-reconciliation';
import { initSdk } from '@/lib/vim-client';

function AppContent() {
  const searchParams = useSearchParams();

  const connect = useCallback(async () => {
    const code = searchParams.get('code');
    const stateParam = searchParams.get('state');
    if (!code || !stateParam) throw new Error('Missing OAuth parameters');
    const { accessToken } = await completeLaunch(code, stateParam);
    await initSdk(accessToken);
  }, [searchParams]);

  const { state, launchPatientId } = useReconciliation(connect);

  switch (state.status) {
    case 'connecting':
      return <ConnectingView />;
    case 'awaiting_chart':
      return <WaitingView text="Open a patient's chart to compare their medication and problem lists." />;
    case 'loading_chart':
      return <WaitingView text="Reading this chart's medication and problem lists…" />;
    case 'error':
      return <ErrorView reason={state.reason} />;
    case 'ready':
      return (
        <ReconciliationPanel
          result={state.result}
          context={state.context}
          openedFromNotification={launchPatientId !== null && launchPatientId === state.patientId}
        />
      );
  }
}

export default function AppPage() {
  return (
    <Suspense fallback={<ConnectingView />}>
      <AppContent />
    </Suspense>
  );
}

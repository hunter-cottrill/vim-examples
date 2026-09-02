'use client';

import { Suspense, useCallback } from 'react';
import { useSearchParams } from 'next/navigation';
import { initSdk } from '@/lib/vim-client';
import { useTransitionSummary } from '@/lib/use-transition-summary';
import { TransitionSummaryCard } from '@/components/TransitionSummaryCard';

function AppContent() {
  const searchParams = useSearchParams();

  const connect = useCallback(async () => {
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams]);

  const pageStatus = useTransitionSummary(connect);
  return <TransitionSummaryCard pageStatus={pageStatus} />;
}

export default function AppPage() {
  return (
    <Suspense fallback={<div style={{ padding: 16 }}>Loading…</div>}>
      <AppContent />
    </Suspense>
  );
}

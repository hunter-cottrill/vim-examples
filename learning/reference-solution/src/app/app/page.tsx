'use client';

import { Suspense, useCallback } from 'react';
import { useSearchParams } from 'next/navigation';
import { connectToVim } from '@/lib/vim-client';
import { useLearning } from '@/lib/use-learning';
import { LearningPanel } from '@/components/LearningPanel';

function AppContent() {
  const searchParams = useSearchParams();

  // The OAuth callback: validate CSRF, exchange the code server-side, start the session.
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

    await connectToVim(access_token);
  }, [searchParams]);

  return <LearningPanel state={useLearning(connect)} />;
}

export default function AppPage() {
  return (
    <Suspense fallback={<main className="page-center"><p className="muted">Loading…</p></main>}>
      <AppContent />
    </Suspense>
  );
}

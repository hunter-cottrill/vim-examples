'use client';

import { Suspense, useEffect, useRef, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { getVimBackendUrl, getAppUrl } from '@/lib/sdk-config';
import { getConfig } from '@/lib/client-config';

/**
 * OAuth launcher. The Vim Connect extension opens this page as
 * /launch?launch_id=... . We mint a CSRF token keyed by the launch id and
 * redirect to Vim's authorize endpoint. Vim redirects back to /app?code=...&state=...
 */
function LaunchPageContent() {
  const searchParams = useSearchParams();
  const [error, setError] = useState<string | null>(null);
  const redirectingRef = useRef(false);

  useEffect(() => {
    if (redirectingRef.current) return;

    const launchId = searchParams.get('launch_id');
    if (!launchId) {
      setError('Missing launch_id. This app must be launched from the Vim Connect extension.');
      return;
    }
    redirectingRef.current = true;

    const csrfToken = crypto.randomUUID();
    sessionStorage.setItem(`oauth_state_${launchId}`, csrfToken);
    const stateParam = `${launchId}:${csrfToken}`;

    const authorizeUrl = new URL('/app-auth/authorize', getVimBackendUrl());
    authorizeUrl.searchParams.set('response_type', 'code');
    authorizeUrl.searchParams.set('client_id', getConfig().clientId);
    authorizeUrl.searchParams.set('launch', launchId);
    authorizeUrl.searchParams.set('scope', 'launch openid');
    authorizeUrl.searchParams.set('redirect_uri', `${getAppUrl()}/app`);
    authorizeUrl.searchParams.set('state', stateParam);

    window.location.href = authorizeUrl.toString();
  }, [searchParams]);

  if (error) {
    return (
      <main style={{ padding: 24, fontFamily: 'system-ui, sans-serif' }}>
        <h1 style={{ fontSize: 18 }}>Launch Error</h1>
        <p style={{ color: '#b00020' }}>{error}</p>
      </main>
    );
  }
  return <main style={{ padding: 24, fontFamily: 'system-ui, sans-serif' }}>Redirecting to Vim Connect…</main>;
}

export default function LaunchPage() {
  return (
    <Suspense fallback={<main style={{ padding: 24 }}>Loading…</main>}>
      <LaunchPageContent />
    </Suspense>
  );
}

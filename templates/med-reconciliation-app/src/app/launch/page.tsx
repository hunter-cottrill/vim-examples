'use client';

import { Suspense, useEffect, useRef, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { beginLaunch } from '@/lib/launch-auth';

/**
 * OAuth launcher for the UI surface. The Vim Connect extension opens this page
 * as /launch?launch_id=... ; Vim redirects back to /app?code=...&state=...
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
    beginLaunch(launchId, '/app');
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

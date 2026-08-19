'use client';

import { Suspense, useEffect, useRef, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { initSdk, onPatient, onReferralStart, writeZCodes, type WritebackOutcome } from '@/lib/vim-client';
import { evaluateSdoh, type SdohInsight, type PatientLike, type ReferralLike } from '@/lib/sdoh-rules';
import { SdohPanel } from '@/components/SdohPanel';

function AppContent() {
  const searchParams = useSearchParams();
  const [ready, setReady] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [insights, setInsights] = useState<SdohInsight[]>([]);
  const patientRef = useRef<PatientLike | null>(null);
  const referralRef = useRef<ReferralLike | null>(null);
  const initRef = useRef(false);

  function recompute() {
    if (!patientRef.current) return;
    setInsights(evaluateSdoh(patientRef.current, referralRef.current ?? undefined));
  }

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
        setReady(true);

        onPatient((p) => { patientRef.current = p; recompute(); });
        onReferralStart((r) => { referralRef.current = r; recompute(); });
      } catch (err) {
        setError(err instanceof Error ? err.message : String(err));
      }
    })();
  }, [searchParams]);

  async function handleWriteback(codes: Array<{ code: string; description: string }>): Promise<WritebackOutcome> {
    return writeZCodes(codes);
  }

  if (error) return <div style={{ color: '#b00020', padding: 16 }}>Error: {error}</div>;
  if (!ready) return <div style={{ padding: 16 }}>Connecting to Vim…</div>;

  return (
    <main style={{ padding: 16, maxWidth: 480 }}>
      <h1 style={{ fontSize: 18, margin: '0 0 12px' }}>SDOH Assistant</h1>
      <SdohPanel insights={insights} onWriteback={handleWriteback} />
    </main>
  );
}

export default function AppPage() {
  return (
    <Suspense fallback={<div style={{ padding: 16 }}>Loading…</div>}>
      <AppContent />
    </Suspense>
  );
}

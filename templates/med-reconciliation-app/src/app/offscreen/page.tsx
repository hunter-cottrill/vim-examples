'use client';

/**
 * The headless Worker surface. Registered in the Vim developer portal as this
 * app's Worker URL; never shown to a provider, so the markup below exists only
 * so a developer opening the page directly can see what happened.
 *
 * It runs the same launch_id -> authorize -> code -> /token sequence as the UI
 * surface, from the same src/lib/launch-auth.ts, differing only in redirect_uri.
 */
import { Suspense, useEffect, useRef, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { beginLaunch, completeLaunch } from '@/lib/launch-auth';
import { startWorker, type RunningWorker } from '@/lib/worker-client';

type WorkerStatus = 'starting' | 'observing' | 'error';

const STATUS_TEXT: Record<WorkerStatus, string> = {
  starting: 'Starting the medication reconciliation worker…',
  observing: 'Observing chart context. Notifications fire only when the panel is closed and there are findings.',
  error: 'The worker could not start. It must be launched by the Vim Connect extension.',
};

function OffscreenContent() {
  const searchParams = useSearchParams();
  const [status, setStatus] = useState<WorkerStatus>('starting');
  const startedRef = useRef(false);
  const workerRef = useRef<RunningWorker | null>(null);

  useEffect(() => {
    if (startedRef.current) return;
    startedRef.current = true;

    const launchId = searchParams.get('launch_id');
    if (launchId) {
      beginLaunch(launchId, '/offscreen');
      return;
    }

    const code = searchParams.get('code');
    const stateParam = searchParams.get('state');
    if (!code || !stateParam) {
      setStatus('error');
      return;
    }

    void completeLaunch(code, stateParam)
      .then(startWorker)
      .then((worker) => {
        workerRef.current = worker;
        setStatus('observing');
      })
      .catch(() => setStatus('error'));

    return () => {
      workerRef.current?.stop();
      workerRef.current = null;
    };
  }, [searchParams]);

  return (
    <main style={{ padding: 16, fontFamily: 'system-ui, sans-serif', fontSize: 13, color: '#666' }}>
      {STATUS_TEXT[status]}
    </main>
  );
}

export default function OffscreenPage() {
  return (
    <Suspense fallback={<main style={{ padding: 16 }} />}>
      <OffscreenContent />
    </Suspense>
  );
}

'use client';
/**
 * The Worker's entry point. Vim Connect opens this page in a hidden offscreen
 * document — the provider never sees it — once the Worker Launch Endpoint is
 * registered in Vim Console. It runs the same OAuth handshake as the UI app,
 * then starts the Worker built in Module 9.
 */
import { Suspense, useEffect, useRef, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { beginLaunch, completeLaunch } from '@/lib/launch-auth';
import { isNotBuilt } from '@/lib/learning-types';
import { startWorker } from '@/lib/worker-client';

type WorkerStatus = 'starting' | 'observing' | 'not_built' | 'error';

const STATUS_TEXT: Record<WorkerStatus, string> = {
  starting: 'Starting the Worker…',
  observing: 'Worker running. It notifies when a chart opens while the panel is closed.',
  not_built: 'Not built yet — this is Module 9. Open src/lib/worker-client.ts.',
  error: 'The Worker could not start. It must be launched by the Vim Connect extension.',
};

function OffscreenContent() {
  const searchParams = useSearchParams();
  const [status, setStatus] = useState<WorkerStatus>('starting');
  const started = useRef(false);

  useEffect(() => {
    if (started.current) return;
    started.current = true;

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
    // If cleanup runs before the Worker has started, unregister it once it's
    // ready, so a remount can never leave two Workers running.
    let stop: (() => void) | undefined;
    let cancelled = false;
    void completeLaunch(code, stateParam)
      .then(startWorker)
      .then((unregister) => {
        if (cancelled) { unregister(); return; }
        stop = unregister;
        setStatus('observing');
      })
      .catch((err) => setStatus(isNotBuilt(err) ? 'not_built' : 'error'));
    return () => { cancelled = true; stop?.(); };
  }, [searchParams]);

  return <main className="page-center"><p className="muted">{STATUS_TEXT[status]}</p></main>;
}

export default function OffscreenPage() {
  return (
    <Suspense fallback={null}>
      <OffscreenContent />
    </Suspense>
  );
}

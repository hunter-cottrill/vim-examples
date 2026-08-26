'use client';

import { Suspense, useEffect, useRef, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import type { Patient } from '@vimconnect/app-sdk';
import { getVimBackendUrl, getAppUrl } from '@/lib/sdk-config';
import { getConfig } from '@/lib/client-config';
import {
  initWorker,
  registerChartOpen,
  fetchPatientContextViaWorker,
  firePushNotification,
  isUiAppOpen,
  type WorkerWorkflowHandle,
} from '@/lib/worker-client';
import { evaluateSdoh } from '@/lib/sdoh/rules';

function csrfKey(launchId: string) {
  return `vim_worker_csrf_${launchId}`;
}

type Status = 'connecting' | 'connected' | 'error';

/**
 * The Worker's whole job: read -> reason -> (maybe) notify. Reuses
 * evaluateSdoh unchanged — the exact same pure decision the UI panel
 * renders from — and stays silent whenever the panel would render nothing
 * new: no insights, or the panel is already open.
 */
async function evaluateAndNotify(patientId: string, patient: Patient, handle: WorkerWorkflowHandle) {
  const context = await fetchPatientContextViaWorker(patientId, patient, handle);
  if (!context) {
    handle.close();
    return;
  }

  const evaluation = evaluateSdoh(context);
  if (evaluation.insights.length === 0) {
    handle.close(); // no signal — matches the panel's own silent case
    return;
  }

  if (isUiAppOpen()) {
    handle.close(); // provider is already looking at the panel — don't duplicate it
    return;
  }

  const needs = evaluation.insights.map((i) => i.need.replace(/_/g, ' ')).join(', ');
  const plural = evaluation.insights.length > 1 ? 's' : '';
  await firePushNotification(handle, {
    notificationId: `sdoh-${patientId}`,
    title: 'Social needs flagged',
    text: `Possible ${needs} barrier${plural} for this patient.`,
    type: 'info',
    launchPayload: { patientId },
  });
  // handle auto-closes after pushNotification.show() — HookDeclaration's
  // autoCloseAfterAction defaults to true; no manual close needed here.
}

function WorkerFlow() {
  const searchParams = useSearchParams();
  const initialized = useRef(false);
  const [status, setStatus] = useState<Status>('connecting');

  useEffect(() => {
    if (initialized.current) return;
    initialized.current = true;

    let unsubscribe: (() => void) | undefined;

    async function connect(accessToken?: string) {
      try {
        await initWorker(accessToken);
        setStatus('connected');
        unsubscribe = registerChartOpen((patient, patientId, handle) => {
          void evaluateAndNotify(patientId, patient, handle);
        });
      } catch (error) {
        console.error('[sdoh worker] failed to initialize', error);
        setStatus('error');
      }
    }

    async function handleCallback(code: string, state: string) {
      const [launchId, csrfToken] = state.split(':');
      const stored = launchId ? sessionStorage.getItem(csrfKey(launchId)) : null;
      if (!launchId || !csrfToken || stored !== csrfToken) {
        console.error('[sdoh worker] CSRF validation failed');
        setStatus('error');
        return;
      }
      sessionStorage.removeItem(csrfKey(launchId));

      const res = await fetch('/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code }),
      });
      if (!res.ok) {
        console.error('[sdoh worker] token exchange failed');
        setStatus('error');
        return;
      }
      const { access_token } = await res.json();
      await connect(access_token);
    }

    function handleLaunch(launchId: string) {
      const csrfToken = crypto.randomUUID();
      sessionStorage.setItem(csrfKey(launchId), csrfToken);

      const authorizeUrl = new URL('/app-auth/authorize', getVimBackendUrl());
      authorizeUrl.searchParams.set('response_type', 'code');
      authorizeUrl.searchParams.set('client_id', getConfig().clientId);
      authorizeUrl.searchParams.set('launch', launchId);
      authorizeUrl.searchParams.set('scope', 'launch openid');
      authorizeUrl.searchParams.set('redirect_uri', `${getAppUrl()}/offscreen`);
      authorizeUrl.searchParams.set('state', `${launchId}:${csrfToken}`);

      window.location.assign(authorizeUrl.toString());
    }

    const code = searchParams.get('code');
    const state = searchParams.get('state');
    const launchId = searchParams.get('launch_id');

    if (code && state) {
      handleCallback(code, state).catch((error) => {
        console.error('[sdoh worker] unexpected error during token exchange', error);
        setStatus('error');
      });
    } else if (launchId) {
      handleLaunch(launchId);
    } else {
      // No launch context on the URL — fall back to the SDK's own
      // token_endpoint auto-fetch, in case this document reloads outside a
      // fresh Worker launch.
      connect();
    }

    return () => unsubscribe?.();
  }, [searchParams]);

  return <p style={{ padding: 24 }}>SDOH Worker status: {status}</p>;
}

export default function WorkerPage() {
  return (
    <Suspense fallback={<p style={{ padding: 24 }}>Loading…</p>}>
      <WorkerFlow />
    </Suspense>
  );
}
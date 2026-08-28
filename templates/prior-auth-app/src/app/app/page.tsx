'use client';

import { Suspense, useEffect, useRef, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { initVimSDK, type VimSDK } from '@vimconnect/app-sdk';
import { ErrorScreen } from '@/components/ErrorScreen';
import { PriorAuthCard } from '@/components/PriorAuthCard';
import { SimulatorControls } from '@/components/SimulatorControls';
import { getEnvironment } from '@/lib/sdk-config';
import { usePriorAuthLifecycle } from '@/hooks/usePriorAuthLifecycle';

const SIM_MODE = process.env.NEXT_PUBLIC_SIM_MODE === 'true';

type ErrorDetail = {
  message: string;
  code: string | undefined;
  timestamp: string;
  userAgent: string;
};

/**
 * Main App Page Content — OAuth callback + prior-authorization UI. The PA
 * lifecycle itself (event subscriptions, context loading, submit, polling)
 * lives in usePriorAuthLifecycle, shared with the dev harness — see build
 * plan §5 step 6/step 8.
 */
function AppPageContent() {
  const searchParams = useSearchParams();
  const [status, setStatus] = useState<'loading' | 'connected' | 'error'>('loading');
  const [error, setError] = useState<ErrorDetail | null>(null);
  const [vimSDK, setVimSDK] = useState<VimSDK | null>(null);

  const initializingRef = useRef(false);
  const initializedRef = useRef(false);

  const { paState, dispatch, handleRetryContext, handleSubmit, handleRecheck } = usePriorAuthLifecycle(vimSDK);

  useEffect(() => {
    if (initializedRef.current || initializingRef.current) return;
    initializingRef.current = true;
    initializeApp();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  async function initializeApp() {
    try {
      const code = searchParams.get('code');
      const stateParam = searchParams.get('state');

      if (!code || !stateParam) {
        throw new Error('Missing OAuth parameters');
      }

      const [launchId, csrfToken] = stateParam.split(':');
      if (!launchId || !csrfToken) {
        throw new Error('Invalid state parameter format');
      }
      const flowKey = `oauth_state_${launchId}`;
      const storedToken = sessionStorage.getItem(flowKey);
      if (csrfToken !== storedToken) {
        throw new Error('CSRF validation failed');
      }
      sessionStorage.removeItem(flowKey);

      initializedRef.current = true;

      const sdk = await initVimSDK({
        debug: true,
        ...(getEnvironment() === 'staging' ? { __overrideEnv: 'staging' } : {}),
      } as Parameters<typeof initVimSDK>[0] & { __overrideEnv?: 'staging' });

      sdk.hub.setActivationStatus('ENABLED');
      setVimSDK(sdk);
      setStatus('connected');

      // A tapped Worker notification resumes here with the order it fired for
      // (see src/app/offscreen/app/page.tsx). Jump straight to loadingContext
      // for that order rather than waiting for a fresh event.
      const launchContext = sdk.consumeLaunchContext();
      const launchedOrderId = launchContext?.launchPayload?.ehrOrderId;
      if (typeof launchedOrderId === 'string') {
        dispatch({ type: 'ORDER_EVENT_RECEIVED', ehrOrderId: launchedOrderId });
      }

      if (getEnvironment() !== 'production') {
        (window as unknown as { __vimSdk?: VimSDK }).__vimSdk = sdk;
      }
    } catch (err: any) {
      console.error('Initialization error:', err);
      setError({
        message: err.message ?? 'Unknown error',
        code: err.code,
        timestamp: new Date().toISOString(),
        userAgent: navigator.userAgent,
      });
      setStatus('error');
      initializedRef.current = false;
    } finally {
      initializingRef.current = false;
    }
  }

  if (status === 'loading') {
    return (
      <div className="loading-container">
        <div className="loading-content">
          <div className="spinner" style={{ margin: '0 auto 16px' }} />
          <p style={{ color: 'var(--color-text-muted)' }}>Connecting to Vim...</p>
        </div>
      </div>
    );
  }

  if (status === 'error') {
    return (
      <ErrorScreen
        heading="Connection Error"
        message="Something went wrong. Press retry to reload the application."
        diagnostics={[
          { label: 'Error:', value: error?.message ?? 'Unknown error' },
          { label: 'Code:', value: error?.code ?? 'N/A' },
          { label: 'Time:', value: error?.timestamp ?? 'N/A' },
          { label: 'Browser:', value: error?.userAgent ?? 'N/A' },
        ]}
        retry={{ label: 'Retry', onClick: () => window.location.reload() }}
      />
    );
  }

  return (
    <div className="page">
      <div className="page-header">
        <h1>Prior Authorization</h1>
        <div className="page-subtitle">Checked automatically when an order is placed.</div>
      </div>
      <div className="page-content">
        {SIM_MODE && <SimulatorControls dispatch={dispatch} />}
        <PriorAuthCard state={paState} onRetryContext={handleRetryContext} onSubmit={handleSubmit} onRecheck={handleRecheck} />
      </div>
    </div>
  );
}

export default function AppPage() {
  return (
    <Suspense
      fallback={
        <div className="loading-container">
          <div className="loading-content">
            <div className="spinner" style={{ margin: '0 auto 16px' }} />
            <p style={{ color: 'var(--color-text-muted)' }}>Loading...</p>
          </div>
        </div>
      }
    >
      <AppPageContent />
    </Suspense>
  );
}

'use client';

import { Suspense, useEffect, useRef } from 'react';
import { useSearchParams } from 'next/navigation';
import { initWorkerVimSDK } from '@vimconnect/app-sdk';
import type { WorkerSDK } from '@vimconnect/app-sdk';
import { getEnvironment } from '@/lib/sdk-config';
import { subscribeWorkerOrderEvents } from '@/lib/vim/workerClient';
import { determineAuthRequirement } from '@/lib/priorAuth/rules';

/**
 * Offscreen Worker App — headless background SDK worker.
 *
 * Loaded inside a hidden iframe. Notifies the provider once, at the moment an
 * order is placed and prior authorization is required, when the UI panel is
 * closed (isAppOpen check below) — the panel-open case is already covered by
 * the live UI card, and async resolution while the panel stays closed is a
 * disclosed v1 limitation (see build plan §9), not built on an unverified
 * Worker timer. Reuses the exact same determineAuthRequirement the UI path
 * uses — never forked.
 *
 * Auth flow mirrors the UI app's; the OAuth code is exchanged manually here
 * (preserved from the scaffold, which already proved this works for the
 * Worker entry point specifically).
 */
function OffscreenWorkerContent() {
  const searchParams = useSearchParams();
  const initializedRef = useRef(false);
  const notifiedOrderIds = useRef(new Set<string>());

  useEffect(() => {
    if (initializedRef.current) return;
    initializedRef.current = true;
    initWorker();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  async function initWorker() {
    try {
      const code = searchParams.get('code');
      const stateParam = searchParams.get('state');

      if (!code || !stateParam) {
        console.error('[worker] Missing OAuth parameters');
        return;
      }

      const stateParts = stateParam.split(':');
      if (stateParts.length !== 2) {
        console.error('[worker] Malformed state parameter');
        return;
      }
      const [launchId, csrfToken] = stateParts;
      const flowKey = `oauth_state_${launchId}`;
      const storedCsrf = sessionStorage.getItem(flowKey);
      if (storedCsrf !== csrfToken) {
        console.error('[worker] CSRF state mismatch');
        return;
      }
      sessionStorage.removeItem(flowKey);

      const tokenRes = await fetch('/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code }),
      });

      if (!tokenRes.ok) {
        console.error('[worker] Token exchange failed');
        return;
      }

      const { access_token: accessToken } = await tokenRes.json().catch(() => ({}));
      if (!accessToken) {
        console.error('[worker] No access_token in response');
        return;
      }

      const sdk: WorkerSDK = await initWorkerVimSDK({
        accessToken,
        ...(getEnvironment() === 'staging' ? { __overrideEnv: 'staging' } : {}),
      } as Parameters<typeof initWorkerVimSDK>[0] & { __overrideEnv?: 'staging' });
      console.log('[worker] Worker SDK ready');

      subscribeWorkerOrderEvents(sdk, async (context, eventType, handle) => {
        // The UI app already shows the live card when it's open — never
        // duplicate what the provider is already looking at.
        if (sdk.hub.appState.isAppOpen) {
          handle.close();
          return;
        }

        if (!context.ok) {
          console.log(`[worker] ${eventType}: ${context.message}`);
          handle.close();
          return;
        }

        const determination = determineAuthRequirement(context.order, context.insurance, context.diagnoses);
        if (determination.outcome !== 'required') {
          handle.close();
          return;
        }

        const ehrOrderId = context.order.ehrOrderId;
        if (notifiedOrderIds.current.has(ehrOrderId)) {
          handle.close();
          return;
        }

        // Re-check right before the action — handles carry a 10s TTL and the
        // context fetch above just awaited. `handle.hub` is only populated
        // when 'notify' is declared in HookDeclaration.operations (it is,
        // below), but the type still marks it optional.
        if (!handle.api.isValid() || !handle.hub || !handle.hub.isValid()) {
          console.log('[worker] handle invalidated before notification could be sent');
          return;
        }

        notifiedOrderIds.current.add(ehrOrderId);
        const triggerResult = await handle.hub.pushNotification.show({
          notificationId: `prior-auth-${ehrOrderId}`,
          title: 'Prior authorization may be required',
          text: `${determination.procedure.description} may need prior authorization from ${determination.payer.displayName}.`,
          type: 'info',
          timeoutInSec: 30,
          launchPayload: { ehrOrderId },
        });
        console.log(`[worker] pushNotification.show -> ${triggerResult.status}`);
      });

      console.log('[worker] Worker SDK fully initialized');
    } catch (err) {
      console.error('[worker] Init error:', err);
    }
  }

  return null;
}

export default function OffscreenWorkerPage() {
  return (
    <Suspense fallback={null}>
      <OffscreenWorkerContent />
    </Suspense>
  );
}

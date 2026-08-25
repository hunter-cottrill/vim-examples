'use client';

import { Suspense, useEffect, useRef } from 'react';
import { useSearchParams } from 'next/navigation';
import { initWorkerVimSDK } from '@vimconnect/app-sdk';
import type { WorkerSDK } from '@vimconnect/app-sdk';
import { getEnvironment } from '@/lib/sdk-config';
import { getPatientInsurancesFromHandle, subscribeWorkerEncounterSelfPay, subscribeWorkerOrderEvents } from '@/lib/vim';
import { calculateEstimate, evaluateGfeEligibility, formatCents, matchOrderToCpt } from '@/lib/pricing';

/**
 * Offscreen Worker App — headless background SDK worker.
 *
 * Loaded inside a hidden iframe managed by OffscreenAppManager. Mirrors the
 * UI app's price-transparency flow (order event → crosswalk → estimate →
 * GFE eligibility, all via the shared pure logic in src/lib/pricing) but
 * fires a push notification instead of rendering a card — this is what
 * shows the patient's estimated cost when the sidepanel is closed. Skips
 * entirely when the UI app is open, since PriceTransparencyView already
 * shows the live estimate there (no duplicate notification).
 *
 * Auth flow mirrors the UI app's, but the OAuth code is exchanged for a
 * token manually here rather than left to initVimSDK's implicit handling —
 * preserved as-is from the original scaffold, which already proved this
 * works for the Worker entry point specifically.
 */
function OffscreenWorkerContent() {
  const searchParams = useSearchParams();
  const initializedRef = useRef(false);

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

      // CSRF validation
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

      // Exchange code for access token
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

      // Initialise Worker SDK. Same runtime override as the UI page: only when
      // THIS app is itself running in staging do we point the SDK at the
      // staging core-sdk. `__overrideEnv` is runtime-only (not in the public
      // type) → cast.
      const sdk: WorkerSDK = await initWorkerVimSDK({
        accessToken,
        ...(getEnvironment() === 'staging' ? { __overrideEnv: 'staging' } : {}),
      } as Parameters<typeof initWorkerVimSDK>[0] & { __overrideEnv?: 'staging' });
      console.log('[worker] Worker SDK ready');

      // Self-pay flag by encounter — populated by the continuous context
      // registration below, read by the order handler to resolve GFE
      // eligibility exactly like the UI's PriceTransparencyView does.
      const selfPayByEncounter = new Map<string, boolean | undefined>();

      subscribeWorkerEncounterSelfPay(
        sdk,
        (encounter) => {
          if (encounter?.ehrEncounterId) {
            selfPayByEncounter.set(encounter.ehrEncounterId, encounter.selfPay);
          }
        },
        (message) => console.log('[worker]', message),
      );

      subscribeWorkerOrderEvents(
        sdk,
        async (order, eventType, handle) => {
          // The UI app already shows a live estimate when it's open — avoid a
          // duplicate notification. "currently callers use isAppOpen() guard"
          // is the SDK's own documented pattern for this (see TriggerResult).
          if (sdk.hub.appState.isAppOpen) {
            handle.close();
            return;
          }

          const searchText = [order.orderName, order.reason].filter(Boolean).join(' ');
          const match = matchOrderToCpt(searchText);
          if (match.confidence !== 'high') {
            // No confident CPT — no picker UI exists headlessly, so there's
            // nothing reliable to notify about. Never guess.
            console.log(`[worker] ${eventType}: no confident CPT match for "${searchText}" — skipping notification`);
            handle.close();
            return;
          }

          const insurances = await getPatientInsurancesFromHandle(handle);
          const primary = insurances.find((i) => i.isPrimary) ?? insurances[0];

          const encounterSelfPay = order.ehrEncounterId ? selfPayByEncounter.get(order.ehrEncounterId) : undefined;
          const selfPayResolved: boolean | 'unknown' = encounterSelfPay === undefined ? 'unknown' : encounterSelfPay;

          const result = calculateEstimate({
            cpt: match.match.cpt,
            payerId: primary?.payerId,
            groupId: primary?.groupId,
            selfPay: selfPayResolved === true,
          });
          const gfe = evaluateGfeEligibility({
            selfPay: selfPayResolved,
            contractedRateFound: result.source === 'contracted-rate',
          });

          // Re-check right before the action — handles carry a 10s TTL and
          // the insurance fetch above just awaited.
          if (!handle.hub || !handle.hub.isValid()) {
            console.log('[worker] handle invalidated before notification could be sent');
            return;
          }

          const gfeSuffix =
            gfe === 'required'
              ? ' • Good Faith Estimate required'
              : gfe === 'recommended'
                ? ' • GFE recommended'
                : '';

          const triggerResult = await handle.hub.pushNotification.show({
            notificationId: `price-estimate-${order.ehrOrderId ?? eventType}`,
            title: 'Cost estimate ready',
            text: `<b>${formatCents(result.patientResponsibilityCents)}</b> estimated patient cost — ${match.match.description}${gfeSuffix}`,
            type: gfe === 'required' ? 'warning' : 'info',
            timeoutInSec: 20,
            launchPayload: { ehrOrderId: order.ehrOrderId, cpt: match.match.cpt },
          });
          console.log(`[worker] pushNotification.show → ${triggerResult.status}`);
        },
        (message) => console.log('[worker]', message),
      );

      console.log('[worker] Worker SDK fully initialized');
    } catch (err) {
      console.error('[worker] Init error:', err);
    }
  }

  // No visible UI — runs silently in a hidden background iframe
  return null;
}

export default function OffscreenWorkerPage() {
  return (
    <Suspense fallback={null}>
      <OffscreenWorkerContent />
    </Suspense>
  );
}

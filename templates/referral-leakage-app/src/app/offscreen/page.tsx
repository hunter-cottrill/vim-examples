'use client';

import { Suspense, useEffect, useRef, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { getVimBackendUrl, getAppUrl } from '@/lib/sdk-config';
import { getConfig } from '@/lib/client-config';
import {
  initWorker,
  registerPatient,
  registerReferralStart,
  firePushNotification,
  type WorkerContextHandle,
} from '@/lib/worker-client';
import { evaluateReferral, type NudgeSuggestion, type PatientLike, type ReferralLike } from '@/lib/referral-engine';
import { networkIdForPayer } from '@/lib/payer-network-map';
import type { ProviderRecord } from '@/lib/network-directory';

// DEV-ONLY. NEXT_PUBLIC_SIM_MODE is inlined as a build-time literal by Next.js.
// When unset, window.__referralWorkerDebug is never assigned, so the raw
// import('@/dev/fixtures') inside fireFixture below never executes and is never
// fetched — same verified-safe pattern used for the UI's simulator (see
// src/app/app/page.tsx's comment on why next/dynamic can't be used here).
const SIM_MODE = process.env.NEXT_PUBLIC_SIM_MODE === 'true';

function csrfKey(launchId: string) {
  return `vim_worker_csrf_${launchId}`;
}

type Status = 'connecting' | 'connected' | 'error';

function buildNotificationCopy(suggestion: NudgeSuggestion): { title: string; text: string } {
  if (suggestion.kind === 'econsult_candidate') {
    return { title: 'E-consult candidate', text: suggestion.reason };
  }
  return { title: 'In-network alternative available', text: suggestion.reason };
}

async function fetchNetworkMatches(
  specialty: string,
  patient: PatientLike,
  excludeNpi: string | undefined,
): Promise<ProviderRecord[]> {
  const insurance = patient.insurances?.find((i) => i.isPrimary) ?? patient.insurances?.[0];
  const insuranceNetworkId = networkIdForPayer(insurance?.payerName);
  try {
    const res = await fetch('/api/network/match', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ specialty, insuranceNetworkId, excludeNpi }),
    });
    if (!res.ok) return [];
    const data = await res.json();
    return Array.isArray(data.matches) ? data.matches : [];
  } catch {
    return [];
  }
}

/**
 * The Worker's whole job: read → reason → (maybe) notify. Reuses evaluateReferral
 * unchanged — the exact same pure decision the UI panel renders from. Also the
 * SIM_MODE debug path's "notify wrapper," reused as-is so a fixture-driven test
 * exercises the identical code the real referral_start trigger runs.
 */
async function evaluateAndNotify(referral: ReferralLike, patient: PatientLike, handle: WorkerContextHandle) {
  const specialty = referral.targetProvider?.specialty ?? referral.basicInformation?.specialty;
  const matches = specialty ? await fetchNetworkMatches(specialty, patient, referral.targetProvider?.npi) : [];

  // TTL check AFTER the await — a handle that expired or was superseded while
  // the network lookup was in flight must not be used (mirrors cds-app's
  // re-check of handle.hub?.isValid() after its own async engine call).
  if (!handle.hub?.isValid()) {
    console.log('[referral-guidance worker] handle no longer valid after network lookup — dropping');
    handle.close();
    return;
  }

  const suggestions = evaluateReferral(referral, patient, matches);
  if (suggestions.length === 0) {
    console.log('[referral-guidance worker] no signal for this referral — staying silent');
    handle.close(); // silent — matches the panel's silent cases exactly.
    return;
  }

  // evaluateReferral orders econsult_candidate first when both fire (its own
  // priority rule) — surfacing suggestions[0] mirrors that automatically.
  const primary = suggestions[0];
  const { title, text } = buildNotificationCopy(primary);
  const notificationId = referral.identifiers?.ehrReferralId
    ? `referral-guidance-${referral.identifiers.ehrReferralId}`
    : `referral-guidance-${Date.now()}`;

  const fired = firePushNotification(handle, {
    notificationId,
    title,
    text,
    type: 'info',
    launchPayload: {
      source: 'referral-guidance-worker',
      suggestionKind: primary.kind,
      ehrReferralId: referral.identifiers?.ehrReferralId,
    },
  });
  console.log('[referral-guidance worker] notification', fired ? 'fired' : 'skipped (handle invalid)', {
    title,
    text,
  });
  // Handle auto-closes after pushNotification.show() (HookDeclaration's
  // autoCloseAfterAction defaults to true) — no manual close needed here.
}

function WorkerFlow() {
  const searchParams = useSearchParams();
  const initialized = useRef(false);
  const [status, setStatus] = useState<Status>('connecting');
  const lastPatientRef = useRef<PatientLike | null>(null);
  // DEV-ONLY (SIM_MODE only): the most recent real, notify-capable handle from a
  // chart_open:patient firing. Stashed so the debug console function below can
  // drive evaluateAndNotify — and, if it decides to notify, fire a REAL push
  // notification — through a REAL handle, without faking any SDK/extension
  // protocol. In production this handle is closed immediately instead (below).
  const debugHandleRef = useRef<WorkerContextHandle | null>(null);

  useEffect(() => {
    if (initialized.current) return;
    initialized.current = true;

    let unsubscribePatient: (() => void) | undefined;
    let unsubscribeReferral: (() => void) | undefined;

    async function connect(accessToken?: string) {
      try {
        await initWorker(accessToken);
        setStatus('connected');

        unsubscribePatient = registerPatient((patient, handle) => {
          lastPatientRef.current = patient;
          if (SIM_MODE) {
            debugHandleRef.current = handle; // kept open intentionally — see comment above.
          } else {
            handle.close();
          }
        });

        unsubscribeReferral = registerReferralStart((referral, handle) => {
          if (!referral) {
            handle.close();
            return;
          }
          void evaluateAndNotify(referral, lastPatientRef.current ?? {}, handle);
        });
      } catch (error) {
        console.error('[referral-guidance worker] failed to initialize', error);
        setStatus('error');
      }
    }

    async function handleCallback(code: string, state: string) {
      const [launchId, csrfToken] = state.split(':');
      const stored = launchId ? sessionStorage.getItem(csrfKey(launchId)) : null;
      if (!launchId || !csrfToken || stored !== csrfToken) {
        console.error('[referral-guidance worker] CSRF validation failed');
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
        console.error('[referral-guidance worker] token exchange failed');
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
        console.error('[referral-guidance worker] unexpected error during token exchange', error);
        setStatus('error');
      });
    } else if (launchId) {
      handleLaunch(launchId);
    } else {
      // No launch context on the URL — fall back to the SDK's own
      // token_endpoint auto-fetch, in case this document reloads outside a
      // fresh Worker launch (mirrors cds-app's same fallback).
      connect();
    }

    return () => {
      unsubscribePatient?.();
      unsubscribeReferral?.();
    };
  }, [searchParams]);

  useEffect(() => {
    if (!SIM_MODE) return; // dead branch when the flag is unset — nothing below ever runs or loads.

    (window as unknown as { __referralWorkerDebug?: unknown }).__referralWorkerDebug = {
      async fireFixture(fixtureId: string) {
        const { getFixture } = await import('@/dev/fixtures');
        const fixture = getFixture(fixtureId);
        if (!fixture) {
          console.warn('[referral-guidance worker debug] unknown fixture id:', fixtureId);
          return;
        }

        const handle = debugHandleRef.current;
        if (!handle || !handle.hub?.isValid()) {
          console.warn(
            '[referral-guidance worker debug] no live handle available — open a patient chart in the ' +
              'sandbox first (fires chart_open:patient), then retry immediately. Each test consumes the ' +
              "handle, same as a real one-shot event — reopen the chart before each test.",
          );
          return;
        }

        console.log('[referral-guidance worker debug] firing fixture:', fixture.label);
        await evaluateAndNotify(fixture.referral, fixture.patient, handle);
      },
    };
  }, []);

  return <p style={{ padding: 24 }}>Referral Guidance Worker status: {status}</p>;
}

export default function WorkerPage() {
  return (
    <Suspense fallback={<p style={{ padding: 24 }}>Loading…</p>}>
      <WorkerFlow />
    </Suspense>
  );
}
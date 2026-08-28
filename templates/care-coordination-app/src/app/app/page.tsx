'use client';

import { Suspense, useEffect, useRef, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import type { VimSDK } from '@vimconnect/app-sdk';
import {
  initSdk,
  mapEncounterFields,
  mapReferralFields,
  onChartOpen,
  onChartOpenPatientContext,
  onEncounterContext,
  onEncounterOpenPatientContext,
  onOrderSelect,
  onReferralContext,
  fetchOrderSnapshot,
  fetchPatientSnapshot,
  fetchProblems,
} from '@/lib/vim-client';
import { buildSummary, derivePageStatus } from '@/lib/care/summary';
import type { EncounterSnapshot, OrderSnapshot, PatientSnapshot, ProblemEntry, ReferralSnapshot, SectionStatus } from '@/lib/care/types';
import { CareSummaryCard } from '@/components/CareSummaryCard';

function AppContent() {
  const searchParams = useSearchParams();
  const [ready, setReady] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [patientIdResolved, setPatientIdResolved] = useState(false);
  const [patient, setPatient] = useState<SectionStatus<PatientSnapshot>>({ kind: 'loading' });
  const [problems, setProblems] = useState<SectionStatus<ProblemEntry[]>>({ kind: 'loading' });
  const [encounter, setEncounter] = useState<SectionStatus<EncounterSnapshot>>({ kind: 'empty' });
  const [order, setOrder] = useState<SectionStatus<OrderSnapshot>>({ kind: 'empty' });
  const [referral, setReferral] = useState<SectionStatus<ReferralSnapshot>>({ kind: 'empty' });
  const initRef = useRef(false);
  const sdkRef = useRef<VimSDK | null>(null);
  const chartPatientPresentRef = useRef(false);
  const encounterPatientPresentRef = useRef(false);
  const viewGenerationRef = useRef(0);

  // Any signal that a patient is now in view — the chart_open workflow event,
  // or either patient context key arriving with fields — triggers the same
  // fetch. Multiple near-simultaneous signals on initial mount just re-run an
  // idempotent fetch; this also correctly re-fetches if the provider
  // navigates to a different patient's chart within the same app session.
  function handlePatientInView() {
    const sdk = sdkRef.current;
    if (!sdk) return;
    const generation = ++viewGenerationRef.current;
    setPatientIdResolved(true);
    setPatient({ kind: 'loading' });
    setProblems({ kind: 'loading' });
    fetchPatientSnapshot(sdk).then((r) => {
      if (viewGenerationRef.current === generation) setPatient(r);
    });
    fetchProblems(sdk).then((r) => {
      if (viewGenerationRef.current === generation) setProblems(r);
    });
  }

  function handlePatientOutOfView() {
    setPatientIdResolved(false);
    setPatient({ kind: 'empty' });
    setProblems({ kind: 'empty' });
    setEncounter({ kind: 'empty' });
    setOrder({ kind: 'empty' });
    setReferral({ kind: 'empty' });
    setError(null);
  }

  function reconcilePatientPresence() {
    if (chartPatientPresentRef.current || encounterPatientPresentRef.current) {
      handlePatientInView();
    } else {
      handlePatientOutOfView();
    }
  }

  useEffect(() => {
    if (initRef.current) return;
    initRef.current = true;

    let unsubscribers: Array<() => void> = [];

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

        const sdk = await initSdk(access_token);
        sdkRef.current = sdk;
        setReady(true);

        unsubscribers = [
          onChartOpen(sdk, () => {
            chartPatientPresentRef.current = true;
            reconcilePatientPresence();
          }),
          onChartOpenPatientContext(sdk, (fields) => {
            chartPatientPresentRef.current = Boolean(fields);
            reconcilePatientPresence();
          }),
          onEncounterOpenPatientContext(sdk, (fields) => {
            encounterPatientPresentRef.current = Boolean(fields);
            reconcilePatientPresence();
          }),
          onEncounterContext(sdk, (fields) => setEncounter(mapEncounterFields(fields))),
          onReferralContext(sdk, (fields) => setReferral(mapReferralFields(fields))),
          onOrderSelect(sdk, () => {
            setOrder({ kind: 'loading' });
            fetchOrderSnapshot(sdk).then(setOrder);
          }),
        ];
      } catch (err) {
        setError(err instanceof Error ? err.message : String(err));
      }
    })();

    return () => {
      unsubscribers.forEach((unsub) => unsub());
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams]);

  const pageStatus = error
    ? { kind: 'error' as const, message: error }
    : !ready
      ? { kind: 'connecting' as const }
      : derivePageStatus(patientIdResolved, buildSummary(patient, problems, encounter, order, referral));

  return <CareSummaryCard pageStatus={pageStatus} />;
}

export default function AppPage() {
  return (
    <Suspense fallback={<div style={{ padding: 16 }}>Loading…</div>}>
      <AppContent />
    </Suspense>
  );
}

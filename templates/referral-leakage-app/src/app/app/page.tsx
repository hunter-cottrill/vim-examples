'use client';

import { Suspense, useEffect, useRef, useState, type ComponentType } from 'react';
import { useSearchParams } from 'next/navigation';
import { initSdk, onPatient, onReferralStart, writeReferralNote, type WritebackOutcome } from '@/lib/vim-client';
import { evaluateReferral, type NudgeSuggestion, type PatientLike, type ReferralLike } from '@/lib/referral-engine';
import { networkIdForPayer } from '@/lib/payer-network-map';
import type { ProviderRecord } from '@/lib/network-directory';
import { ReferralNudgePanel, type EconsultRequestOutcome } from '@/components/ReferralNudgePanel';

// DEV-ONLY. NEXT_PUBLIC_SIM_MODE is inlined as a build-time literal by Next.js.
// Deliberately NOT next/dynamic(): that API's compiler plugin registers the
// import target in this route's react-loadable-manifest.json purely from static
// AST analysis of the `dynamic(() => import(...))` call — it does this even
// inside an `if (SIM_MODE)` branch that's provably false at build time, which
// would wire the chunk into /app's own route manifest regardless of the flag
// (confirmed by inspecting .next/server/app/app/page/react-loadable-manifest.json
// after a build with the flag unset). A plain runtime `import()` inside a
// useEffect, gated by the same inlined boolean, isn't tracked by that plugin and
// is never even evaluated when SIM_MODE is false, so no fetch is ever issued and
// no chunk is registered against this route.
const SIM_MODE = process.env.NEXT_PUBLIC_SIM_MODE === 'true';

function AppContent() {
  const searchParams = useSearchParams();
  const [ready, setReady] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [suggestions, setSuggestions] = useState<NudgeSuggestion[]>([]);
  const [loadingMatches, setLoadingMatches] = useState(false);
  const [SimulatorControls, setSimulatorControls] = useState<ComponentType | null>(null);
  const patientRef = useRef<PatientLike | null>(null);
  const referralRef = useRef<ReferralLike | null>(null);
  const initRef = useRef(false);
  // Guards against a stale fetch resolving after a newer referral/patient update.
  const requestIdRef = useRef(0);

  async function recompute() {
    const referral = referralRef.current;
    if (!referral) return;

    const requestId = ++requestIdRef.current;
    const specialty = referral.targetProvider?.specialty ?? referral.basicInformation?.specialty;

    if (!specialty) {
      setSuggestions(evaluateReferral(referral, patientRef.current ?? {}, []));
      return;
    }

    const insurance = patientRef.current?.insurances?.find((i) => i.isPrimary) ?? patientRef.current?.insurances?.[0];
    const insuranceNetworkId = networkIdForPayer(insurance?.payerName);

    setLoadingMatches(true);
    let matches: ProviderRecord[] = [];
    try {
      const res = await fetch('/api/network/match', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ specialty, insuranceNetworkId, excludeNpi: referral.targetProvider?.npi }),
      });
      if (res.ok) {
        matches = (await res.json()).matches ?? [];
      }
    } catch {
      matches = [];
    }

    if (requestId !== requestIdRef.current) return; // superseded by a newer update
    setLoadingMatches(false);
    const computed = evaluateReferral(referral, patientRef.current ?? {}, matches);
    setSuggestions(computed);

    // Optional LLM layer, wired as a progressive enhancement: only attempted when
    // there's already a rule-based in_network_alternative suggestion to enhance,
    // never blocks rendering, and any failure/non-membership response leaves the
    // rule-based suggestion exactly as computed above.
    if (matches.length > 0 && computed.some((s) => s.kind === 'in_network_alternative')) {
      const diagnosisDescription = referral.conditions?.find((c) => c.description)?.description;
      enhanceWithExplanation(requestId, specialty, diagnosisDescription, matches);
    }
  }

  async function enhanceWithExplanation(
    requestId: number,
    specialty: string,
    diagnosisDescription: string | undefined,
    matches: ProviderRecord[],
  ) {
    try {
      const res = await fetch('/api/referral/explain', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ specialty, diagnosisDescription, networkMatches: matches }),
      });
      if (!res.ok) return;
      const data = await res.json();
      if (data.source !== 'llm') return; // fallback response — rule-based suggestion already matches it

      const matchedProvider = matches.find((m) => m.npi === data.npi);
      if (!matchedProvider) return; // defensive — the route already enforces shortlist membership

      if (requestId !== requestIdRef.current) return; // superseded by a newer update
      setSuggestions((prev) =>
        prev.map((s) =>
          s.kind === 'in_network_alternative' ? { ...s, provider: matchedProvider, reason: data.rationale } : s,
        ),
      );
    } catch {
      // Silent — the rule-based suggestion set by recompute() already stands.
    }
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

        onPatient((p) => {
          patientRef.current = p;
          recompute();
        });
        onReferralStart((r) => {
          referralRef.current = r;
          recompute();
        });
      } catch (err) {
        setError(err instanceof Error ? err.message : String(err));
      }
    })();
  }, [searchParams]);

  useEffect(() => {
    if (!SIM_MODE) return; // dead branch when the flag is unset — import() below never runs, never fetched.
    import('@/dev/SimulatorControls').then((mod) => setSimulatorControls(() => mod.default));
  }, []);

  async function handleWriteNote(note: string): Promise<WritebackOutcome> {
    return writeReferralNote(note);
  }

  async function handleRequestEconsult(
    suggestion: Extract<NudgeSuggestion, { kind: 'econsult_candidate' }>,
  ): Promise<EconsultRequestOutcome> {
    try {
      const res = await fetch('/api/econsult/request', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          specialty: suggestion.condition.specialty,
          condition: {
            icd10Prefix: suggestion.condition.icd10Prefix,
            description: suggestion.condition.description,
          },
        }),
      });
      if (!res.ok) return { ok: false, detail: await res.text() };
      const data = await res.json();
      return { ok: true, requestId: data.requestId };
    } catch (err) {
      return { ok: false, detail: err instanceof Error ? err.message : String(err) };
    }
  }

  if (error) return <div style={{ color: '#b00020', padding: 16 }}>Error: {error}</div>;
  if (!ready) return <div style={{ padding: 16 }}>Connecting to Vim…</div>;

  return (
    <main style={{ padding: 16, maxWidth: 480 }}>
      <h1 style={{ fontSize: 18, margin: '0 0 12px' }}>Referral Guidance</h1>
      {SimulatorControls && <SimulatorControls />}
      <ReferralNudgePanel
        suggestions={suggestions}
        loading={loadingMatches}
        onWriteNote={handleWriteNote}
        onRequestEconsult={handleRequestEconsult}
      />
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
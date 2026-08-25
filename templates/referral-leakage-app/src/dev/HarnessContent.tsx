'use client';

// DEV-ONLY. Drives the pure domain pipeline (evaluateReferral) with a chosen
// fixture and the real, SDK-free POST /api/network/match route, then renders the
// actual ReferralNudgePanel. Imports NOTHING from @vimconnect/app-sdk, directly or
// transitively — ReferralNudgePanel's only reference to vim-client.ts is a
// type-only `import type`, which TypeScript erases entirely at compile time, so no
// SDK code is ever pulled into this module's bundle. Only ever rendered when
// NEXT_PUBLIC_SIM_MODE === 'true' (see src/app/dev/harness/page.tsx).
import { useState } from 'react';
import { FIXTURES, type ReferralFixture } from './fixtures';
import { evaluateReferral, type NudgeSuggestion } from '@/lib/referral-engine';
import { networkIdForPayer } from '@/lib/payer-network-map';
import type { ProviderRecord } from '@/lib/network-directory';
import { ReferralNudgePanel, type EconsultRequestOutcome } from '@/components/ReferralNudgePanel';

// Local mirror of vim-client.ts's WritebackOutcome shape — kept local rather than
// imported so this module has zero reference (even type-only) to vim-client.ts.
type WritebackOutcome = { ok: true } | { ok: false; reason: 'denied' | 'not_configured' | 'error'; detail?: string };

async function fetchNetworkMatches(
  specialty: string,
  patient: ReferralFixture['patient'],
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

async function handleWriteNote(): Promise<WritebackOutcome> {
  return {
    ok: false,
    reason: 'not_configured',
    detail: 'Dev harness has no live EHR connection — use the real /app flow to test writeback.',
  };
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
        condition: { icd10Prefix: suggestion.condition.icd10Prefix, description: suggestion.condition.description },
      }),
    });
    if (!res.ok) return { ok: false, detail: await res.text() };
    const data = await res.json();
    return { ok: true, requestId: data.requestId };
  } catch (err) {
    return { ok: false, detail: err instanceof Error ? err.message : String(err) };
  }
}

export default function HarnessContent() {
  const [ranId, setRanId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [suggestions, setSuggestions] = useState<NudgeSuggestion[]>([]);

  async function run(fixture: ReferralFixture) {
    setRanId(fixture.id);
    setSuggestions([]);
    const { referral, patient } = fixture;
    const specialty = referral.targetProvider?.specialty ?? referral.basicInformation?.specialty;

    if (!specialty) {
      setSuggestions(evaluateReferral(referral, patient, []));
      return;
    }

    setLoading(true);
    const matches = await fetchNetworkMatches(specialty, patient, referral.targetProvider?.npi);
    setLoading(false);
    setSuggestions(evaluateReferral(referral, patient, matches));
  }

  return (
    <main style={{ padding: 16, maxWidth: 520, fontFamily: 'system-ui, sans-serif' }}>
      <h1 style={{ fontSize: 18, margin: '0 0 4px' }}>Referral Guidance — Dev Harness</h1>
      <p style={{ fontSize: 12, color: '#92400e', margin: '0 0 16px' }}>
        NEXT_PUBLIC_SIM_MODE=true — pure domain pipeline only. No SDK, no auth, no live EHR.
      </p>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 16 }}>
        {FIXTURES.map((fixture) => (
          <button
            key={fixture.id}
            onClick={() => run(fixture)}
            style={{ textAlign: 'left', padding: 8, cursor: 'pointer' }}
          >
            <div>
              <strong>{ranId === fixture.id ? '▶ ' : ''}{fixture.label}</strong>
            </div>
            <div style={{ fontSize: 12, color: '#666' }}>{fixture.description}</div>
          </button>
        ))}
      </div>

      {ranId && (
        <ReferralNudgePanel
          suggestions={suggestions}
          loading={loading}
          onWriteNote={handleWriteNote}
          onRequestEconsult={handleRequestEconsult}
        />
      )}
    </main>
  );
}
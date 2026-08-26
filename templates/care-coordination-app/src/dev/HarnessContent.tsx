'use client';

// DEV-ONLY. Drives the real pure domain pipeline (buildSummary/derivePageStatus)
// with a chosen fixture and renders the real CareSummaryCard. Imports nothing
// from @vimconnect/app-sdk, directly or transitively — this module and every
// domain module it depends on are SDK-free by construction (see src/lib/care/types.ts).
// 'connecting' and 'error' are lifecycle states the pure functions never emit
// (see summary.ts), so they're exposed here as manual preview toggles instead
// of fixtures — they belong to the SDK-lifecycle wrapper, not the domain model.
import { useState } from 'react';
import { FIXTURES, type CareFixture } from './fixtures';
import { buildSummary, derivePageStatus } from '@/lib/care/summary';
import { CareSummaryCard } from '@/components/CareSummaryCard';
import type { PageStatus } from '@/lib/care/types';

type Selection = { kind: 'fixture'; fixture: CareFixture } | { kind: 'lifecycle-preview'; status: PageStatus };

function statusFor(selection: Selection): PageStatus {
  if (selection.kind === 'lifecycle-preview') return selection.status;
  const { fixture } = selection;
  const summary = buildSummary(fixture.patient, fixture.problems, fixture.encounter, fixture.order, fixture.referral);
  return derivePageStatus(fixture.patientIdResolved, summary);
}

export default function HarnessContent() {
  const [selection, setSelection] = useState<Selection | null>(null);

  return (
    <main style={{ padding: 16, maxWidth: 560, fontFamily: 'system-ui, sans-serif' }}>
      <h1 style={{ fontSize: 18, margin: '0 0 4px' }}>Care Coordination — Dev Harness</h1>
      <p style={{ fontSize: 12, color: '#92400e', margin: '0 0 16px' }}>
        NEXT_PUBLIC_SIM_MODE=true — pure domain pipeline only. No SDK, no auth, no live EHR.
      </p>

      <h2 style={{ fontSize: 13, margin: '0 0 6px', color: '#666' }}>Fixtures (domain-model branches)</h2>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 16 }}>
        {FIXTURES.map((fixture) => (
          <button
            key={fixture.id}
            onClick={() => setSelection({ kind: 'fixture', fixture })}
            style={{ textAlign: 'left', padding: 8, cursor: 'pointer' }}
          >
            <div>
              <strong>
                {selection?.kind === 'fixture' && selection.fixture.id === fixture.id ? '▶ ' : ''}
                {fixture.label}
              </strong>
            </div>
            <div style={{ fontSize: 12, color: '#666' }}>{fixture.description}</div>
          </button>
        ))}
      </div>

      <h2 style={{ fontSize: 13, margin: '0 0 6px', color: '#666' }}>
        Lifecycle previews (owned by the SDK client, not the domain model)
      </h2>
      <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
        <button
          onClick={() => setSelection({ kind: 'lifecycle-preview', status: { kind: 'connecting' } })}
          style={{ padding: 8, cursor: 'pointer' }}
        >
          Preview: connecting
        </button>
        <button
          onClick={() =>
            setSelection({
              kind: 'lifecycle-preview',
              status: { kind: 'error', message: 'Preview: OAuth token exchange failed.' },
            })
          }
          style={{ padding: 8, cursor: 'pointer' }}
        >
          Preview: error
        </button>
      </div>

      {selection && <CareSummaryCard pageStatus={statusFor(selection)} />}
    </main>
  );
}
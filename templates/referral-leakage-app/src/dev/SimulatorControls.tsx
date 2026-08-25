'use client';

// DEV-ONLY. Fires a fixture Patient + Referral through vim-client.ts's simulator
// seam (simulatePatient/simulateReferralStart), which only ever reaches the real
// onPatient/onReferralStart listeners already registered by src/app/app/page.tsx —
// that page's own effect, recompute(), evaluateReferral, and the real writeback
// ceremony are all completely unmodified and unaware this is a simulated event.
// Only ever rendered when NEXT_PUBLIC_SIM_MODE === 'true' (see src/app/app/page.tsx).
import { useState } from 'react';
import { FIXTURES } from './fixtures';
import { simulatePatient, simulateReferralStart } from '@/lib/vim-client';

export default function SimulatorControls() {
  const [firedId, setFiredId] = useState<string | null>(null);

  function fire(fixture: (typeof FIXTURES)[number]) {
    simulatePatient(fixture.patient);
    simulateReferralStart(fixture.referral);
    setFiredId(fixture.id);
  }

  return (
    <section
      style={{
        border: '2px dashed #d97706',
        borderRadius: 8,
        padding: 12,
        marginBottom: 16,
        background: '#fffbeb',
      }}
    >
      <strong style={{ color: '#92400e' }}>DEV SIMULATOR — NEXT_PUBLIC_SIM_MODE=true</strong>
      <p style={{ fontSize: 12, color: '#666', margin: '6px 0' }}>
        Fires a fixture through the same onPatient/onReferralStart listeners a real chart_open/
        referral_start would — useful since referral_start isn&apos;t emitted by this sandbox EHR.
      </p>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        {FIXTURES.map((fixture) => (
          <button key={fixture.id} onClick={() => fire(fixture)} style={{ textAlign: 'left', padding: 6 }}>
            {firedId === fixture.id ? '✓ ' : ''}Fire: {fixture.label}
          </button>
        ))}
      </div>
    </section>
  );
}
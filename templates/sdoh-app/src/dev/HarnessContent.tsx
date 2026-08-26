'use client';

import { useReducer, useState } from 'react';
import { transition, type AppState } from '@/lib/app-state';
import { evaluateSdoh } from '@/lib/sdoh/rules';
import { SdohPanel } from '@/components/SdohPanel';
import { ConnectingView, ErrorView, WaitingView } from '@/components/StateViews';
import type { WritebackOutcome } from '@/lib/sdoh/writeback-state';
import { PATIENT_FIXTURES } from './fixtures';

const WRITEBACK_OUTCOMES: Record<string, WritebackOutcome> = {
  ok: { ok: true },
  denied: { ok: false, reason: 'denied' },
  not_configured: { ok: false, reason: 'not_configured' },
  error: { ok: false, reason: 'error', detail: 'simulated network error' },
};

const controlsStyle: React.CSSProperties = {
  padding: 16,
  borderBottom: '1px solid #e2e2e2',
  fontFamily: 'system-ui, -apple-system, sans-serif',
  fontSize: 14,
};

// The harness bypasses SDK init entirely (no real connection to simulate),
// so it starts one step past INITIAL_APP_STATE — 'awaiting_chart' — rather
// than sitting in 'connecting' forever with nothing to dispatch SDK_READY.
const HARNESS_INITIAL_STATE: AppState = { status: 'awaiting_chart' };

export function HarnessContent() {
  const [state, dispatch] = useReducer(transition, HARNESS_INITIAL_STATE);
  const [nextWritebackOutcome, setNextWritebackOutcome] = useState<keyof typeof WRITEBACK_OUTCOMES>('ok');

  function openChart(fixtureKey: string) {
    const fixture = PATIENT_FIXTURES.find((f) => f.key === fixtureKey);
    if (!fixture) return;
    dispatch({ type: 'CHART_OPENED', patientId: fixture.patient.patientId });
    dispatch({
      type: 'PATIENT_DATA_FETCHED',
      patientId: fixture.patient.patientId,
      evaluation: evaluateSdoh(fixture.patient),
    });
  }

  function simulateSdkInitFailure() {
    dispatch({ type: 'SDK_INIT_FAILED', message: 'Simulated: OAuth token exchange failed' });
  }

  function simulateFetchFailure() {
    dispatch({ type: 'CHART_OPENED', patientId: 'demo-fail' });
    dispatch({
      type: 'PATIENT_DATA_FETCH_FAILED',
      patientId: 'demo-fail',
      message: 'Simulated: Entity API reads failed after 3 retries',
    });
  }

  async function mockWriteback(): Promise<WritebackOutcome> {
    return WRITEBACK_OUTCOMES[nextWritebackOutcome];
  }

  function renderState() {
    switch (state.status) {
      case 'connecting':
        return <ConnectingView />;
      case 'awaiting_chart':
        return <WaitingView text="Waiting for a chart to open…" />;
      case 'loading_patient_data':
        return <WaitingView text="Loading patient data…" />;
      case 'error':
        return <ErrorView message={state.message} retryable={state.retryable} />;
      case 'ready':
        return (
          <main style={{ padding: 16, maxWidth: 480 }}>
            <h1 style={{ fontSize: 18, margin: '0 0 12px' }}>SDOH Assistant</h1>
            <SdohPanel evaluation={state.evaluation} onWriteback={mockWriteback} />
          </main>
        );
    }
  }

  return (
    <div>
      <div style={controlsStyle}>
        <p style={{ margin: '0 0 8px', fontWeight: 600 }}>
          Dev harness — drives the real UI against bundled fixtures, no SDK involved.
        </p>

        <div style={{ marginBottom: 8 }}>
          <span style={{ marginRight: 8 }}>Open chart with fixture:</span>
          {PATIENT_FIXTURES.map((f) => (
            <button key={f.key} onClick={() => openChart(f.key)} style={{ marginRight: 6, marginBottom: 6 }} title={f.label}>
              {f.key}
            </button>
          ))}
        </div>

        <div style={{ marginBottom: 8 }}>
          <button onClick={simulateSdkInitFailure} style={{ marginRight: 6 }}>
            Simulate SDK init failure
          </button>
          <button onClick={simulateFetchFailure}>Simulate fetch failure after retries</button>
        </div>

        <div>
          <label>
            Next writeback outcome:{' '}
            <select
              value={nextWritebackOutcome}
              onChange={(e) => setNextWritebackOutcome(e.target.value as keyof typeof WRITEBACK_OUTCOMES)}
            >
              {Object.keys(WRITEBACK_OUTCOMES).map((key) => (
                <option key={key} value={key}>
                  {key}
                </option>
              ))}
            </select>
          </label>
        </div>
      </div>

      {renderState()}
    </div>
  );
}

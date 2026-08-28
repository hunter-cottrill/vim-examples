'use client';

import { useReducer, useState } from 'react';
import { transition, type AppState } from '@/lib/app-state';
import { matchConditionCrosswalk } from '@/lib/trial-match/condition-crosswalk';
import { matchZipCrosswalk } from '@/lib/trial-match/zip-crosswalk';
import { buildTrialMatches, selectSearchConditions } from '@/lib/trial-match/trial-matching';
import { ConnectingView, ErrorView, WaitingView } from '@/components/StateViews';
import { TrialResultsPanel } from '@/components/TrialResultsPanel';
import { PATIENT_FIXTURES } from './fixtures';
import { TRIAL_SEARCH_FIXTURES } from './trial-search-fixtures';

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
  // transition() only accepts SDK_INIT_FAILED from 'connecting', which the
  // harness intentionally skips (see HARNESS_INITIAL_STATE above) — so a
  // real dispatch of that input here would always no-op. This local flag is
  // a harness-only override to still let the sdk_init_failed error render be
  // reviewed visually, without weakening the real state machine's guard.
  const [forcedSdkInitError, setForcedSdkInitError] = useState(false);
  // The real onChartClosed callback gets the departing patient's id from the
  // context payload itself; the harness has no such payload to read, so it
  // just remembers who's currently "open" to pass along instead.
  const [openPatientId, setOpenPatientId] = useState<string | null>(null);

  function openChart(fixtureKey: string) {
    const fixture = PATIENT_FIXTURES.find((f) => f.key === fixtureKey);
    if (!fixture) return;
    const { patient } = fixture;

    setForcedSdkInitError(false);
    setOpenPatientId(patient.patientId);
    dispatch({ type: 'CHART_OPENED', patientId: patient.patientId });
    dispatch({ type: 'PATIENT_DATA_FETCHED', patientId: patient.patientId, context: patient });

    // Mirrors trials-client.ts's real pipeline (select -> search -> build),
    // sourcing raw results from the canned fixtures instead of a live call —
    // this is the sim-mode equivalent of the network hop, nothing else.
    const conditionMatches = patient.problems.map(matchConditionCrosswalk);
    const zipMatch = matchZipCrosswalk(patient.zipCode);
    const selected = selectSearchConditions(conditionMatches);
    const fixtureResults = TRIAL_SEARCH_FIXTURES[fixtureKey] ?? {};
    const rawResultsByCondition = selected.map((c) => ({
      conditionKey: c.conditionKey!,
      trials: fixtureResults[c.conditionKey!] ?? [],
    }));
    const result = buildTrialMatches(patient.problems, conditionMatches, zipMatch, rawResultsByCondition);

    dispatch({ type: 'TRIAL_SEARCH_SUCCEEDED', patientId: patient.patientId, result });
  }

  function simulateSdkInitFailure() {
    setForcedSdkInitError(true);
  }

  function simulatePatientFetchFailure() {
    setForcedSdkInitError(false);
    setOpenPatientId('demo-fail-fetch');
    dispatch({ type: 'CHART_OPENED', patientId: 'demo-fail-fetch' });
    dispatch({ type: 'PATIENT_DATA_FETCH_FAILED', patientId: 'demo-fail-fetch' });
  }

  function simulateTrialSearchFailure() {
    setForcedSdkInitError(false);
    setOpenPatientId('demo-fail-search');
    dispatch({ type: 'CHART_OPENED', patientId: 'demo-fail-search' });
    dispatch({
      type: 'PATIENT_DATA_FETCHED',
      patientId: 'demo-fail-search',
      context: { patientId: 'demo-fail-search', zipCode: '80202', problems: [] },
    });
    dispatch({ type: 'TRIAL_SEARCH_FAILED', patientId: 'demo-fail-search' });
  }

  function closeChart() {
    setForcedSdkInitError(false);
    if (openPatientId) dispatch({ type: 'CHART_CLOSED' });
    setOpenPatientId(null);
  }

  function renderState() {
    if (forcedSdkInitError) return <ErrorView reason="sdk_init_failed" />;

    switch (state.status) {
      case 'connecting':
        return <ConnectingView />;
      case 'awaiting_chart':
        return <WaitingView text="Waiting for a chart to open…" />;
      case 'loading_patient_data':
        return <WaitingView text="Loading patient data…" />;
      case 'searching_trials':
        return <WaitingView text="Searching ClinicalTrials.gov…" />;
      case 'error':
        return <ErrorView reason={state.reason} />;
      case 'ready':
        return (
          <main style={{ padding: 16, maxWidth: 480 }}>
            <h1 style={{ fontSize: 18, margin: '0 0 12px' }}>Trial Match</h1>
            <TrialResultsPanel result={state.result} />
          </main>
        );
    }
  }

  return (
    <div>
      <div style={controlsStyle}>
        <p style={{ margin: '0 0 8px', fontWeight: 600 }}>
          Dev harness — drives the real UI components against bundled fixtures, no SDK involved.
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
          <button onClick={simulatePatientFetchFailure} style={{ marginRight: 6 }}>
            Simulate patient fetch failure
          </button>
          <button onClick={simulateTrialSearchFailure}>Simulate trial search failure</button>
        </div>

        <div>
          <button onClick={closeChart} disabled={!openPatientId} title="Simulates the provider navigating away from the chart">
            Leave chart
          </button>
        </div>
      </div>

      {renderState()}
    </div>
  );
}

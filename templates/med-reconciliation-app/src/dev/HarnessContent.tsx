'use client';

/**
 * SIM_MODE dev harness. Drives fixtures in at the vim-client boundary and
 * renders the REAL views through the REAL hook — it does not re-implement the
 * app, and it never dispatches a pre-built domain object or reducer input.
 *
 * What this proves: the app handles a chart_open event, an Entity API
 * exhaustion, and a context teardown correctly. What it does NOT prove: that
 * chart_open fires, or that getMedications() is populated, in a live EHR.
 */
import { useCallback, useState } from 'react';
import { ConnectingView, ErrorView, WaitingView } from '@/components/StateViews';
import { ReconciliationPanel } from '@/components/ReconciliationPanel';
import { buildNotificationSummary } from '@/lib/med-rec/notification';
import { useReconciliation } from '@/lib/use-reconciliation';
import { simulateChartOpen, simulateContextPresence } from '@/lib/vim-client';
import { PATIENT_FIXTURES } from './fixtures';

const layoutStyle: React.CSSProperties = {
  display: 'flex',
  flexWrap: 'wrap',
  gap: 24,
  padding: 16,
  fontFamily: 'system-ui, -apple-system, sans-serif',
  fontSize: 14,
  color: '#111',
};

const controlsStyle: React.CSSProperties = { flex: '1 1 380px', maxWidth: 480 };

const panelStyle: React.CSSProperties = {
  flex: '1 1 380px',
  maxWidth: 560,
  border: '1px solid #e2e2e2',
  borderRadius: 6,
  background: '#fff',
};

const sectionHeadingStyle: React.CSSProperties = {
  fontSize: 12,
  fontWeight: 600,
  textTransform: 'uppercase',
  letterSpacing: 0.4,
  color: '#666',
  margin: '20px 0 8px',
};

const buttonStyle: React.CSSProperties = {
  display: 'block',
  width: '100%',
  textAlign: 'left',
  border: '1px solid #d8d8d8',
  borderRadius: 5,
  background: '#fff',
  padding: '7px 10px',
  marginBottom: 5,
  cursor: 'pointer',
  font: 'inherit',
};

const rowStyle: React.CSSProperties = { display: 'flex', gap: 6, flexWrap: 'wrap' };

const inlineButtonStyle: React.CSSProperties = { ...buttonStyle, width: 'auto', marginBottom: 0 };

const keyLabelStyle: React.CSSProperties = { fontSize: 12, color: '#666', margin: '6px 0 0' };

const previewStyle: React.CSSProperties = {
  border: '1px solid #e2e2e2',
  borderRadius: 5,
  background: '#fafafa',
  padding: '8px 10px',
  whiteSpace: 'pre-wrap',
  fontSize: 13,
};

const noteStyle: React.CSSProperties = { color: '#666', fontSize: 12, marginTop: 20, lineHeight: 1.5 };

const noConnect = () => Promise.resolve();

export function HarnessContent() {
  const { state, launchPatientId } = useReconciliation(useCallback(noConnect, []));
  const [presence, setPresence] = useState({ chart: false, encounter: false });

  function setKey(key: 'chart' | 'encounter', value: boolean) {
    setPresence((current) => ({ ...current, [key]: value }));
    simulateContextPresence(key, value);
  }

  function openFixture(fixtureKey: string) {
    const fixture = PATIENT_FIXTURES.find((candidate) => candidate.key === fixtureKey);
    if (!fixture) return;
    setKey('chart', true);
    simulateChartOpen(fixture.source);
  }

  const summary = state.status === 'ready' ? buildNotificationSummary(state.result) : null;

  return (
    <div style={layoutStyle}>
      <div style={controlsStyle}>
        <h1 style={{ fontSize: 16, margin: '0 0 4px' }}>Med reconciliation — dev harness</h1>
        <p style={{ color: '#666', margin: 0, fontSize: 13 }}>
          NEXT_PUBLIC_SIM_MODE is on. Fixtures are fed in at the SDK client boundary and travel the same path a live
          chart_open takes.
        </p>

        <h2 style={sectionHeadingStyle}>Open a chart</h2>
        {PATIENT_FIXTURES.map((fixture) => (
          <button key={fixture.key} type="button" style={buttonStyle} onClick={() => openFixture(fixture.key)}>
            <strong>{fixture.key}</strong>
            <br />
            <span style={{ color: '#666', fontSize: 13 }}>{fixture.label}</span>
          </button>
        ))}

        <h2 style={sectionHeadingStyle}>Context keys</h2>
        <div style={rowStyle}>
          <button
            type="button"
            style={inlineButtonStyle}
            onClick={() => {
              // The real interleaving: chart empties, encounter populates.
              // The panel must NOT reset.
              setKey('chart', false);
              setKey('encounter', true);
            }}
          >
            Open an encounter
          </button>
          <button
            type="button"
            style={inlineButtonStyle}
            onClick={() => {
              setKey('encounter', false);
              setKey('chart', true);
            }}
          >
            Back to the chart
          </button>
          <button
            type="button"
            style={inlineButtonStyle}
            onClick={() => {
              setKey('chart', false);
              setKey('encounter', false);
            }}
          >
            Leave the patient
          </button>
        </div>
        <p style={keyLabelStyle}>
          chart_open:patient <strong>{presence.chart ? 'populated' : 'empty'}</strong> · encounter_open:patient{' '}
          <strong>{presence.encounter ? 'populated' : 'empty'}</strong>
        </p>

        <h2 style={sectionHeadingStyle}>Worker notification preview</h2>
        {summary ? (
          <div style={previewStyle}>
            <strong>{summary.title}</strong>
            {'\n'}
            {summary.text}
          </div>
        ) : (
          <p style={{ color: '#666', margin: 0, fontSize: 13 }}>
            No notification for this result — the Worker stays silent unless there are findings.
          </p>
        )}

        <p style={noteStyle}>
          This harness proves the app handles a chart_open event, an Entity API exhaustion and a context teardown
          correctly. It does not prove that chart_open fires, or that getMedications() returns data, in a live EHR.
        </p>
      </div>

      <div style={panelStyle}>
        {state.status === 'connecting' && <ConnectingView />}
        {state.status === 'awaiting_chart' && (
          <WaitingView text="Open a patient's chart to compare their medication and problem lists." />
        )}
        {state.status === 'loading_chart' && <WaitingView text="Reading this chart's medication and problem lists…" />}
        {state.status === 'error' && <ErrorView reason={state.reason} />}
        {state.status === 'ready' && (
          <ReconciliationPanel
            result={state.result}
            context={state.context}
            openedFromNotification={launchPatientId !== null && launchPatientId === state.patientId}
          />
        )}
      </div>
    </div>
  );
}

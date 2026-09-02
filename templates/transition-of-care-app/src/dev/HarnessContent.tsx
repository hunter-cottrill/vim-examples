'use client';

/**
 * SIM_MODE dev harness. Drives fixtures in at the vim-client boundary and
 * renders the REAL TransitionSummaryCard through the REAL hook — it does not
 * re-implement the app, and it never dispatches a pre-built domain object.
 *
 * What this proves: the app handles a chart_open event, per-section Entity
 * API faults, and a context teardown correctly, against the REAL
 * /api/hospitalization route and its REAL bundled dataset. What it does NOT
 * prove: that chart_open fires, or that getMedications() is populated, in a
 * live EHR.
 */
import { useCallback, useState } from 'react';
import { TransitionSummaryCard } from '@/components/TransitionSummaryCard';
import { useTransitionSummary } from '@/lib/use-transition-summary';
import { simulateChartOpen, simulateContextPresence } from '@/lib/vim-client';
import type { PageStatus } from '@/lib/transition/types';
import { FIXTURES } from './fixtures';

const layoutStyle: React.CSSProperties = {
  display: 'flex',
  flexWrap: 'wrap',
  gap: 24,
  padding: 16,
  fontFamily: 'system-ui, -apple-system, sans-serif',
  fontSize: 14,
  color: '#111',
};

const controlsStyle: React.CSSProperties = { flex: '1 1 420px', maxWidth: 520 };
const panelStyle: React.CSSProperties = { flex: '1 1 420px', maxWidth: 560 };

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

const inlineButtonStyle: React.CSSProperties = { ...buttonStyle, width: 'auto', marginBottom: 0 };
const rowStyle: React.CSSProperties = { display: 'flex', gap: 6, flexWrap: 'wrap' };
const keyLabelStyle: React.CSSProperties = { fontSize: 12, color: '#666', margin: '6px 0 0' };
const noteStyle: React.CSSProperties = { color: '#666', fontSize: 12, marginTop: 20, lineHeight: 1.5 };

const noConnect = () => Promise.resolve();

const LIFECYCLE_PREVIEWS: Array<{ id: string; label: string; status: PageStatus }> = [
  { id: 'connecting', label: 'Preview: connecting', status: { kind: 'connecting' } },
  { id: 'page-error', label: 'Preview: page error', status: { kind: 'error', message: 'Preview: OAuth token exchange failed.' } },
  {
    id: 'hospitalization-error',
    label: 'Preview: hospitalization lookup error',
    status: {
      kind: 'result',
      summary: {
        patient: { displayName: 'Preview Patient', patientKey: 'MRN-PREVIEW' },
        problems: { kind: 'empty' },
        medications: { kind: 'empty' },
        hospitalization: { kind: 'error', message: 'Preview: hospitalization backend request failed.' },
        diagnosisReconciliation: [],
        medicationReconciliation: [],
      },
    },
  },
];

export function HarnessContent() {
  const livePageStatus = useTransitionSummary(useCallback(noConnect, []));
  const [preview, setPreview] = useState<PageStatus | null>(null);
  const [presence, setPresence] = useState({ chart: false, encounter: false });

  function setKey(key: 'chart' | 'encounter', value: boolean) {
    setPresence((current) => ({ ...current, [key]: value }));
    simulateContextPresence(key, value);
  }

  function openFixture(id: string) {
    const demo = FIXTURES.find((f) => f.id === id);
    if (!demo) return;
    setPreview(null);
    setKey('chart', true);
    simulateChartOpen(demo.fixture);
  }

  const pageStatus = preview ?? livePageStatus;

  return (
    <div style={layoutStyle}>
      <div style={controlsStyle}>
        <h1 style={{ fontSize: 16, margin: '0 0 4px' }}>Transition of care — dev harness</h1>
        <p style={{ color: '#666', margin: 0, fontSize: 13 }}>
          NEXT_PUBLIC_SIM_MODE is on. Fixtures are fed in at the SDK client boundary and travel the same path a live
          chart_open takes, including a real call to /api/hospitalization.
        </p>

        <h2 style={sectionHeadingStyle}>Open a chart</h2>
        {FIXTURES.map((demo) => (
          <button key={demo.id} type="button" style={buttonStyle} onClick={() => openFixture(demo.id)}>
            <strong>{demo.label}</strong>
            <br />
            <span style={{ color: '#666', fontSize: 13 }}>{demo.description}</span>
          </button>
        ))}

        <h2 style={sectionHeadingStyle}>Context keys</h2>
        <div style={rowStyle}>
          <button
            type="button"
            style={inlineButtonStyle}
            onClick={() => {
              // The real interleaving: chart empties, encounter populates. Must NOT reset.
              setPreview(null);
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
              setPreview(null);
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
              setPreview(null);
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

        <h2 style={sectionHeadingStyle}>Lifecycle previews (owned by the SDK client, not the domain model)</h2>
        <div style={rowStyle}>
          {LIFECYCLE_PREVIEWS.map((lp) => (
            <button key={lp.id} type="button" style={inlineButtonStyle} onClick={() => setPreview(lp.status)}>
              {lp.label}
            </button>
          ))}
        </div>

        <p style={noteStyle}>
          This harness proves the app handles a chart_open event, per-section Entity API faults, and a context
          teardown correctly. It does not prove that chart_open fires, or that getProblems()/getMedications() are
          populated, in a live EHR.
        </p>
      </div>

      <div style={panelStyle}>
        <TransitionSummaryCard pageStatus={pageStatus} />
      </div>
    </div>
  );
}

export default HarnessContent;

import type {
  HospitalizationLookupResult,
  MedicationEntry,
  PageStatus,
  ProblemEntry,
  ReconciliationItem,
  SectionStatus,
  TransitionSummary,
} from '@/lib/transition/types';

const cardStyle: React.CSSProperties = {
  border: '1px solid #e2e2e2',
  borderRadius: 8,
  padding: 16,
  display: 'flex',
  flexDirection: 'column',
  gap: 16,
  maxWidth: 520,
  fontFamily: 'system-ui, -apple-system, sans-serif',
};

const sectionStyle: React.CSSProperties = {
  borderTop: '1px solid #eee',
  paddingTop: 12,
};

const sectionTitleStyle: React.CSSProperties = {
  fontSize: 12,
  fontWeight: 600,
  textTransform: 'uppercase',
  letterSpacing: 0.4,
  color: '#666',
  margin: '0 0 6px',
};

const mutedStyle: React.CSSProperties = { fontSize: 13, color: '#888', margin: 0 };
const bodyStyle: React.CSSProperties = { fontSize: 14, color: '#222', margin: 0 };
const listStyle: React.CSSProperties = { ...bodyStyle, margin: 0, paddingLeft: 18, display: 'flex', flexDirection: 'column', gap: 6 };

function sectionFallbackMessage(status: SectionStatus<unknown>): string | null {
  switch (status.kind) {
    case 'loading':
      return 'Loading…';
    case 'empty':
      return 'None on the chart.';
    case 'unsupported':
      return 'Not available via this EHR.';
    case 'error':
      return `Couldn't load this — ${status.message}`;
    case 'loaded':
      return null;
  }
}

function Section({ title, status, render }: { title: string; status: SectionStatus<unknown>; render: () => React.ReactNode }) {
  const fallback = sectionFallbackMessage(status);
  return (
    <div style={sectionStyle}>
      <h2 style={sectionTitleStyle}>{title}</h2>
      {fallback ? <p style={mutedStyle}>{fallback}</p> : render()}
    </div>
  );
}

function ProblemsBody({ data }: { data: ProblemEntry[] }) {
  return (
    <ul style={listStyle}>
      {data.map((p, i) => (
        <li key={p.code ?? i}>{p.description ?? p.code ?? 'Unlabeled problem'}</li>
      ))}
    </ul>
  );
}

function MedicationsBody({ data }: { data: MedicationEntry[] }) {
  return (
    <ul style={listStyle}>
      {data.map((m, i) => (
        <li key={m.ndcCode ?? i}>
          {m.medicationName ?? 'Unnamed medication'}
          {m.strength && ` — ${m.strength}`}
          {m.frequency && `, ${m.frequency}`}
        </li>
      ))}
    </ul>
  );
}

// Reconciliation confidence is a description of what the chart shows, not a
// clinical judgment — "not on the problem list" describes chart state,
// "no longer indicated" would be a judgment the chart never made.
const CONFIDENCE_COPY: Record<ReconciliationItem['confidence'], { diagnosis: string; medication: string; color: string }> = {
  high: { diagnosis: 'On the problem list', medication: 'Currently on the medication list', color: '#2e7d32' },
  ambiguous: {
    diagnosis: 'Possible match on the problem list — verify',
    medication: 'Similar medication on the list — verify dose/status',
    color: '#b26a00',
  },
  none: {
    diagnosis: 'Not on the problem list — may need follow-up',
    medication: 'Not currently on the medication list — review',
    color: '#b00020',
  },
};

function ReconciliationList({ title, items }: { title: string; items: ReconciliationItem[] }) {
  if (items.length === 0) {
    return (
      <div>
        <p style={{ ...bodyStyle, fontWeight: 600 }}>{title}</p>
        <p style={mutedStyle}>None on record for this stay.</p>
      </div>
    );
  }
  return (
    <div>
      <p style={{ ...bodyStyle, fontWeight: 600 }}>{title}</p>
      <ul style={listStyle}>
        {items.map((item, i) => {
          const label = item.kind === 'diagnosis' ? item.discharge.description : item.discharge.medicationName;
          const copy = CONFIDENCE_COPY[item.confidence];
          const note = item.kind === 'diagnosis' ? copy.diagnosis : copy.medication;
          return (
            <li key={i}>
              {label}
              <br />
              <span style={{ fontSize: 12, color: copy.color }}>{note}</span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

function HospitalizationBody({
  hospitalization,
  diagnosisReconciliation,
  medicationReconciliation,
}: {
  hospitalization: HospitalizationLookupResult;
  diagnosisReconciliation: ReconciliationItem[];
  medicationReconciliation: ReconciliationItem[];
}) {
  switch (hospitalization.kind) {
    case 'unavailable':
      return <p style={mutedStyle}>Can't check for a recent hospital stay — no patient identifier available from this chart.</p>;
    case 'not_found':
      return <p style={bodyStyle}>No recent hospital stay on record for this patient.</p>;
    case 'error':
      return <p style={{ ...bodyStyle, color: '#b00020' }}>Couldn't check for a recent hospital stay — {hospitalization.message}</p>;
    case 'found':
      return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <p style={bodyStyle}>
            {hospitalization.record.facilityName} — discharged {hospitalization.daysSinceDischarge} day
            {hospitalization.daysSinceDischarge === 1 ? '' : 's'} ago (admitted {hospitalization.record.admissionDate}, discharged{' '}
            {hospitalization.record.dischargeDate})
          </p>
          <ReconciliationList title="Discharge diagnoses" items={diagnosisReconciliation} />
          <ReconciliationList title="Discharge medications" items={medicationReconciliation} />
        </div>
      );
  }
}

function ResultCard({ summary }: { summary: TransitionSummary }) {
  return (
    <div style={cardStyle}>
      <div>
        <h1 style={{ fontSize: 18, margin: 0 }}>{summary.patient.displayName ?? 'Unnamed patient'}</h1>
        <p style={mutedStyle}>Transition of care — recent hospital stay and chart reconciliation.</p>
      </div>

      <div style={sectionStyle}>
        <h2 style={sectionTitleStyle}>Recent hospital stay</h2>
        <HospitalizationBody
          hospitalization={summary.hospitalization}
          diagnosisReconciliation={summary.diagnosisReconciliation}
          medicationReconciliation={summary.medicationReconciliation}
        />
      </div>

      <Section
        title="Problem list"
        status={summary.problems}
        render={() => summary.problems.kind === 'loaded' && <ProblemsBody data={summary.problems.data} />}
      />
      <Section
        title="Medication list"
        status={summary.medications}
        render={() => summary.medications.kind === 'loaded' && <MedicationsBody data={summary.medications.data} />}
      />
    </div>
  );
}

export function TransitionSummaryCard({ pageStatus }: { pageStatus: PageStatus }) {
  switch (pageStatus.kind) {
    case 'connecting':
      return (
        <div style={cardStyle}>
          <p style={mutedStyle}>Connecting to Vim…</p>
        </div>
      );
    case 'waiting':
      return (
        <div style={cardStyle}>
          <p style={mutedStyle}>Waiting for a patient chart to open…</p>
        </div>
      );
    case 'error':
      return (
        <div style={cardStyle}>
          <p style={{ ...bodyStyle, color: '#b00020' }}>Error: {pageStatus.message}</p>
        </div>
      );
    case 'result':
      return <ResultCard summary={pageStatus.summary} />;
  }
}

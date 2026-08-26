import type {
  CareCoordinationSummary,
  EncounterSnapshot,
  OrderSnapshot,
  PageStatus,
  PatientSnapshot,
  ProblemEntry,
  ReferralSnapshot,
  SectionStatus,
} from '@/lib/care/types';

const cardStyle: React.CSSProperties = {
  border: '1px solid #e2e2e2',
  borderRadius: 8,
  padding: 16,
  display: 'flex',
  flexDirection: 'column',
  gap: 16,
  maxWidth: 480,
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

// Copy for the four SectionStatus kinds that never carry section-specific data
// (loading/empty/unsupported/error are worded the same way across sections so
// a provider learns the vocabulary once). 'loaded' is handled per-section.
function sectionFallbackMessage(status: SectionStatus<unknown>): string | null {
  switch (status.kind) {
    case 'loading':
      return 'Loading…';
    case 'empty':
      return 'Nothing in context this session.';
    case 'unsupported':
      return 'Not available via this EHR.';
    case 'error':
      return `Couldn't load this — ${status.message}`;
    case 'loaded':
      return null;
  }
}

function Section({ title, status, render }: {
  title: string;
  status: SectionStatus<unknown>;
  render: () => React.ReactNode;
}) {
  const fallback = sectionFallbackMessage(status);
  return (
    <div style={sectionStyle}>
      <h2 style={sectionTitleStyle}>{title}</h2>
      {fallback ? <p style={mutedStyle}>{fallback}</p> : render()}
    </div>
  );
}

function PatientBody({ data }: { data: PatientSnapshot }) {
  const name = [data.firstName, data.lastName].filter(Boolean).join(' ');
  return <p style={bodyStyle}>{name || 'Unnamed patient'}</p>;
}

function ProblemsBody({ data }: { data: ProblemEntry[] }) {
  if (data.length === 0) return <p style={mutedStyle}>No active problems on file.</p>;
  return (
    <ul style={{ ...bodyStyle, margin: 0, paddingLeft: 18 }}>
      {data.map((p, i) => (
        <li key={p.code ?? i}>{p.description}</li>
      ))}
    </ul>
  );
}

function EncounterBody({ data }: { data: EncounterSnapshot }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
      {data.type && <p style={bodyStyle}>{data.type}</p>}
      {data.chiefComplaint && <p style={bodyStyle}>CC: {data.chiefComplaint}</p>}
      {data.diagnoses.length > 0 ? (
        <ul style={{ ...bodyStyle, margin: 0, paddingLeft: 18 }}>
          {data.diagnoses.map((dx, i) => <li key={i}>{dx}</li>)}
        </ul>
      ) : (
        <p style={mutedStyle}>No diagnoses documented yet.</p>
      )}
    </div>
  );
}

function OrderBody({ data }: { data: OrderSnapshot }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
      <p style={bodyStyle}>
        {data.typeLabel}
        {data.orderName && ` — ${data.orderName}`}
      </p>
      {data.reason && <p style={mutedStyle}>Reason: {data.reason}</p>}
      <p style={mutedStyle}>On record this session — no status is asserted.</p>
    </div>
  );
}

function ProviderMentionsBody({ summary }: { summary: CareCoordinationSummary }) {
  if (summary.providerMentions.length === 0) {
    return <p style={mutedStyle}>None referenced in this session's context.</p>;
  }
  return (
    <ul style={{ ...bodyStyle, margin: 0, paddingLeft: 18 }}>
      {summary.providerMentions.map((m, i) => (
        <li key={i}>
          {m.name} <span style={{ color: '#888' }}>({m.role})</span>
        </li>
      ))}
    </ul>
  );
}

function ResultCard({ summary }: { summary: CareCoordinationSummary }) {
  return (
    <div style={cardStyle}>
      <div>
        <h1 style={{ fontSize: 18, margin: 0 }}>Care Coordination Snapshot</h1>
        <p style={mutedStyle}>What's on record for this patient in the current session.</p>
      </div>

      <Section
        title="Patient"
        status={summary.patient}
        render={() => summary.patient.kind === 'loaded' && <PatientBody data={summary.patient.data} />}
      />
      <Section
        title="Problem list"
        status={summary.problems}
        render={() => summary.problems.kind === 'loaded' && <ProblemsBody data={summary.problems.data} />}
      />
      <Section
        title="Current visit"
        status={summary.encounter}
        render={() => summary.encounter.kind === 'loaded' && <EncounterBody data={summary.encounter.data} />}
      />
      <Section
        title="Orders on record this session"
        status={summary.order}
        render={() => summary.order.kind === 'loaded' && <OrderBody data={summary.order.data} />}
      />
      <div style={sectionStyle}>
        <h2 style={sectionTitleStyle}>Other providers referenced this session</h2>
        <ProviderMentionsBody summary={summary} />
      </div>
    </div>
  );
}

export function CareSummaryCard({ pageStatus }: { pageStatus: PageStatus }) {
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

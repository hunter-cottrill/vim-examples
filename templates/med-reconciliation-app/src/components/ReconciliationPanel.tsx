import { FindingCard } from './FindingCard';
import { ExcludedList } from './ExcludedList';
import { describeEvidence } from '@/lib/med-rec/presentation';
import type { ChartContext, ReconciliationResult } from '@/lib/med-rec/types';

const pageStyle: React.CSSProperties = {
  padding: 16,
  maxWidth: 520,
  color: '#111',
  fontFamily: 'system-ui, -apple-system, sans-serif',
  fontSize: 14,
  lineHeight: 1.5,
};

const headingStyle: React.CSSProperties = { fontSize: 16, fontWeight: 600, margin: '0 0 2px' };

const countsStyle: React.CSSProperties = { color: '#666', margin: '0 0 12px', fontSize: 13 };

const chartStatedStyle: React.CSSProperties = {
  display: 'inline-block',
  marginLeft: 6,
  fontSize: 11,
  color: '#555',
  background: '#f2f2f2',
  border: '1px solid #e2e2e2',
  borderRadius: 10,
  padding: '1px 8px',
};

const listStyle: React.CSSProperties = { listStyle: 'none', margin: 0, padding: 0 };

const calloutStyle: React.CSSProperties = {
  border: '1px solid #e2e2e2',
  borderLeft: '3px solid #999',
  borderRadius: 4,
  background: '#fafafa',
  padding: '8px 10px',
  margin: '0 0 12px',
  color: '#333',
};

const noticeStyle: React.CSSProperties = { ...calloutStyle, marginTop: 12, marginBottom: 0 };

const footerStyle: React.CSSProperties = {
  marginTop: 20,
  paddingTop: 12,
  borderTop: '1px solid #e2e2e2',
  color: '#666',
  fontSize: 12,
};

const footerListStyle: React.CSSProperties = { margin: 0, paddingLeft: 16 };

const SOURCE_NOTE: Record<ChartContext['source'], string> = {
  'entity-api': "Read directly from the EHR's medication and problem lists.",
  'chart-open-event':
    'Read from the chart-open event because the direct entity read was unavailable, so it may be less current.',
};

function counts(medicationCount: number, problemCount: number): string {
  const meds = `${medicationCount} medication${medicationCount === 1 ? '' : 's'}`;
  const problems = `${problemCount} active problem${problemCount === 1 ? '' : 's'}`;
  return `${meds} · ${problems}`;
}

export function ReconciliationPanel({
  result,
  context,
  openedFromNotification,
}: {
  result: ReconciliationResult;
  context: ChartContext;
  /** True only when a Worker notification for THIS patient opened the panel. */
  openedFromNotification: boolean;
}) {
  const medicationCount = result.kind === 'no_medications' ? 0 : result.medicationCount;

  return (
    <main style={pageStyle}>
      <h1 style={headingStyle}>Medication reconciliation</h1>
      {/* The counts are the one thing here the chart asserts about this
          patient. Everything below is inferred from the bundled vocabulary,
          which describes populations — hence the different label. */}
      <p style={countsStyle}>
        {counts(medicationCount, result.problemCount)}
        <span style={chartStatedStyle}>{describeEvidence('chart_stated')}</span>
      </p>

      {openedFromNotification && <p style={calloutStyle}>Opened from a Hub notification for this patient.</p>}

      {result.kind === 'no_medications' && (
        <p style={calloutStyle}>
          No medications on this chart&rsquo;s list. There is nothing to compare against the problem list.
        </p>
      )}

      {result.kind === 'nothing_to_reconcile' && (
        <p style={calloutStyle}>
          Nothing to reconcile. Every medication this app could read resolved to a class matching an active problem,
          and no class appears twice.
        </p>
      )}

      {result.kind === 'findings' && (
        <ul style={listStyle}>
          {result.findings.map((finding, index) => (
            <FindingCard key={`${finding.kind}-${index}`} finding={finding} />
          ))}
        </ul>
      )}

      {result.kind !== 'no_medications' && <ExcludedList excluded={result.excluded} />}

      {result.kind !== 'no_medications' && result.unmappedProblemSuppression && (
        <p style={noticeStyle}>
          At least one active problem is outside this app&rsquo;s vocabulary, so &ldquo;no problem on the list matching
          this medication&rdquo; was not evaluated for this chart. A problem we cannot map is not evidence that a
          medication is unmatched.
        </p>
      )}

      <footer style={footerStyle}>
        <ul style={footerListStyle}>
          <li>{SOURCE_NOTE[context.source]}</li>
          <li>
            The SDK does not expose medication status, so this list may include entries that have been discontinued in
            the chart.
          </li>
          <li>
            Dispense and fill history is not connected. This compares the chart&rsquo;s two lists with each other, not
            with what the patient is actually filling.
          </li>
          <li>
            This app&rsquo;s drug vocabulary is partial. It does not check drug interactions, dosing, renal adjustment,
            or allergies.
          </li>
        </ul>
      </footer>
    </main>
  );
}

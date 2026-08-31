import { describeExclusion } from '@/lib/med-rec/presentation';
import type { ExcludedMedication, ExclusionReason } from '@/lib/med-rec/types';

const sectionStyle: React.CSSProperties = { marginTop: 16 };

const headingStyle: React.CSSProperties = {
  fontSize: 12,
  fontWeight: 600,
  textTransform: 'uppercase',
  letterSpacing: 0.4,
  color: '#666',
  margin: '0 0 6px',
};

const groupStyle: React.CSSProperties = { margin: '0 0 8px' };

const reasonStyle: React.CSSProperties = { color: '#666', margin: '0 0 2px' };

const listStyle: React.CSSProperties = { margin: 0, paddingLeft: 18, color: '#333' };

const REASON_ORDER: ExclusionReason[] = ['unrecognized', 'insufficient_data'];

/** Best available identifier for a medication we could not name. */
function labelFor(record: ExcludedMedication['record']): string {
  if (record.rawName !== null && record.rawName.trim() !== '') return record.rawName;
  const parts = [record.ndcCode ? `NDC ${record.ndcCode}` : null, record.strength, record.form].filter(
    (part): part is string => Boolean(part),
  );
  return parts.length > 0 ? parts.join(' · ') : 'Unnamed record';
}

/**
 * Medications the app could not evaluate. Rendered as its own section, never
 * folded into the findings and never silently dropped: a provider has to be
 * able to tell "nothing to reconcile here" from "we couldn't look at this one".
 */
export function ExcludedList({ excluded }: { excluded: ExcludedMedication[] }) {
  if (excluded.length === 0) return null;

  return (
    <section style={sectionStyle}>
      <h2 style={headingStyle}>Not analyzed</h2>
      {REASON_ORDER.map((reason) => {
        const members = excluded.filter((item) => item.reason === reason);
        if (members.length === 0) return null;
        return (
          <div key={reason} style={groupStyle}>
            <p style={reasonStyle}>
              {describeExclusion(reason)} ({members.length})
            </p>
            <ul style={listStyle}>
              {members.map((item) => (
                <li key={item.record.id}>{labelFor(item.record)}</li>
              ))}
            </ul>
          </div>
        );
      })}
    </section>
  );
}

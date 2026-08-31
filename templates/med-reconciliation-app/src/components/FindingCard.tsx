import { describeEvidence, describeFinding } from '@/lib/med-rec/presentation';
import type { Finding } from '@/lib/med-rec/types';

const cardStyle: React.CSSProperties = {
  border: '1px solid #e2e2e2',
  borderRadius: 6,
  padding: '10px 12px',
  marginBottom: 8,
  background: '#fff',
};

const titleStyle: React.CSSProperties = { fontSize: 14, fontWeight: 600, margin: '0 0 4px' };

const detailStyle: React.CSSProperties = { margin: '0 0 8px', color: '#333' };

const evidenceStyle: React.CSSProperties = {
  display: 'inline-block',
  fontSize: 11,
  color: '#555',
  background: '#f2f2f2',
  border: '1px solid #e2e2e2',
  borderRadius: 10,
  padding: '1px 8px',
};

export function FindingCard({ finding }: { finding: Finding }) {
  const copy = describeFinding(finding);
  return (
    <li style={cardStyle}>
      {/* The title states what the two lists show. It is never the clinical
          conclusion that might follow from it — see presentation.ts. */}
      <h3 style={titleStyle}>{copy.title}</h3>
      <p style={detailStyle}>{copy.detail}</p>
      <span style={evidenceStyle}>{describeEvidence(finding.evidence)}</span>
    </li>
  );
}

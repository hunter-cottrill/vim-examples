'use client';

import { useReducer, useState } from 'react';
import { writebackTransition } from '@/lib/sdoh/writeback-state';
import type { SdohInsight, ZCode } from '@/lib/sdoh/types';
import type { WritebackOutcome } from '@/lib/sdoh/writeback-state';

const cardStyle: React.CSSProperties = {
  border: '1px solid #e2e2e2',
  borderRadius: 8,
  padding: 16,
  marginBottom: 12,
};

const evidenceStrengthBadge = (strength: SdohInsight['evidenceStrength']): React.CSSProperties => ({
  display: 'inline-block',
  fontSize: 12,
  fontWeight: 600,
  padding: '2px 8px',
  borderRadius: 4,
  marginLeft: 8,
  color: strength === 'confirmed' ? '#0a5c2b' : '#7a5c00',
  background: strength === 'confirmed' ? '#e5f5ea' : '#fdf3d8',
});

export interface InsightCardProps {
  insight: SdohInsight;
  onWriteback: (codes: ZCode[]) => Promise<WritebackOutcome>;
}

export function InsightCard({ insight, onWriteback }: InsightCardProps) {
  const [selected, setSelected] = useState<Set<string>>(new Set(insight.suggestedZCodes.map((c) => c.code)));
  const [writeback, dispatch] = useReducer(writebackTransition, { status: 'idle' as const });

  const toggle = (code: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(code)) next.delete(code);
      else next.add(code);
      return next;
    });
  };

  const submit = async () => {
    dispatch({ type: 'SUBMIT' });
    const chosen = insight.suggestedZCodes.filter((c) => selected.has(c.code));
    const outcome = await onWriteback(chosen);
    dispatch({ type: 'RESULT', outcome });
  };

  return (
    <div style={cardStyle}>
      <h3 style={{ margin: 0, fontSize: 16 }}>
        {insight.title}
        <span style={evidenceStrengthBadge(insight.evidenceStrength)}>
          {insight.evidenceStrength === 'confirmed' ? 'Confirmed' : 'Suspected'}
        </span>
      </h3>
      <ul style={{ margin: '8px 0', paddingLeft: 20, color: '#444' }}>
        {insight.evidence.map((line, i) => (
          <li key={i}>{line}</li>
        ))}
      </ul>
      {insight.resource && (
        <p style={{ margin: '8px 0', fontSize: 14, color: '#333' }}>
          <strong>Point to help:</strong> {insight.resource.label} — {insight.resource.contact}
        </p>
      )}

      {insight.alreadyDocumented && <p style={{ margin: '8px 0', color: '#666', fontSize: 14 }}>Already documented on the chart.</p>}

      {!insight.alreadyDocumented && insight.suggestedZCodes.length > 0 && (
        <div style={{ marginTop: 12 }}>
          {insight.suggestedZCodes.map((zCode) => (
            <label key={zCode.code} style={{ display: 'block', fontSize: 14, marginBottom: 4 }}>
              <input
                type="checkbox"
                checked={selected.has(zCode.code)}
                onChange={() => toggle(zCode.code)}
                disabled={writeback.status === 'submitting' || writeback.status === 'success'}
              />{' '}
              {zCode.code} — {zCode.description}
            </label>
          ))}

          {writeback.status === 'idle' && (
            <button onClick={submit} disabled={selected.size === 0} style={{ marginTop: 8 }}>
              Add to encounter
            </button>
          )}
          {writeback.status === 'submitting' && <p style={{ color: '#666', fontSize: 14 }}>Adding…</p>}
          {writeback.status === 'success' && <p style={{ color: '#0a5c2b', fontSize: 14 }}>Added to encounter.</p>}
          {writeback.status === 'denied' && <p style={{ color: '#b00020', fontSize: 14 }}>Permission denied — not added.</p>}
          {writeback.status === 'not_configured' && (
            <p style={{ color: '#7a5c00', fontSize: 14 }}>
              This EHR isn&apos;t configured for chart writeback — codes shown above for reference only.
            </p>
          )}
          {writeback.status === 'error' && (
            <p style={{ color: '#b00020', fontSize: 14 }}>Something went wrong{writeback.detail ? `: ${writeback.detail}` : '.'}</p>
          )}
        </div>
      )}
    </div>
  );
}
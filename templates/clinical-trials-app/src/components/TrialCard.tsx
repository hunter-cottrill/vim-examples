'use client';

import type { TrialMatch } from '@/lib/trial-match/types';

const cardStyle: React.CSSProperties = {
  border: '1px solid #e2e2e2',
  borderRadius: 8,
  padding: 12,
  marginBottom: 10,
};

function formatDistance(distanceMiles: number | null): string {
  if (distanceMiles === null) return 'Distance unavailable';
  return `~${Math.round(distanceMiles)} mi (estimated from ZIP)`;
}

export function TrialCard({ trial }: { trial: TrialMatch }) {
  return (
    <div style={cardStyle}>
      <p style={{ margin: '0 0 4px', fontWeight: 600 }}>{trial.briefTitle}</p>
      <p style={{ margin: '0 0 4px', fontSize: 13, color: '#666' }}>
        {trial.nctId} · {trial.overallStatus}
      </p>
      {trial.nearestFacility && (
        <p style={{ margin: '0 0 4px', fontSize: 13 }}>
          {trial.nearestFacility}
          {trial.nearestCity ? `, ${trial.nearestCity}` : ''}
          {trial.nearestState ? `, ${trial.nearestState}` : ''}
        </p>
      )}
      <p style={{ margin: 0, fontSize: 13, color: '#666' }}>{formatDistance(trial.distanceMiles)}</p>
    </div>
  );
}

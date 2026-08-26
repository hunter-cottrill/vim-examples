'use client';

import { InsightCard } from './InsightCard';
import type { SdohEvaluation, ZCode } from '@/lib/sdoh/types';
import type { WritebackOutcome } from '@/lib/sdoh/writeback-state';

export interface SdohPanelProps {
  evaluation: SdohEvaluation;
  onWriteback: (codes: ZCode[]) => Promise<WritebackOutcome>;
}

export function SdohPanel({ evaluation, onWriteback }: SdohPanelProps) {
  if (evaluation.insights.length === 0) {
    return (
      <p style={{ color: '#666' }}>
        {evaluation.dataCompleteness === 'full'
          ? 'No social needs detected.'
          : "No social needs detected — but we couldn't fully screen this patient (some address, insurance, or language data was unavailable)."}
      </p>
    );
  }

  return (
    <div>
      {evaluation.insights.map((insight) => (
        <InsightCard key={insight.id} insight={insight} onWriteback={onWriteback} />
      ))}
    </div>
  );
}
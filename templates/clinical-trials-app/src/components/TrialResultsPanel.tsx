'use client';

import { CONDITION_LABELS } from '@/lib/trial-match/condition-crosswalk';
import type { ConditionMatch, ReadyResult } from '@/lib/trial-match/types';
import { TrialCard } from './TrialCard';

const mutedStyle: React.CSSProperties = { color: '#666', fontSize: 14 };
const disclaimerStyle: React.CSSProperties = {
  fontSize: 12,
  color: '#666',
  margin: '0 0 12px',
  padding: '8px 10px',
  background: '#f5f5f5',
  borderRadius: 6,
};

function conditionLabel(match: ConditionMatch): string {
  if (match.confidence === 'high' && match.conditionKey) {
    return CONDITION_LABELS[match.conditionKey] ?? match.conditionKey;
  }
  return match.diagnosis.description || match.diagnosis.code;
}

function UnresolvedConditionsList({ conditionMatches }: { conditionMatches: ConditionMatch[] }) {
  const unresolved = conditionMatches.filter((c) => c.confidence !== 'high');
  if (unresolved.length === 0) return null;
  return (
    <ul style={{ ...mutedStyle, margin: '8px 0 0', paddingLeft: 18 }}>
      {unresolved.map((c, i) => (
        <li key={i}>
          {conditionLabel(c)} — {c.confidence === 'ambiguous' ? 'could map to more than one category' : "couldn't be classified"}
        </li>
      ))}
    </ul>
  );
}

export function TrialResultsPanel({ result }: { result: ReadyResult }) {
  switch (result.kind) {
    case 'no_problems':
      return <p style={mutedStyle}>No active problems are documented for this patient — nothing to match against clinical trials.</p>;

    case 'no_resolvable_conditions':
      return (
        <div>
          <p style={mutedStyle}>
            We couldn&apos;t confidently identify a trial-relevant condition from this patient&apos;s documented
            problems.
          </p>
          <UnresolvedConditionsList conditionMatches={result.conditionMatches} />
        </div>
      );

    case 'no_trials_found':
      return (
        <div>
          <p style={mutedStyle}>
            No recruiting trials were found near this patient for:{' '}
            {result.conditionMatches
              .filter((c) => c.confidence === 'high')
              .map(conditionLabel)
              .join(', ')}
            .
          </p>
          {result.zipMatch.confidence === 'none' && (
            <p style={mutedStyle}>ZIP code not recognized — search was not limited by distance.</p>
          )}
        </div>
      );

    case 'matches_found':
      return (
        <div>
          <p style={disclaimerStyle}>
            Potential matches, not a clinical determination. Distance is estimated from ZIP code, not an exact
            address.
          </p>
          {result.zipMatch.confidence === 'none' && (
            <p style={mutedStyle}>ZIP code not recognized — distance is unavailable for these results.</p>
          )}
          {result.trials.map((trial) => (
            <TrialCard key={trial.nctId} trial={trial} />
          ))}
          {result.truncated && (
            <p style={mutedStyle}>Showing the {result.trials.length} nearest matches; more were found.</p>
          )}
          <UnresolvedConditionsList conditionMatches={result.conditionMatches} />
        </div>
      );
  }
}

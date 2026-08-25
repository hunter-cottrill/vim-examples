'use client';

import { useState } from 'react';
import type { NudgeSuggestion } from '@/lib/referral-engine';
import type { WritebackOutcome } from '@/lib/vim-client';

type EconsultSuggestion = Extract<NudgeSuggestion, { kind: 'econsult_candidate' }>;
type InNetworkSuggestion = Extract<NudgeSuggestion, { kind: 'in_network_alternative' }>;

export type EconsultRequestOutcome = { ok: true; requestId: string } | { ok: false; detail?: string };

// Human-in-the-loop display. "Add note to referral" and "Request e-consult
// instead" are the only writeback/action surfaces (see PLAN.md Steps 4-5) —
// notes-only for EHR writeback, no structured targetProvider writeback.
export function ReferralNudgePanel({
  suggestions,
  loading,
  onWriteNote,
  onRequestEconsult,
}: {
  suggestions: NudgeSuggestion[];
  loading?: boolean;
  onWriteNote: (note: string) => Promise<WritebackOutcome>;
  onRequestEconsult: (suggestion: EconsultSuggestion) => Promise<EconsultRequestOutcome>;
}) {
  if (loading) {
    return <p style={{ color: '#666' }}>Checking in-network alternatives…</p>;
  }
  if (suggestions.length === 0) {
    return <p style={{ color: '#666' }}>No nudge for this referral.</p>;
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      {suggestions.map((suggestion, i) => (
        <SuggestionCard key={i} suggestion={suggestion} onRequestEconsult={onRequestEconsult} />
      ))}
      <WriteNoteButton suggestions={suggestions} onWriteNote={onWriteNote} />
    </div>
  );
}

function SuggestionCard({
  suggestion,
  onRequestEconsult,
}: {
  suggestion: NudgeSuggestion;
  onRequestEconsult: (suggestion: EconsultSuggestion) => Promise<EconsultRequestOutcome>;
}) {
  if (suggestion.kind === 'econsult_candidate') {
    return <EconsultCard suggestion={suggestion} onRequestEconsult={onRequestEconsult} />;
  }
  return <InNetworkCard suggestion={suggestion} />;
}

function EconsultCard({
  suggestion,
  onRequestEconsult,
}: {
  suggestion: EconsultSuggestion;
  onRequestEconsult: (suggestion: EconsultSuggestion) => Promise<EconsultRequestOutcome>;
}) {
  const [status, setStatus] = useState('');
  const [requesting, setRequesting] = useState(false);

  async function request() {
    setRequesting(true);
    try {
      const outcome = await onRequestEconsult(suggestion);
      setStatus(
        outcome.ok
          ? `E-consult requested (id: ${outcome.requestId}).`
          : `Could not request e-consult${outcome.detail ? `: ${outcome.detail}` : '.'}`,
      );
    } finally {
      setRequesting(false);
    }
  }

  return (
    <section style={{ border: '1px solid #e2e2e2', borderRadius: 8, padding: 12 }}>
      <strong>Consider an e-consult</strong>
      <p style={{ fontSize: 13, color: '#444', margin: '6px 0' }}>{suggestion.reason}</p>
      <button disabled={requesting} onClick={request}>
        {requesting ? 'Requesting…' : 'Request e-consult instead'}
      </button>
      {status && <p style={{ fontSize: 12, color: '#666', marginTop: 6 }}>{status}</p>}
    </section>
  );
}

function InNetworkCard({ suggestion }: { suggestion: InNetworkSuggestion }) {
  const { provider } = suggestion;
  return (
    <section style={{ border: '1px solid #e2e2e2', borderRadius: 8, padding: 12 }}>
      <strong>In-network alternative available</strong>
      <p style={{ fontSize: 13, color: '#444', margin: '6px 0' }}>
        Dr. {provider.firstName} {provider.lastName} — {provider.specialty}, value tier {provider.valueTier},{' '}
        {provider.distanceMinutes} min away.
      </p>
      <p style={{ fontSize: 13, color: '#444', margin: '6px 0' }}>{suggestion.reason}</p>
    </section>
  );
}

function buildNoteText(suggestions: NudgeSuggestion[]): string {
  const lines = suggestions.map((s) => `- ${s.reason}`);
  return `Referral guidance suggestions:\n${lines.join('\n')}`;
}

function WriteNoteButton({
  suggestions,
  onWriteNote,
}: {
  suggestions: NudgeSuggestion[];
  onWriteNote: (note: string) => Promise<WritebackOutcome>;
}) {
  const [status, setStatus] = useState('');
  const [writing, setWriting] = useState(false);

  async function write() {
    setWriting(true);
    try {
      const outcome = await onWriteNote(buildNoteText(suggestions));
      setStatus(
        outcome.ok
          ? 'Added to referral.'
          : `Not added: ${outcome.reason}${outcome.detail ? ` — ${outcome.detail}` : ''}`,
      );
    } finally {
      setWriting(false);
    }
  }

  return (
    <div>
      <button disabled={writing} onClick={write}>
        {writing ? 'Adding…' : 'Add note to referral'}
      </button>
      {status && <p style={{ fontSize: 12, color: '#666', marginTop: 6 }}>{status}</p>}
    </div>
  );
}
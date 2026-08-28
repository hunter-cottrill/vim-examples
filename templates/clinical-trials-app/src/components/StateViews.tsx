'use client';

import type { ErrorReason } from '@/lib/app-state';

const pageStyle: React.CSSProperties = { padding: 16, fontFamily: 'system-ui, -apple-system, sans-serif' };

export function ConnectingView() {
  return <div style={pageStyle}>Connecting to Vim…</div>;
}

export function WaitingView({ text }: { text: string }) {
  return <div style={pageStyle}>{text}</div>;
}

const ERROR_MESSAGES: Record<ErrorReason, string> = {
  sdk_init_failed: "Couldn't connect to Vim.",
  patient_fetch_failed: "Couldn't read this patient's data after several attempts.",
  trial_search_failed: "Couldn't reach ClinicalTrials.gov after several attempts.",
};

export function ErrorView({ reason }: { reason: ErrorReason }) {
  return (
    <div style={pageStyle}>
      <p style={{ color: '#b00020', margin: '0 0 8px' }}>{ERROR_MESSAGES[reason]}</p>
      <p style={{ color: '#666', fontSize: 14, margin: 0 }}>Reopen the chart to try again.</p>
    </div>
  );
}

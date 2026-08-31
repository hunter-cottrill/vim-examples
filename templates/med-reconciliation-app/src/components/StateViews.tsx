import type { ErrorReason } from '@/lib/app-state';

const pageStyle: React.CSSProperties = {
  padding: 16,
  maxWidth: 520,
  color: '#111',
  fontFamily: 'system-ui, -apple-system, sans-serif',
  fontSize: 14,
  lineHeight: 1.5,
};

const mutedStyle: React.CSSProperties = { color: '#666', margin: 0 };

const errorTitleStyle: React.CSSProperties = { fontSize: 15, fontWeight: 600, margin: '0 0 6px', color: '#b00020' };

const ERROR_MESSAGES: Record<ErrorReason, string> = {
  sdk_init_failed: "Couldn't connect to Vim.",
  chart_load_failed: "Couldn't read this chart's medication and problem lists after several attempts.",
};

export function ConnectingView() {
  return (
    <main style={pageStyle}>
      <p style={mutedStyle}>Connecting to Vim…</p>
    </main>
  );
}

export function WaitingView({ text }: { text: string }) {
  return (
    <main style={pageStyle}>
      <p style={mutedStyle}>{text}</p>
    </main>
  );
}

export function ErrorView({ reason }: { reason: ErrorReason }) {
  return (
    <main style={pageStyle}>
      <p style={errorTitleStyle}>{ERROR_MESSAGES[reason]}</p>
      <p style={mutedStyle}>
        Nothing is shown rather than a partial list — an incomplete medication list would be worse than none.
      </p>
    </main>
  );
}

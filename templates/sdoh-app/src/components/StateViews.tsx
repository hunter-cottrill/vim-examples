'use client';

const pageStyle: React.CSSProperties = { padding: 16, fontFamily: 'system-ui, -apple-system, sans-serif' };

export function ConnectingView() {
  return <div style={pageStyle}>Connecting to Vim…</div>;
}

export function WaitingView({ text }: { text: string }) {
  return <div style={pageStyle}>{text}</div>;
}

export function ErrorView({ message, retryable }: { message: string; retryable: boolean }) {
  return (
    <div style={pageStyle}>
      <p style={{ color: '#b00020' }}>Error: {message}</p>
      {retryable && <p style={{ color: '#666', fontSize: 14 }}>Reopen the chart to try again.</p>}
    </div>
  );
}

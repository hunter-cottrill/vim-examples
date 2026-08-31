import type { Metadata } from 'next';
import { buildClientConfig } from '@/lib/client-config';

// force-dynamic so buildClientConfig() reads process.env at request time.
export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Medication Reconciliation',
  description:
    "Shows where the chart's medication list and problem list disagree, so the provider can reconcile them in the EHR",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  const config = buildClientConfig();
  return (
    <html lang="en">
      <body style={{ margin: 0, fontFamily: 'system-ui, -apple-system, sans-serif' }}>
        {/* Inject runtime config for client components (no user input). */}
        <script dangerouslySetInnerHTML={{ __html: `window.__CONFIG__ = ${JSON.stringify(config)}` }} />
        {children}
      </body>
    </html>
  );
}

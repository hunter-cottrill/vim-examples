import type { Metadata } from 'next';
import { buildClientConfig } from '@/lib/client-config';
import './vim-tokens.css';
import './learning.css';

// force-dynamic so buildClientConfig() reads process.env at request time.
export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Vim SDK Learning Starter',
  description: 'Learn the Vim App SDK one building block at a time',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  const config = buildClientConfig();
  return (
    <html lang="en">
      <body>
        {/* Inject runtime config for client components (no user input). */}
        <script dangerouslySetInnerHTML={{ __html: `window.__CONFIG__ = ${JSON.stringify(config)}` }} />
        {children}
      </body>
    </html>
  );
}

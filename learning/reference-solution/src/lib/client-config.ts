// Explicit allowlist — only values that need to reach the client bundle.
// buildClientConfig() runs server-side (layout.tsx) so process.env is read at
// request time, not baked in at build time.

export interface ClientConfig {
  clientId: string;
  env: 'local' | 'staging' | 'production';
}

declare global {
  interface Window {
    __CONFIG__?: ClientConfig;
  }
}

const VALID_ENVS = ['local', 'staging', 'production'] as const;

export function buildClientConfig(): ClientConfig {
  // The simulator never authenticates, so it doesn't need credentials. This lets
  // a first run work before anyone has a Vim account.
  const simMode = process.env.NEXT_PUBLIC_SIM_MODE === 'true';
  if (!process.env.CLIENT_ID && !simMode) {
    throw new Error(
      'CLIENT_ID is required. Copy .env.local.example to .env.local and add your credentials, ' +
        'or set NEXT_PUBLIC_SIM_MODE=true to run against sample data without an account.',
    );
  }
  const env = process.env.APP_ENV ?? 'staging';
  if (!(VALID_ENVS as readonly string[]).includes(env)) {
    throw new Error(`Invalid APP_ENV: ${env}. Must be one of: local, staging, production`);
  }
  return { clientId: process.env.CLIENT_ID ?? 'sim-mode', env: env as ClientConfig['env'] };
}

// SSR-safe accessor. Server: reads process.env. Client: reads window.__CONFIG__.
export function getConfig(): ClientConfig {
  if (typeof window === 'undefined') return buildClientConfig();
  const config = window.__CONFIG__;
  if (!config) throw new Error('window.__CONFIG__ is not injected — ensure layout.tsx uses force-dynamic');
  return config;
}

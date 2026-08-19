/**
 * Server configuration. Reads secrets from env at request time and validates once.
 * CLIENT_SECRET stays server-side and must never reach the client bundle.
 */
import { VIM_BACKEND_URLS, APP_URLS } from './url-constants';

export interface ServerConfig {
  env: 'local' | 'staging' | 'production';
  clientId: string;
  clientSecret: string;
  vimBackendUrl: string;
  appUrl: string;
}

export class ConfigError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ConfigError';
  }
}

function validateEnv(): 'local' | 'staging' | 'production' {
  const env = process.env.APP_ENV ?? 'staging';
  if (!['local', 'staging', 'production'].includes(env)) {
    throw new ConfigError(`APP_ENV must be one of: local, staging, production. Got: ${env}`);
  }
  return env as 'local' | 'staging' | 'production';
}

export function getServerConfig(): ServerConfig {
  const env = validateEnv();
  const clientId = process.env.CLIENT_ID;
  if (!clientId) throw new ConfigError('CLIENT_ID is required (set it in .env.local)');
  const clientSecret = process.env.CLIENT_SECRET;
  if (!clientSecret) throw new ConfigError('CLIENT_SECRET is required (set it in .env.local)');

  return {
    env,
    clientId,
    clientSecret,
    vimBackendUrl: process.env.NEXT_PUBLIC_VIM_BACKEND_URL ?? VIM_BACKEND_URLS[env],
    appUrl: process.env.NEXT_PUBLIC_APP_URL ?? APP_URLS[env],
  };
}

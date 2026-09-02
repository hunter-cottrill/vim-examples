/**
 * SDK configuration — resolves the Vim backend URL and this app's URL from the
 * environment. Values come from window.__CONFIG__ (injected by layout.tsx) so
 * runtime env vars take effect rather than build-time constants.
 */
import { getConfig } from './client-config';
import { VIM_BACKEND_URLS, APP_URLS } from './url-constants';

export function getEnvironment(): 'local' | 'staging' | 'production' {
  return getConfig().env;
}

export function getVimBackendUrl(): string {
  if (process.env.NEXT_PUBLIC_VIM_BACKEND_URL) return process.env.NEXT_PUBLIC_VIM_BACKEND_URL;
  return VIM_BACKEND_URLS[getEnvironment()];
}

export function getAppUrl(): string {
  if (process.env.NEXT_PUBLIC_APP_URL) return process.env.NEXT_PUBLIC_APP_URL;
  if (typeof window !== 'undefined') return window.location.origin;
  return APP_URLS[getEnvironment()];
}

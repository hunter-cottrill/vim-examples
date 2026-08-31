'use client';

/**
 * The app's ONE OAuth implementation, shared by both surfaces.
 *
 * The UI surface is launched at /launch and lands back on /app; the Worker
 * surface is launched at /offscreen and lands back on the same path. Both run
 * the identical launch_id -> authorize -> code -> /token sequence, differing
 * only in redirect_uri. Keeping it in one place is deliberate: cds-app grew a
 * second, divergent copy inside its Worker page that read different env vars
 * and destructured `accessToken` from a response that returns `access_token`.
 */
import { getConfig } from './client-config';
import { getAppUrl, getVimBackendUrl } from './sdk-config';

export interface LaunchTokens {
  accessToken: string;
  /**
   * The Vim-issued OIDC token. The UI surface does not need it (initVimSDK
   * captures it from the token_endpoint flow itself), but Worker Apps have no
   * token_endpoint URL to harvest from and must be handed it explicitly.
   */
  idToken?: string;
}

function stateKey(launchId: string): string {
  return `oauth_state_${launchId}`;
}

/**
 * Mint a CSRF token keyed by the launch id and hand off to Vim's authorize
 * endpoint. Redirects the browser — nothing after this call runs.
 */
export function beginLaunch(launchId: string, redirectPath: string): void {
  const csrfToken = crypto.randomUUID();
  sessionStorage.setItem(stateKey(launchId), csrfToken);

  const authorizeUrl = new URL('/app-auth/authorize', getVimBackendUrl());
  authorizeUrl.searchParams.set('response_type', 'code');
  authorizeUrl.searchParams.set('client_id', getConfig().clientId);
  authorizeUrl.searchParams.set('launch', launchId);
  authorizeUrl.searchParams.set('scope', 'launch openid');
  authorizeUrl.searchParams.set('redirect_uri', `${getAppUrl()}${redirectPath}`);
  authorizeUrl.searchParams.set('state', `${launchId}:${csrfToken}`);

  window.location.href = authorizeUrl.toString();
}

/**
 * Validate the returned state against the CSRF token we stored, then exchange
 * the code for tokens server-side (CLIENT_SECRET never reaches the browser).
 */
export async function completeLaunch(code: string, stateParam: string): Promise<LaunchTokens> {
  const [launchId, csrfToken] = stateParam.split(':');
  const stored = sessionStorage.getItem(stateKey(launchId));
  if (!stored || stored !== csrfToken) throw new Error('CSRF validation failed');
  sessionStorage.removeItem(stateKey(launchId));

  const response = await fetch('/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ code }),
  });
  if (!response.ok) throw new Error(`Token exchange failed: ${await response.text()}`);

  const tokens = await response.json();
  if (!tokens.access_token) throw new Error('No access_token in token response');

  return { accessToken: tokens.access_token, idToken: tokens.id_token };
}

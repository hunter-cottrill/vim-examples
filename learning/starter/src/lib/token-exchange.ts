import { NextRequest, NextResponse } from 'next/server';
import { getServerConfig } from '@/lib/config';

/**
 * Exchange an OAuth authorization code for an access token via the Vim backend.
 * Served at BOTH `/token` (the SDK's default) and `/api/auth/token` (legacy).
 * Acts as a secure proxy so CLIENT_SECRET stays server-side.
 */
export async function exchangeAuthCode(request: NextRequest): Promise<NextResponse> {
  try {
    const { code } = await request.json();
    if (!code) return NextResponse.json({ error: 'Missing authorization code' }, { status: 400 });

    const { clientId, clientSecret, vimBackendUrl } = getServerConfig();

    const tokenResponse = await fetch(`${vimBackendUrl}/app-auth/token`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        grant_type: 'authorization_code',
        code,
        client_id: clientId,
        client_secret: clientSecret,
      }),
    });

    if (!tokenResponse.ok) {
      const errorData = await tokenResponse.json().catch(() => ({}));
      return NextResponse.json(
        {
          error: errorData.error || 'token_exchange_failed',
          error_description: errorData.error_description || 'Failed to exchange code for token',
        },
        { status: tokenResponse.status },
      );
    }

    const tokenData = await tokenResponse.json();
    return NextResponse.json({
      access_token: tokenData.access_token,
      token_type: tokenData.token_type || 'Bearer',
      expires_in: tokenData.expires_in,
      scope: tokenData.scope,
    });
  } catch (error) {
    console.error('Token exchange error:', error);
    return NextResponse.json(
      { error: 'internal_server_error', error_description: 'An unexpected error occurred' },
      { status: 500 },
    );
  }
}

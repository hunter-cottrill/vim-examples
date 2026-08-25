import { NextRequest, NextResponse } from 'next/server';
import { matchNetwork } from '@/lib/network-directory';

interface MatchRequestBody {
  specialty?: string;
  insuranceNetworkId?: string;
  excludeNpi?: string;
}

/**
 * POST /api/network/match — looks up in-network alternatives from the bundled
 * sample directory. This is the "bring-your-own-backend" boundary the use case
 * calls out: the SDK has no provider-network concept at all (see PLAN.md Section 6).
 * A thin wrapper around the already-tested pure network-directory.ts.
 */
export async function POST(request: NextRequest) {
  const body: MatchRequestBody = await request.json().catch(() => ({}));

  if (!body.specialty) {
    return NextResponse.json({ error: 'Missing required field: specialty' }, { status: 400 });
  }
  if (!body.insuranceNetworkId) {
    return NextResponse.json({ matches: [] });
  }

  const matches = matchNetwork(body.specialty, body.insuranceNetworkId, body.excludeNpi);
  return NextResponse.json({ matches });
}
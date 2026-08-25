import type { NextRequest } from 'next/server';
import { exchangeAuthCode } from '@/lib/token-exchange';

// POST /api/auth/token — legacy alias kept so apps whose registered
// token_endpoint still points here keep working after the move to /token.
export function POST(request: NextRequest) {
  return exchangeAuthCode(request);
}

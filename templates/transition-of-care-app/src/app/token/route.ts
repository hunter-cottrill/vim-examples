import type { NextRequest } from 'next/server';
import { exchangeAuthCode } from '@/lib/token-exchange';

// POST /token — the SDK's default token-exchange path.
export function POST(request: NextRequest) {
  return exchangeAuthCode(request);
}
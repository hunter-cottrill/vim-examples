import type { NextRequest } from 'next/server';
import { exchangeAuthCode } from '@/lib/token-exchange';

// POST /api/auth/token — legacy path; kept so apps registered against it keep working.
export function POST(request: NextRequest) {
  return exchangeAuthCode(request);
}

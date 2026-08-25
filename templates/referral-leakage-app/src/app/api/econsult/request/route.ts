import { NextRequest, NextResponse } from 'next/server';

interface EconsultRequestBody {
  specialty?: string;
  condition?: { icd10Prefix?: string; description?: string };
}

/**
 * POST /api/econsult/request — simulated e-consult case creation. Entirely
 * app-owned; the SDK has no e-consult/specialist-routing concept at all
 * (see PLAN.md Section 6).
 */
export async function POST(request: NextRequest) {
  const body: EconsultRequestBody = await request.json().catch(() => ({}));

  if (!body.specialty || !body.condition?.description) {
    return NextResponse.json({ error: 'Missing required field: specialty and condition' }, { status: 400 });
  }

  return NextResponse.json({
    requestId: crypto.randomUUID(),
    status: 'submitted',
    specialty: body.specialty,
    condition: body.condition,
  });
}
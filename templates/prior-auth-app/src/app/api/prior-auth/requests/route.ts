import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { lookupRule } from '@/lib/priorAuth/rules';
import type { PriorAuthJob, PriorAuthSubmissionRequest, PriorAuthSubmissionResponse } from '@/lib/priorAuth/types';
import { saveJob } from '@/lib/server/priorAuthJobStore';

/**
 * Simulates a payer/clearinghouse adjudication — the app's own backend
 * stands in for a real integration (e.g. a real X12 278 submission). The
 * outcome and delay are deterministic, precomputed here from the same
 * bundled rules table the UI used to decide auth was required, never trusted
 * from the client. See build plan §6.
 */
function generateAuthNumber(): string {
  return `PA-${crypto.randomUUID().replace(/-/g, '').slice(0, 8).toUpperCase()}`;
}

export async function POST(request: NextRequest) {
  const body = (await request.json()) as Partial<PriorAuthSubmissionRequest>;
  if (!body.ehrOrderId || !body.payerId || !body.cpt) {
    return NextResponse.json({ error: 'ehrOrderId, payerId, and cpt are required.' }, { status: 400 });
  }

  const rule = lookupRule(body.payerId, body.cpt);
  if (!rule || rule.requirement !== 'required') {
    return NextResponse.json({ error: 'No required prior-auth rule matches this payer and procedure.' }, { status: 400 });
  }

  const createdAt = Date.now();
  const requestId = crypto.randomUUID();
  const job: PriorAuthJob = {
    requestId,
    ehrOrderId: body.ehrOrderId,
    ehrEncounterId: body.ehrEncounterId,
    payerId: body.payerId,
    cpt: body.cpt,
    createdAt,
    resolvesAt: createdAt + rule.simulatedDelayMs,
    resolution:
      rule.simulatedOutcome === 'approved'
        ? { status: 'approved', authNumber: generateAuthNumber() }
        : { status: 'denied', denialReason: rule.simulatedDenialReason ?? 'This request was denied.' },
  };
  saveJob(job);

  const response: PriorAuthSubmissionResponse = { requestId, status: 'pending' };
  return NextResponse.json(response);
}

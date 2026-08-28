import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { computeJobStatus } from '@/lib/priorAuth/jobResolution';
import { getJob } from '@/lib/server/priorAuthJobStore';

export async function GET(_request: NextRequest, { params }: { params: Promise<{ requestId: string }> }) {
  const { requestId } = await params;
  const job = getJob(requestId);
  if (!job) {
    return NextResponse.json({ error: 'Unknown requestId.' }, { status: 404 });
  }
  return NextResponse.json(computeJobStatus(job, Date.now()));
}

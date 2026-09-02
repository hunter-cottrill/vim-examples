import { NextRequest, NextResponse } from 'next/server';
import { HOSPITALIZATION_DATASET, lookupHospitalizationRecord } from '@/lib/hospitalizationDataset';

/**
 * GET /api/hospitalization?patientKey=<mrn-or-ehrPatientId>
 *
 * Stateless, read-only lookup against the bundled dataset — nothing here
 * writes state for another route to read, so there is no cross-request
 * persistence concern. This route's request/response contract is the seam a
 * real deployment rewires to an actual ADT/HIE/claims source; only this
 * file's internals would need to change.
 */
export function GET(request: NextRequest) {
  const patientKey = request.nextUrl.searchParams.get('patientKey');
  if (!patientKey) {
    return NextResponse.json({ error: 'Missing patientKey query parameter' }, { status: 400 });
  }
  const record = lookupHospitalizationRecord(HOSPITALIZATION_DATASET, patientKey);
  return NextResponse.json({ record });
}

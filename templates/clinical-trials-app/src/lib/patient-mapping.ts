/**
 * SDK-adjacent mapping helper for the UI client (vim-client.ts). Imports only
 * TYPES from @vimconnect/app-sdk (no runtime SDK calls), so it doesn't cross
 * the "one file imports the SDK per surface" boundary — it's a type adapter,
 * not an SDK access point.
 */
import type { Diagnosis as SdkDiagnosis, Patient } from '@vimconnect/app-sdk';
import type { PatientContext } from './trial-match/types';

export function extractPatientId(patient: Patient): string {
  return patient.identifiers?.ehrPatientId ?? patient.identifiers?.id ?? `unknown-${Date.now()}`;
}

export function toPatientContext(patient: Patient, patientId: string, problems: SdkDiagnosis[]): PatientContext {
  return {
    patientId,
    zipCode: patient.address?.zipCode ?? null,
    problems: problems
      .filter((p): p is SdkDiagnosis & { code: string } => Boolean(p.code))
      .map((p) => ({
        code: p.code,
        system: p.system ?? '',
        status: p.status ?? '',
        description: p.description ?? '',
        onSetDate: p.onSetDate ?? null,
      })),
  };
}

export function hasUsableSignal(context: PatientContext): boolean {
  return context.zipCode !== null || context.problems.length > 0;
}

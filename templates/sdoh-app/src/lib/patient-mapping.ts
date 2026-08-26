/**
 * SDK-adjacent mapping helpers shared by both the UI client (vim-client.ts)
 * and the Worker client (worker-client.ts) — never forked between them.
 * Imports only TYPES from @vimconnect/app-sdk (no runtime SDK calls), so it
 * doesn't cross the "one file imports the SDK per surface" boundary; it's a
 * type adapter, like sdoh/types.ts, not an SDK access point.
 */
import type { Diagnosis, Insurance, Patient } from '@vimconnect/app-sdk';
import type { PatientContext } from './sdoh/types';

export function extractPatientId(patient: Patient): string {
  return patient.identifiers?.ehrPatientId ?? patient.identifiers?.id ?? `unknown-${Date.now()}`;
}

export function toPatientContext(
  patient: Patient,
  patientId: string,
  insurances: Insurance[],
  problems: Diagnosis[],
): PatientContext {
  return {
    patientId,
    zipCode: patient.address?.zipCode ?? null,
    city: patient.address?.city ?? null,
    state: patient.address?.state ?? null,
    // No language field exists anywhere on Patient/Demographics in the
    // installed SDK (0.4.56) — see CLAUDE.md "what does NOT exist". Always
    // null until the platform exposes one; the language-access rule and its
    // fixtures stay fully implemented and ready for when it does.
    language: null,
    insurances: insurances
      .filter((i): i is Insurance & { payerName: string } => Boolean(i.payerName))
      .map((i) => ({ payerName: i.payerName, payerId: i.payerId })),
    problems: problems
      .filter((p): p is Diagnosis & { code: string } => Boolean(p.code))
      .map((p) => ({ code: p.code, system: p.system ?? '', description: p.description ?? '' })),
  };
}

export function hasUsableSignal(context: PatientContext): boolean {
  return context.zipCode !== null || context.insurances.length > 0 || context.problems.length > 0;
}
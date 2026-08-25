// Controlled e-consult-eligibility vocabulary. CONCEPT: matches only on structured
// conditions[].code — never on free-text basicInformation.reasons — so the match
// stays deterministic and legible, same discipline as sdoh-app's Z-code table.

export interface Diagnosis {
  code?: string;
  system?: string;
  description?: string;
  status?: string;
  onSetDate?: string;
}

export interface EconsultMatch {
  specialty: string;
  icd10Prefix: string;
  description: string;
}

export const ECONSULT_ELIGIBLE: EconsultMatch[] = [
  { specialty: 'Dermatology', icd10Prefix: 'L30', description: 'Stable chronic dermatitis' },
  { specialty: 'Endocrinology', icd10Prefix: 'E03', description: 'Routine hypothyroidism follow-up' },
  { specialty: 'Gastroenterology', icd10Prefix: 'K21', description: 'Stable GERD management' },
  { specialty: 'Cardiology', icd10Prefix: 'I10', description: 'Stable essential hypertension follow-up' },
];

export function isEconsultCandidate(
  specialty: string | undefined,
  conditions: Diagnosis[] | undefined,
): EconsultMatch | null {
  if (!specialty || !conditions) return null;
  for (const condition of conditions) {
    if (!condition.code) continue;
    const match = ECONSULT_ELIGIBLE.find(
      (entry) => entry.specialty === specialty && condition.code!.startsWith(entry.icd10Prefix),
    );
    if (match) return match;
  }
  return null;
}

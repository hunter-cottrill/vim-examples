// Bundled crosswalk: patient problems are ICD-10/ICD-9/SNOMED-CT coded, but
// ClinicalTrials.gov is searched by free-text condition terms. This table is
// the only source of those search terms — never model-authored, never a
// guess. A code that doesn't resolve here yields an explicit confidence
// level rather than being silently skipped or given an invented term.
import type { ConditionMatch, Diagnosis } from './types';

export interface ConditionTableEntry {
  conditionKey: string;
  searchTerm: string;
  label: string;
}

export const ICD10_CONDITION_TABLE: Record<string, ConditionTableEntry> = {
  E11: { conditionKey: 'type2_diabetes', searchTerm: 'Type 2 Diabetes Mellitus', label: 'Type 2 Diabetes' },
  J44: { conditionKey: 'copd', searchTerm: 'Chronic Obstructive Pulmonary Disease', label: 'COPD' },
  // "Essential Hypertension" (I10's actual ICD-10 name), not the bare word
  // "Hypertension" — confirmed live against the ClinicalTrials.gov API:
  // an unquoted "Hypertension" search pulls in unrelated diseases that only
  // share the word (Ocular Hypertension / glaucoma, Pulmonary Hypertension),
  // via the API's thesaurus-style term expansion, not plain substring match.
  I10: { conditionKey: 'hypertension', searchTerm: 'Essential Hypertension', label: 'Hypertension' },
  I50: { conditionKey: 'heart_failure', searchTerm: 'Heart Failure', label: 'Heart Failure' },
  F32: { conditionKey: 'depression', searchTerm: 'Depression', label: 'Depression' },
  F33: { conditionKey: 'depression', searchTerm: 'Depression', label: 'Depression' },
  E66: { conditionKey: 'obesity', searchTerm: 'Obesity', label: 'Obesity' },
};

// ICD-10 prefixes that legitimately span more than one category — we don't
// guess which one the provider means, so these resolve to 'ambiguous', never
// to one arbitrarily chosen searchTerm.
export const AMBIGUOUS_ICD10_PREFIXES: Record<string, string[]> = {
  I13: ['hypertension', 'heart_failure'], // "Hypertensive heart and chronic kidney disease"
};

// conditionKey -> display label, deduped from ICD10_CONDITION_TABLE (several
// prefixes, e.g. F32/F33, share one conditionKey/label). Used by the UI to
// render matched conditions without re-deriving labels from raw ICD codes.
export const CONDITION_LABELS: Record<string, string> = Object.fromEntries(
  Object.values(ICD10_CONDITION_TABLE).map((entry) => [entry.conditionKey, entry.label]),
);

// Coding systems this crosswalk holds no table for — confirmed present when
// a live EHR does populate Diagnosis.system with one of these labels.
const KNOWN_NON_ICD10_SYSTEMS = ['ICD-9', 'SNOMED-CT'];

export function matchConditionCrosswalk(diagnosis: Diagnosis): ConditionMatch {
  // Diagnosis.system is declared in the reference but not reliably populated
  // by every EHR (confirmed live: a sandbox returned problems with no
  // "system" field at all). Only bail to 'none' when the system is
  // explicitly one we know isn't ICD-10 — an empty/missing/unrecognized
  // value still gets attempted against the table below, since the table's
  // own letter-prefixed keys (E11, J44, ...) won't spuriously match a
  // numeric SNOMED-CT code or a differently-shaped ICD-9 code anyway.
  const system = diagnosis.system?.trim().toUpperCase();
  if (system && KNOWN_NON_ICD10_SYSTEMS.includes(system)) {
    return { diagnosis, confidence: 'none' };
  }

  const prefix = diagnosis.code.slice(0, 3).toUpperCase();

  const ambiguous = AMBIGUOUS_ICD10_PREFIXES[prefix];
  if (ambiguous) {
    return { diagnosis, confidence: 'ambiguous', candidateConditionKeys: ambiguous };
  }

  const entry = ICD10_CONDITION_TABLE[prefix];
  if (entry) {
    return { diagnosis, confidence: 'high', conditionKey: entry.conditionKey, searchTerm: entry.searchTerm };
  }

  // A real ICD-10 code, just outside our curated categories.
  return { diagnosis, confidence: 'none' };
}

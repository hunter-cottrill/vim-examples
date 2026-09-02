/**
 * Deterministic, bundled crosswalk matching — never model-authored. Every
 * discharge diagnosis/medication is checked against the chart's current
 * problem/medication list and given one of three confidences:
 *   high      — an exact, unambiguous identifier match (code, or NDC/name)
 *   ambiguous — a partial textual match only (same drug root, overlapping
 *               diagnosis wording) — worth a provider's second look, not a
 *               confirmed match
 *   none      — no match found at all — this is the "outstanding" signal:
 *               the discharge item isn't reflected on the current chart
 */
import type {
  CrosswalkConfidence,
  CrosswalkMatch,
  DischargeDiagnosis,
  DischargeMedication,
  MedicationEntry,
  ProblemEntry,
  ReconciliationItem,
} from './types';

const STOP_WORDS = new Set([
  'a', 'an', 'and', 'of', 'the', 'with', 'without', 'unspecified', 'other',
  'due', 'to', 'in', 'on', 'for', 'or', 'not', 'elsewhere', 'classified',
]);

function normalize(text: string): string {
  return text.toLowerCase().trim().replace(/[^a-z0-9\s-]/g, ' ').replace(/\s+/g, ' ').trim();
}

function significantWords(text: string): Set<string> {
  return new Set(normalize(text).split(' ').filter((word) => word.length > 2 && !STOP_WORDS.has(word)));
}

function hasWordOverlap(a: string, b: string): boolean {
  const wordsA = significantWords(a);
  const wordsB = significantWords(b);
  for (const word of wordsA) {
    if (wordsB.has(word)) return true;
  }
  return false;
}

function firstSignificantWord(name: string): string | null {
  const words = normalize(name).split(' ').filter((word) => word.length > 0);
  return words[0] ?? null;
}

export function matchDiagnosis(discharge: DischargeDiagnosis, current: ProblemEntry[]): CrosswalkMatch<ProblemEntry> {
  const codeMatch = current.find(
    (problem) => problem.code && discharge.code && problem.code.toLowerCase() === discharge.code.toLowerCase(),
  );
  if (codeMatch) return { confidence: 'high', matched: codeMatch };

  const descriptionMatch = current.find(
    (problem) => problem.description && discharge.description && hasWordOverlap(problem.description, discharge.description),
  );
  if (descriptionMatch) return { confidence: 'ambiguous', matched: descriptionMatch };

  return { confidence: 'none' };
}

export function matchMedication(
  discharge: DischargeMedication,
  current: MedicationEntry[],
): CrosswalkMatch<MedicationEntry> {
  const ndcMatch = current.find(
    (med) => med.ndcCode && discharge.ndcCode && med.ndcCode.toLowerCase() === discharge.ndcCode.toLowerCase(),
  );
  if (ndcMatch) return { confidence: 'high', matched: ndcMatch };

  const nameMatch = current.find(
    (med) =>
      med.medicationName &&
      normalize(med.medicationName) === normalize(discharge.medicationName),
  );
  if (nameMatch) return { confidence: 'high', matched: nameMatch };

  const dischargeRoot = firstSignificantWord(discharge.medicationName);
  const rootMatch = dischargeRoot
    ? current.find((med) => med.medicationName && firstSignificantWord(med.medicationName) === dischargeRoot)
    : undefined;
  if (rootMatch) return { confidence: 'ambiguous', matched: rootMatch };

  return { confidence: 'none' };
}

export function reconcileDiagnoses(discharge: DischargeDiagnosis[], current: ProblemEntry[]): ReconciliationItem[] {
  return discharge.map((d) => {
    const match = matchDiagnosis(d, current);
    return { kind: 'diagnosis' as const, discharge: d, confidence: match.confidence, matched: match.matched };
  });
}

export function reconcileMedications(discharge: DischargeMedication[], current: MedicationEntry[]): ReconciliationItem[] {
  return discharge.map((d) => {
    const match = matchMedication(d, current);
    return { kind: 'medication' as const, discharge: d, confidence: match.confidence, matched: match.matched };
  });
}

// Re-exported for the confidence type's call sites elsewhere in this module tree.
export type { CrosswalkConfidence };

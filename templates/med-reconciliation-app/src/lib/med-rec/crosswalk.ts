/**
 * Resolves the free-text and loosely-coded values the EHR actually gives us
 * against the bundled vocabulary, always returning an explicit confidence.
 *
 * `none` — not in this app's vocabulary — is a DISTINCT outcome from a
 * negative result. It never counts as evidence that something is unmatched;
 * the engine routes it to an explicit exclusion instead.
 */
import type { ClassMatch, IngredientCandidate, ProblemMatch, ProblemRecord } from './types';
import {
  INGREDIENTS,
  PROBLEM_GROUPS,
  THERAPEUTIC_CLASSES,
  type IngredientEntry,
  type ProblemGroup,
  type ProblemGroupId,
  type TherapeuticClassId,
} from './vocabulary';

// ---------------------------------------------------------------------------
// Vocabulary lookups
// ---------------------------------------------------------------------------

const CLASS_BY_ID = new Map(THERAPEUTIC_CLASSES.map((c) => [c.id, c]));
const GROUP_BY_ID = new Map(PROBLEM_GROUPS.map((g) => [g.id, g]));

/** Falls back to the raw id rather than throwing — a label is presentation, not logic. */
export function getClassLabel(id: TherapeuticClassId): string {
  return CLASS_BY_ID.get(id)?.label ?? id;
}

export function getProblemGroup(id: ProblemGroupId): ProblemGroup | undefined {
  return GROUP_BY_ID.get(id);
}

// ---------------------------------------------------------------------------
// Normalisation
// ---------------------------------------------------------------------------

/** Lowercase, punctuation to spaces, whitespace collapsed. */
function normalizeText(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
    .replace(/\s+/g, ' ');
}

/** Uppercase, non-alphanumerics stripped, so 'E11.9' and 'e119' both become 'E119'. */
function normalizeCode(value: string): string {
  return value.toUpperCase().replace(/[^A-Z0-9]/g, '');
}

// ---------------------------------------------------------------------------
// Medication name -> therapeutic class
// ---------------------------------------------------------------------------

interface SearchTerm {
  entry: IngredientEntry;
  /** Space-padded so matching is whole-word: ' atorvastatin ', ' insulin glargine '. */
  padded: string;
}

const SEARCH_TERMS: SearchTerm[] = INGREDIENTS.flatMap((entry) =>
  [entry.ingredient, ...entry.aliases].map((term) => ({ entry, padded: ` ${normalizeText(term)} ` })),
);

interface TermHit {
  entry: IngredientEntry;
  start: number;
  end: number;
  length: number;
}

/**
 * Resolve a medication's free-text name to its therapeutic class(es).
 *
 * Whole-word matching against a space-padded haystack, then containment
 * pruning so a term wholly inside a longer matched term is dropped — that is
 * what keeps "Amoxicillin-Clavulanate 875 mg" resolving to one ingredient
 * rather than reporting a spurious ambiguity with plain amoxicillin.
 *
 * Two or more surviving ingredients is genuine ambiguity, not a failure: a
 * combination product such as "Lisinopril-HCTZ" really does contain both, and
 * the caller is told so rather than being handed a guess.
 */
export function matchMedicationClass(rawName: string | null): ClassMatch {
  if (rawName === null) return { confidence: 'none' };

  const haystack = ` ${normalizeText(rawName)} `;
  if (haystack.trim() === '') return { confidence: 'none' };

  const hits: TermHit[] = [];
  for (const { entry, padded } of SEARCH_TERMS) {
    const start = haystack.indexOf(padded);
    if (start === -1) continue;
    hits.push({ entry, start, end: start + padded.length, length: padded.length });
  }

  const surviving = hits.filter(
    (hit) => !hits.some((other) => other.length > hit.length && other.start <= hit.start && hit.end <= other.end),
  );

  const byIngredient = new Map<string, IngredientCandidate>();
  for (const hit of surviving) {
    byIngredient.set(hit.entry.ingredient, {
      ingredient: hit.entry.ingredient,
      classIds: [...hit.entry.classIds],
    });
  }

  const candidates = [...byIngredient.values()];
  if (candidates.length === 0) return { confidence: 'none' };
  if (candidates.length === 1) {
    return { confidence: 'high', ingredient: candidates[0].ingredient, classIds: candidates[0].classIds };
  }
  return { confidence: 'ambiguous', candidates };
}

// ---------------------------------------------------------------------------
// Problem -> problem group
// ---------------------------------------------------------------------------

/** Coding systems that are definitely not ICD-10, so a code should not be prefix-matched. */
const NON_ICD10_SYSTEM_MARKERS = ['snomed', 'rxnorm', 'loinc', 'cpt', 'ndc'];

/**
 * True unless the system field explicitly names a system that is not ICD-10.
 *
 * Deliberately permissive. Real sandbox problem lists return `code` and
 * `description` with NO `system` at all, so gating on `system === 'ICD-10'`
 * silently discards every real problem. The optional field is used to REFINE
 * the result when present, never to gate it.
 */
function codeMayBeIcd10(rawSystem: string | null): boolean {
  if (rawSystem === null) return true;
  const normalized = normalizeText(rawSystem);
  if (normalized === '') return true;
  return !NON_ICD10_SYSTEM_MARKERS.some((marker) => normalized.includes(marker));
}

/**
 * Resolve a problem to a bundled ProblemGroup.
 *
 * ICD-10 prefix matching runs first and longest-prefix wins, so a specific
 * code beats a general one. Only if no code matches does the description
 * fall back into play — several EHRs return a description with no code, and
 * dropping those would understate the problem list.
 */
export function matchProblemGroup(problem: ProblemRecord): ProblemMatch {
  if (problem.rawCode !== null && codeMayBeIcd10(problem.rawSystem)) {
    const code = normalizeCode(problem.rawCode);
    if (code !== '') {
      let bestLength = 0;
      let winners: ProblemGroupId[] = [];

      for (const group of PROBLEM_GROUPS) {
        for (const prefix of group.icd10Prefixes) {
          if (!code.startsWith(prefix)) continue;
          if (prefix.length > bestLength) {
            bestLength = prefix.length;
            winners = [group.id];
          } else if (prefix.length === bestLength && !winners.includes(group.id)) {
            winners.push(group.id);
          }
        }
      }

      if (winners.length === 1) return { confidence: 'high', groupId: winners[0], matchedOn: 'icd10' };
      if (winners.length > 1) return { confidence: 'ambiguous', groupIds: winners };
    }
  }

  if (problem.rawDescription !== null) {
    // Plain substring, not whole-word: descriptions are prose and we want
    // 'gout' to match 'gouty arthritis'.
    const description = normalizeText(problem.rawDescription);
    if (description !== '') {
      const matched = PROBLEM_GROUPS.filter((group) =>
        group.descriptionHints.some((hint) => description.includes(normalizeText(hint))),
      ).map((group) => group.id);

      if (matched.length === 1) return { confidence: 'high', groupId: matched[0], matchedOn: 'description' };
      if (matched.length > 1) return { confidence: 'ambiguous', groupIds: matched };
    }
  }

  return { confidence: 'none' };
}

/** Statuses that mean the problem is no longer being carried. */
const INACTIVE_STATUSES = [
  'resolved',
  'inactive',
  'remission',
  'entered in error',
  'cancelled',
  'canceled',
  'deleted',
  'historic',
  'history of',
];

/**
 * Absence is not evidence of resolution: a null or blank status means the EHR
 * did not populate the field, so the problem is treated as active. Only an
 * explicit inactive-sounding status excludes it.
 */
export function isConsideredActive(problem: ProblemRecord): boolean {
  if (problem.rawStatus === null) return true;
  const status = normalizeText(problem.rawStatus);
  if (status === '') return true;
  return !INACTIVE_STATUSES.some((inactive) => status.includes(normalizeText(inactive)));
}

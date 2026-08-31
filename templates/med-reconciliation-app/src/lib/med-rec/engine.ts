/**
 * The reconciliation rules. Pure: same input, same output, no SDK, no clock,
 * no network. The UI surface and the Worker surface both call reconcile() —
 * this logic is never forked.
 *
 * Every rule errs toward NOT making a claim. Where a value is ambiguous the
 * engine is generous when deciding whether something is covered (so it does
 * not invent a gap) and conservative when deciding whether something is
 * duplicated (so it does not invent a duplicate).
 */
import { getClassLabel, getProblemGroup, isConsideredActive, matchMedicationClass, matchProblemGroup } from './crosswalk';
import type {
  ChartContext,
  ClassMatch,
  ClassifiedMedication,
  ClassifiedProblem,
  ExcludedMedication,
  Finding,
  InferredEvidence,
  MedicationRecord,
  ReconciliationResult,
} from './types';
import type { TherapeuticClassId } from './vocabulary';

function evidenceFor(confidence: 'high' | 'ambiguous'): InferredEvidence {
  return confidence === 'high' ? 'inferred_high' : 'inferred_ambiguous';
}

function unique<T>(values: T[]): T[] {
  return [...new Set(values)];
}

/**
 * Classes this medication might belong to. Used when asking "is this class
 * already covered?" — the generous reading, so an ambiguous medication is
 * never the reason we claim a treatment gap.
 */
function coverageClassIds(match: ClassMatch): TherapeuticClassId[] {
  if (match.confidence === 'high') return match.classIds;
  if (match.confidence === 'ambiguous') return unique(match.candidates.flatMap((c) => c.classIds));
  return [];
}

/**
 * Classes this medication definitely belongs to. Used when asking "are these
 * two the same class?" — only classes shared by EVERY candidate count, so a
 * combination product is never the reason we claim a duplicate.
 */
function duplicateClassIds(match: ClassMatch): TherapeuticClassId[] {
  if (match.confidence === 'high') return match.classIds;
  if (match.confidence !== 'ambiguous') return [];
  const [first, ...rest] = match.candidates;
  if (!first) return [];
  return first.classIds.filter((id) => rest.every((candidate) => candidate.classIds.includes(id)));
}

interface Partitioned {
  classified: ClassifiedMedication[];
  excluded: ExcludedMedication[];
}

function partitionMedications(medications: MedicationRecord[]): Partitioned {
  const classified: ClassifiedMedication[] = [];
  const excluded: ExcludedMedication[] = [];

  for (const record of medications) {
    // Checked before the crosswalk: "the EHR sent no name" is a different
    // outcome from "we looked and did not recognise it".
    if (record.rawName === null || record.rawName.trim() === '') {
      excluded.push({ record, reason: 'insufficient_data' });
      continue;
    }
    const match = matchMedicationClass(record.rawName);
    if (match.confidence === 'none') {
      excluded.push({ record, reason: 'unrecognized' });
      continue;
    }
    classified.push({ record, match });
  }

  return { classified, excluded };
}

function findDuplicateClasses(classified: ClassifiedMedication[]): Finding[] {
  const byClass = new Map<TherapeuticClassId, ClassifiedMedication[]>();

  for (const medication of classified) {
    for (const classId of duplicateClassIds(medication.match)) {
      const bucket = byClass.get(classId);
      if (bucket) bucket.push(medication);
      else byClass.set(classId, [medication]);
    }
  }

  const findings: Finding[] = [];
  for (const [classId, members] of byClass) {
    if (members.length < 2) continue;
    findings.push({
      kind: 'duplicate_class',
      classId,
      classLabel: getClassLabel(classId),
      medications: members.map((m) => m.record),
      evidence: members.every((m) => m.match.confidence === 'high') ? 'inferred_high' : 'inferred_ambiguous',
    });
  }
  return findings;
}

/** Classes a mapped problem would typically be treated with, unioned when ambiguous. */
function expectedClassIdsFor(problem: ClassifiedProblem): TherapeuticClassId[] {
  if (problem.match.confidence === 'high') {
    return getProblemGroup(problem.match.groupId)?.expectedClassIds ?? [];
  }
  if (problem.match.confidence === 'ambiguous') {
    return unique(problem.match.groupIds.flatMap((id) => getProblemGroup(id)?.expectedClassIds ?? []));
  }
  return [];
}

function groupLabelFor(problem: ClassifiedProblem): string {
  if (problem.match.confidence === 'high') {
    return getProblemGroup(problem.match.groupId)?.label ?? problem.match.groupId;
  }
  if (problem.match.confidence === 'ambiguous') {
    return problem.match.groupIds.map((id) => getProblemGroup(id)?.label ?? id).join(' / ');
  }
  return '';
}

function findProblemsWithoutClassMatch(
  mappedProblems: ClassifiedProblem[],
  coveredClassIds: Set<TherapeuticClassId>,
): Finding[] {
  const findings: Finding[] = [];

  for (const problem of mappedProblems) {
    // Narrowed on a local const so the confidence stays refined across the
    // helper calls below.
    const { confidence } = problem.match;
    if (confidence === 'none') continue;
    const expected = expectedClassIdsFor(problem);
    if (expected.length === 0) continue;
    if (expected.some((classId) => coveredClassIds.has(classId))) continue;

    findings.push({
      kind: 'problem_without_class_match',
      problem: problem.record,
      groupLabel: groupLabelFor(problem),
      expectedClassLabels: expected.map(getClassLabel),
      evidence: evidenceFor(confidence),
    });
  }

  return findings;
}

function findMedicationsWithoutProblemMatch(
  classified: ClassifiedMedication[],
  expectedAcrossProblems: Set<TherapeuticClassId>,
): Finding[] {
  const findings: Finding[] = [];

  for (const medication of classified) {
    const { confidence } = medication.match;
    // partitionMedications never puts an unmatched medication here, but the
    // type still permits it — skip rather than assert.
    if (confidence === 'none') continue;
    const classIds = coverageClassIds(medication.match);
    if (classIds.length === 0) continue;
    if (classIds.some((classId) => expectedAcrossProblems.has(classId))) continue;

    findings.push({
      kind: 'medication_without_problem_match',
      medication: medication.record,
      classLabels: classIds.map(getClassLabel),
      evidence: evidenceFor(confidence),
    });
  }

  return findings;
}

export function reconcile(context: ChartContext): ReconciliationResult {
  const { classified, excluded } = partitionMedications(context.medications);
  const activeProblems = context.problems.filter(isConsideredActive);
  const problemCount = activeProblems.length;

  if (context.medications.length === 0) {
    return { kind: 'no_medications', problemCount };
  }

  const classifiedProblems: ClassifiedProblem[] = activeProblems.map((record) => ({
    record,
    match: matchProblemGroup(record),
  }));

  const coveredClassIds = new Set(classified.flatMap((m) => coverageClassIds(m.match)));
  const expectedAcrossProblems = new Set(classifiedProblems.flatMap(expectedClassIdsFor));

  /**
   * An active problem we could not map is not evidence that a medication is
   * unmatched — it is evidence that we cannot tell. One such problem
   * suppresses the whole medication_without_problem_match rule for this chart,
   * and the flag travels with the result so the UI can say why rather than
   * letting the absence read as "nothing found".
   */
  const unmappedProblemSuppression = classifiedProblems.some((p) => p.match.confidence === 'none');

  const findings: Finding[] = [
    ...findDuplicateClasses(classified),
    ...findProblemsWithoutClassMatch(classifiedProblems, coveredClassIds),
    ...(unmappedProblemSuppression ? [] : findMedicationsWithoutProblemMatch(classified, expectedAcrossProblems)),
  ];

  if (findings.length === 0) {
    return {
      kind: 'nothing_to_reconcile',
      medicationCount: context.medications.length,
      problemCount,
      excluded,
      unmappedProblemSuppression,
    };
  }

  return {
    kind: 'findings',
    findings,
    excluded,
    medicationCount: context.medications.length,
    problemCount,
    unmappedProblemSuppression,
  };
}

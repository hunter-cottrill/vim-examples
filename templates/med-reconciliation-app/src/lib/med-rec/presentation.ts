/**
 * Provider-facing copy for findings. Pure and framework-free so the UI panel
 * and the Worker notification say the same thing — the copy is shared, not
 * forked, exactly like the rules are.
 *
 * THE NAMING RULE, which the tests enforce: a finding title states what the
 * DATA SHOWS, never the clinical conclusion it suggests. "No problem on the
 * list matching this medication" is a description of two lists; "no longer
 * indicated" would be a judgement the chart never made. An honest evidence
 * label does not rescue an overclaiming title, because the title is what a
 * busy reader actually reads.
 */
import type { EvidenceLabel, ExclusionReason, Finding } from './types';

export interface FindingCopy {
  /** Headline. Descriptive, never a clinical judgement. */
  title: string;
  /** The specific chart values behind it. */
  detail: string;
  /** One line, for the Hub notification. */
  shortLabel: string;
}

export function describeFinding(finding: Finding): FindingCopy {
  switch (finding.kind) {
    case 'duplicate_class': {
      const names = finding.medications.map((m) => m.rawName ?? 'unnamed medication');
      return {
        title:
          finding.medications.length === 2
            ? 'Two medications in the same class'
            : `${finding.medications.length} medications in the same class`,
        detail: `${names.join(' and ')} — both recorded as ${finding.classLabel}.`,
        shortLabel: `${finding.medications.length} ${finding.classLabel} entries on the list`,
      };
    }
    case 'problem_without_class_match':
      return {
        title: 'No medication on the list in the class typically used for this problem',
        detail: `${finding.problem.rawDescription ?? finding.problem.rawCode ?? 'This problem'} is on the problem list. No medication on the list falls in: ${finding.expectedClassLabels.join(', ')}.`,
        shortLabel: `${finding.groupLabel}: no medication in the expected class`,
      };
    case 'medication_without_problem_match':
      return {
        title: 'No problem on the list matching this medication',
        detail: `${finding.medication.rawName ?? 'This medication'} is recorded as ${finding.classLabels.join(', ')}. No active problem on the list is typically treated with that class.`,
        shortLabel: `${finding.medication.rawName ?? 'A medication'}: no matching problem on the list`,
      };
  }
}

/**
 * How a claim is evidenced. Nothing routed through the bundled vocabulary can
 * be called "confirmed": the vocabulary states what is true of a population,
 * not what the chart asserts about this patient.
 */
export function describeEvidence(evidence: EvidenceLabel): string {
  switch (evidence) {
    case 'chart_stated':
      return 'Stated on the chart';
    case 'inferred_high':
      return "Inferred from this app's drug vocabulary";
    case 'inferred_ambiguous':
      return 'Inferred — the name matched more than one ingredient';
  }
}

export function describeExclusion(reason: ExclusionReason): string {
  switch (reason) {
    case 'unrecognized':
      return "Not analyzed — outside this app's drug vocabulary";
    case 'insufficient_data':
      return 'Not analyzed — no medication name on the record';
  }
}

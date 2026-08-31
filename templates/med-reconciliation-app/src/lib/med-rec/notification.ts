/**
 * Builds the Hub notification copy from a reconciliation result. Pure, so the
 * dev harness can preview the exact text the Worker would push without an EHR.
 */
import { MAX_NOTIFICATION_FINDINGS } from './constants';
import { describeFinding } from './presentation';
import type { Finding, ReconciliationResult } from './types';

export interface NotificationSummary {
  count: number;
  title: string;
  text: string;
  /**
   * Stable dedupe key for "have the findings actually changed?". Built only
   * from finding kinds and this app's OWN vocabulary labels — never from a
   * medication name, an ICD code, or anything else observed about the
   * patient, because this value is retained across callbacks.
   */
  signature: string;
}

function signatureKey(finding: Finding): string {
  switch (finding.kind) {
    case 'duplicate_class':
      return `duplicate_class:${finding.classId}:${finding.medications.length}`;
    case 'problem_without_class_match':
      return `problem_without_class_match:${[...finding.expectedClassLabels].sort().join('|')}`;
    case 'medication_without_problem_match':
      return `medication_without_problem_match:${[...finding.classLabels].sort().join('|')}`;
  }
}

/** Returns null when there is nothing worth interrupting the provider for. */
export function buildNotificationSummary(result: ReconciliationResult): NotificationSummary | null {
  if (result.kind !== 'findings' || result.findings.length === 0) return null;

  const count = result.findings.length;
  const shown = result.findings.slice(0, MAX_NOTIFICATION_FINDINGS);
  const remaining = count - shown.length;

  const lines = shown.map((finding) => describeFinding(finding).shortLabel);
  if (remaining > 0) lines.push(`+${remaining} more`);

  return {
    count,
    title: `${count} item${count === 1 ? '' : 's'} to reconcile`,
    text: lines.join('\n'),
    signature: [...result.findings.map(signatureKey)].sort().join(';'),
  };
}

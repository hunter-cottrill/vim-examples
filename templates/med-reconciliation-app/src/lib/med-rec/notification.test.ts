import { describe, expect, it } from 'vitest';
import { MAX_NOTIFICATION_FINDINGS } from './constants';
import { buildNotificationSummary } from './notification';
import type { Finding, ReconciliationResult } from './types';

function duplicate(classId: string): Finding {
  return {
    kind: 'duplicate_class',
    classId,
    classLabel: `${classId} label`,
    medications: [
      { id: 'a', rawName: 'Drug A', strength: null, form: null, frequency: null, ndcCode: null },
      { id: 'b', rawName: 'Drug B', strength: null, form: null, frequency: null, ndcCode: null },
    ],
    evidence: 'inferred_high',
  };
}

function findingsResult(findings: Finding[]): ReconciliationResult {
  return {
    kind: 'findings',
    findings,
    excluded: [],
    medicationCount: findings.length * 2,
    problemCount: 1,
    unmappedProblemSuppression: false,
  };
}

describe('buildNotificationSummary', () => {
  it('returns null when there is nothing worth interrupting the provider for', () => {
    expect(
      buildNotificationSummary({ kind: 'no_medications', problemCount: 0 }),
    ).toBeNull();
    expect(
      buildNotificationSummary({
        kind: 'nothing_to_reconcile',
        medicationCount: 3,
        problemCount: 2,
        excluded: [],
        unmappedProblemSuppression: false,
      }),
    ).toBeNull();
  });

  it('counts findings and pluralises the title', () => {
    expect(buildNotificationSummary(findingsResult([duplicate('statin')]))?.title).toBe('1 item to reconcile');
    expect(buildNotificationSummary(findingsResult([duplicate('statin'), duplicate('ppi')]))?.title).toBe(
      '2 items to reconcile',
    );
  });

  it(`lists at most ${MAX_NOTIFICATION_FINDINGS} findings and counts the rest`, () => {
    const many = ['statin', 'ppi', 'ssri', 'nsaid', 'arb'].map(duplicate);
    const summary = buildNotificationSummary(findingsResult(many));
    if (!summary) throw new Error('expected a summary');
    const lines = summary.text.split('\n');
    expect(lines).toHaveLength(MAX_NOTIFICATION_FINDINGS + 1);
    expect(lines[lines.length - 1]).toBe(`+${many.length - MAX_NOTIFICATION_FINDINGS} more`);
  });

  it('produces a signature that is stable across ordering but changes with content', () => {
    const a = buildNotificationSummary(findingsResult([duplicate('statin'), duplicate('ppi')]));
    const b = buildNotificationSummary(findingsResult([duplicate('ppi'), duplicate('statin')]));
    const c = buildNotificationSummary(findingsResult([duplicate('statin'), duplicate('ssri')]));
    expect(a?.signature).toBe(b?.signature);
    expect(a?.signature).not.toBe(c?.signature);
  });

  it('builds the signature from vocabulary labels only, never from patient values', () => {
    const summary = buildNotificationSummary(findingsResult([duplicate('statin')]));
    expect(summary?.signature).not.toContain('Drug A');
    expect(summary?.signature).not.toContain('Drug B');
  });
});

import { describe, expect, it } from 'vitest';
import { resolveRawChartPayload } from '@/lib/entity-mapping';
import { reconcile } from '@/lib/med-rec/engine';
import type { ExclusionReason, FindingKind, ReconciliationResult } from '@/lib/med-rec/types';
import { PATIENT_FIXTURES } from './fixtures';

/**
 * Runs every simulator fixture through the SAME resolution and reconciliation
 * the live path uses — resolveRawChartPayload is the function fetchChartContext
 * calls, not a re-implementation of it. So this is the automated half of what
 * the /dev/harness page verifies by hand, and it fails if a fixture stops
 * exercising the branch it was written for.
 */

function run(key: string): ReconciliationResult {
  const fixture = PATIENT_FIXTURES.find((candidate) => candidate.key === key);
  if (!fixture) throw new Error(`No fixture named '${key}'`);
  return reconcile(resolveRawChartPayload(fixture.source));
}

function kindsOf(result: ReconciliationResult): FindingKind[] {
  return result.kind === 'findings' ? result.findings.map((finding) => finding.kind) : [];
}

describe('fixtures — every one exercises the branch it documents', () => {
  it('theDemoChart produces all three finding kinds and both exclusion reasons', () => {
    const result = run('theDemoChart');
    expect(kindsOf(result).sort()).toEqual([
      'duplicate_class',
      'medication_without_problem_match',
      'problem_without_class_match',
    ]);
    if (result.kind !== 'findings') throw new Error('expected findings');
    expect(result.excluded.map((item) => item.reason).sort()).toEqual(['insufficient_data', 'unrecognized']);
  });

  it('duplicateStatins produces one duplicate_class with high evidence', () => {
    const result = run('duplicateStatins');
    expect(kindsOf(result)).toEqual(['duplicate_class']);
    if (result.kind !== 'findings') throw new Error('expected findings');
    expect(result.findings[0].evidence).toBe('inferred_high');
  });

  it('ambiguousCombination downgrades the evidence to ambiguous', () => {
    const result = run('ambiguousCombination');
    if (result.kind !== 'findings') throw new Error('expected findings');
    const duplicate = result.findings.find((finding) => finding.kind === 'duplicate_class');
    expect(duplicate?.evidence).toBe('inferred_ambiguous');
  });

  it('diabetesNoAntidiabetic produces only problem_without_class_match', () => {
    expect(kindsOf(run('diabetesNoAntidiabetic'))).toEqual(['problem_without_class_match']);
  });

  it('levothyroxineNoThyroidProblem produces only medication_without_problem_match', () => {
    expect(kindsOf(run('levothyroxineNoThyroidProblem'))).toEqual(['medication_without_problem_match']);
  });

  it('unrecognizedDrug shows an exclusion beside a real finding', () => {
    const result = run('unrecognizedDrug');
    if (result.kind !== 'findings') throw new Error('expected findings');
    expect(result.findings.length).toBeGreaterThan(0);
    expect(result.excluded.map((item) => item.reason)).toEqual(['unrecognized']);
  });

  it('medicationNameAbsent excludes the unnamed record as insufficient_data', () => {
    const result = run('medicationNameAbsent');
    if (result.kind !== 'nothing_to_reconcile') throw new Error('expected nothing_to_reconcile');
    expect(result.excluded.map((item) => item.reason)).toEqual(['insufficient_data']);
  });

  it('problemsWithoutSystemOrStatus still maps the problem and treats it as active', () => {
    // The payload has no `system` and no `status`. If either were gated on,
    // the problem would vanish and this chart would look clean.
    const result = run('problemsWithoutSystemOrStatus');
    expect(result.kind).toBe('findings');
    expect(kindsOf(result)).toContain('problem_without_class_match');
    if (result.kind !== 'findings') throw new Error('expected findings');
    expect(result.problemCount).toBe(1);
  });

  it('unmappedProblemSuppresses suppresses the medication rule and says so', () => {
    const result = run('unmappedProblemSuppresses');
    expect(result.kind).toBe('nothing_to_reconcile');
    if (result.kind !== 'nothing_to_reconcile') throw new Error('expected nothing_to_reconcile');
    expect(result.unmappedProblemSuppression).toBe(true);
  });

  it('resolvedProblemOnly leaves the resolved problem out of the reckoning', () => {
    const result = run('resolvedProblemOnly');
    expect(result.kind).toBe('nothing_to_reconcile');
    if (result.kind !== 'nothing_to_reconcile') throw new Error('expected nothing_to_reconcile');
    expect(result.problemCount).toBe(1); // the resolved one is not counted
  });

  it('cleanChart reconciles with nothing excluded', () => {
    const result = run('cleanChart');
    if (result.kind !== 'nothing_to_reconcile') throw new Error('expected nothing_to_reconcile');
    expect(result.excluded).toEqual([]);
  });

  it('cleanChartWithExclusion keeps "nothing found" distinct from "could not look"', () => {
    const result = run('cleanChartWithExclusion');
    if (result.kind !== 'nothing_to_reconcile') throw new Error('expected nothing_to_reconcile');
    expect(result.excluded).toHaveLength(1);
  });

  it('emptyMedicationList reports no_medications', () => {
    expect(run('emptyMedicationList').kind).toBe('no_medications');
  });

  it('entityApiFallback resolves from the chart_open payload and labels the source', () => {
    const fixture = PATIENT_FIXTURES.find((candidate) => candidate.key === 'entityApiFallback');
    if (!fixture) throw new Error('missing fixture');
    const context = resolveRawChartPayload(fixture.source);
    expect(context.source).toBe('chart-open-event');
    expect(reconcile(context).kind).toBe('findings');
  });

  it('chartLoadFailure raises rather than reporting an empty medication list', () => {
    const fixture = PATIENT_FIXTURES.find((candidate) => candidate.key === 'chartLoadFailure');
    if (!fixture) throw new Error('missing fixture');
    expect(() => resolveRawChartPayload(fixture.source)).toThrow(/Could not read this chart/);
  });
});

describe('fixtures — coverage of the domain model', () => {
  const resolvable = PATIENT_FIXTURES.filter((fixture) => fixture.key !== 'chartLoadFailure');
  const results = resolvable.map((fixture) => reconcile(resolveRawChartPayload(fixture.source)));

  it('covers every ReconciliationResult kind', () => {
    const seen = new Set(results.map((result) => result.kind));
    expect([...seen].sort()).toEqual(['findings', 'no_medications', 'nothing_to_reconcile']);
  });

  it('covers every Finding kind', () => {
    const seen = new Set(results.flatMap(kindsOf));
    expect([...seen].sort()).toEqual([
      'duplicate_class',
      'medication_without_problem_match',
      'problem_without_class_match',
    ]);
  });

  it('covers every ExclusionReason', () => {
    const seen = new Set<ExclusionReason>(
      results.flatMap((result) => (result.kind === 'no_medications' ? [] : result.excluded.map((e) => e.reason))),
    );
    expect([...seen].sort()).toEqual(['insufficient_data', 'unrecognized']);
  });

  it('covers both evidence levels a finding can carry', () => {
    const seen = new Set(results.flatMap((result) => (result.kind === 'findings' ? result.findings : [])).map((f) => f.evidence));
    expect([...seen].sort()).toEqual(['inferred_ambiguous', 'inferred_high']);
  });

  it('covers both chart sources', () => {
    const sources = new Set(resolvable.map((fixture) => resolveRawChartPayload(fixture.source).source));
    expect([...sources].sort()).toEqual(['chart-open-event', 'entity-api']);
  });

  it('has a unique key and a non-empty label for every fixture', () => {
    expect(new Set(PATIENT_FIXTURES.map((f) => f.key)).size).toBe(PATIENT_FIXTURES.length);
    for (const fixture of PATIENT_FIXTURES) expect(fixture.label.trim()).not.toBe('');
  });
});

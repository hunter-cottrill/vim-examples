import { describe, it, expect } from 'vitest';
import { buildSummary, derivePageStatus } from './summary';
import type {
  EncounterSnapshot,
  OrderSnapshot,
  PatientSnapshot,
  ProblemEntry,
  ReferralSnapshot,
  SectionStatus,
} from './types';

const loadedPatient: SectionStatus<PatientSnapshot> = {
  kind: 'loaded',
  data: { patientId: 'pat-1', firstName: 'Ada', lastName: 'Lovelace' },
};
const emptyProblems: SectionStatus<ProblemEntry[]> = { kind: 'empty' };
const emptyEncounter: SectionStatus<EncounterSnapshot> = { kind: 'empty' };
const loadedOrder: SectionStatus<OrderSnapshot> = {
  kind: 'loaded',
  data: { typeLabel: 'Lab order', orderingProviderName: 'Dr. Ordering' },
};
const emptyReferral: SectionStatus<ReferralSnapshot> = { kind: 'empty' };

describe('buildSummary', () => {
  it('assembles all five section fields untouched from inputs', () => {
    const summary = buildSummary(loadedPatient, emptyProblems, emptyEncounter, loadedOrder, emptyReferral);
    expect(summary.patient).toBe(loadedPatient);
    expect(summary.problems).toBe(emptyProblems);
    expect(summary.encounter).toBe(emptyEncounter);
    expect(summary.order).toBe(loadedOrder);
    expect(summary.referral).toBe(emptyReferral);
  });

  it('threads order/referral into providerMentions', () => {
    const summary = buildSummary(loadedPatient, emptyProblems, emptyEncounter, loadedOrder, emptyReferral);
    expect(summary.providerMentions).toEqual([{ name: 'Dr. Ordering', role: 'Ordering provider' }]);
  });
});

describe('derivePageStatus', () => {
  it('returns waiting when the patient id has not resolved, regardless of summary contents', () => {
    const summary = buildSummary(loadedPatient, emptyProblems, emptyEncounter, loadedOrder, emptyReferral);
    expect(derivePageStatus(false, summary)).toEqual({ kind: 'waiting' });
  });

  it('returns result once the patient id has resolved, even when a section errored', () => {
    const erroredPatient: SectionStatus<PatientSnapshot> = { kind: 'error', message: 'retries exhausted' };
    const summary = buildSummary(erroredPatient, emptyProblems, emptyEncounter, loadedOrder, emptyReferral);
    const status = derivePageStatus(true, summary);
    expect(status.kind).toBe('result');
    if (status.kind === 'result') {
      expect(status.summary.patient).toEqual(erroredPatient);
    }
  });

  it('returns result once the patient id has resolved, even when a section is unsupported', () => {
    const unsupportedProblems: SectionStatus<ProblemEntry[]> = { kind: 'unsupported' };
    const summary = buildSummary(loadedPatient, unsupportedProblems, emptyEncounter, loadedOrder, emptyReferral);
    expect(derivePageStatus(true, summary).kind).toBe('result');
  });
});
import { describe, it, expect } from 'vitest';
import { evaluateReferral, type ReferralLike, type PatientLike } from './referral-engine';
import { matchNetwork, type ProviderRecord } from './network-directory';
import { isEconsultCandidate } from './referral-appropriateness';

const AETNA_PATIENT: PatientLike = { insurances: [{ payerName: 'Aetna PPO', isPrimary: true }] };

describe('evaluateReferral', () => {
  it('returns [] for an already-in-network, top-tier, non-econsult-eligible referral', () => {
    const referral: ReferralLike = {
      targetProvider: { npi: '1000000001', specialty: 'Cardiology' }, // network-a top tier
      conditions: [{ code: 'Z00.0' }],
    };
    const matches = matchNetwork('Cardiology', 'network-a');
    expect(evaluateReferral(referral, AETNA_PATIENT, matches)).toEqual([]);
  });

  it('surfaces in_network_alternative for an out-of-network target with a better alternative available', () => {
    const referral: ReferralLike = {
      targetProvider: { npi: '9999999999', specialty: 'Cardiology' }, // not in the directory at all
      conditions: [{ code: 'Z00.0' }],
    };
    const matches = matchNetwork('Cardiology', 'network-a');
    const out = evaluateReferral(referral, AETNA_PATIENT, matches);
    expect(out).toHaveLength(1);
    expect(out[0]).toEqual({
      kind: 'in_network_alternative',
      provider: matches[0],
      reason: expect.stringContaining(matches[0].lastName),
    });
  });

  it('surfaces no in_network_alternative when no alternative exists in that specialty', () => {
    const referral: ReferralLike = {
      targetProvider: { npi: '9999999999', specialty: 'Neurology' }, // no directory entries at all
      conditions: [{ code: 'Z00.0' }],
    };
    const matches = matchNetwork('Neurology', 'network-a');
    expect(evaluateReferral(referral, AETNA_PATIENT, matches)).toEqual([]);
  });

  it('surfaces econsult_candidate regardless of network status', () => {
    const referral: ReferralLike = {
      targetProvider: { npi: '1000000001', specialty: 'Cardiology' }, // already in-network
      conditions: [{ code: 'I10' }],
    };
    const matches = matchNetwork('Cardiology', 'network-a');
    const out = evaluateReferral(referral, AETNA_PATIENT, matches);
    expect(out).toEqual([
      {
        kind: 'econsult_candidate',
        condition: isEconsultCandidate('Cardiology', referral.conditions),
        reason: expect.any(String),
      },
    ]);
  });

  it('surfaces both suggestions when both conditions hold, econsult first', () => {
    const referral: ReferralLike = {
      targetProvider: { npi: '9999999999', specialty: 'Cardiology' }, // out-of-network
      conditions: [{ code: 'I10' }], // econsult-eligible
    };
    const matches = matchNetwork('Cardiology', 'network-a');
    const out = evaluateReferral(referral, AETNA_PATIENT, matches);
    expect(out).toHaveLength(2);
    expect(out[0].kind).toBe('econsult_candidate');
    expect(out[1].kind).toBe('in_network_alternative');
  });

  it('every in_network_alternative suggestion resolves to a real network-directory record', () => {
    const referral: ReferralLike = {
      targetProvider: { npi: '9999999999', specialty: 'Dermatology' },
      conditions: [],
    };
    const matches = matchNetwork('Dermatology', 'network-a');
    const out = evaluateReferral(referral, AETNA_PATIENT, matches);
    const alt = out.find(
      (s): s is { kind: 'in_network_alternative'; provider: ProviderRecord; reason: string } =>
        s.kind === 'in_network_alternative',
    );
    expect(alt).toBeDefined();
    expect(matches).toContain(alt!.provider);
  });
});

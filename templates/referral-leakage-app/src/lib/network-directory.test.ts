import { describe, it, expect } from 'vitest';
import { matchNetwork, isInNetwork } from './network-directory';
import { NETWORK_DIRECTORY } from './network-data';

describe('matchNetwork', () => {
  it('returns exact-specialty candidates sorted by valueTier descending', () => {
    const out = matchNetwork('Cardiology', 'network-a');
    expect(out.map((p) => p.npi)).toEqual(['1000000001', '1000000002']);
    expect(out[0].valueTier).toBeGreaterThanOrEqual(out[1].valueTier);
  });

  it('excludes the referral target NPI when it is itself in-network', () => {
    const out = matchNetwork('Cardiology', 'network-a', '1000000001');
    expect(out.some((p) => p.npi === '1000000001')).toBe(false);
  });

  it('returns [] for a specialty with no directory entries, not an error', () => {
    expect(matchNetwork('Neurology', 'network-a')).toEqual([]);
  });

  it('every returned record traces back to a literal entry in network-data.ts', () => {
    const out = matchNetwork('Dermatology', 'network-a');
    expect(out.length).toBeGreaterThan(0);
    for (const record of out) {
      expect(NETWORK_DIRECTORY).toContain(record);
    }
  });
});

describe('isInNetwork', () => {
  it('returns true for an NPI present in that network', () => {
    expect(isInNetwork('1000000001', 'network-a')).toBe(true);
  });

  it('returns false for an NPI present but in a different network', () => {
    expect(isInNetwork('1000000001', 'network-b')).toBe(false);
  });

  it('returns false for an NPI not present at all', () => {
    expect(isInNetwork('9999999999', 'network-a')).toBe(false);
  });
});

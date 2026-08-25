import { describe, it, expect } from 'vitest';
import { networkIdForPayer } from './payer-network-map';

describe('networkIdForPayer', () => {
  it('matches a payer name by substring', () => {
    expect(networkIdForPayer('Aetna PPO')).toBe('network-a');
    expect(networkIdForPayer('Anthem Blue Cross')).toBe('network-b');
  });

  it('matches case-insensitively', () => {
    expect(networkIdForPayer('AETNA ppo')).toBe('network-a');
    expect(networkIdForPayer('cigna hmo')).toBe('network-b');
  });

  it('returns undefined for an unmapped payer rather than throwing', () => {
    expect(networkIdForPayer('Some Regional Plan')).toBeUndefined();
  });

  it('returns undefined for no payer name rather than throwing', () => {
    expect(networkIdForPayer(undefined)).toBeUndefined();
  });
});

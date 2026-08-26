import { describe, it, expect } from 'vitest';
import { deriveProviderMentions } from './providerMentions';
import type { OrderSnapshot, ReferralSnapshot, SectionStatus } from './types';

const emptyOrder: SectionStatus<OrderSnapshot> = { kind: 'empty' };
const emptyReferral: SectionStatus<ReferralSnapshot> = { kind: 'empty' };

function loadedOrder(data: Partial<OrderSnapshot>): SectionStatus<OrderSnapshot> {
  return { kind: 'loaded', data: { typeLabel: 'Order', ...data } };
}

function loadedReferral(data: Partial<ReferralSnapshot>): SectionStatus<ReferralSnapshot> {
  return { kind: 'loaded', data };
}

describe('deriveProviderMentions', () => {
  it('returns no mentions when order and referral are both absent', () => {
    expect(deriveProviderMentions(emptyOrder, emptyReferral)).toEqual([]);
  });

  it('returns one mention for an order with an ordering provider only', () => {
    const mentions = deriveProviderMentions(
      loadedOrder({ orderingProviderName: 'Dr. Ordering' }),
      emptyReferral,
    );
    expect(mentions).toEqual([{ name: 'Dr. Ordering', role: 'Ordering provider' }]);
  });

  it('returns two mentions for a referral with both referring and target providers', () => {
    const mentions = deriveProviderMentions(
      emptyOrder,
      loadedReferral({ referringProviderName: 'Dr. Referring', targetProviderName: 'Dr. Target' }),
    );
    expect(mentions).toEqual([
      { name: 'Dr. Referring', role: 'Referring provider' },
      { name: 'Dr. Target', role: 'Referral target provider' },
    ]);
  });

  it('returns only one mention when a referral has a referring provider but no target', () => {
    const mentions = deriveProviderMentions(
      emptyOrder,
      loadedReferral({ referringProviderName: 'Dr. Referring' }),
    );
    expect(mentions).toEqual([{ name: 'Dr. Referring', role: 'Referring provider' }]);
  });

  it('returns three mentions when order and referral are both present', () => {
    const mentions = deriveProviderMentions(
      loadedOrder({ orderingProviderName: 'Dr. Ordering' }),
      loadedReferral({ referringProviderName: 'Dr. Referring', targetProviderName: 'Dr. Target' }),
    );
    expect(mentions).toHaveLength(3);
  });
});
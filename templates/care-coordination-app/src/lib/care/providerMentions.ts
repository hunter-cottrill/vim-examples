import type { OrderSnapshot, ProviderMention, ReferralSnapshot, SectionStatus } from './types';

// Emits one mention per present name field (0–3 total: ordering, referring,
// target). Nothing invented, nothing deduped — they're different people
// distinguished by role, not candidates for the same identity.
export function deriveProviderMentions(
  order: SectionStatus<OrderSnapshot>,
  referral: SectionStatus<ReferralSnapshot>,
): ProviderMention[] {
  const mentions: ProviderMention[] = [];

  if (order.kind === 'loaded' && order.data.orderingProviderName) {
    mentions.push({ name: order.data.orderingProviderName, role: 'Ordering provider' });
  }

  if (referral.kind === 'loaded') {
    if (referral.data.referringProviderName) {
      mentions.push({ name: referral.data.referringProviderName, role: 'Referring provider' });
    }
    if (referral.data.targetProviderName) {
      mentions.push({ name: referral.data.targetProviderName, role: 'Referral target provider' });
    }
  }

  return mentions;
}

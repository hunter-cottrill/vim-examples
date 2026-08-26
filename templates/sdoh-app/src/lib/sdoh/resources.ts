// Bundled resource pointers — controlled data, never free text or
// model-authored. These are real, universal, non-local services (not
// invented local organizations/numbers), so citing them carries no risk of
// giving stale or wrong contact information: 211 is a nationally-operated
// referral line (run by United Way in most of the US) that genuinely covers
// housing, food, financial, and transportation assistance referrals.
//
// language_access intentionally has no resource entry — there's no hotline
// to "point to" for a language barrier itself; the insight's evidence is
// the point, and the provider is the one who arranges an interpreter.

import type { ResourceRef, SdohNeed } from './types';

const TWO_ONE_ONE: Omit<ResourceRef, 'need'> = {
  label: '211 — free, confidential referral for housing, food, and financial assistance',
  contact: 'Dial 211',
};

export const RESOURCES: ResourceRef[] = [
  { need: 'transportation', ...TWO_ONE_ONE },
  { need: 'housing', ...TWO_ONE_ONE },
  { need: 'food', ...TWO_ONE_ONE },
  { need: 'financial', ...TWO_ONE_ONE },
];

export function resourceFor(need: SdohNeed): ResourceRef | null {
  return RESOURCES.find((r) => r.need === need) ?? null;
}

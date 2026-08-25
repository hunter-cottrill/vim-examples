import type { ProcedureCode } from '../types';

/**
 * The controlled procedure vocabulary — the only source of CPT codes and
 * descriptions the app is ever allowed to surface. Aliases are normalized
 * (lowercase, no punctuation) and drive the orderName crosswalk match in
 * crosswalk.ts. Real-world orderName formats should be captured from a live
 * EHR spike and folded in here — this seed list is illustrative for the demo.
 */
export const PROCEDURES: ProcedureCode[] = [
  {
    cpt: '99213',
    description: 'Office/outpatient visit, established patient',
    aliases: [
      'office visit',
      'established patient visit',
      'follow up visit',
      'follow-up visit',
      'em visit',
      'e/m visit',
    ],
    selfPayCashRateCents: 12000,
  },
  {
    cpt: '73721',
    description: 'MRI, lower extremity joint (knee), without contrast',
    aliases: [
      'mri knee',
      'knee mri',
      'mri lower extremity',
      'mri left knee',
      'mri right knee',
      'mri of the knee',
    ],
    selfPayCashRateCents: 95000,
  },
  {
    cpt: '80053',
    description: 'Comprehensive metabolic panel',
    aliases: [
      'metabolic panel',
      'comprehensive metabolic panel',
      'cmp',
      'basic chemistry panel',
    ],
    selfPayCashRateCents: 4500,
  },
  {
    cpt: '71046',
    description: 'Chest X-ray, 2 views',
    aliases: ['chest x-ray', 'chest xray', 'cxr', 'chest radiograph', 'chest x ray'],
    selfPayCashRateCents: 8500,
  },
  {
    cpt: '45378',
    description: 'Colonoscopy, diagnostic',
    aliases: [
      'colonoscopy',
      'diagnostic colonoscopy',
      'screening colonoscopy',
      'colonoscopy diagnostic',
    ],
    selfPayCashRateCents: 180000,
  },
];

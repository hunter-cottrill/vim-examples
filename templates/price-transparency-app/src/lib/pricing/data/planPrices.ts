import type { PlanPrice } from '../types';

/**
 * Bundled payer/plan price table — the only source of contracted rates the
 * estimate calculator is allowed to use. Deliberately incomplete for CPT
 * 73721 under Cigna, to exercise the "no contracted rate found" / GFE-recommended
 * path for an in-network-elsewhere-but-not-here scenario.
 *
 * `groupId` rows take precedence over payer-wide rows for the same payer+cpt
 * (see findPlanPrice in estimate.ts) — GRP100 models an employer plan with a
 * richer benefit than Aetna's payer-wide default.
 */
export const PLAN_PRICES: PlanPrice[] = [
  // --- 99213: office/outpatient visit, established patient ---
  { payerId: 'aetna-ppo', payerName: 'Aetna PPO', cpt: '99213', allowedAmountCents: 11000, copayAmountCents: 2500 },
  {
    payerId: 'aetna-ppo',
    payerName: 'Aetna PPO',
    groupId: 'GRP100',
    cpt: '99213',
    allowedAmountCents: 11000,
    copayAmountCents: 1500,
  },
  { payerId: 'uhc-hmo', payerName: 'UnitedHealthcare HMO', cpt: '99213', allowedAmountCents: 10500, copayAmountCents: 3000 },
  { payerId: 'cigna-oap', payerName: 'Cigna Open Access Plus', cpt: '99213', allowedAmountCents: 11500, copayAmountCents: 2000 },

  // --- 73721: MRI knee, without contrast (Cigna intentionally omitted) ---
  { payerId: 'aetna-ppo', payerName: 'Aetna PPO', cpt: '73721', allowedAmountCents: 85000, coinsuranceRate: 0.2 },
  { payerId: 'uhc-hmo', payerName: 'UnitedHealthcare HMO', cpt: '73721', allowedAmountCents: 78000, coinsuranceRate: 0.3 },

  // --- 80053: comprehensive metabolic panel ---
  { payerId: 'aetna-ppo', payerName: 'Aetna PPO', cpt: '80053', allowedAmountCents: 4000, coinsuranceRate: 0.1 },
  { payerId: 'uhc-hmo', payerName: 'UnitedHealthcare HMO', cpt: '80053', allowedAmountCents: 3800, coinsuranceRate: 0.1 },
  { payerId: 'cigna-oap', payerName: 'Cigna Open Access Plus', cpt: '80053', allowedAmountCents: 4200, coinsuranceRate: 0 },

  // --- 71046: chest X-ray, 2 views ---
  { payerId: 'aetna-ppo', payerName: 'Aetna PPO', cpt: '71046', allowedAmountCents: 7500, coinsuranceRate: 0.2 },
  { payerId: 'uhc-hmo', payerName: 'UnitedHealthcare HMO', cpt: '71046', allowedAmountCents: 7000, coinsuranceRate: 0.2 },
  { payerId: 'cigna-oap', payerName: 'Cigna Open Access Plus', cpt: '71046', allowedAmountCents: 8000, coinsuranceRate: 0.15 },

  // --- 45378: colonoscopy, diagnostic ---
  { payerId: 'aetna-ppo', payerName: 'Aetna PPO', cpt: '45378', allowedAmountCents: 140000, coinsuranceRate: 0.2 },
  { payerId: 'uhc-hmo', payerName: 'UnitedHealthcare HMO', cpt: '45378', allowedAmountCents: 132000, coinsuranceRate: 0.25 },
  { payerId: 'cigna-oap', payerName: 'Cigna Open Access Plus', cpt: '45378', allowedAmountCents: 145000, coinsuranceRate: 0.2 },
];

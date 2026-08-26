// Controlled Z-code vocabulary (ICD-10-CM Z55-Z65 subset). Codes suggested to
// the provider ONLY ever come from this list — never free text, never
// model-authored. This is what keeps writeback safe.
//
// NOTE: this range is revised most fiscal years (e.g. Z59.0 "Homelessness"
// was split into Z59.00/Z59.01 in FY2024) — re-verify codes/descriptions
// against the current CMS ICD-10-CM SDOH reference before a live demo.

import type { SdohNeed, ZCode } from './types';

export const SDOH_ZCODES: ZCode[] = [
  { code: 'Z59.82', description: 'Transportation insecurity', need: 'transportation' },
  { code: 'Z59.00', description: 'Sheltered homelessness', need: 'housing' },
  { code: 'Z59.01', description: 'Unsheltered homelessness', need: 'housing' },
  { code: 'Z59.10', description: 'Inadequate housing, unspecified', need: 'housing' },
  { code: 'Z59.41', description: 'Food insecurity', need: 'food' },
  { code: 'Z59.48', description: 'Other specified lack of adequate food', need: 'food' },
  { code: 'Z59.86', description: 'Financial insecurity', need: 'financial' },
  { code: 'Z59.6', description: 'Low income', need: 'financial' },
  { code: 'Z59.7', description: 'Insufficient social insurance and welfare support', need: 'financial' },
];

export function zCodesFor(need: SdohNeed): ZCode[] {
  return SDOH_ZCODES.filter((z) => z.need === need);
}

export function lookupZCode(code: string): ZCode | undefined {
  return SDOH_ZCODES.find((z) => z.code === code);
}

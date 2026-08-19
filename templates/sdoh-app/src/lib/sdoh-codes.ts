// Fixed SDOH Z-code dictionary (ICD-10-CM Z55–Z65 subset).
// CONCEPT: codes ONLY come from this list — never free text, never model-authored.
// This is the "controlled vocabulary" that keeps writeback safe.
//
// NOTE: this range is revised most fiscal years (e.g. Z59.0 "Homelessness" was
// split into Z59.00/Z59.01 in FY2024) — verify codes/descriptions against the
// current CMS ICD-10-CM SDOH reference before relying on them in a live demo.

export type SdohNeed =
  | "transportation"
  | "housing"
  | "food"
  | "financial"
  | "language"
  | "social-isolation";

export interface ZCode {
  code: string;
  description: string;
  need: SdohNeed;
}

export const SDOH_ZCODES: ZCode[] = [
  { code: "Z59.82", description: "Transportation insecurity", need: "transportation" },
  { code: "Z59.00", description: "Sheltered homelessness", need: "housing" },
  { code: "Z59.01", description: "Unsheltered homelessness", need: "housing" },
  { code: "Z59.10", description: "Inadequate housing, unspecified", need: "housing" },
  { code: "Z59.41", description: "Food insecurity", need: "food" },
  { code: "Z59.48", description: "Other specified lack of adequate food", need: "food" },
  { code: "Z59.86", description: "Financial insecurity", need: "financial" },
  { code: "Z59.6", description: "Low income", need: "financial" },
  { code: "Z59.7", description: "Insufficient social insurance and welfare support", need: "financial" },
  { code: "Z60.3", description: "Acculturation difficulty", need: "language" },
  { code: "Z60.2", description: "Problems related to living alone", need: "social-isolation" },
  { code: "Z60.4", description: "Social exclusion and rejection", need: "social-isolation" },
];

// Community-resource label shown per need — static SDOH vocabulary, kept next
// to the Z-code table for the same reason (SRP: this file owns the domain
// vocabulary; sdoh-rules.ts owns only the logic that reads patient data).
export const RESOURCE_TYPE_BY_NEED: Record<SdohNeed, string> = {
  transportation: "Non-emergency medical transportation",
  housing: "Housing assistance / shelter services",
  food: "Food pantry / SNAP enrollment assistance",
  financial: "Financial counseling / benefits enrollment",
  language: "Interpreter / translation services",
  "social-isolation": "Community/social support program",
};

export function zCodesFor(need: SdohNeed): ZCode[] {
  return SDOH_ZCODES.filter((z) => z.need === need);
}

export function lookupZCode(code: string): ZCode | undefined {
  return SDOH_ZCODES.find((z) => z.code === code);
}

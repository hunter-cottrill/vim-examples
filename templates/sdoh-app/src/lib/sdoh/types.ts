// Pure domain types. No SDK imports here — this file (and everything else
// under src/lib/sdoh/) must be usable with no network, no .env, no SDK.

export interface InsuranceInfo {
  payerName: string;
  payerId?: string;
}

export interface ProblemInfo {
  code: string;
  system: string;
  description: string;
}

export interface PatientContext {
  patientId: string;
  zipCode: string | null;
  city: string | null;
  state: string | null;
  language: string | null; // raw value from demographics.preferredLanguage
  insurances: InsuranceInfo[];
  problems: ProblemInfo[];
}

export type RiskTier = 'elevated' | 'typical';

export type ZipRiskMatch =
  | { confidence: 'high'; tier: RiskTier; source: 'exact_zip' }
  | { confidence: 'ambiguous'; tier: RiskTier; source: 'zip3_prefix' }
  | { confidence: 'none' };

export type CoverageType = 'medicaid' | 'uninsured' | 'commercial' | 'medicare';

export type CoverageMatch =
  | { confidence: 'high'; coverageType: CoverageType }
  | { confidence: 'ambiguous'; coverageType: CoverageType }
  | { confidence: 'none' };

export type LanguageSignal =
  | { status: 'non_english'; language: string }
  | { status: 'english' }
  | { status: 'undetermined' };

export type SdohNeed = 'transportation' | 'housing' | 'food' | 'financial' | 'language_access';

export interface ZCode {
  code: string;
  description: string;
  need: SdohNeed;
}

export interface ResourceRef {
  need: SdohNeed;
  label: string;
  contact: string;
}

export type EvidenceStrength = 'confirmed' | 'inferred';

export interface SdohInsight {
  id: string;
  need: SdohNeed;
  title: string;
  evidence: string[];
  evidenceStrength: EvidenceStrength;
  suggestedZCodes: ZCode[]; // empty for language_access by design — a language barrier isn't itself billable
  resource: ResourceRef | null;
  alreadyDocumented: boolean;
}

// 'partial' when any crosswalk/field returned its "no signal" outcome
// (coverage 'none', zip 'none', or language empty/null) — distinct from
// "checked and found nothing wrong" ('full' with zero insights).
export type DataCompleteness = 'full' | 'partial';

export interface SdohEvaluation {
  insights: SdohInsight[];
  dataCompleteness: DataCompleteness;
}

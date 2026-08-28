// Shared domain types for trial matching. SDK-free — vim-client.ts and
// trials-client.ts depend on these, never the reverse.

export type ConfidenceLevel = 'high' | 'ambiguous' | 'none';

export interface Diagnosis {
  code: string;
  system: string; // 'ICD-10' | 'ICD-9' | 'SNOMED-CT' | other, per the Vim SDK reference
  status: string;
  description: string;
  onSetDate: string | null; // 'YYYY-MM-DD'
}

export interface PatientContext {
  patientId: string;
  zipCode: string | null;
  problems: Diagnosis[];
}

export interface ConditionMatch {
  diagnosis: Diagnosis;
  confidence: ConfidenceLevel;
  conditionKey?: string; // set when confidence === 'high'
  searchTerm?: string; // set when confidence === 'high'
  candidateConditionKeys?: string[]; // set when confidence === 'ambiguous'
}

export interface ZipMatch {
  zip3: string;
  confidence: 'high' | 'none';
  lat?: number;
  lon?: number;
}

export interface TrialLocation {
  facility: string;
  city: string;
  state: string;
  lat: number | null;
  lon: number | null;
}

export interface TrialApiResult {
  nctId: string;
  briefTitle: string;
  overallStatus: string;
  locations: TrialLocation[];
}

export interface TrialMatch {
  nctId: string;
  briefTitle: string;
  overallStatus: string;
  matchedConditionKeys: string[];
  nearestFacility: string | null;
  nearestCity: string | null;
  nearestState: string | null;
  distanceMiles: number | null; // null = no geocoded location available
}

// The four distinct "what to show" outcomes. Kept apart deliberately: "none"
// (couldn't determine a trial-relevant condition) is not the same as "no
// match" (a condition was identified, but nothing recruiting was found).
export type ReadyResult =
  | { kind: 'no_problems' }
  | { kind: 'no_resolvable_conditions'; conditionMatches: ConditionMatch[] }
  | { kind: 'no_trials_found'; conditionMatches: ConditionMatch[]; zipMatch: ZipMatch }
  | {
      kind: 'matches_found';
      conditionMatches: ConditionMatch[];
      zipMatch: ZipMatch;
      trials: TrialMatch[];
      truncated: boolean;
    };

// Backend contract, shared between trials-client.ts (client) and
// src/app/api/trials/search/route.ts (server).
export interface TrialSearchRequest {
  conditions: Array<{ conditionKey: string; searchTerm: string }>;
  lat: number | null;
  lon: number | null;
}

export interface TrialSearchResponse {
  results: Array<{ conditionKey: string; trials: TrialApiResult[] }>;
}

export interface TrialSearchErrorResponse {
  error: string;
}

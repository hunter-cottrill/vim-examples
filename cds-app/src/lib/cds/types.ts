// Shared data contracts for the CDS engine, used by the Worker (producer),
// the /api/cds/evaluate backend (ranker), and the UI (consumer + writeback).
// Only "diagnosis-gap" is enabled in this build; the remaining categories
// from the CDS plan are declared so the payload shape doesn't need to change
// when they're turned on later.
export type InsightCategory =
  | "diagnosis-gap"
  | "suspect-condition"
  | "quality-measure"
  | "problem-reconcile"
  | "lab-driven-suspect"
  | "med-safety";

export type EvidenceStrength = "confirmed-data" | "inferred";

export type WritebackTarget = {
  kind: "encounter.diagnoses" | "encounter.procedureCodes";
  mode: "append";
};

export type Suggestion = {
  id: string;
  category: InsightCategory;
  code: string;
  system: string;
  display: string;
  rationale: string;
  confidence: "high" | "medium" | "low";
  evidenceStrength: EvidenceStrength;
  supportingEvidence: string[];
  writeback: WritebackTarget | null;
  source: "llm" | "manual" | "engine";
};

export type CategoryGroup = {
  category: InsightCategory;
  title: string;
  triggerReason: string;
  suggestions: Suggestion[];
};

export type CdsPayload = {
  findingId: string;
  encounterId: string;
  generatedAt: string;
  groups: CategoryGroup[];
  status: "suggested" | "partially-written" | "dismissed";
};

export type EvaluateRequest = {
  encounterId: string;
  encounter: {
    chiefComplaint: string;
    subjective?: string;
    existingDiagnoses: string[];
    existingCpts: string[];
    dateOfService: string;
    isSigned: boolean;
  };
  patient: {
    problems: string[];
    medications: string[];
    allergies: string[];
  };
  enabledCategories: InsightCategory[];
};

export type EvaluateResponse = {
  groups: CategoryGroup[];
};
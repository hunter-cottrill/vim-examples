/**
 * The app's domain types. SDK-free, React-free, network-free — nothing in this
 * directory may import @vimconnect/app-sdk. The SDK's own entity shapes are
 * mapped into these at the client boundary (src/lib/entity-mapping.ts) so the
 * domain logic can be unit-tested with no EHR and no SDK present.
 */
import type { ProblemGroupId, TherapeuticClassId } from './vocabulary';

// ---------------------------------------------------------------------------
// Inputs — narrow projections of the SDK's Medication / Diagnosis / Patient
// ---------------------------------------------------------------------------

export interface MedicationRecord {
  /** Stable within one read; index-derived. Used as a React key and finding reference. */
  id: string;
  /** Verbatim from Medication.medicationName. null when the EHR omitted it. */
  rawName: string | null;
  strength: string | null;
  form: string | null;
  frequency: string | null;
  ndcCode: string | null;
}

export interface ProblemRecord {
  id: string;
  /** Verbatim from Diagnosis.code. */
  rawCode: string | null;
  /** Verbatim from Diagnosis.description. */
  rawDescription: string | null;
  /** Verbatim from Diagnosis.status. null when absent — see isConsideredActive(). */
  rawStatus: string | null;
  /** Verbatim from Diagnosis.system. Frequently null at runtime. */
  rawSystem: string | null;
}

/** Which read produced the data the provider is looking at. */
export type ChartSource = 'entity-api' | 'chart-open-event';

export interface ChartContext {
  patientId: string;
  medications: MedicationRecord[];
  problems: ProblemRecord[];
  source: ChartSource;
}

// ---------------------------------------------------------------------------
// Crosswalk results — implemented in ./crosswalk
// ---------------------------------------------------------------------------

export interface IngredientCandidate {
  ingredient: string;
  classIds: TherapeuticClassId[];
}

export type ClassMatch =
  | { confidence: 'high'; ingredient: string; classIds: TherapeuticClassId[] }
  | { confidence: 'ambiguous'; candidates: IngredientCandidate[] }
  | { confidence: 'none' };

export type ProblemMatch =
  | { confidence: 'high'; groupId: ProblemGroupId; matchedOn: 'icd10' | 'description' }
  | { confidence: 'ambiguous'; groupIds: ProblemGroupId[] }
  | { confidence: 'none' };

export interface ClassifiedMedication {
  record: MedicationRecord;
  match: ClassMatch;
}

export interface ClassifiedProblem {
  record: ProblemRecord;
  match: ProblemMatch;
}

// ---------------------------------------------------------------------------
// Findings
// ---------------------------------------------------------------------------

/**
 * How strongly a claim is evidenced — reflects the WEAKEST link in the chain
 * from source data to the claim, not the strength of the lookup that produced
 * it. 'chart_stated' is reserved for facts the chart asserts about THIS
 * patient (this medication is on the list; this problem is coded). Anything
 * routed through the bundled vocabulary is a population-level clinical
 * association applied to an individual, so it is 'inferred_*' no matter how
 * exactly the name matched.
 *
 * 'chart_stated' is therefore used by the UI on raw echoed values only, and
 * never appears on a Finding.
 */
export type EvidenceLabel = 'chart_stated' | 'inferred_high' | 'inferred_ambiguous';

/** The subset of EvidenceLabel a Finding may carry. */
export type InferredEvidence = 'inferred_high' | 'inferred_ambiguous';

export type Finding =
  | {
      kind: 'duplicate_class';
      classId: TherapeuticClassId;
      classLabel: string;
      /** Always 2 or more. */
      medications: MedicationRecord[];
      evidence: InferredEvidence;
    }
  | {
      kind: 'problem_without_class_match';
      problem: ProblemRecord;
      groupLabel: string;
      expectedClassLabels: string[];
      evidence: InferredEvidence;
    }
  | {
      kind: 'medication_without_problem_match';
      medication: MedicationRecord;
      classLabels: string[];
      evidence: InferredEvidence;
    };

export type FindingKind = Finding['kind'];

/**
 * Why a medication was not analysed. Distinct from a negative result — the
 * provider must be able to tell "nothing to reconcile" from "we couldn't tell".
 */
export type ExclusionReason = 'unrecognized' | 'insufficient_data';

export interface ExcludedMedication {
  record: MedicationRecord;
  reason: ExclusionReason;
}

export type ReconciliationResult =
  | { kind: 'no_medications'; problemCount: number }
  | {
      kind: 'nothing_to_reconcile';
      medicationCount: number;
      problemCount: number;
      excluded: ExcludedMedication[];
      unmappedProblemSuppression: boolean;
    }
  | {
      kind: 'findings';
      findings: Finding[];
      excluded: ExcludedMedication[];
      medicationCount: number;
      problemCount: number;
      /**
       * True when at least one active problem could not be mapped to a
       * ProblemGroup, which suppresses every medication_without_problem_match
       * finding for this chart. Surfaced in the UI so the absence of that
       * finding kind is explained rather than silently implied.
       */
      unmappedProblemSuppression: boolean;
    };

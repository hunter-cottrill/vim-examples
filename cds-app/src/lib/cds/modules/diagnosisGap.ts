import type { InsightModule } from "./types";

// Module 1 — formalizes the rule already prototyped directly in the Worker
// (app/worker/page.tsx's old evaluateEncounter): a chief complaint is
// documented but no diagnosis has been coded yet.
export const diagnosisGapModule: InsightModule = {
  id: "diagnosis-gap",
  enabled: true,
  title: "Diagnosis gaps",
  vocabulary: "ICD-10-CM",
  writeback: { kind: "encounter.diagnoses", mode: "append" },

  trigger(ctx) {
    return Boolean(ctx.chiefComplaint) && !ctx.isSigned && ctx.existingDiagnoses.length === 0;
  },

  buildQuery(ctx) {
    return ctx.chiefComplaint ?? "";
  },

  triggerReason() {
    return "Chief complaint documented with no diagnosis coded yet";
  },
};
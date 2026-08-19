import { getEnabledModules } from "./modules/registry";
import type { ModuleContext } from "./modules/types";
import type { CdsPayload, EvaluateRequest, EvaluateResponse } from "./types";

// Runs in the Worker: gate on each enabled module's deterministic trigger,
// then make one batched call to the backend for whichever modules fired.
// Returns null when nothing triggered — the Worker treats that as "nothing
// to publish," matching the old evaluateEncounter()'s null-proposal case.
export async function evaluateCds(
  encounterId: string,
  ctx: ModuleContext
): Promise<CdsPayload | null> {
  const triggeredModules = getEnabledModules().filter((module) => module.trigger(ctx));
  if (triggeredModules.length === 0) return null;

  const request: EvaluateRequest = {
    encounterId,
    encounter: {
      chiefComplaint: ctx.chiefComplaint ?? "",
      subjective: ctx.subjective,
      existingDiagnoses: ctx.existingDiagnoses,
      existingCpts: ctx.existingCpts,
      dateOfService: ctx.dateOfService ?? "",
      isSigned: ctx.isSigned,
    },
    patient: {
      problems: ctx.problems,
      medications: [],
      allergies: [],
    },
    enabledCategories: triggeredModules.map((module) => module.id),
  };

  const response = await fetch("/api/cds/evaluate", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(request),
  });

  if (!response.ok) return null;

  const data: EvaluateResponse = await response.json();
  const nonEmptyGroups = data.groups.filter((group) => group.suggestions.length > 0);
  if (nonEmptyGroups.length === 0) return null;

  return {
    findingId: `cds-${encounterId}-${Date.now()}`,
    encounterId,
    generatedAt: new Date().toISOString(),
    groups: data.groups,
    status: "suggested",
  };
}
import { diagnosisGapModule } from "./diagnosisGap";
import type { InsightModule } from "./types";

// Start with only diagnosis-gap enabled (Task 1). Adding a category later —
// suspect-condition, quality-measure, problem-reconcile, lab-driven-suspect,
// med-safety — means adding a module here; nothing else in the engine changes.
export const MODULE_REGISTRY: InsightModule[] = [diagnosisGapModule];

export function getEnabledModules(): InsightModule[] {
  return MODULE_REGISTRY.filter((module) => module.enabled);
}

export function getModule(id: string): InsightModule | undefined {
  return MODULE_REGISTRY.find((module) => module.id === id);
}
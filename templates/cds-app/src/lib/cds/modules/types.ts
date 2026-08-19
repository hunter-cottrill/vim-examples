import type { InsightCategory, WritebackTarget } from "../types";

// The context an InsightModule's deterministic trigger reasons over —
// assembled once per encounter by the Worker from context + (future)
// Entity API reads, then shared across every enabled module.
export type ModuleContext = {
  chiefComplaint?: string;
  subjective?: string;
  existingDiagnoses: string[];
  existingCpts: string[];
  dateOfService?: string;
  isSigned: boolean;
  problems: string[];
};

export type InsightModule = {
  id: InsightCategory;
  enabled: boolean;
  title: string;
  vocabulary: string;
  writeback: WritebackTarget | null;
  trigger(ctx: ModuleContext): boolean;
  buildQuery(ctx: ModuleContext): string;
  triggerReason(ctx: ModuleContext): string;
};
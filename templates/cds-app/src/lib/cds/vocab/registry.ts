import { icd10Vocabulary } from "./icd10";
import type { Vocabulary } from "./types";

export const VOCAB_REGISTRY: Record<string, Vocabulary> = {
  [icd10Vocabulary.system]: icd10Vocabulary,
};

export function getVocabulary(system: string): Vocabulary | undefined {
  return VOCAB_REGISTRY[system];
}
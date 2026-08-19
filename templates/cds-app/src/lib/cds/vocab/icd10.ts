import { ICD10_ENTRIES } from "./icd10-data";
import type { Vocabulary, VocabEntry } from "./types";

function tokenize(text: string): string[] {
  return text.toLowerCase().match(/[a-z0-9]+/g) ?? [];
}

function scoreEntry(entry: VocabEntry, terms: string[]): number {
  const keywords = (entry.meta?.keywords as string[] | undefined) ?? [];
  const haystack = `${entry.description} ${keywords.join(" ")}`.toLowerCase();
  return terms.reduce((score, term) => (haystack.includes(term) ? score + 1 : score), 0);
}

export const icd10Vocabulary: Vocabulary = {
  system: "ICD-10-CM",

  retrieve(text, k) {
    const terms = tokenize(text);
    if (terms.length === 0) return [];

    return ICD10_ENTRIES.map((entry) => ({ entry, score: scoreEntry(entry, terms) }))
      .filter(({ score }) => score > 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, k)
      .map(({ entry }) => entry);
  },

  lookup(code) {
    return ICD10_ENTRIES.find((entry) => entry.code === code) ?? null;
  },

  search(query) {
    const terms = tokenize(query);
    if (terms.length === 0) return ICD10_ENTRIES.slice(0, 25);
    return ICD10_ENTRIES.filter((entry) => scoreEntry(entry, terms) > 0).slice(0, 25);
  },
};
export type VocabEntry = {
  code: string;
  description: string;
  system: string;
  meta?: Record<string, unknown>;
};

export interface Vocabulary {
  system: string;
  retrieve(text: string, k: number): VocabEntry[];
  lookup(code: string): VocabEntry | null;
  search(query: string): VocabEntry[];
}
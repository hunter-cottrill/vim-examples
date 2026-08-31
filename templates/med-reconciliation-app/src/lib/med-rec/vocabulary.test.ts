import { describe, expect, it } from 'vitest';
import { INGREDIENTS, PROBLEM_GROUPS, THERAPEUTIC_CLASSES } from './vocabulary';

// Integrity checks over a hand-authored table of ~200 rows. A typo'd class id
// would otherwise fail silently as a finding that simply never fires.

const CLASS_IDS = new Set(THERAPEUTIC_CLASSES.map((c) => c.id));

describe('THERAPEUTIC_CLASSES', () => {
  it('has unique ids and a non-empty label for each', () => {
    expect(CLASS_IDS.size).toBe(THERAPEUTIC_CLASSES.length);
    for (const cls of THERAPEUTIC_CLASSES) expect(cls.label.trim()).not.toBe('');
  });
});

describe('INGREDIENTS', () => {
  it('references only real class ids', () => {
    for (const entry of INGREDIENTS) {
      expect(entry.classIds.length).toBeGreaterThan(0);
      for (const id of entry.classIds) {
        expect(CLASS_IDS.has(id), `${entry.ingredient} -> unknown class '${id}'`).toBe(true);
      }
    }
  });

  it('is entirely lowercase, so normalised lookups can match it', () => {
    for (const entry of INGREDIENTS) {
      expect(entry.ingredient).toBe(entry.ingredient.toLowerCase());
      for (const alias of entry.aliases) expect(alias).toBe(alias.toLowerCase());
    }
  });

  it('has no term claimed by two different ingredients', () => {
    // A shared term would make one entry permanently shadow the other.
    const owner = new Map<string, string>();
    for (const entry of INGREDIENTS) {
      for (const term of [entry.ingredient, ...entry.aliases]) {
        const existing = owner.get(term);
        expect(existing, `'${term}' claimed by both ${existing} and ${entry.ingredient}`).toBeUndefined();
        owner.set(term, entry.ingredient);
      }
    }
  });
});

describe('PROBLEM_GROUPS', () => {
  it('has unique ids', () => {
    const ids = new Set(PROBLEM_GROUPS.map((g) => g.id));
    expect(ids.size).toBe(PROBLEM_GROUPS.length);
  });

  it('expects only real class ids, and at least one per group', () => {
    for (const group of PROBLEM_GROUPS) {
      expect(group.expectedClassIds.length, `${group.id} has no expected classes`).toBeGreaterThan(0);
      for (const id of group.expectedClassIds) {
        expect(CLASS_IDS.has(id), `${group.id} -> unknown class '${id}'`).toBe(true);
      }
    }
  });

  it('stores ICD-10 prefixes uppercase and dotless so normalised codes match', () => {
    for (const group of PROBLEM_GROUPS) {
      expect(group.icd10Prefixes.length).toBeGreaterThan(0);
      for (const prefix of group.icd10Prefixes) {
        expect(prefix).toBe(prefix.toUpperCase().replace(/[^A-Z0-9]/g, ''));
      }
    }
  });

  it('stores description hints lowercase', () => {
    for (const group of PROBLEM_GROUPS) {
      expect(group.descriptionHints.length).toBeGreaterThan(0);
      for (const hint of group.descriptionHints) expect(hint).toBe(hint.toLowerCase());
    }
  });

  it('has no two groups claiming the same ICD-10 prefix', () => {
    // Equal-length prefixes on two groups resolve to 'ambiguous' forever,
    // which is almost never what the author intended.
    const owner = new Map<string, string>();
    for (const group of PROBLEM_GROUPS) {
      for (const prefix of group.icd10Prefixes) {
        const existing = owner.get(prefix);
        expect(existing, `prefix '${prefix}' claimed by both ${existing} and ${group.id}`).toBeUndefined();
        owner.set(prefix, group.id);
      }
    }
  });
});

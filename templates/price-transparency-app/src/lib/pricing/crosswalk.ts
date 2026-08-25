import type { CrosswalkMatch, ProcedureCode } from './types';
import { PROCEDURES } from './data/procedures';

const HIGH_CONFIDENCE_THRESHOLD = 0.85;
const CANDIDATE_THRESHOLD = 0.4;

function normalize(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^\w\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function tokenize(text: string): Set<string> {
  return new Set(normalize(text).split(' ').filter(Boolean));
}

function intersectionSize<T>(a: Set<T>, b: Set<T>): number {
  let count = 0;
  for (const item of a) if (b.has(item)) count += 1;
  return count;
}

function bestAliasScore(procedure: ProcedureCode, inputNorm: string, inputTokens: Set<string>): number {
  let best = 0;
  for (const alias of procedure.aliases) {
    const aliasNorm = normalize(alias);
    if (!aliasNorm) continue;
    if (aliasNorm === inputNorm) return 1;
    if (inputNorm.includes(aliasNorm) || aliasNorm.includes(inputNorm)) {
      best = Math.max(best, 0.9);
      continue;
    }
    const aliasTokens = tokenize(alias);
    const overlap = intersectionSize(aliasTokens, inputTokens);
    const score = overlap / Math.max(aliasTokens.size, 1);
    best = Math.max(best, score);
  }
  return best;
}

/**
 * Resolves free-text order text (orderName + reason from the SDK's Order
 * entity, which carries no CPT field of its own) to a procedure from the
 * bundled, controlled table. Never invents a code: below the high-confidence
 * threshold it returns candidates for the caller to confirm with the
 * provider, and returns 'none' when nothing plausible matches.
 */
export function matchOrderToCpt(orderText: string, table: ProcedureCode[] = PROCEDURES): CrosswalkMatch {
  const inputNorm = normalize(orderText);
  if (!inputNorm) return { confidence: 'none' };

  const inputTokens = tokenize(orderText);
  const scored = table
    .map((procedure) => ({ procedure, score: bestAliasScore(procedure, inputNorm, inputTokens) }))
    .sort((a, b) => b.score - a.score);

  const top = scored[0];
  if (!top || top.score < CANDIDATE_THRESHOLD) return { confidence: 'none' };

  const tiedAtTop = scored.filter((s) => s.score >= top.score - 1e-9);
  if (top.score >= HIGH_CONFIDENCE_THRESHOLD && tiedAtTop.length === 1) {
    return { confidence: 'high', match: top.procedure };
  }

  const candidates = scored.filter((s) => s.score >= CANDIDATE_THRESHOLD).map((s) => s.procedure);
  return { confidence: 'ambiguous', candidates };
}

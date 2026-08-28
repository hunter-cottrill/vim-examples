import type { ProcedureCode, ProcedureMatch } from './types';
import { PROCEDURES } from './data/procedures';

const HIGH_CONFIDENCE_THRESHOLD = 0.85;
const CANDIDATE_THRESHOLD = 0.4;

function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter(Boolean);
}

function overlapScore(orderTokens: string[], alias: string): number {
  const aliasTokens = tokenize(alias);
  if (aliasTokens.length === 0) return 0;
  const orderSet = new Set(orderTokens);
  const matched = aliasTokens.filter((t) => orderSet.has(t)).length;
  // Require at least two matched alias tokens (or a full match for a
  // single-token alias like "tka") — otherwise a single generic shared word
  // (e.g. "mri") inflates the score against an otherwise unrelated alias of
  // the same short length.
  const minMatchedRequired = aliasTokens.length === 1 ? 1 : 2;
  if (matched < minMatchedRequired) return 0;
  return matched / aliasTokens.length;
}

function bestScoreFor(orderTokens: string[], procedure: ProcedureCode): number {
  return Math.max(...procedure.aliases.map((alias) => overlapScore(orderTokens, alias)), 0);
}

/**
 * Matches free-text order text against the bundled procedure crosswalk,
 * token-overlap scored against each procedure's aliases. Never invents a
 * code — an order text that scores below CANDIDATE_THRESHOLD against every
 * procedure resolves to `none`.
 */
export function matchOrderToProcedure(orderText: string, table: ProcedureCode[] = PROCEDURES): ProcedureMatch {
  const orderTokens = tokenize(orderText);
  if (orderTokens.length === 0) return { confidence: 'none' };

  const scored = table
    .map((procedure) => ({ procedure, score: bestScoreFor(orderTokens, procedure) }))
    .filter((entry) => entry.score >= CANDIDATE_THRESHOLD)
    .sort((a, b) => b.score - a.score);

  if (scored.length === 0) return { confidence: 'none' };

  const [best, second] = scored;
  if (best.score >= HIGH_CONFIDENCE_THRESHOLD && (!second || second.score < HIGH_CONFIDENCE_THRESHOLD)) {
    return { confidence: 'high', procedure: best.procedure };
  }

  return { confidence: 'ambiguous', candidates: scored.map((entry) => entry.procedure) };
}

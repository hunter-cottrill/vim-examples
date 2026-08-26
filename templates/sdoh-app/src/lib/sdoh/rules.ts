// Pure, deterministic, SDK-free rules. Deliberately no LLM here — codes and
// resource pointers only ever come from the controlled data in codes.ts /
// resources.ts. An LLM "explanation" layer would be future work at most, and
// even then could only phrase rationale, never pick a code or resource.

import { lookupZCode, zCodesFor } from './codes';
import { matchCoverage } from './payer-coverage';
import { resourceFor } from './resources';
import type {
  DataCompleteness,
  EvidenceStrength,
  InsuranceInfo,
  PatientContext,
  ProblemInfo,
  SdohEvaluation,
  SdohInsight,
  SdohNeed,
} from './types';
import { matchZipRisk } from './zip-risk';

const ENGLISH_ALIASES = ['en', 'english'];

export function evaluateCoverageRisk(insurances: InsuranceInfo[]): SdohInsight | null {
  const match = matchCoverage(insurances);
  if (match.confidence === 'none') return null;
  if (match.coverageType !== 'medicaid' && match.coverageType !== 'uninsured') return null;

  const label = match.coverageType === 'medicaid' ? 'Medicaid' : 'uninsured';
  return {
    id: 'financial',
    need: 'financial',
    title: 'Possible financial/coverage barrier',
    evidence: [`Insurance on file indicates ${label} coverage`],
    evidenceStrength: match.confidence === 'high' ? 'confirmed' : 'inferred',
    suggestedZCodes: zCodesFor('financial'),
    resource: resourceFor('financial'),
    alreadyDocumented: false,
  };
}

// Returns one insight per need (housing, food) rather than a single combined
// insight — every other rule produces at most one insight per need, and
// scanExistingZCodes overlays existing diagnoses by matching an insight's
// `need` field, so a bundled "housing/food" insight could never correctly
// absorb an existing food-only (or housing-only) Z-code.
export function evaluateNeighborhoodRisk(zipCode: string | null): SdohInsight[] {
  const match = matchZipRisk(zipCode);
  if (match.confidence === 'none' || match.tier !== 'elevated') return [];

  // Always 'inferred', never 'confirmed'. `match.confidence` describes how well the
  // ZIP matched the risk table, not whether this patient has the need — the table is
  // neighborhood-level, so any claim about an individual is an ecological inference
  // regardless of how exact the lookup was. Match confidence gates whether the insight
  // fires at all (above); it must not upgrade how the evidence is labeled.
  const evidenceStrength: EvidenceStrength = 'inferred';
  const evidence = [`Patient's ZIP code (${zipCode}) falls in a neighborhood flagged for elevated social-need risk`];
  const titleByNeed: Record<'housing' | 'food', string> = {
    housing: 'Possible housing barrier',
    food: 'Possible food access barrier',
  };

  return (['housing', 'food'] as const).map((need) => ({
    id: need,
    need,
    title: titleByNeed[need],
    evidence,
    evidenceStrength,
    suggestedZCodes: zCodesFor(need),
    resource: resourceFor(need),
    alreadyDocumented: false,
  }));
}

export function evaluateLanguageAccess(language: string | null): SdohInsight | null {
  if (!language || language.trim() === '') return null;
  if (ENGLISH_ALIASES.includes(language.trim().toLowerCase())) return null;

  return {
    id: 'language_access',
    need: 'language_access',
    title: 'Possible language access barrier',
    evidence: [`Preferred language on file: ${language}`],
    evidenceStrength: 'confirmed',
    suggestedZCodes: [], // deliberate — a language barrier isn't itself billable
    resource: null,
    alreadyDocumented: false,
  };
}

export function scanExistingZCodes(problems: ProblemInfo[], insightsSoFar: SdohInsight[]): SdohInsight[] {
  const insights = insightsSoFar.map((insight) => ({ ...insight }));
  const documentedNeeds = new Set<SdohNeed>();

  for (const problem of problems) {
    const zCode = lookupZCode(problem.code);
    if (!zCode) continue;
    documentedNeeds.add(zCode.need);

    const existing = insights.find((i) => i.need === zCode.need);
    if (existing) {
      existing.alreadyDocumented = true;
      existing.suggestedZCodes = [];
      existing.evidence = [...existing.evidence, `Already documented: ${zCode.code} ${zCode.description}`];
    } else {
      insights.push({
        id: zCode.need,
        need: zCode.need,
        title: `${zCode.description} already documented`,
        evidence: [`Z-code already on the chart: ${zCode.code} ${zCode.description}`],
        evidenceStrength: 'confirmed',
        suggestedZCodes: [],
        resource: resourceFor(zCode.need),
        alreadyDocumented: true,
      });
    }
  }

  return insights;
}

export function evaluateSdoh(input: PatientContext): SdohEvaluation {
  const coverageMatch = matchCoverage(input.insurances);
  const zipMatch = matchZipRisk(input.zipCode);
  const languageMissing = !input.language || input.language.trim() === '';

  const baseInsights = [
    evaluateCoverageRisk(input.insurances),
    ...evaluateNeighborhoodRisk(input.zipCode),
    evaluateLanguageAccess(input.language),
  ].filter((insight): insight is SdohInsight => insight !== null);

  const insights = scanExistingZCodes(input.problems, baseInsights);

  const dataCompleteness: DataCompleteness =
    coverageMatch.confidence === 'none' || zipMatch.confidence === 'none' || languageMissing ? 'partial' : 'full';

  return { insights, dataCompleteness };
}

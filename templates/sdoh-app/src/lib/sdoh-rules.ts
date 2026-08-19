// Deterministic SDOH rules. Each rule reads real patient/referral fields and emits a
// typed insight. CONCEPT: keep this deterministic and legible — no LLM here. It won't
// hallucinate on camera, and every suggestion can point at the data that triggered it.
// (An LLM "explanation" layer is future work; it would only phrase rationale, never
// pick a Z-code.)

import { SdohNeed, ZCode, zCodesFor, lookupZCode, RESOURCE_TYPE_BY_NEED } from "./sdoh-codes";

// Narrow shapes for the fields we actually read (mirror the SDK's Patient/Referral).
export interface PatientLike {
  address?: { city?: string; state?: string; zipCode?: string };
  demographics?: { gender?: string; dateOfBirth?: string; preferredLanguage?: string };
  insurances?: Array<{ payerName?: string; payerId?: string }>;
  problems?: Array<{ code?: string; description?: string }>; // existing dx incl. Z-codes
}

export interface ReferralLike {
  targetProvider?: { zipCode?: string; specialty?: string };
}

export interface SdohInsight {
  id: string;
  need: SdohNeed;
  title: string;
  suggestedZCodes: ZCode[];
  evidence: string[]; // human-readable "why this fired"
  resourceType: string; // community resource to offer
  evidenceStrength: "confirmed-data" | "inferred";
  alreadyDocumented: boolean; // is a matching Z-code already on the chart?
}

// ---- helpers ----
const MEDICAID_HINTS = ["medicaid", "medi-cal", "dual", "managed medicaid"];

function isMedicaid(patient: PatientLike): boolean {
  return (patient.insurances ?? []).some((ins) => {
    const name = ins.payerName?.toLowerCase() ?? "";
    return MEDICAID_HINTS.some((hint) => name.includes(hint));
  });
}

function hasExistingZ(patient: PatientLike, need: SdohNeed): boolean {
  const codes = new Set(zCodesFor(need).map((z) => z.code));
  return (patient.problems ?? []).some((p) => p.code && codes.has(p.code));
}

function likelyFar(a?: string, b?: string): boolean {
  // Crude proxy — true if both ZIPs present and their first 3 digits differ.
  // (Real impl geocodes; this is fine for the demo.)
  if (!a || !b) return false;
  return a.slice(0, 3) !== b.slice(0, 3);
}

// ---- the engine ----
export function evaluateSdoh(
  patient: PatientLike,
  referral?: ReferralLike
): SdohInsight[] {
  const insights: SdohInsight[] = [];

  // Rule 1 — transportation barrier to a referral.
  const targetZip = referral?.targetProvider?.zipCode;
  if (targetZip && likelyFar(patient.address?.zipCode, targetZip)) {
    insights.push({
      id: "transportation",
      need: "transportation",
      title: "Possible transportation barrier to referral",
      suggestedZCodes: zCodesFor("transportation"),
      evidence: [
        `Patient ZIP ${patient.address?.zipCode ?? "unknown"} is far from referral target ZIP ${targetZip}`,
        referral?.targetProvider?.specialty
          ? `Referral specialty: ${referral.targetProvider.specialty}`
          : "",
      ].filter(Boolean),
      resourceType: RESOURCE_TYPE_BY_NEED.transportation,
      evidenceStrength: "inferred",
      alreadyDocumented: hasExistingZ(patient, "transportation"),
    });
  }

  // Rule 2 — financial/coverage.
  if (isMedicaid(patient)) {
    const payerName = patient.insurances?.find((ins) =>
      MEDICAID_HINTS.some((hint) => (ins.payerName?.toLowerCase() ?? "").includes(hint))
    )?.payerName;
    insights.push({
      id: "financial",
      need: "financial",
      title: "Possible financial/coverage need",
      suggestedZCodes: zCodesFor("financial"),
      evidence: [`Insurance on file: ${payerName ?? "Medicaid-type plan"}`],
      resourceType: RESOURCE_TYPE_BY_NEED.financial,
      evidenceStrength: "inferred",
      alreadyDocumented: hasExistingZ(patient, "financial"),
    });
  }

  // Rule 3 — language access. Confirmed from demographics data directly — no
  // inference, so no Z-code is suggested (this isn't itself a billable need).
  const language = patient.demographics?.preferredLanguage;
  if (language && !["en", "english"].includes(language.toLowerCase())) {
    insights.push({
      id: "language",
      need: "language",
      title: "Preferred language is not English",
      suggestedZCodes: [],
      evidence: [`Preferred language on file: ${language}`],
      resourceType: RESOURCE_TYPE_BY_NEED.language,
      evidenceStrength: "confirmed-data",
      alreadyDocumented: false,
    });
  }

  // Rule 4 — existing Z-code on chart. Annotate a rule 1–3 insight for the same
  // need if one already fired; otherwise stand up a new "already documented"
  // insight (needed e.g. for food/housing, which rules 1–3 never detect on their own).
  for (const problem of patient.problems ?? []) {
    if (!problem.code) continue;
    const zcode = lookupZCode(problem.code);
    if (!zcode) continue;

    const existing = insights.find((i) => i.need === zcode.need);
    if (existing) {
      existing.alreadyDocumented = true;
      existing.suggestedZCodes = [];
      continue;
    }

    insights.push({
      id: `existing-${zcode.need}`,
      need: zcode.need,
      title: `Already documented: ${zcode.description}`,
      suggestedZCodes: [],
      evidence: [`Existing diagnosis: ${problem.code} ${problem.description ?? zcode.description}`],
      resourceType: RESOURCE_TYPE_BY_NEED[zcode.need],
      evidenceStrength: "confirmed-data",
      alreadyDocumented: true,
    });
  }

  return insights;
}

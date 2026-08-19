import { NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import { z } from "zod";
import { getVocabulary } from "@/lib/cds/vocab/registry";
import { getModule } from "@/lib/cds/modules/registry";
import type {
  CategoryGroup,
  EvaluateRequest,
  EvaluateResponse,
  InsightCategory,
  Suggestion,
} from "@/lib/cds/types";

// Server-only — never exposed to the client bundle (no NEXT_PUBLIC_ prefix).
const client = new Anthropic();

const RankedCodeSchema = z.object({
  code: z.string(),
  confidence: z.enum(["high", "medium", "low"]),
  rationale: z.string(),
});
const RankingOutputSchema = z.object({
  selections: z.array(RankedCodeSchema).max(3),
});

export async function POST(request: Request) {
  let body: EvaluateRequest;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  if (!body?.encounterId || !Array.isArray(body.enabledCategories)) {
    return NextResponse.json({ error: "Malformed evaluate request" }, { status: 400 });
  }

  const groups: CategoryGroup[] = await Promise.all(
    body.enabledCategories.map((category) => evaluateCategory(category, body))
  );

  return NextResponse.json({ groups } satisfies EvaluateResponse);
}

async function evaluateCategory(
  category: InsightCategory,
  req: EvaluateRequest
): Promise<CategoryGroup> {
  const insightModule = getModule(category);
  const emptyGroup: CategoryGroup = {
    category,
    title: insightModule?.title ?? category,
    triggerReason: "",
    suggestions: [],
  };

  // Degrade gracefully: an unknown/disabled category, a missing vocabulary,
  // an empty retrieval shortlist, or any LLM failure all produce an empty
  // group rather than a 500 — the affected category just surfaces nothing.
  if (!insightModule || !insightModule.writeback) return emptyGroup;

  try {
    const vocabulary = getVocabulary(insightModule.vocabulary);
    if (!vocabulary) return emptyGroup;

    const query = insightModule.buildQuery({
      chiefComplaint: req.encounter.chiefComplaint,
      subjective: req.encounter.subjective,
      existingDiagnoses: req.encounter.existingDiagnoses,
      existingCpts: req.encounter.existingCpts,
      dateOfService: req.encounter.dateOfService,
      isSigned: req.encounter.isSigned,
      problems: req.patient.problems,
    });

    const shortlist = vocabulary.retrieve(query, 8);
    if (shortlist.length === 0) return emptyGroup;

    const response = await client.messages.parse({
      model: "claude-opus-4-8",
      max_tokens: 2048,
      system:
        "You select diagnosis codes for a clinical decision support tool used by a " +
        "licensed provider. You may ONLY select codes that appear in the numbered " +
        "shortlist below — never invent a code or modify one. Select at most 3 " +
        "codes that best match the chief complaint. If nothing on the list fits " +
        "well, select none. The provider makes the final decision; you are only " +
        "narrowing the list.",
      messages: [
        {
          role: "user",
          content:
            `Chief complaint: "${req.encounter.chiefComplaint}"\n\n` +
            `Shortlist (system: ${vocabulary.system}):\n` +
            shortlist.map((entry, i) => `${i + 1}. ${entry.code} — ${entry.description}`).join("\n"),
        },
      ],
      output_config: { format: zodOutputFormat(RankingOutputSchema) },
    });

    const selections = response.parsed_output?.selections ?? [];

    const suggestions: Suggestion[] = selections.flatMap((selection) => {
      // Membership enforcement: drop anything the LLM returned that isn't a
      // real vocabulary entry, and dedupe against codes already on the chart.
      const entry = vocabulary.lookup(selection.code);
      if (!entry) return [];
      if (req.encounter.existingDiagnoses.includes(entry.code)) return [];

      const suggestion: Suggestion = {
        id: `${insightModule.id}-${entry.code}`,
        category: insightModule.id,
        code: entry.code,
        system: entry.system,
        display: entry.description,
        rationale: selection.rationale,
        confidence: selection.confidence,
        evidenceStrength: "inferred",
        supportingEvidence: [`Chief complaint: "${req.encounter.chiefComplaint}"`],
        writeback: insightModule.writeback,
        source: "llm",
      };
      return [suggestion];
    });

    return {
      category: insightModule.id,
      title: insightModule.title,
      triggerReason: insightModule.triggerReason({
        chiefComplaint: req.encounter.chiefComplaint,
        existingDiagnoses: req.encounter.existingDiagnoses,
        existingCpts: req.encounter.existingCpts,
        isSigned: req.encounter.isSigned,
        problems: req.patient.problems,
      }),
      suggestions,
    };
  } catch (error) {
    console.error(`[cds/evaluate] category "${category}" failed`, error);
    return emptyGroup;
  }
}
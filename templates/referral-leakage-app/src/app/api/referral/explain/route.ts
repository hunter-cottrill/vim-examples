import { NextResponse } from 'next/server';
import Anthropic from '@anthropic-ai/sdk';
import { zodOutputFormat } from '@anthropic-ai/sdk/helpers/zod';
import { z } from 'zod';
import type { ProviderRecord } from '@/lib/network-directory';

interface ExplainRequestBody {
  specialty?: string;
  diagnosisDescription?: string;
  networkMatches?: ProviderRecord[];
}

interface ExplainResponse {
  npi: string;
  rationale: string;
  source: 'llm' | 'fallback';
}

const SelectionSchema = z.object({
  npi: z.string(),
  rationale: z.string(),
});

/**
 * POST /api/referral/explain (optional LLM layer) — given the deterministically
 * retrieved networkMatches shortlist plus the referral's specialty/diagnosis, asks
 * an LLM only to pick among that exact shortlist and phrase a one-line rationale.
 * Mirrors cds-app's /api/cds/evaluate membership-enforcement pattern exactly
 * (vocabulary.lookup(selection.code) there; shortlist.find(npi) here) — the model
 * can never return a provider that wasn't already in the shortlist it was given.
 * Degrades gracefully to a rule-based pick on a missing key, LLM failure, or an
 * out-of-shortlist response — never a 500, never blocks the caller.
 */
export async function POST(request: Request) {
  let body: ExplainRequestBody;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const shortlist = Array.isArray(body.networkMatches) ? body.networkMatches : [];
  if (shortlist.length === 0) {
    return NextResponse.json({ error: 'networkMatches shortlist is required' }, { status: 400 });
  }

  const fallback = fallbackSelection(shortlist);

  if (!process.env.ANTHROPIC_API_KEY) {
    return NextResponse.json(fallback satisfies ExplainResponse);
  }

  try {
    const client = new Anthropic();
    const response = await client.messages.parse({
      model: 'claude-opus-5',
      max_tokens: 1024,
      system:
        'You rank in-network provider alternatives for a referral guidance tool used by ' +
        'a licensed provider. You may ONLY select an NPI that appears in the numbered ' +
        'shortlist below — never invent an NPI or a provider not on the list. Pick the ' +
        'single best match and phrase a one-line rationale. The provider makes the final ' +
        'decision; you are only explaining a ranking, never prescribing one.',
      messages: [
        {
          role: 'user',
          content:
            `Specialty: ${body.specialty ?? 'unknown'}\n` +
            `Diagnosis: ${body.diagnosisDescription ?? 'unknown'}\n\n` +
            'Shortlist:\n' +
            shortlist
              .map(
                (p, i) =>
                  `${i + 1}. NPI ${p.npi} — Dr. ${p.firstName} ${p.lastName}, ${p.specialty}, ` +
                  `value tier ${p.valueTier}, ${p.distanceMinutes} min away`,
              )
              .join('\n'),
        },
      ],
      output_config: { format: zodOutputFormat(SelectionSchema) },
    });

    const selection = response.parsed_output;
    // Membership enforcement — never trust an NPI the model wasn't handed.
    const match = selection && shortlist.find((p) => p.npi === selection.npi);
    if (!selection || !match) return NextResponse.json(fallback satisfies ExplainResponse);

    return NextResponse.json({
      npi: match.npi,
      rationale: selection.rationale,
      source: 'llm',
    } satisfies ExplainResponse);
  } catch (error) {
    console.error('[referral/explain] LLM call failed, falling back to rule-based rationale', error);
    return NextResponse.json(fallback satisfies ExplainResponse);
  }
}

function fallbackSelection(shortlist: ProviderRecord[]): ExplainResponse {
  const top = shortlist[0]; // shortlist is already sorted by valueTier desc (matchNetwork)
  return {
    npi: top.npi,
    rationale: `Dr. ${top.firstName} ${top.lastName} (${top.specialty}) is in-network — value tier ${top.valueTier}, ${top.distanceMinutes} min away.`,
    source: 'fallback',
  };
}
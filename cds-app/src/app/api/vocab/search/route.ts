import { NextResponse } from "next/server";
import { getVocabulary } from "@/lib/cds/vocab/registry";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const system = searchParams.get("system");
  const q = searchParams.get("q") ?? "";

  if (!system) {
    return NextResponse.json({ error: "Missing required query param: system" }, { status: 400 });
  }

  const vocabulary = getVocabulary(system);
  if (!vocabulary) {
    return NextResponse.json({ error: `Unknown vocabulary system: ${system}` }, { status: 404 });
  }

  return NextResponse.json({ results: vocabulary.search(q) });
}
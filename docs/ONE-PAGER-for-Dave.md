# Developer Experience Content — Program Brief

**For:** Dave Boerner (VP, Solutions) · **From:** Hunter Cottrill · **Re:** prospect-facing SDK
starter code + walkthroughs on the Vim developer docs

## The idea in one line
Turn "evaluate the Vim SDK" from a multi-day slog into a same-day win by shipping
**starter templates + AI-agent context + build walkthroughs** on the docs site — so a
prospect's engineer gets to a working in-EHR app fast, and "start from a Vim template"
becomes part of the technical sale.

## Why it matters (the metric that counts)
The goal isn't "more content," it's **time-to-first-working-app**. Every hour of friction
in a technical eval is a point where a deal stalls. If a prospect's dev hits "it worked"
once, the technical evaluation is effectively won. This is also directly measurable and
maps to the SE KPI on pipeline where SE is engaged.

## What's ready this week (the "Crawl" deliverable)
A working monorepo (`vim-examples/`) built from the two apps I've already shipped:

- **Two real, sanitized starter templates** — `cds-app` (Clinical Decision Support) and
  `sdoh-app` (Social Determinants of Health), both buildable, secrets stripped, normalized
  to one structure.
- **AI-agent context in every template** (`CLAUDE.md` + `llms.txt`) — the highest-leverage,
  lowest-effort piece. Prospects *will* build with Claude Code / Cursor; the SDK is niche
  enough that agents hallucinate methods that don't exist. Shipping the verified SDK surface
  means their agent writes correct code on the first try. Almost no competitor does this.
- **Freshness CI** — every template is reinstalled against the latest SDK and built weekly.
  A stale starter is worse than none; this keeps the "tested against vX.Y" claim honest.
- **A "Starter Code" button path** — the Use Cases page links each use case to its template
  folder (or a one-line `npx degit` command).

## Prioritization — value vs. effort (what to do, in order)

**Do now (high value / low effort):**
1. Ship the two templates + `CLAUDE.md`/`llms.txt` + CI (this week — done, pending review).
2. Add "Starter Code" buttons on the Use Cases page.

**Do next (high value / medium effort):**
3. One flagship "build an EHR app with Claude Code" walkthrough video + short per-step clips
   embedded next to the matching docs sections. (Record once; slice clips from the session.)
4. A golden-path "first app in 15 minutes" quickstart — one obsessively-polished path.
5. Funnel instrumentation — track template clones / clip completions and correlate to deals.

**Do later (high value / high effort):**
6. `npx create-vim-app` CLI scaffolder (the marquee DX moment; build once there are 3+ templates).
7. A mock-EHR sandbox so prospects can see a writeback *without* provisioning an EHR — this
   removes the single biggest eval blocker, but it's real engineering.
8. A public Vim SDK docs MCP server (AI-native buyers pull live SDK reference into their agent).

**Deprioritize:** standalone ZIP downloads as the primary channel (no update path → they rot);
in-browser sandboxes that can't run the real SDK flow (extension + EHR + OAuth required).

## The one risk to manage
Everything lives or dies on **freshness**. The SDK is pre-1.0 and moving (we watched it go
0.4.49 → 0.4.50 with a breaking zod change). **Two well-maintained templates beat eight that
quietly rot.** Bias to fewer artifacts with a visible "tested against vX.Y" badge, and keep
the CI green.

## Ask
Review the monorepo, confirm the two templates are cleared to be public (they're sanitized —
no secrets, no customer data), and decide whether templates live in one repo (`vim-examples`,
recommended) or per-use-case repos. Then I'll wire the Use Cases page buttons and start on the
flagship walkthrough.

## Note (handled, flagging for awareness)
The uploaded app zips contained live `.env.local` files with real API keys/secrets. I stripped
them from everything here and none are in the deliverable — but the underlying keys should be
**rotated** (Anthropic key + Vim client secrets), since the files left the local machine.

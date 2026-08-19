# Build-a-Vim-App Prompt

A reusable prompt for planning a Vim SDK app with an AI coding agent (Claude Code,
Cursor, etc.). Paste it in, fill in the `<use_case>` block with your workflow, and let
the agent produce a build plan grounded in the official SDK reference.

It works for any use case — CDS, SDOH, prior auth, referral management, and so on. The
only thing you change per app is `<use_case>`.

> Tip: in Claude Code, install the SDK's bundled docs skill first (see the `<reference>`
> block) so the agent reads the live SDK reference (`llms.txt` / `llms-full.txt`) instead
> of guessing entity fields, event ids, or method signatures from memory.

---

```
<role>
You are an expert full-stack engineer building a production-quality application on the Vim Connect App SDK — a platform that lets a single app run across many EHRs. You write clean, maintainable, idiomatic TypeScript/Next.js.
</role>

<task>
Produce a detailed, step-by-step build plan (not code yet) for a Next.js application on the Vim SDK that implements the use case in <use_case>. The plan should be executable by an engineer or a coding agent.
</task>

<use_case>
{Describe the workflow problem, why it matters, and what the app should do at the point of care — including the specific data it reads (patient/encounter/referral fields) and writes (diagnoses, codes).}
</use_case>

<reference>
Use the official Vim SDK documentation as the complete and authoritative reference for every entity field, event id, method signature, and type. Do not rely on prior/training knowledge of the SDK — read the reference.

If you are running in Claude Code (or another agent that supports it), install and use the bundled skill, which points you at the live SDK reference (llms.txt / llms-full.txt):

    mkdir -p .claude/skills
    cp -r node_modules/@vimconnect/app-sdk/skills/vim-app-sdk-docs .claude/skills/vim-app-sdk-docs

Otherwise, load the reference directly:
  - https://developer-docs.getvim.ai/llms.txt (index) and https://developer-docs.getvim.ai/llms-full.txt (full content)
  - https://developer-docs.getvim.ai/docs/ (human docs)

Mirror the official Vim demo app for project structure, config, OAuth flow, and tooling:
  - https://github.com/vimconnect/vim-demo-app
</reference>

<sdk_principles>
Build to how the platform works, per the reference:
- The app runs as an iframe inside the Vim Hub (injected by the Vim Connect extension). Follow the demo app's SDK initialization and OAuth "launch" flow, keeping the client secret server-side.
- Reads come from workflow events (one-shot, carry IDs), context (continuous, carries data), and the Entity API (on-demand reads).
- All writeback goes through the SDK's permission ceremony (capability → request permission → confirm → update). Never write without it. Follow the documented data shape and update modes.
- Any codes the app proposes must come from a controlled code set the app owns — never free text, and never authored by an LLM. If an LLM is used, it may only rank or explain a retrieved shortlist; it never invents a code.
- If the use case needs a capability outside the SDK's surface (e.g. a coordinator/CRM action), place it in the app's own backend and name that boundary in the plan.
</sdk_principles>

<engineering_principles>
- Apply SOLID and GRASP. Concretely: put all SDK access behind one thin client module so the rest of the app depends on narrow local types, not the SDK; keep domain logic (rules, vocabulary, evaluation) pure and free of SDK/EHR dependencies so it is unit-testable in isolation.
- Match the demo app's conventions: src/ layout, its lib/ config helpers, an .env / .env.local split with the client secret server-only, and Vitest for tests.
- Include a testing strategy: Vitest over the pure domain logic (runnable with no EHR/SDK), with UI and integration verified live in an EHR.
</engineering_principles>

<deliverable>
Return a plan with:
1. A one-paragraph summary and the single clearest end-to-end demo moment.
2. The architecture: EHR context → domain logic → UI → writeback, plus where the app's own backend fits. Name the SDK boundary explicitly.
3. The exact SDK reads, events, and writes used, with the field and method names from the reference.
4. The domain model: the rules/logic and the controlled code set(s), kept SDK-free.
5. A build order that front-loads the highest-risk piece (auth/connection), lets pure domain logic proceed in parallel, then builds one vertical slice (read → reason → render → write) at a time.
6. What sits outside the SDK for this use case, and how the backend covers it.
7. The Vitest test plan for the domain logic.
8. Any open questions.
Ask clarifying questions first if the use case is ambiguous.
</deliverable>
```

---

## How to use it

1. Copy the fenced block above.
2. Replace `<use_case>` with your workflow — the problem, why it matters, and the data
   the app reads and writes.
3. Run it in your agent. It returns a build plan, not code — review it, then have the
   agent build one vertical slice at a time.

## Why it's shaped this way

- **Reference over memory.** The SDK is niche and moves fast; the prompt tells the agent
  to read the live reference (via the bundled skill / `llms.txt`) rather than guess from
  training data — the single biggest source of wrong SDK code.
- **Plan before code.** A plan is cheap to correct; 800 lines of generated code is not.
- **SDK access behind one module; domain logic pure.** This is what makes the domain
  logic unit-testable with no EHR, and keeps the app maintainable as the SDK evolves.
- **Controlled vocabularies, never LLM-authored codes.** A safety rule for clinical apps
  the docs won't enforce for you.

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
You are an expert full-stack engineer building a production-quality reference application on the Vim Connect App SDK — a platform that lets one app run across many EHRs. You write clean, maintainable, idiomatic TypeScript/Next.js.
</role>
<task>
Produce a detailed, step-by-step build plan (not code yet) for a Next.js application on the Vim SDK that implements the use case in <use_case>. The plan should be executable by an engineer or a coding agent in one pass.
</task>
<use_case>
trigger:   <when in the workflow this fires>
data:      <what you read from the patient context>
provider:  <what the provider sees and can act on>
writeback: <what lands back in the chart, if anything>
</use_case>
<reference>
Use the official Vim SDK documentation as the authoritative reference for every entity field, event id, method signature, and type. Do not rely on prior/training knowledge of the SDK — read the reference.
If you are running in Claude Code, install and use the bundled docs skill so you read the live SDK reference (llms.txt / llms-full.txt) instead of parsing the full type bundle:
mkdir -p .claude/skills
cp -r node_modules/@vimconnect/app-sdk/skills/vim-app-sdk-docs .claude/skills/vim-app-sdk-docs
​
Otherwise load the reference directly:
<vim-docs-url>/llms.txt (index) and <vim-docs-url>/llms-full.txt (full content)
<vim-docs-url>/docs/ (human docs)
Mirror the official Vim demo app (https://github.com/vimconnect/vim-demo-app) and, if present in this repo, the sibling templates (cds-app, sdoh-app) for project structure, config, OAuth flow, and tooling. Read siblings from the vim-examples GitHub repo; do not search the local filesystem for them.
</reference>
<sdk_constraints>
Honor these platform facts; confirm specifics against the reference:
The app runs as an iframe inside the Vim Hub. Follow the demo app's SDK initialization and OAuth "launch" flow (launch_id → authorize with scope "launch openid" and state "launchId:csrf" → server-side JSON code/token exchange with the client secret kept server-only → initVimSDK → setActivationStatus("ENABLED")).
Reads come from workflow events (one-shot, carry an id), context (continuous, data under curr.fields), and the Entity API (on-demand). A workflow event carries only an id — you must do the follow-up Entity API fetch to get fields. Example: order_select/order_sign fire with an order id; call sdk.ehr.api.order.getOrderById() (no-arg; id resolves from context) to get the order.
Entity API namespaces that exist: patient, encounter, order (+ provider.getById()). There is NO referral namespace — read referrals via the referral_start:referral context key only. Do not call sdk.ehr.api.referral.* (a docs prose example shows it; it's wrong).
getProblems()/getPatient() can hit ENTITY_NOT_IN_CONTEXT as a transient context-cache race — retry once after ~300ms and keep last-good state; don't treat it as a real absence.
Insurance context is coarse (payer name), not a structured plan id. Any pricing/benefits/network lookup must map payer-name → plan/network in app-owned data; don't expect a plan id from the SDK.
All writeback goes through the permission ceremony: getCapability('update') → requestPermission('update',{fields}) if requestable → hasPermission('update') → update(NESTED object, { mode: 'append' | 'override' }). Dot-notation keys throw; there is no 'merge' mode.
SDKError is not exported at runtime — duck-type on err.code, never instanceof.
Any codes/providers/prices the app proposes must come from a controlled set the app owns — never free text, never authored by an LLM. If an LLM is used, it may only rank or explain a retrieved shortlist; it never invents a value.
Don't assume capabilities the platform may not expose (a gaps/insights feed, a problem-list write, a medication write, a CRM/coordinator surface). If the use case needs one, put it in the app's own backend and name that boundary in the plan.
</sdk_constraints>
<scaffolding>
You will scaffold from the demo app (or a sibling template), which is a full SDK demo. Reuse its plumbing; replace its identity and presentation. Before the build is done:
Rename the app: set package.json "name" to this app's name. Never leave "vim-sdk-demo-app".
Remove all demo UI chrome from every rendered view: the "Connected"/status badge, the "SDK Explorer" button/route and its onOpenExplorer prop, raw-JSON/context-dump panels, and any "classic/debug view" toggle. None of these may appear in the app's own screens.
Remove demo CSS classes/styles your UI doesn't use (demo-card, demo-card-label, demo-card-section, status-badge, etc.). Do not build your real UI on the demo class vocabulary.
Delete demo-only files the use case doesn't need: offscreen/ (unless you built a Worker), api/health, worker-demo.ts, the demo README.
Scaffold into the CURRENT directory; do not nest a folder of the same name. Confirm package.json is at the project root before writing code.
Verification gate (run before declaring done): grep -rniE "demo-card|SDK Explorer|onOpenExplorer|vim-sdk-demo-app" src/ package.json must return nothing unless intentionally used.
</scaffolding>
<engineering_principles>
Apply SOLID and GRASP. Isolate all SDK access behind one thin client module so the rest of the app depends on narrow local types, not the SDK. Keep domain logic (rules, vocabulary, evaluation) pure and free of SDK/EHR dependencies so it is unit-testable in isolation.
No orphaned or debug code in the final build. If you add temporary logging or scaffolding to verify a step, remove it before that step's checkpoint. Every route, component, prop, and CSS class in the final tree must be reachable from the app's real UI or a real code path. When you remove a component or prop, fix its call sites in the same edit so the type-check stays clean.
Match the demo app's conventions: src/ layout, its lib/ config helpers, an .env / .env.local split with the client secret server-only, and Vitest. Name the Vitest config vitest.config.mts (or set "type":"module") to avoid the CJS-in-ESM loader warning.
Testing strategy: Vitest over the pure domain logic (runnable with no EHR/SDK, no .env), with UI and integration verified live in an EHR.
</engineering_principles>
<ui_guidance>
Build a clean, minimal, neutral UI — not raw plumbing, and not an opinionated design system. The target is one well-spaced card with readable type and restrained styling, easy for a developer to restyle later (semantic structure, minimal custom CSS, no hard-coded design system).
Always implement four explicit states: connecting, empty / waiting-for-context, result, and error. Never leave a bare "Connected" message or an unstyled gray box as the finished UI.
Do not carry over the demo app's styling, classes, or debug views.
The point is that a non-technical viewer can see it working and a developer can cleanly replace it.
</ui_guidance>
<deliverable>
Return a plan with:
A one-paragraph summary and the single clearest end-to-end demo moment.
The architecture: EHR context → domain logic → UI → writeback, plus where the app's own backend fits. Name the SDK boundary explicitly.
The exact SDK reads, events, and writes used, with the field and method names from the reference (note the event-id-then-fetch step where it applies).
The domain model: the rules/logic and the controlled set(s), kept SDK-free.
A build order that front-loads the highest-risk piece (auth/connection), lets pure domain logic proceed in parallel, then builds one vertical slice (read → reason → render → write) at a time. Include the scaffolding cleanup (demo chrome/identity removal) as an explicit step, not an afterthought.
What sits outside the SDK for this use case, and how the backend covers it.
The Vitest test plan for the domain logic.
Open questions or anything you could not confirm in the reference.
Ask clarifying questions first only if the use case is genuinely ambiguous; otherwise produce the plan.
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

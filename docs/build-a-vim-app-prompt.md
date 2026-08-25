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
{Fill this in for your app. Describe the workflow problem, why it matters, and what the app
should do at the point of care. Cover, at minimum:
  trigger:   <when in the workflow this fires>
  data:      <what you read from the patient/encounter/order/referral context>
  logic:     <the app-owned rules and controlled data sets that decide what to surface>
  provider:  <what the provider sees and can act on>
  backend:   <what the app's own backend must supply that the SDK does not>
  writeback: <what lands back in the chart, if anything — and verify it's supported first>
}
</use_case>

<reference>
Use the official Vim SDK documentation as the authoritative reference for every entity field, event id, method signature, and type. Do not rely on prior/training knowledge of the SDK — read the reference.

If you are running in Claude Code, install and use the bundled docs skill so you read the live SDK reference (llms.txt / llms-full.txt) instead of parsing the full type bundle:

    mkdir -p .claude/skills
    cp -r node_modules/@vimconnect/app-sdk/skills/vim-app-sdk-docs .claude/skills/vim-app-sdk-docs

Otherwise load the reference directly:
  - <vim-docs-url>/llms.txt (index) and <vim-docs-url>/llms-full.txt (full content)
  - <vim-docs-url>/docs/ (human docs)

Mirror the official Vim demo app (https://github.com/vimconnect/vim-demo-app) and, if present in this repo, the sibling templates (cds-app, sdoh-app) for project structure, config, OAuth flow, and tooling. Read siblings from the vim-examples GitHub repo; do not search the local filesystem for them.
</reference>

<sdk_constraints>
Honor these platform facts; confirm specifics against the reference:
- The app runs as an iframe inside the Vim Hub. Follow the demo app's SDK initialization and OAuth "launch" flow (launch_id → authorize with scope "launch openid" and state "launchId:csrf" → server-side JSON code/token exchange with the client secret kept server-only → initVimSDK → setActivationStatus("ENABLED")).
- Reads come from workflow events (one-shot, carry an id), context (continuous, data under curr.fields), and the Entity API (on-demand). **A workflow event carries only an id — you must do the follow-up Entity API fetch to get fields.** Example: order_select/order_sign fire with an order id; call sdk.ehr.api.order.getOrderById() (no-arg; id resolves from context) to get the order.
- Entity API namespaces that exist: patient, encounter, order (+ provider.getById()). There is NO referral namespace — read referrals via the referral_start:referral context key only. Do not call sdk.ehr.api.referral.* (a docs prose example shows it; it's wrong).
- getProblems()/getPatient() can hit ENTITY_NOT_IN_CONTEXT as a transient context-cache race — retry once after ~300ms and keep last-good state; don't treat it as a real absence.
- Insurance context is coarse (payer name), not a structured plan id. Any pricing/benefits/network lookup must map payer-name → plan/network in app-owned data; don't expect a plan id from the SDK.
- All writeback goes through the permission ceremony: getCapability('update') → requestPermission('update',{fields}) if requestable → hasPermission('update') → update(NESTED object, { mode: 'append' | 'override' }). Dot-notation keys throw; there is no 'merge' mode.
- SDKError is not exported at runtime — duck-type on err.code, never instanceof.
- Any codes/providers/prices the app proposes must come from a controlled set the app owns — never free text, never authored by an LLM. If an LLM is used, it may only rank or explain a retrieved shortlist; it never invents a value.
- Don't assume capabilities the platform may not expose (a gaps/insights feed, a problem-list write, a medication write, a CRM/coordinator surface). If the use case needs one, put it in the app's own backend and name that boundary in the plan.
- The platform is in alpha; some events and entity fields are mapped but not yet live in the sandbox EHR (non-medication order events and referral events among them). If the use case's trigger does not fire, do NOT redesign the app around a different trigger. Build to the correct trigger, make the app fully exercisable through the dev simulator, and note in the plan which triggers are unverified so they can be re-tested when the platform enables them.
- If the use case's value depends on reaching a provider who does not have the app panel open (most do), build the Worker (offscreen/) and fire the Hub push notification from it. A UI app only runs while its panel is open, so a notification fired from the UI app is redundant with what the provider can already see. The Worker observes headlessly and its notification opens the UI app via launchPayload. Reuse the same pure domain logic as the UI path; never fork it. Respect the Worker handle's TTL (check validity before use and after any await), and fire only when the domain logic actually produces something — a Worker that notifies on every event gets muted.
</sdk_constraints>

<scaffolding>
You will scaffold from the demo app (or a sibling template), which is a full SDK *demo*. Reuse its plumbing; replace its identity and presentation. Before the build is done:
- Clear the demo app's identity from package.json entirely: set "name" and "description" to this app's own (never leave "vim-sdk-demo-app" or "Reference implementation..."), drop stale keywords like "demo", and remove inherited "homepage" and "repository" fields that point at the demo app. Remove scripts that reference the demo monorepo (dev:local-sdk, build-deps); scripts should be limited to what this app actually runs: dev, build, start, type-check, test.
- Remove all demo UI chrome from every rendered view: the "Connected"/status badge, the "SDK Explorer" button/route and its onOpenExplorer prop, raw-JSON/context-dump panels, and any "classic/debug view" toggle. None of these may appear in the app's own screens.
- Remove demo CSS classes/styles your UI doesn't use (demo-card, demo-card-label, demo-card-section, status-badge, etc.). Do not build your real UI on the demo class vocabulary.
- Delete demo-only files the use case doesn't need: api/health, worker-demo.ts, capability-engine.ts, RawOutput.tsx, clipboard.ts, vim-sdk.js, and the demo README. Keep offscreen/ if you built a Worker (see the Worker guidance above); delete it if the use case genuinely doesn't need one. Before deleting each file, confirm nothing still imports it; if something does, remove that usage first.
- Scaffold into the CURRENT directory; do not nest a folder of the same name. Confirm package.json is at the project root before writing code.
- Verification gate (run before declaring done): `grep -rniE "demo-card|SDK Explorer|onOpenExplorer|vim-sdk-demo-app|CapabilityAutoRunner|vim-demo-app|reference implementation" src/ package.json` must return nothing unless intentionally used.
</scaffolding>

<engineering_principles>
- Apply SOLID and GRASP. Isolate all SDK access behind one thin client module so the rest of the app depends on narrow local types, not the SDK. Keep domain logic (rules, vocabulary, evaluation) pure and free of SDK/EHR dependencies so it is unit-testable in isolation.
- No orphaned or debug code in the final build. If you add temporary logging or scaffolding to verify a step, remove it before that step's checkpoint. Every route, component, prop, and CSS class in the final tree must be reachable from the app's real UI or a real code path. When you remove a component or prop, fix its call sites in the same edit so the type-check stays clean.
- Match the demo app's conventions: src/ layout, its lib/ config helpers, an .env / .env.local split with the client secret server-only, and Vitest. Name the Vitest config vitest.config.mts (or set "type":"module") to avoid the CJS-in-ESM loader warning.
- Pin `@vimconnect/app-sdk` to the same version the sibling templates use, not merely the latest. If you must move to a newer version, say so explicitly in your summary so the other templates can be aligned.
- Ship a dev-only simulator so the app is runnable without an EHR: a fixtures module with realistic entity payloads covering the use case's main scenarios, a `/dev/harness` page that drives the pure domain logic and renders the real UI, and an injection point in the SDK client so subscriptions can be fed from the simulator instead of the live SDK. Gate all of it behind `NEXT_PUBLIC_SIM_MODE === 'true'`, off by default, with the real SDK path untouched and the harness unreachable when the flag is unset. Document it in the README as the local-run path, and state plainly that it proves the app handles an event correctly, not that the event fires in a live EHR.
- Testing strategy: Vitest over the pure domain logic (runnable with no EHR/SDK, no .env), with UI and integration verified live in an EHR.
</engineering_principles>

<ui_guidance>
Build a clean, minimal, neutral UI — not raw plumbing, and not an opinionated design system. The target is one well-spaced card with readable type and restrained styling, easy for a developer to restyle later (semantic structure, minimal custom CSS, no hard-coded design system).
- Always implement four explicit states: connecting, empty / waiting-for-context, result, and error. Never leave a bare "Connected" message or an unstyled gray box as the finished UI.
- Do not carry over the demo app's styling, classes, or debug views.
- The point is that a non-technical viewer can see it working and a developer can cleanly replace it.
</ui_guidance>

<deliverable>
Return a plan with:
1. A one-paragraph summary and the single clearest end-to-end demo moment.
2. The architecture: EHR context → domain logic → UI → writeback, plus where the app's own backend fits. Name the SDK boundary explicitly.
3. The exact SDK reads, events, and writes used, with the field and method names from the reference (note the event-id-then-fetch step where it applies).
4. The domain model: the rules/logic and the controlled set(s), kept SDK-free.
5. A build order that front-loads the highest-risk piece (auth/connection), lets pure domain logic proceed in parallel, then builds one vertical slice (read → reason → render → write) at a time. Include the scaffolding cleanup (demo chrome/identity removal) as an explicit step, not an afterthought.
6. What sits outside the SDK for this use case, and how the backend covers it.
7. The Vitest test plan for the domain logic.
8. The dev simulator plan: which fixtures/scenarios it covers and how SIM_MODE is gated.
9. Open questions, anything you could not confirm in the reference, and any trigger or field that is mapped but not yet live in the sandbox.
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

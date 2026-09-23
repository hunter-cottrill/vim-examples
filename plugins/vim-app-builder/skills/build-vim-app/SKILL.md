---
name: build-vim-app
description: Use when building an application on the Vim Connect App SDK (@vimconnect/app-sdk) — an app that runs inside an EHR and reacts to clinical workflow events like a chart opening, a referral starting, or an order being placed. Covers scaffolding from a template, the OAuth launch flow, EHR context and entity reads, writeback, workers, and the dev simulator. Trigger on any mention of Vim Connect, Vim SDK, vim-examples, or building an app inside an EHR.
---

<role>
You are an expert full-stack engineer building a production-quality reference application on the Vim Connect App SDK — a platform that lets one app run across many EHRs. You write clean, maintainable, idiomatic TypeScript/Next.js.
</role>

<task>
Produce a build plan (not code yet) for a Next.js application on the Vim SDK that implements the use case below. The <use_case> is deliberately brief — follow <intake> to close the gaps yourself before planning. The finished plan must be executable by an engineer or a coding agent in one pass, with no manual patching.
</task>

<use_case>
  goal:      <what the app should accomplish, in one line>
  trigger:   <when in the clinical workflow this fires>
  data:      <what it reads from the chart, if you know; otherwise leave blank>
  provider:  <what the provider sees and can act on>
  writeback: <what lands back in the chart, if anything; "none" or blank is fine>
</use_case>

<intake>
The use case above is intentionally short. Do the work of completing it yourself — do not ask the person to write a specification.

1. RESEARCH FIRST. Read the SDK reference and the sibling templates before asking anything. Determine: which event fires this trigger; what fields that entity actually carries; whether the data the use case needs exists on the entity or must be derived; and which sibling template already solved the closest problem.

2. INFER WHAT YOU CAN. Do not ask about anything determinable from the reference, the siblings, or ordinary domain knowledge. Assume by default: the app owns a bundled controlled data set; a dev simulator is required; the four UI states are required; and a Worker plus notification is required if the provider must be reached with the panel closed.

3. ASK AT MOST FIVE QUESTIONS, ALL IN ONE MESSAGE, and only where a wrong guess would be expensive to unwind. Propose your best answer inline so the person can confirm rather than compose. When an option carries a material tradeoff — patient-data handling, clinical-safety risk, incomplete or misleading output, or a pattern that shouldn't be copied into production — say so in the option itself rather than presenting it as a neutral choice. The person may not have the context to spot it, and a recommendation they can't evaluate is not a real choice. Limit them to:
   - The controlled data set(s) the app will own — state your proposed contents and scale, and its coverage implication: roughly what share of real cases will fall outside it, and what the user will see when they do.
   - Whether the flow is single-shot or has an asynchronous/pending stage.
   - Any standard, regulatory framework, or house rule the app must honor.
   - The v1 scope cut line — state what you propose to defer.
   - Anything the reference genuinely could not settle.
   Skip any question the use case already answers. If the use case answers all of them, ask nothing and plan immediately.

4. THEN PLAN. Open the plan with a short "Completed spec" paragraph restating goal, trigger, reads, domain data, backend boundaries, writeback, and scope — so the person can see exactly what you filled in on their behalf.
</intake>

<reference>
Use the official Vim SDK documentation as the authoritative reference for every entity field, event id, method signature, and type. Do not rely on prior/training knowledge of the SDK — read the reference.

If you are running in Claude Code, install and use the bundled docs skill so you read the live SDK reference (llms.txt / llms-full.txt) instead of parsing the full type bundle:

    mkdir -p .claude/skills
    cp -r node_modules/@vimconnect/app-sdk/skills/vim-app-sdk-docs .claude/skills/vim-app-sdk-docs

Otherwise load the reference directly:
  - <vim-docs-url>/llms.txt (index) and <vim-docs-url>/llms-full.txt (full content)
  - <vim-docs-url>/docs/ (human docs)

Mirror the official Vim demo app (https://github.com/vimconnect/vim-demo-app) and the sibling templates in the vim-examples GitHub repo (cds-app, sdoh-app, referral-leakage-app, price-transparency-app) for project structure, config, OAuth flow, and tooling. Read the siblings' working source, not just their docs — they encode solved problems. Do not search the local filesystem for them.
</reference>

<sdk_constraints>
Honor these platform facts; confirm specifics against the reference:
- The app runs as an iframe inside the Vim Hub. Follow the demo app's SDK initialization and OAuth "launch" flow (launch_id → authorize with scope "launch openid" and state "launchId:csrf" → server-side JSON code/token exchange with the client secret kept server-only → initVimSDK → setActivationStatus("ENABLED")).
- Reads come from workflow events (one-shot, carry an id), context (continuous, data under curr.fields), and the Entity API (on-demand). A workflow event carries only an id — you must do the follow-up Entity API fetch to get fields.
- The follow-up fetch can reject in the same tick the event fires ("not in the current EHR context") — a context-population race, not a real absence. Retry with backoff (~200/500/1000ms) and fall back to any inline entity on the event before giving up.
- Entity API namespaces that exist: patient, encounter, order (+ provider.getById()). There is NO referral namespace — read referrals via the referral_start:referral context key only.
- getProblems()/getPatient() can hit ENTITY_NOT_IN_CONTEXT as a transient cache race — retry once after ~300ms and keep last-good state; don't treat it as a real absence.
- Prefer the non-deprecated overloads. Entity API reads resolve their id from the current context and take no argument (getPatient(), getProblems(), getInsurances(), getOrderById()); the overloads that accept an explicit {patientId}/{orderId}/{encounterId} are marked deprecated. Don't pass ids you didn't need to pass.
- The Worker is a different SDK object with a different surface, not the UI SDK in a headless page. It comes from initWorkerVimSDK(), registers handlers rather than subscribing (one registration per event id, not an array), and delivers a short-lived handle whose API differs from the UI sdk's. Confirm the exact registration signature, the handle's validity-check method, and whether a given hub capability (e.g. panel-open state) is reachable from a Worker handle at all, against the reference and the sibling Workers — do not assume the UI form works there.
- Entities are thinner than you expect. Confirm every field you plan to read actually exists on the entity. Notably: an Order carries free-text name/reason and a coarse type, not a procedure code; Insurance gives a payer name, not a structured plan or network id. Existence in the type is also not evidence the field arrives at runtime: nearly every entity field is declared optional and a given EHR build populates only some of them (a confirmed example: real sandbox problem lists return Diagnosis.code and .description with no .system at all). Never gate logic on an optional field's value — use it to refine a result when present, and fall back to what is reliably there when it is not. The same applies to event payloads, and the failure there is worse: a workflow event carries entity REFERENCES, not populated entities, and an exception thrown inside an SDK subscription callback is swallowed — the app simply never advances, with no error state and no log to point at. Never destructure an event payload without guarding it, and never let a handler's only path to dispatching depend on a field the event may not carry. Derive what you can from the event, guard what you cannot, and let the follow-up Entity API read be the real source.
- Capability is declared at runtime, not compiled in. Two kinds of absence are not the same thing. A STRUCTURAL absence is a property of the SDK itself — a namespace that does not exist, a concept the platform has no notion of — and the facts in this section are of that kind. A CAPABILITY absence is what a given session supports: whether a writeback target is configured, whether a field is populated, whether an operation is available. Coverage expands as the platform adds capabilities, so a capability claim inherited from these constraints, from a sibling template's notes, or from the docs may already be stale. Read getManifest() and getCapability() and let the answer come from the session. Feature-detect and degrade gracefully rather than hardcoding — that is what lets one app keep working as coverage grows. When an intake question depends on a capability, check before you ask; never hand someone a stale capability claim as a premise they have to accept.
- All writeback goes through the permission ceremony: getCapability('update') → requestPermission('update',{fields}) if requestable → hasPermission('update') → update(NESTED object, { mode }). Dot-notation keys throw. The available modes differ by surface — confirm the exact union against the installed types for the surface you are on rather than assuming they match: the UI writeback and the Worker's writeback handle do not expose the same set. Which entities and fields are writable comes from getManifest().contextWriteback for the current session — read it rather than assuming; EntityTypeMap declares writeback for patient, encounter, order, referral and providerRecord, and the manifest says which are configured. If no writable target is available for what you want to write, do not invent one — display the value for the provider instead, and say so in the plan.
- SDKError is not exported at runtime — duck-type on err.code, never instanceof.
- Don't assume capabilities the platform may not expose (a gaps/insights feed, a problem-list write, a medication write, a CRM/coordinator surface, FHIR/CQL/Questionnaire support, payer or network connectivity). If the use case needs one, put it in the app's own backend and name that boundary in the plan.
- A workflow event reports a MOMENT, not current state, and it is one-shot. Your panel may mount after it fired — a provider who opens the chart first and clicks your app second will never receive it — so an event must never be the only path by which the app learns a patient is present. Derive present-state from the matching context key, which reports what is true now, and treat the event as an accelerator for the case where the panel was already open. An app that sets its "ready" flag only from the event sits at its waiting state forever in the most common real usage order.
- Workflow events fire on entry only — there is no chart_close, encounter_close, or equivalent. If your app displays entity-scoped data, also subscribe to the matching context key and treat currentData === undefined as the teardown signal, resetting to the waiting state. Without this the panel keeps showing the previous patient's results after the provider navigates away. Do not try to identify which entity left from the closing payload — it is partial and may not carry identifiers; the transition to empty is itself the signal, and testing presence means Boolean(current), never reaching into it for a nested id.
- For patient-scoped data this means watching BOTH patient context keys, not one. They interleave: opening an encounter from within a chart empties chart_open:patient while encounter_open:patient populates — the patient has not left. Track presence from each key separately and reset only when both are empty, and only on a true present-to-absent transition (a reconcile that fires whenever nothing is present will reset spuriously during startup and context churn). Watching a single key produces a worse bug than the stale panel it was meant to fix: it tears down in-flight work every time the provider opens an encounter.
- The platform is in alpha; some events and entity fields are mapped but not yet live in the sandbox EHR. If the use case's trigger does not fire, do NOT redesign around a different trigger. Build to the correct trigger, make the app fully exercisable through the dev simulator, and note which triggers are unverified so they can be re-tested when the platform enables them.
- Build the Worker (offscreen/) only if the provider would miss something actionable with the app panel closed. Apply the test honestly: if the trigger already puts the provider in front of the app, or the insight is visible in the panel they just opened, a Worker adds noise, and the plan should say why it isn't needed instead of building one. When a Worker is warranted, it observes headlessly and its notification opens the UI app via launchPayload; a notification fired from the UI app is redundant, since a UI app only runs while its panel is open. Reuse the same pure domain logic as the UI path; never fork it. Respect the Worker handle's TTL: check validity before use and after every await. Throttle repeat notifications for stable findings, and suppress entirely when the panel is already open.
</sdk_constraints>

<architecture_patterns>
These are the house patterns across the templates. Apply the ones the use case calls for.

Prefer the simplest structure that satisfies the use case. Do not apply a pattern the use case does not require — a single-step read-evaluate-display app needs no state machine, no backend store, and no Worker. When you decline a pattern, say so in a sentence rather than silently omitting it, so the reader can see it was considered. Plan length should track the use case's actual complexity, not this list's.

- CONTROLLED DATA. Every code, provider, price, question, or option the app proposes comes from a bundled data set the app owns. Never free text, never model-authored. If an LLM is used at all, it may only rank or explain an already-retrieved shortlist, behind a membership check, with a deterministic fallback when it fails or is unconfigured.

- MISSING ENTITY FIELDS → CROSSWALK. When the use case needs a value the entity does not carry, resolve it with a bundled crosswalk returning an explicit confidence (high | ambiguous | none) and never invent a value. "none" is a distinct outcome from the negative case ("not required", "no match") and must be modeled and surfaced as such, never conflated.

- COARSE CONTEXT → APP-OWNED MAPPING. Where the SDK gives a name rather than an id (payer, plan, network), map it in an app-owned name-matching table.

- MULTI-STEP OR ASYNC FLOWS → PURE STATE MACHINE. If the flow has more than one step or can pend, model the lifecycle as a discriminated union plus a pure transition(state, input) reducer. Every state named anywhere in the plan must exist in the union; every input the UI can produce must have a transition; out-of-order inputs are no-ops, not throws. This makes the lifecycle testable with no network.

- APP BACKEND CONTRACT. Anything the SDK does not expose lives behind the app's own API routes. Define the request/response contract so a real integration later replaces only the route internals, leaving domain logic and UI untouched. State this explicitly in the plan. Where a route calls a real external API, verify its query semantics empirically before designing around them — issue real calls and read the results rather than assuming a search matches literally, or that identifiers you already hold are ones the API accepts. Confirm both recall and precision on a representative term; a search that silently returns plausible-looking but unrelated results is the failure mode that reads as working software.

- BACKEND STATE MUST SURVIVE REQUESTS. If one route writes state another route reads (submit → poll), a bare module-level variable will not survive route re-instantiation in dev or serverless. Pin it to globalThis or persist to a file, and say which in the plan.

- WHAT MAY BE STORED. Persist only app-generated state: request ids, submission status, decisions, dedupe markers, and the identifiers needed to correlate them. Never persist observed patient or clinical data outside the EHR — not to disk, not to a long-lived in-memory store, not keyed by patient id. The EHR is the system of record; this app is a workflow surface on top of it. If a use case appears to need accumulated clinical history, note that the SDK exposes no history read and that building your own store is not the workaround: scope v1 to what is readable at the moment of the trigger, label it honestly in the UI as what it is, and name the missing platform capability in open questions. Where a fuller experience is wanted, the right shape is an app-owned backend the implementer wires to their own source of truth (their EHR's history API, an HIE, a claims feed), which the plan names as a boundary rather than filling itself.

- ASYNC RESOLUTION AND NOTIFICATION. If work resolves later, say how the provider learns: poll while the panel is open (fixed interval, cleared on unmount and on terminal state, bounded attempts), and a Worker notification when it is not. Scope every notification to the patient and request it belongs to — never surface one patient's result while another patient's chart is open. Suppress the Worker notification when the UI panel is already open (check sdk.hub.appState.isAppOpen) so the Worker never duplicates what the provider is already looking at. If the platform offers no timer primitive for deferred work, say so and flag your approach as unverified rather than presenting it as idiomatic.
</architecture_patterns>

<scaffolding>
You will scaffold from a sibling template (preferred — pick the closest one) or the demo app. Reuse the plumbing; replace the identity and presentation. Before the build is done:
- Clear the source app's identity from package.json entirely: set "name" and "description" to this app's own, drop stale keywords, and remove inherited "homepage" and "repository" fields. Remove scripts that reference another project's monorepo (dev:local-sdk, build-deps); scripts should be limited to dev, build, start, type-check, test.
- Remove all demo UI chrome from every rendered view: status/"Connected" badges, "SDK Explorer" buttons/routes and their props, raw-JSON/context-dump panels, and any classic/debug view toggle.
- Remove demo CSS classes and styles your UI doesn't use. Do not build your real UI on another app's class vocabulary.
- Delete files the use case doesn't need (api/health, worker-demo.ts, capability-engine.ts, RawOutput.tsx, clipboard.ts, vim-sdk.js, the source app's README). Keep offscreen/ if you built a Worker. Before deleting each file, confirm nothing still imports it; if something does, remove that usage first.
- Copy the repo's convention files so this template matches its siblings: README.md (describing THIS app, including how to run it under SIM_MODE), CLAUDE.md, llms.txt, LICENSE.
- Scaffold into the CURRENT directory; do not nest a folder of the same name. Confirm package.json is at the project root before writing code.
- Verification gate (run before declaring done): `grep -rniE "demo-card|SDK Explorer|onOpenExplorer|vim-sdk-demo-app|CapabilityAutoRunner|vim-demo-app|reference implementation" src/ package.json` must return nothing unless intentionally used.
</scaffolding>

<engineering_principles>
- Apply SOLID and GRASP. Isolate all SDK access behind one thin client module per surface (UI and Worker) so the rest of the app depends on narrow local types, not the SDK. Keep domain logic (rules, vocabulary, evaluation, state) pure and free of SDK/EHR dependencies so it is unit-testable in isolation. The UI and the Worker call the same pure logic; never fork it.
- No orphaned or debug code in the final build. If you add temporary logging or scaffolding to verify a step, remove it before that step's checkpoint. Every route, component, prop, and CSS class in the final tree must be reachable from the app's real UI or a real code path. When you remove a component or prop, fix its call sites in the same edit so the type-check stays clean.
- Match the demo app's conventions: src/ layout, its lib/ config helpers, an .env / .env.local split with the client secret server-only, and Vitest. Name the Vitest config vitest.config.mts (or set "type":"module").
- Pin @vimconnect/app-sdk to the same version the sibling templates use, not merely the latest. If you must move to a newer version, say so explicitly rather than diverging silently.
- Ship a dev-only simulator so the app is runnable without an EHR: a fixtures module with realistic entity payloads covering every branch of the domain model, a /dev/harness page that drives the pure logic and renders the real UI, and an injection point in the SDK client so subscriptions can be fed from the simulator. The simulator must drive the SAME code path as the real SDK client, not bypass it: feed fixtures in at the client boundary so they pass through the same mapping, extraction, and normalization the live path uses, and never dispatch pre-formed domain objects or reducer inputs directly. A harness that hand-constructs the value a broken mapper would have produced will pass while the real path fails. Fixtures must include payloads with optional fields absent, not only fully-populated ones. Gate everything behind NEXT_PUBLIC_SIM_MODE === 'true', off by default, with the real SDK path untouched and the harness unreachable when the flag is unset. Document it in the README as the local-run path, and state plainly that it proves the app handles an event correctly, not that the event fires in a live EHR. When the flag is active, say so in the rendered UI — a small, unmissable banner in the app's own surface, not just a console line. A simulator seam that silently replaces the live SDK path is the worst kind of failure: the app connects, subscribes, and reports no error while being permanently inert against a real EHR, because the subscriptions went into the simulator's listener arrays and nothing in a real EHR will ever call them. The mode must be visible from the screen the developer is already looking at.
- Testing strategy: Vitest over the pure domain logic, runnable with no EHR, no SDK, and no .env file present. UI and integration are verified live in an EHR.
</engineering_principles>

<ui_guidance>
Build a clean, minimal, neutral UI — not raw plumbing, and not an opinionated design system. The target is one well-spaced card with readable type and restrained styling, easy for a developer to restyle later (semantic structure, minimal custom CSS, no hard-coded design system).
- Always implement four explicit states: connecting, empty / waiting-for-context, result, and error. Never leave a bare "Connected" message or an unstyled gray box as the finished UI.
- Surface undetermined and ambiguous outcomes distinctly from negative ones; a provider must be able to tell "no action needed" from "we couldn't tell." Where the UI labels how strongly something is evidenced, that label must reflect the weakest link in the chain from source data to the claim, not the confidence of the lookup that produced it: a value derived from an area-level, population-level, or otherwise group-level proxy is inferred about an individual no matter how exactly the lookup matched. Reserve "confirmed" for what the chart asserts about this patient. The test is one question — does the source say this about this person, or about a group they belong to? The same discipline governs how a finding is named, not just how it is labeled: state what the data shows, not the clinical conclusion it suggests. "No matching problem on the list" is a description; "no longer indicated" is a judgment the chart did not make. An honest evidence label does not rescue a title that overclaims, because the title is what a busy reader actually reads.
- Do not carry over the source app's styling, classes, or debug views.
</ui_guidance>

<deliverable>
Return a plan with the sections below. Scale it to the use case: a section that doesn't apply (a transition table for a single-step app, a backend contract for an app with no backend) should be one line saying so and why, not padded to match the others. A simple app should produce a short plan.

0. Completed spec — one short paragraph restating what you filled in on the person's behalf (goal, trigger, reads, domain data, backend boundaries, writeback, scope).
1. A one-paragraph summary and the clearest end-to-end demo moment.
2. The architecture: EHR context → domain logic → UI → writeback, plus where the app's own backend fits. Name the SDK boundary explicitly.
3. The exact SDK reads, events, and writes used, with the field and method names from the reference, each annotated with where you confirmed it (reference, sibling source, or unverified).
4. The domain model: types, controlled data sets, and — if the flow is multi-step — the full state union and transition table, kept SDK-free.
5. A build order that front-loads the highest-risk piece (auth/connection), lets pure domain logic proceed in parallel, then builds one vertical slice (read → reason → render → act) at a time. Build the dev simulator early enough that every slice which says "verify through the harness" can actually do so when that step runs. Include scaffolding cleanup and the convention files as explicit steps.
6. What sits outside the SDK for this use case, and how the backend covers it.
7. The Vitest test plan for the domain logic.
8. The dev simulator plan: the fixture scenarios and how SIM_MODE is gated.
9. Open questions, anything unconfirmed in the reference, and any trigger or field that is mapped but not yet live.
</deliverable>

<plan_review>
Before you output the plan, check it against this list and fix what fails. Do not report the checklist — just deliver a plan that passes it.
1. TYPE INVENTORY. Enumerate every type, interface, and state name you referenced anywhere in the plan — in prose, tables, signatures, and the test plan. For each one, confirm a definition block for it appears in the plan. Do this as an explicit pass, not an impression; the most common defect is a type used in a function signature or an input union that was never defined (e.g. a rule-result or engine-result type). Add any missing definition before you output.
2. No derived or conditional types (Exclude, Omit, Extract, Pick) in the definition of a recursive discriminated union — a union member that references the union it belongs to will fail to compile as "circularly references itself." Declare the intended subset as its own explicitly named union and reference that instead.
3. Every constant, input variant, and state you define is actually used: every constant is read somewhere, every input in the union is dispatched by something named in the plan, and every state is reachable by at least one transition. Remove orphans or add the missing rule.
4. Every cross-reference resolves. Step and section numbers point at what they claim, and no step depends on an artifact that a later step creates — if a step says "verify via X," X must already exist by then.
5. Every environment variable, config flag, or file the plan references is created by an explicit step (including additions to .env.local.example).
6. Every behavior the use case implies is either built in the plan or listed in the open-questions section as a deliberate v1 limitation. Nothing the person asked for silently goes missing.
7. Every outcome described in prose or in the test plan exists in the type definitions — including negative, ambiguous, and undetermined outcomes.
8. Every demo moment named in section 1 has a complete path through the states, inputs, and UI described later. If a demo moment has no transition that produces it, add one.
9. Every backend route that reads state another route wrote says how that state persists across requests.
10. Every polling or retry loop states its interval, its cleanup, and its bound — and each bound is actually enforced by a named rule, not just declared as a constant.
11. Every notification states what scopes it (which patient, which request) and when it is suppressed.
12. The build steps include the convention files (README.md, CLAUDE.md, llms.txt, LICENSE) and the scaffolding verification gate.
13. Every step requiring a human (app registration, credentials, live EHR testing) is labeled a handoff, so the build stops cleanly instead of inventing values.
14. Every simulator fixture maps to at least one branch of the domain model, and every branch has at least one fixture.
15. Nothing in the plan requires the person to hand-edit it before the build can start.
</plan_review>
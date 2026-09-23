---
name: integrate-vim-sdk
description: Use when adding Vim Connect to an application that already exists — integrating the Vim App SDK (@vimconnect/app-sdk) into an existing codebase, migrating an app from Vim's older SDK to the new one, or making an existing product run inside an EHR through the Vim Connect hub. Covers the OAuth launch flow, the SDK client boundary, EHR context reads, presence and teardown, writeback, and testing without an EHR. Trigger on any mention of integrating, migrating, adding, or porting an app to Vim Connect or the Vim SDK.
---

<role>
You are an expert full-stack engineer adding the Vim Connect App SDK to an application that already exists. You work with the codebase you are given — its framework, its conventions, its structure — and add the Vim layer around it. You do not restructure someone else's app.
</role>

<task>
Integrate the Vim App SDK into the existing application in this working directory, so it runs inside an EHR through the Vim Connect hub and reacts to clinical workflow events. Produce a plan first, then execute it. Present the plan briefly and offer to proceed rather than ending your turn.
</task>

<hard_constraints>
- DO NOT scaffold a new app, and do not restructure the existing one. No new framework, no moved directories, no reorganised source tree. You are adding a layer, not rebuilding.
- Match the existing codebase's conventions — language, module style, routing, state management, test framework, formatting. If it uses Vite, do not introduce Next.js. If it uses classes, do not convert to hooks. If it uses a state library, use it rather than adding another.
- Touch the minimum surface that makes the integration work. Every file you add or change should be defensible as "this is Vim integration."
- Never put CLIENT_SECRET anywhere the browser can reach it. This constrains the architecture — see discovery step 2.
</hard_constraints>

<discovery>
Read the codebase before proposing anything. Establish, in this order:

1. **Framework and router.** Next.js App Router, Next Pages Router, Vite + React Router, CRA, Remix, SvelteKit, plain SPA, something else. This determines where the launch and token endpoints can live and how routes are declared.

2. **IS THERE A SERVER?** This is the blocking question and it comes first, before anything else is worth planning. The OAuth code-for-token exchange uses CLIENT_SECRET and must run server-side. If the app is a pure client-side SPA served as static files, it cannot complete the Vim launch flow as it stands.

   If there is no server-side execution available, say so immediately and plainly, and give the options: add a minimal serverless function (Vercel/Netlify/Cloudflare) alongside the existing deploy, route through a backend they already run elsewhere, or stop and decide before any code is written. Do not design around it, do not defer it to a later step, and never place the secret in the client bundle or a public env var. Getting this wrong means building most of an integration that cannot work.

3. **Is Vim's older SDK already present?** If so, it is your best specification — read it thoroughly before changing anything. Inventory:
   - which events or hooks it subscribes to
   - what data it reads, and from where
   - what it writes back, and to which fields
   - where each result surfaces in the UI
   - any permission or capability checks it performs

   That inventory is the behaviour the new integration must reproduce. Put it in the plan explicitly, so nothing silently disappears in the move.

4. **What UI belongs in the panel?** The app runs in a narrow iframe sidebar inside the Vim Hub, not as a full page. Identify which existing component or view should appear there. It may need a narrower layout; it should not need a rewrite. If several are plausible, ask.

5. **Existing auth and routing.** Does the app have auth that would intercept the Vim entry points? Are there route guards, middleware, or redirects the launch and callback routes must bypass? Vim's flow arrives unauthenticated from the app's own perspective.

6. **Testing setup.** What test runner is already in use? The simulator seam and any pure logic you add should fit it, not introduce a second framework.
</discovery>

<intake>
After discovery, ask AT MOST FIVE QUESTIONS, all in one message, with your proposed answer inline so the person can confirm rather than compose. Ask only what discovery could not settle. Likely candidates:

- **The clinical moment** — which workflow event should bring the app forward (a chart opening, a referral starting, an order being placed)? Propose one based on what the app does, and say why.
- **Which existing view goes in the panel**, if discovery found more than one candidate.
- **Whether the app should write anything back to the chart**, and what. Default to no: display the result and let the provider act, unless a writable target is confirmed and the use case genuinely needs it.
- **Confirmation of your old-SDK inventory**, if one is present — "here is everything I found the current integration doing; is that complete?"
- **The server question from discovery**, if it is unresolved.

When an option carries a material tradeoff — patient-data handling, a pattern that shouldn't reach production, work that would be thrown away — say so in the option itself rather than presenting it as a neutral choice.

Skip anything already answered. If everything is settled, plan immediately.
</intake>

<reference>
Read these before writing any SDK code:

- https://developer-docs.getvim.ai/llms.txt (index) and llms-full.txt (full content)
- https://github.com/hunter-cottrill/vim-examples/blob/main/docs/vim-sdk-notes.md — the shared verified surface and known runtime gotchas

Where either disagrees with the installed types, the types win: read
`node_modules/@vimconnect/app-sdk/dist/index.d.ts` directly.

Once the package is installed, also copy in the SDK's bundled docs skill for the rest of
the build:

    mkdir -p .claude/skills
    cp -r node_modules/@vimconnect/app-sdk/skills/vim-app-sdk-docs .claude/skills/vim-app-sdk-docs

The templates at https://github.com/hunter-cottrill/vim-examples/tree/main/templates are
worked examples of every piece below — the launch flow, the client boundary, presence
tracking, the simulator seam. Read their source for the pattern; do not copy their project
structure into this app.
</reference>

<sdk_constraints>
The constraints that most often bite an integration:

- **Capability is declared at runtime.** Read `getManifest()` and `getCapability()` rather than assuming from the types, from these notes, or from any document. Coverage expands as the platform adds capabilities, so a negative claim you read anywhere may already be stale. Feature-detect and degrade gracefully.
- **A workflow event reports a moment and is one-shot.** The panel may mount after it fired — a provider who opens the chart first and clicks the app second never receives it. Derive present-state from the matching context key, which reports what is true now, and treat the event as an accelerator. An app that sets its ready flag only from the event sits at its waiting state forever in the most common usage order.
- **There is no teardown event.** No `chart_close`. Detect the patient leaving from the context key emptying. For patient-scoped data, watch BOTH patient context keys — opening an encounter from within a chart empties `chart_open:patient` while `encounter_open:patient` populates, and the patient has not left. Reset only when both are empty, and only on a true present-to-absent transition. Test presence with `Boolean(current)`; never reach into the closing payload for a nested id.
- **A workflow event carries entity references, not populated entities.** Do the follow-up Entity API read. Guard before destructuring: an exception thrown inside an SDK subscription callback is swallowed, so the app silently never advances, with no error state and no log.
- **Entity fields are optional and frequently absent at runtime.** Existence in the type is not evidence the field arrives. Never gate logic on an optional field's value — use it to refine when present, fall back to what is reliably there when it is not.
- **Entity API reads resolve their id from context and take no argument.** The overloads accepting an explicit id are deprecated.
- **Reads can reject with ENTITY_NOT_IN_CONTEXT in the same tick an event fires** — a context-population race, not a real absence. Retry with backoff (~200/500/1000ms) before giving up.
- **SDKError is not exported at runtime** — duck-type on `err.code`, never `instanceof`. A method may also be absent from a namespace entirely on a given build (`TypeError: not a function`), which is distinct from `NOT_IMPLEMENTED`.
- **Writeback goes through the permission ceremony:** `getCapability('update')` → `requestPermission('update', {fields})` if requestable → `hasPermission('update')` → `update(NESTED object, { mode })`. Dot-notation keys throw. Which targets are writable comes from `getManifest().contextWriteback` for the current session. If no target is available for what you want to write, display the value instead — do not repurpose an unrelated field.
- **Registration must match what you serve.** The registered Launch, Token, and Allowed iframe URLs, the port the app runs on, and the redirect URI all have to agree; a mismatch produces a generic failure that looks like an application bug. Leave the Worker Launch Endpoint blank unless a Worker is actually built, or the hub will request it and 404 on every load.
- **CSP:** the app is framed by the Vim Connect Chrome extension, not by the EHR. If `frame-ancestors` is set at all, the only origin needed is `chrome-extension://hkgoafgiinlkilinanffdoehogbhckeo`. There is no EHR domain list.
</sdk_constraints>

<what_to_add>
Roughly these pieces. Place each according to the app's own conventions, not a fixed layout.

1. **Launch endpoint** — receives `launch_id`, mints and stores a CSRF token, redirects to Vim's authorize URL with `scope="launch openid"` and `state="launchId:csrf"`.
2. **Callback and token exchange** — validates CSRF from `state`, then a server-side JSON POST of the code for an access token. CLIENT_SECRET never reaches the client.
3. **One SDK client module** — the only place that imports `@vimconnect/app-sdk`. Everything else depends on narrow local types. This is the single most valuable structural decision: it keeps the SDK from spreading through the codebase and makes everything else testable without it.
4. **Panel entry point** — initialises the SDK, sets activation status to ENABLED, and renders the existing UI chosen in discovery.
5. **Subscriptions** — the trigger event, plus present-state and teardown from the context keys.
6. **Reads** — the Entity API calls the app needs, behind the client module, translated into the app's own existing types rather than leaking SDK types outward.
7. **Writeback**, only where a target is confirmed and the use case needs it.
8. **A simulator seam** — fixtures fed in at the client boundary so they pass through the same mapping the live path uses, gated behind an env flag, off by default, with the real SDK path untouched when unset. Show a visible banner when it is active: a seam that silently replaces the live path means the app connects, reports no error, and stays inert.
9. **Configuration** — an env example listing CLIENT_ID, CLIENT_SECRET, and the environment, with the secret server-only and the example file carrying placeholders only.
</what_to_add>

<removal>
If the older SDK was present, removing it is a first-class step, not cleanup at the end.

Leftover subscriptions still fire. Leftover imports keep a dead dependency installed. A half-migrated app that appears to work is worse than one that obviously does not.

- Remove every import, subscription, call, type reference, and config entry belonging to the old integration.
- Remove the old package from `package.json`.
- Fix every call site in the same edit, so the type-check stays clean at each step rather than at the end.
- **Verification gate before declaring done:** grep the source tree for the old package name and for its distinctive method and event names. Anything that returns must be intentional and explained in your summary.
</removal>

<deliverable>
Return a plan with:

0. **What you found** — framework and router, whether server-side execution is available, whether the older SDK is present, and if so a complete inventory of what it currently does.
1. **The clinical moment** and which existing UI goes in the panel.
2. **Every file you will add, and every existing file you will change**, each with one line on why.
3. **The SDK reads, events, and writes**, named against the reference, each annotated with where you confirmed it — reference, template source, or unverified.
4. **The removal plan**, if the older SDK is present, with its verification gate.
5. **How to test without an EHR** — the simulator seam and what it proves (that the app handles an event correctly, not that the event fires in a live EHR).
6. **What needs a human** — developer account request, app registration in Vim Console, credentials, live EHR verification. Label these as handoffs and stop cleanly rather than inventing values.
7. **Anything unresolved or unverified**, including any capability you could not confirm from the manifest.

Keep it proportional. A small app integrating one event does not need a long plan.
</deliverable>

<review>
Before you output the plan, check it and fix what fails. Do not report the checklist.

1. Nothing in the plan restructures the existing app or introduces a framework, library, or convention it does not already use.
2. The server-side question is answered explicitly, and CLIENT_SECRET is server-only everywhere it appears.
3. If the older SDK is present, every behaviour in your inventory is either reproduced in the new integration or listed as a deliberate drop with a reason.
4. Present-state comes from a context key, not only from the workflow event.
5. Teardown watches both patient context keys and resets only on a true present-to-absent transition.
6. Every capability claim is sourced from `getManifest()`/`getCapability()` at runtime, not asserted from a document.
7. Every file you add is listed, and every existing file you change is listed.
8. Every step needing a human is labelled a handoff.
9. Nothing in the plan requires the person to hand-edit it before work can start.
</review>

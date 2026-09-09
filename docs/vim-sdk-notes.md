# Vim App SDK — notes for AI coding agents

> The shared, verified surface behind the official reference. Read this alongside, not
> instead of:
>
> - **Live reference (upstream, authoritative):** https://developer-docs.getvim.ai/llms.txt
>   (index) and `llms-full.txt` (full content)
> - **Bundled docs skill**, once dependencies are installed:
>   `cp -r node_modules/@vimconnect/app-sdk/skills/vim-app-sdk-docs .claude/skills/`
>
> This file records what the docs don't yet say and what the installed types actually
> declare. Where they disagree, **the installed types win** — read
> `node_modules/@vimconnect/app-sdk/dist/index.d.ts`.
>
> Every template in this repo links here rather than keeping its own copy, so a correction
> lands in one place.

---

## Capability is declared at runtime

The single most important habit. Two kinds of absence are not the same thing:

- **Structural** — the SDK has no such namespace, no such concept. Stable. Stated as fact
  below.
- **Capability** — what the current session supports: whether a writeback target is
  configured, whether a field is populated, whether an operation is available. Coverage
  expands as the platform adds capabilities, so a capability claim you read anywhere,
  including here, may already be stale.

Resolve capability from the session, never from a document:

```js
sdk.ehr.getManifest()                              // what this session supports
sdk.ehr.getManifest().contextWriteback             // writable entities and their fields
sdk.ehr.context.<entity>.getCapability('update')   // confirm before writing
```

Feature-detect and degrade gracefully rather than hardcoding. That is what lets one app keep
working as coverage grows.

---

## Package facts

- `@vimconnect/app-sdk`, ESM-only. Types at `dist/index.d.ts`.
- **Peer-depends on Zod v4** (not v3). Pin `zod@^4`.
- Pre-1.0 — re-verify signatures on upgrade. Templates pin an exact version; see each
  template's `package.json`.

---

## Auth (OAuth launch flow)

1. The extension opens your Launch endpoint as `/launch?launch_id=abc123`.
2. Redirect to `{backend}/app-auth/authorize` with `response_type=code`, `client_id`,
   `launch=abc123`, `scope="launch openid"`, `redirect_uri={origin}/app`,
   `state="abc123:<csrf>"`.
3. Vim redirects to `/app?code=…&state=…`. Validate CSRF from `state`.
4. Your **server** route POSTs JSON (not form-urlencoded, no `redirect_uri`) to
   `{backend}/app-auth/token`:
   `{ grant_type: "authorization_code", code, client_id, client_secret }`.
5. `initVimSDK({ accessToken })` → `sdk.hub.setActivationStatus("ENABLED")`.

Backend host is `api.getvim.ai` / `api.stage.getvim.ai` — note `api.`, not `app.`. Auth codes
are single-use; there is no refresh flow. `CLIENT_SECRET` is server-only.

**Registration must match what you serve.** The registered Launch, Token, and Allowed iframe
URLs, the port your app runs on, and the redirect URI all have to agree. A mismatch produces
a generic failure that looks like a code bug. If you register a Worker Launch endpoint for an
app that has no Worker, the Hub will request it and 404 on every load.

---

## The four EHR primitives

**1. Workflow events** — `chart_open`, `encounter_open`, `referral_start`, `referral_save`,
`order_select`, `order_sign`.

An event reports a **moment**, and it is **one-shot**. Your panel may mount after it fired —
a provider who opens the chart first and clicks your app second never receives it. An event
must never be the only path by which your app learns a patient is present. Events also carry
entity **references**, not populated entities; do the follow-up Entity API read.

**2. Context** — `chart_open:patient`, `encounter_open:encounter`, `encounter_open:patient`,
`referral_start:referral`. Data under `curr.fields`.

Context reports **what is true now**, which is why it's the source of present-state. It is
also the only teardown signal: there is no `chart_close`. Treat `current === undefined` as
the patient leaving.

For patient-scoped data, watch **both** patient keys. They interleave — opening an encounter
from within a chart empties `chart_open:patient` while `encounter_open:patient` populates.
Track presence per key, reset only when both are empty, and only on a true present-to-absent
transition. Test presence with `Boolean(current)`; never reach into the closing payload for a
nested id, since it is partial.

**3. Entity API** — on-demand reads. Prefer the no-arg overloads, which resolve the id from
context; the `{patientId}` / `{orderId}` forms are deprecated.

Reads can reject with `ENTITY_NOT_IN_CONTEXT` in the same tick an event fires — a
context-population race, not a real absence. Retry with backoff (200/500/1000ms) before
giving up.

**4. Writeback** — the ceremony, in order:

```js
const cap = sdk.ehr.context.encounter.getCapability('update');
if (cap.disruptive && cap.permissionState === 'requestable')
  await sdk.ehr.context.encounter.requestPermission('update', { fields: [...] });
if (sdk.ehr.context.encounter.hasPermission('update'))
  await sdk.ehr.context.encounter.update({ assessment: { diagnoses: [...] } }, { mode: 'append' });
```

`update()` takes a **nested object** — dot-notation keys throw `INVALID_DATA`.

Modes differ by surface: the UI's `sdk.ehr.context.<entity>` is typed `ContextWriteback<T>`
and accepts `'override' | 'merge' | 'append'`; the Worker's pre-authorized handle is
`ContextWritebackNamespace` and accepts only `'override' | 'append'`. The two are easy to
conflate — check which one your surface exposes.

`EntityTypeMap` declares writeback for **patient, encounter, order, referral, and
providerRecord**. Which of those are configured comes from
`getManifest().contextWriteback` — read it rather than assuming. If no target is available
for what you want to write, display the value for the provider instead; do not repurpose an
unrelated field.

---

## Entities are thinner than the types suggest

Nearly every entity field is declared optional, and a given build populates only some of
them. **Existence in the type is not evidence the field arrives at runtime.**

- `Diagnosis` — `code`, `status`, `system`, `onSetDate`, `description`, all optional.
  `system` is frequently absent in real problem lists; match on code shape and use `system`
  only to refine.
- `Medication` — `medicationName`, `ndcCode`, `strength`, `frequency`, `form`, `quantity`,
  `onSetDate`. **No `status` field** — you cannot distinguish active from discontinued.
- `Order` — free-text `orderName` and `reason`, a coarse `type` (`LAB | DI | PROCEDURE |
  RX`), and a `medication` sub-object for RX orders. **No procedure code** — resolve one with
  a bundled crosswalk.
- `Insurance` — `payerName`, `payerId`, `groupId`, `memberId`, `isPrimary`. Payer *name*, not
  a structured plan or network id.

Never gate logic on an optional field's value. Use it to refine when present; fall back to
what is reliably there when it is not.

The same applies to **event payloads**, and the failure there is worse: an exception thrown
inside an SDK subscription callback is swallowed, so the app simply never advances — no error
state, no log. Guard before destructuring.

---

## Errors

`SDKError` is declared in the types but **not exported by the compiled runtime bundle** —
`instanceof SDKError` never matches. Duck-type on `err.code`.

Codes seen in practice: `ENTITY_NOT_IN_CONTEXT`, `OPERATION_NOT_CONFIGURED`,
`PERMISSION_REQUIRED`, `INVALID_DATA`, `NOT_IMPLEMENTED`, `WRONG_CONTEXT`,
`CONNECTION_TIMEOUT`, `NOT_EXISTS`, `MISSING_REQUIRED_PARAMETER`, `MANIFEST_NOT_AVAILABLE`.

A method may also be **absent from a namespace entirely** on a given build — `TypeError: not
a function`, not a `NOT_IMPLEMENTED` code. Guard with `typeof fn === 'function'` before
calling anything the manifest hasn't confirmed.

---

## Workers

A Worker is a different SDK object with a different surface, not the UI SDK in a headless
page. It comes from `initWorkerVimSDK()`, **registers** handlers rather than subscribing (one
registration per event id, not an array), and delivers a short-lived handle.

- Handle TTL is short — check validity before use and **after every await**.
- `handle.close()` on every early exit.
- Panel-open state lives on the top-level worker SDK (`worker.hub.appState.isAppOpen`), not
  on the per-event handle.
- Notifications carry a `launchPayload`; the UI reads it once via
  `sdk.consumeLaunchContext()`.
- Build one only if the provider would miss something actionable with the panel closed.
  Suppress when the panel is already open, and throttle repeat notifications for stable
  findings.

---

## Structural absences — the platform has no concept of these

Distinct from capability gaps above; these are properties of the SDK, not of a session.

- **No `sdk.ehr.api.referral` namespace.** Referral data arrives via the
  `referral_start:referral` context key only.
- **No encounter-history or list read.** `encounter` exposes procedure codes for the
  encounter currently in context; there is no `getEncounters()`.
- **No order query or list.** `getOrderById()` resolves the order in context; you cannot ask
  what else is outstanding.
- **No gaps/insights feed**, no CRM, coordinator, task, or worklist surface.
- **No dispense, fill, or claims read.**
- **No FHIR client, CQL engine, or Questionnaire support.**
- **No timer or scheduler primitive** for deferred work in a Worker.
- **No teardown events** — see Context above.

If a use case needs one of these, it belongs behind your own backend, named as a boundary.

---

## Framework notes (Next.js App Router)

- `useSearchParams()` needs a `<Suspense>` wrapper.
- Guard init/redirect effects with a `useRef` so StrictMode doesn't double-fire.
- `NEXT_PUBLIC_*` is inlined at build time — restart the dev server after changing one.
- Name the Vitest config `vitest.config.mts`, or set `"type": "module"`.
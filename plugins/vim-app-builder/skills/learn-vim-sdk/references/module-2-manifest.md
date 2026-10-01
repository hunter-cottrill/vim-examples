# Module 2 · Checking what's available

## Why it matters

This is how one app works across many EHRs. Vim normalizes their differences, but it can't invent a capability an EHR doesn't have — so a well-built app asks what's available and adapts, instead of assuming. It's the difference between an app that quietly fails at one customer and an app that degrades gracefully everywhere.

## Predict

> If your app depends on a particular event or piece of data, how would you find out whether *this* EHR provides it?

### Answer key

There are two right answers, and the learner may give either:

- **The manifest** — `sdk.ehr.getManifest()` describes everything the session supports: its events, context keys, entities, and which entities accept writeback. This is the whole-session picture.
- **`getCapability`** — `getCapability('update')` on an entity's writeback namespace answers a narrower question: *can I write to this, right now?* It's real, and Module 6 uses it.

Credit either. Then give them the other, and the distinction: the manifest for the overall picture, `getCapability` for a specific action at the moment of acting.

If a learner names any other API, **check the installed types before saying it doesn't exist** — see the ground rules.

## Build

`describeSession()` — read the manifest and summarise it.

Reference implementation — Verified against `@vimconnect/app-sdk` 0.4.56. Build toward it in small steps; don't paste it wholesale.

```typescript
// ─── MODULE 2 · Checking what's available ───────────────────────────────────

/**
 * Read what this session supports. The manifest is the source of truth —
 * not the type definitions, and not the documentation.
 */
export function describeSession(): SessionSummary {
  const manifest: AppManifest = SIM_MODE ? SIM_MANIFEST : requireSdk().ehr.getManifest();
  return {
    events: manifest.supportedEvents.map((e) => e.id),
    contexts: manifest.supportedContexts.map((c) => c.contextKey),
    entities: manifest.supportedEntities.map((e) => e.type),
    writable: Object.entries(manifest.contextWriteback ?? {})
      .filter(([, entity]) => Boolean(entity?.update))
      .map(([type]) => type),
  };
}
```

Point at one thing: `contextWriteback` may be missing entirely, which is why it's read with `?? {}`. Not every session supports writing anything.

## Check

`npm test` — the Module 2 check should pass, and the panel now lists what the simulator supports.

## Break

Compare the panel's event list with the six events in `ALL_EVENTS`, in Module 3's section of the file. The simulator supports two.

Ask: *if your app relied on an event this session doesn't support, what would happen?*

- **Credit fully:** nothing — it never fires, and there's no error.
- **Then add:** that silence is why checking matters. In Module 7 they'll compare this with the real sandbox.

## Your app

> Which events or data does your app depend on most? What should it do in an EHR that doesn't provide one of them?

## Takeaway

Ask the session what it supports, and adapt. Don't assume.

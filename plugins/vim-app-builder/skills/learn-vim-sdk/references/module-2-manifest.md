# Module 2 · Checking what's available

**Goal:** learn to ask the session what it supports, instead of assuming.

## Predict

> Vim works across many EHRs, and they don't all expose the same things. If your app depends on a particular event or a particular piece of data, how would you find out whether *this* EHR provides it?

## Build

`describeSession()`. Read the manifest and summarise four things: the events it supports, the context keys, the entities, and which entities accept writeback. In the simulator, read `SIM_MANIFEST`.

**Reference implementation** — verified against `@vimconnect/app-sdk` 0.4.56. Build toward this in small steps and explain as you go; don't paste it wholesale.

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

Point at `contextWriteback`: it's optional, which is why it's read with `?? {}`. Not every session supports writing anything.

## Check

`npm test` — the Module 2 check should pass.

## Break

In the panel, Module 2 now lists what the simulator supports. Ask them to compare it against the six event types in `ALL_EVENTS` in Module 3's code.

Ask: *the simulator only lists two events. What happens if your app depends on one that isn't there?* It never fires. Nothing errors. The app just waits. That's why an app should read the manifest and adjust — and why "can the SDK do X?" is always answered by checking, not by assuming.

In Module 7 they'll see the real sandbox's manifest and compare it with this one.

## Takeaway

The manifest is the source of truth for what a session supports. Check it; don't assume.

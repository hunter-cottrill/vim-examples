# Module 2 · What this EHR supports

A quick module — no question.

**Say:** "EHRs don't all support the same things. Your app can ask Vim what this one supports, and adapt."

**Build** `describeSession`. Then one sentence: it reads the list of what this EHR session supports — events, data, and what can be written back.

Reference implementation — verified against the SDK version pinned in the reference solution. Build toward it; don't paste it at the learner.

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

**Check:** `npm test`. Then point at the panel's Module 2 card, which now lists what's supported.

**One line to finish:** "If your app relies on something an EHR doesn't support, it doesn't error — it just never happens. That's why apps check."

## In the Mock EHR

Build it without discussion, as part of the workshop setup in SKILL.md.

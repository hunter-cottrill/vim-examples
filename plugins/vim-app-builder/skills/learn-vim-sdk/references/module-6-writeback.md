# Module 6 · Writeback

**Goal:** write something back into the EHR, with the provider's permission, and handle the cases where you can't.

## Predict

> Your app wants to add a note to the patient's encounter. What should it have to check before it's allowed to?

## Build

`checkEncounterWriteback()` and `appendEncounterNote(text)`. The first reports whether writing is possible. The second follows the writeback ceremony. In the simulator, push the note onto `simWrites`.

**Reference implementation** — verified against `@vimconnect/app-sdk` 0.4.56. Build toward this in small steps and explain as you go; don't paste it wholesale.

```typescript
// ─── MODULE 6 · Writeback ───────────────────────────────────────────────────

const simWrites: string[] = [];

/** DEV-ONLY. What the simulator has "written" so far. */
export function simulatedWrites(): string[] {
  return [...simWrites];
}

/**
 * Can this session write to the encounter? The writeback namespace only exists
 * for entity types configured for writeback — so it can be missing at runtime
 * even though the types say it's always there.
 */
export function checkEncounterWriteback(): WritebackCheck {
  if (SIM_MODE) return { available: true, permissionState: 'granted', reason: null };
  const encounter = requireSdk().ehr.context.encounter;
  if (!encounter) return { available: false, permissionState: null, reason: 'No encounter writeback is configured for this session.' };
  const capability = encounter.getCapability('update');
  return {
    available: capability.available,
    permissionState: capability.permissionState ?? null,
    reason: capability.reason ?? null,
  };
}

/**
 * The writeback ceremony: check → request permission if needed → confirm →
 * write, using a nested object. 'append' adds to the note rather than
 * replacing it.
 */
export async function appendEncounterNote(text: string): Promise<WriteResult> {
  if (SIM_MODE) {
    simWrites.push(text);
    return 'written';
  }
  const encounter = requireSdk().ehr.context.encounter;
  if (!encounter) return 'unavailable';

  const capability = encounter.getCapability('update');
  if (!capability.available) return 'unavailable';
  if (capability.permissionState === 'requestable') {
    await encounter.requestPermission('update', { fields: ['plan'] });
  }
  if (!encounter.hasPermission('update')) return 'denied';

  try {
    await encounter.update({ plan: { generalNotes: text } }, { mode: 'append' });
    return 'written';
  } catch {
    return 'failed';
  }
}
```

Walk through the ceremony — it's the same four steps for every writeback:

1. **Check capability** with `getCapability('update')`. Is writing possible here at all?
2. **Request permission** if it's `requestable`. This is where the provider is asked.
3. **Confirm** with `hasPermission('update')`.
4. **Write** with `update()`, using a nested object — `{ plan: { generalNotes } }`, never a dotted key like `'plan.generalNotes'`, which throws. `mode: 'append'` adds to the existing note instead of replacing it.

And point at the first check in both functions: `if (!encounter)`. The types say `sdk.ehr.context.encounter` always exists, but it's only present when writeback is configured for that entity in this session. The types say one thing; the runtime can say another. That's the manifest lesson from Module 2, showing up in code.

## Check

`npm test` — the Module 6 check should pass.

## Break

1. **Open chart**, type a note in Module 6, and click **Append to encounter note**. The result reads `written`.
2. Ask: *in the simulator, writeback is always available. In a real EHR, what would the panel show if this session had no encounter writeback configured?* "Not available here", with the reason. The app degrades instead of crashing.

In Module 7, they'll find out what the real sandbox allows.

## Takeaway

Writing back always goes through the capability check and the provider's permission — and it may not be available at all.

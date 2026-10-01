# Module 6 · Writeback

## Why it matters

Writeback turns an app from a sidebar into part of the clinical record — a note, a diagnosis, a documented action, without the provider retyping it. It's also where trust is earned: the provider stays in control of what goes into their chart.

## Predict

> Your app wants to add a note to the patient's encounter. What should it check first?

### Answer key

- **Credit fully:** whether writing is possible here, and whether the provider has given permission.
- **Credit partly:** "that there's an encounter open" — right, and it's the first check. Then add the other two: is writing supported in this session, and has the provider allowed it?

## Build

`checkEncounterWriteback()` and `appendEncounterNote(text)`.

Reference implementation — Verified against `@vimconnect/app-sdk` 0.4.56. Build toward it in small steps; don't paste it wholesale.

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

Point at the sequence, in plain terms. Every writeback follows the same steps: **check** that writing is possible, **ask** the provider if needed, **confirm** permission was granted, then **write**. The provider always has the final say.

## Check

`npm test` — the Module 6 check should pass.

## Break

**Open chart**, type a note, and click **Append to encounter note**. The result is `written`.

Ask: *in a real EHR where this session can't write to the encounter, what should the app do?*

- **Credit fully:** tell the provider it isn't available here, instead of failing.

In Module 7 they'll see what the sandbox allows.

## Your app

> What would your app write back to the chart, if anything? What should it do when it can't?

## Under the hood — only if asked

`getCapability` and the write target both come from the session. The types declare `sdk.ehr.context.encounter` as always present, but it's only there when writeback is configured — hence the `if (!encounter)` guard. `update` takes a nested object, `{ plan: { generalNotes } }`, not a dotted key, and `mode: 'append'` adds to the note instead of replacing it.

## Takeaway

Writeback puts your app's work into the chart — always with the provider's permission, and only where it's supported.

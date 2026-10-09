# Module 6 · Writing back

**Why it matters, in one sentence:** Writeback puts your app's work into the chart — always with the provider's permission.

**Ask exactly:**
> Before your app adds a note to a patient's encounter, what should it check?

**Build** `checkEncounterWriteback` and `appendEncounterNote`. One or two sentences: they check whether writing is possible here, ask the provider if needed, then add the note.

Reference implementation — verified against the SDK version pinned in the reference solution. Build toward it; don't paste it at the learner.

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

**Check:** `npm test`.

**Try it (simulator):** **Open chart**, type a note in the Writeback card, and click **Append to encounter note**. The result says *written*.

**Then ask:** "Does that match what you predicted?"

**Explain, in two or three sentences:** every write follows the same steps — check it's possible, ask the provider, confirm, then write. Where an EHR doesn't support writing, the app says so instead of failing.

**Takeaway:** Writing back keeps the provider in control.

## In the Mock EHR

Skip this module unless the facilitator says otherwise — it's covered on the slides.

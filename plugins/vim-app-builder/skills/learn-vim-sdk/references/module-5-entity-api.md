# Module 5 · Reading the chart

**Why it matters, in one sentence:** Once your app knows who's on screen, it can read their chart — problems, medications, allergies, and more.

**Ask exactly:**
> When your app asks the EHR for a patient's name and problem list, what might come back?

**Build** `fetchPatient` and `fetchProblems`. One or two sentences: they read the patient and their problem list for whoever is on screen, and anything missing becomes "not provided" rather than an error.

Reference implementation — verified against the SDK version pinned in the reference solution. Build toward it; don't paste it at the learner.

```typescript
// ─── MODULE 5 · Entity API ──────────────────────────────────────────────────

function toLoadable<T, U>(outcome: RetryOutcome<T>, map: (data: T) => U): Loadable<U> {
  if (outcome.outcome === 'loaded') return { kind: 'loaded', data: map(outcome.data) };
  if (outcome.outcome === 'unsupported') return { kind: 'unsupported' };
  return { kind: 'error', message: outcome.message };
}

/** Every field is optional — read defensively and fall back to null. */
function toPatientCard(patient: Patient): PatientCard {
  const first = patient.demographics?.firstName;
  const last = patient.demographics?.lastName;
  const name = [first, last].filter(Boolean).join(' ');
  return {
    name: name.length > 0 ? name : null,
    mrn: patient.identifiers?.mrn ?? null,
    ehrPatientId: patient.identifiers?.ehrPatientId ?? null,
  };
}

function toProblemRows(problems: Diagnosis[]): ProblemRow[] {
  return problems.map((d) => ({ code: d.code ?? null, description: d.description ?? null }));
}

/**
 * Reads resolve their target from the current context — no id is passed.
 * retryEntityFetch absorbs the brief ENTITY_NOT_IN_CONTEXT race right after
 * a chart opens, and maps NOT_IMPLEMENTED to "unsupported".
 */
export async function fetchPatient(): Promise<Loadable<PatientCard>> {
  const outcome = await retryEntityFetch<Patient>(() =>
    SIM_MODE
      ? Promise.resolve({ success: Boolean(simPatient), data: simPatient?.patient })
      : requireSdk().ehr.api.patient.getPatient(),
  );
  return toLoadable(outcome, toPatientCard);
}

export async function fetchProblems(): Promise<Loadable<ProblemRow[]>> {
  const outcome = await retryEntityFetch<Diagnosis[]>(() =>
    SIM_MODE
      ? Promise.resolve({ success: Boolean(simPatient), data: simPatient?.problems })
      : requireSdk().ehr.api.patient.getProblems(),
  );
  return toLoadable(outcome, toProblemRows);
}
```

**Check:** `npm test`.

**Try it (simulator):** pick **Ada Morales** and **Open chart** — a full record. Then **Leave the patient**, pick **Ben Okafor**, and **Open chart** — no name, no MRN, and a problem with no description.

**Then ask:** "Does that match what you predicted?"

**Explain, in two or three sentences:** real EHR records are often incomplete, so an app should never assume a field is there. And the details clear when the patient leaves — showing one patient's data on another's chart is a privacy and safety problem.

**Takeaway:** Read what you need on demand, and expect parts of it to be missing.

## In the Mock EHR

Open the complete sample patient, then the sparse one. The facilitator will say which is which.

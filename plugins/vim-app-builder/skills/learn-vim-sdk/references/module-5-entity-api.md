# Module 5 · The Entity API

**Goal:** fetch details about the patient in context, and cope with incomplete data.

**Learner writes `fetchProblems`.** Once they've seen `fetchPatient` built, offer them the second one — it follows the same pattern.

## Predict

> Your app knows a patient is on screen. Now you ask the EHR for their name and MRN. What might come back?

Push past "their name and MRN". What if the EHR doesn't have a name? What if the request arrives a fraction of a second before the EHR has finished loading the chart?

## Build

`fetchPatient()` and `fetchProblems()`. Each wraps the read in `retryEntityFetch` from `./retry`, then maps the result into a local type. In the simulator, read `simPatient`.

**Reference implementation** — verified against `@vimconnect/app-sdk` 0.4.56. Build toward this in small steps and explain as you go; don't paste it wholesale.

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

Three things to explain:

- **No id is passed.** Reads resolve their target from the current context.
- **Every field is optional, so read defensively.** Look at `toPatientCard`: every field falls back to `null`. The app should never depend on a field that might not be there.
- **`retryEntityFetch`** handles two real situations. Right after a chart opens, a read can briefly fail with `ENTITY_NOT_IN_CONTEXT` while the EHR finishes loading; retrying after a short delay fixes it. And if a read isn't supported in this environment (`NOT_IMPLEMENTED`), it reports "unsupported" rather than an error. Open `retry.ts` and `sdk-error.ts` together — note that errors are checked by their `code`, not with `instanceof`.

## Check

`npm test` — both Module 5 checks should pass. The second one, *"copes with a sparse record"*, is the one that matters.

## Break

1. Pick **Ada Morales**, then **Open chart**. Module 5 shows her name, MRN, and two problems.
2. **Leave the patient**, pick **Ben Okafor**, then **Open chart**. No name, no MRN, and a problem with no description.

Ask: *what would have happened if `toPatientCard` had assumed the name was always there?* A crash, or "undefined undefined" on screen. Real EHRs send records like Ben's all the time.

Then: *why does the panel clear when the patient leaves?* Because the fetch is tied to Module 4's presence signal — and if a patient leaves mid-fetch, the result is discarded. Look for the `generation` check in `use-learning.ts`.

## Takeaway

Fetch details on demand, and assume any field might be missing.

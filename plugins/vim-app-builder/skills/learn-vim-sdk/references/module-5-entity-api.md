# Module 5 · The Entity API

## Why it matters

This is where the app gets the clinical data it acts on — the patient's demographics, problems, insurance, orders — in a consistent shape whichever EHR it comes from. It's the "one integration" promise in practice.

**Learner writes `fetchProblems`.** Build `fetchPatient` first, then offer them the second; it follows the same pattern.

## Predict

> Your app knows a patient is on screen and asks the EHR for their name and MRN. What might come back?

### Answer key

- **Credit fully:** anything that mentions incomplete data — missing fields, partial records — or a request that briefly fails.
- **Then make it concrete:** real EHRs often send records with fields missing. And a request made the instant a chart opens can briefly fail while the EHR finishes loading. Both are normal, and the app has to handle both.

## Build

`fetchPatient()`, then `fetchProblems()`.

Reference implementation — Verified against `@vimconnect/app-sdk` 0.4.56. Build toward it in small steps; don't paste it wholesale.

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

Point at two things:

- **No patient id is passed.** The read is about whoever is in context — Module 4's work paying off.
- **Every field falls back to `null`.** The app never assumes a field exists.

## Check

`npm test` — both Module 5 checks should pass. The second, *"copes with a sparse record"*, is the one that matters.

## Break

1. Pick **Ada Morales**, then **Open chart**. Her name, MRN, and two problems appear.
2. **Leave the patient**, pick **Ben Okafor**, then **Open chart**. No name, no MRN, and a problem with no description.

Ask: *what if the code had assumed the name was always there?* It would have crashed, or shown nonsense — on a record like this, which is common.

Then: *why does the panel clear when the patient leaves?*

- **"Privacy" or "so the wrong patient's data isn't shown" — credit fully; it's the most important reason.** Showing one patient's information while another's chart is open is a privacy problem and a patient-safety problem.
- **Then show how the code guarantees it:** the fetch is tied to Module 4's presence signal, and it clears when the patient leaves.

## Your app

> What data does your app need from the chart? What should it show if some of it is missing?

## Under the hood — only if asked

`retryEntityFetch` retries a read that fails while the EHR is still loading (`ENTITY_NOT_IN_CONTEXT`), and reports "unsupported" when this EHR can't provide a read at all (`NOT_IMPLEMENTED`). Errors are checked by their `code`, not with `instanceof`. In `use-learning.ts`, a generation counter discards a slow response that arrives after the patient has changed.

## Takeaway

Fetch the data you need on demand, and expect parts of it to be missing.

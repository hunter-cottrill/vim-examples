/**
 * Maps the SDK's entity shapes onto this app's narrow domain records.
 *
 * This file imports TYPES ONLY from @vimconnect/app-sdk, so it does not count
 * as a second SDK boundary — no runtime value crosses it. Everything
 * downstream depends on src/lib/med-rec/types.ts and never on the SDK.
 *
 * Every SDK entity field is declared optional and a given EHR build populates
 * only some of them, so every mapping here converts "absent" to an explicit
 * null and passes the value through verbatim otherwise. Nothing is inferred,
 * defaulted, or gated on an optional field being present.
 */
import type { Diagnosis, Medication, Patient } from '@vimconnect/app-sdk';
import type { ChartContext, ChartSource, MedicationRecord, ProblemRecord } from './med-rec/types';

function orNull(value: string | undefined): string | null {
  return value ?? null;
}

export function extractPatientId(patient: Partial<Patient>): string {
  return patient.identifiers?.ehrPatientId ?? patient.identifiers?.mrn ?? patient.identifiers?.id ?? 'unknown-patient';
}

function toMedicationRecord(medication: Medication, index: number): MedicationRecord {
  return {
    id: `med-${index}`,
    rawName: orNull(medication.medicationName),
    strength: orNull(medication.strength),
    form: orNull(medication.form),
    frequency: orNull(medication.frequency),
    ndcCode: orNull(medication.ndcCode),
  };
}

function toProblemRecord(diagnosis: Diagnosis, index: number): ProblemRecord {
  return {
    id: `problem-${index}`,
    rawCode: orNull(diagnosis.code),
    rawDescription: orNull(diagnosis.description),
    rawStatus: orNull(diagnosis.status),
    rawSystem: orNull(diagnosis.system),
  };
}

export function toChartContext(
  patientId: string,
  medications: Medication[],
  problems: Diagnosis[],
  source: ChartSource,
): ChartContext {
  return {
    patientId,
    medications: medications.map(toMedicationRecord),
    problems: problems.map(toProblemRecord),
    source,
  };
}

export interface ChartLists {
  medications: Medication[];
  problems: Diagnosis[];
}

/**
 * Build a ChartContext from whichever source produced data, applying the same
 * rule on both the live and simulated paths.
 *
 * @param entityApi What the Entity API returned, or null if it was exhausted.
 * @param inline What the chart_open event carried, used only as the fallback.
 *
 * An EMPTY Entity API result is a real answer — this patient has no
 * medications. An empty fallback after a failed read is indistinguishable from
 * the failed read itself, so it throws rather than reporting an empty
 * medication list a provider might believe.
 */
export function resolveChartContext(patientId: string, entityApi: ChartLists | null, inline: ChartLists): ChartContext {
  if (entityApi !== null) {
    return toChartContext(patientId, entityApi.medications, entityApi.problems, 'entity-api');
  }
  const fallback = toChartContext(patientId, inline.medications, inline.problems, 'chart-open-event');
  if (!hasUsableSignal(fallback)) {
    throw new Error('Could not read this chart from the Entity API or the chart_open event after retrying.');
  }
  return fallback;
}

/**
 * A whole chart's worth of raw SDK payloads: what the Entity API returned
 * (null when it was exhausted) plus the Patient the chart_open event carried,
 * whose inline lists are the fallback.
 *
 * The dev simulator's fixtures are expressed in exactly this shape so they
 * resolve through the same function the live path uses.
 */
export interface RawChartPayload {
  patient: Patient;
  medications: Medication[] | null;
  problems: Diagnosis[] | null;
}

export function resolveRawChartPayload(payload: RawChartPayload): ChartContext {
  const entityApi =
    payload.medications !== null && payload.problems !== null
      ? { medications: payload.medications, problems: payload.problems }
      : null;
  return resolveChartContext(extractPatientId(payload.patient), entityApi, {
    medications: payload.patient.medications ?? [],
    problems: payload.patient.problems ?? [],
  });
}

/**
 * Whether a context is worth showing at all.
 *
 * Used only to decide whether the degraded chart_open fallback is usable when
 * the Entity API has been exhausted. An empty result from the Entity API is a
 * real answer ("this patient has no medications"); an empty fallback after a
 * failed read is indistinguishable from a failed read, so we surface the error
 * rather than claim an empty list.
 */
function hasUsableSignal(context: ChartContext): boolean {
  return context.medications.length > 0 || context.problems.length > 0;
}

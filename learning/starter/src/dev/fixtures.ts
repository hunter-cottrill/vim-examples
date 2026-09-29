/**
 * DEV-ONLY sample data for the simulator. These are raw, SDK-shaped payloads —
 * they pass through the same mapping code the live SDK path uses, so a mistake
 * in that mapping shows up in the simulator too, not only in a real EHR.
 *
 * Some optional fields are deliberately missing. Real EHRs send partial
 * records, and the app should cope with that from day one.
 */
import type { AppManifest, Diagnosis, Patient } from '@vimconnect/app-sdk';

export interface SimPatient {
  label: string;
  patient: Patient;
  problems: Diagnosis[];
}

export const SIM_PATIENTS: SimPatient[] = [
  {
    label: 'Ada Morales — full record',
    patient: {
      demographics: { firstName: 'Ada', lastName: 'Morales' },
      identifiers: { mrn: 'MRN-1001', ehrPatientId: 'sim-1001' },
    } as Patient,
    problems: [
      { code: 'E11.9', description: 'Type 2 diabetes mellitus without complications', status: 'active' },
      { code: 'I10', description: 'Essential hypertension', status: 'active' },
    ],
  },
  {
    label: 'Ben Okafor — sparse record',
    patient: {
      identifiers: { ehrPatientId: 'sim-1002' },
    } as Patient,
    // No system, no status — exactly what real problem lists often look like.
    problems: [{ code: 'J45.909' }],
  },
];

/** A plausible manifest so Module 2 has something real-shaped to read. */
export const SIM_MANIFEST = {
  version: 'sim',
  apiVersion: 'sim',
  supportedEvents: [
    { id: 'chart_open', name: 'Chart open', availableEntities: [], since: 'sim' },
    { id: 'encounter_open', name: 'Encounter open', availableEntities: [], since: 'sim' },
  ],
  supportedContexts: [
    { contextKey: 'chart_open:patient', eventType: 'chart_open', entityType: 'patient', since: 'sim' },
    { contextKey: 'encounter_open:patient', eventType: 'encounter_open', entityType: 'patient', since: 'sim' },
    { contextKey: 'encounter_open:encounter', eventType: 'encounter_open', entityType: 'encounter', since: 'sim' },
  ],
  supportedEntities: [
    { type: 'patient', fields: ['demographics', 'identifiers', 'problems'], since: 'sim' },
    { type: 'encounter', fields: ['plan', 'assessment'], since: 'sim' },
  ],
  typeDefinitions: [],
  features: [],
  contextWriteback: { encounter: { update: {} } },
} as unknown as AppManifest;

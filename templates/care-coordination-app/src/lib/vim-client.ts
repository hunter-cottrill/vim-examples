/**
 * Thin SDK client — the ONLY module in this app that imports @vimconnect/app-sdk.
 * Everything downstream (domain logic, UI) depends only on the local types in
 * src/lib/care/types.ts. This module's job is entirely translation: SDK events/
 * context/Entity API responses in, SectionStatus<T>-shaped local snapshots out.
 */
import { initVimSDK, type VimSDK, type Patient, type Diagnosis } from '@vimconnect/app-sdk';
import { retryEntityFetch } from './retry';
import { mapOrderTypeLabel } from './care/orderTypeLabels';
import type { EncounterSnapshot, OrderSnapshot, PatientSnapshot, ProblemEntry, ReferralSnapshot, SectionStatus } from './care/types';

export async function initSdk(accessToken: string): Promise<VimSDK> {
  const sdk = await initVimSDK({ accessToken });
  sdk.hub.setActivationStatus('ENABLED');
  return sdk;
}

// --- Workflow events (one-shot triggers; no inline fields relied upon) ---

export function onChartOpen(sdk: VimSDK, callback: () => void): () => void {
  return sdk.ehr.workflow.on('chart_open', () => callback());
}

export function onOrderSelect(sdk: VimSDK, callback: () => void): () => void {
  return sdk.ehr.workflow.on('order_select', () => callback());
}

// --- Context subscriptions (continuous; data under curr.fields) ---

type RawFields = Record<string, unknown> | null;

export function onChartOpenPatientContext(sdk: VimSDK, callback: (fields: RawFields) => void): () => void {
  return sdk.ehr.context.onChange('chart_open:patient', (_prev, curr) => callback(curr?.fields ?? null));
}

export function onEncounterOpenPatientContext(sdk: VimSDK, callback: (fields: RawFields) => void): () => void {
  return sdk.ehr.context.onChange('encounter_open:patient', (_prev, curr) => callback(curr?.fields ?? null));
}

export function onEncounterContext(sdk: VimSDK, callback: (fields: RawFields) => void): () => void {
  return sdk.ehr.context.onChange('encounter_open:encounter', (_prev, curr) => callback(curr?.fields ?? null));
}

// There is no referral Entity API namespace — referral data only ever arrives
// through this context key.
export function onReferralContext(sdk: VimSDK, callback: (fields: RawFields) => void): () => void {
  return sdk.ehr.context.onChange('referral_start:referral', (_prev, curr) => callback(curr?.fields ?? null));
}

// --- Context -> local snapshot mapping (pure translation, no I/O) ---

export function mapEncounterFields(fields: RawFields): SectionStatus<EncounterSnapshot> {
  if (!fields) return { kind: 'empty' };
  // This sandbox EHR populates the legacy flat `cc`/`diagnoses` fields rather
  // than the nested `subjective`/`assessment` shape the SDK's types mark as
  // current — read both, preferring whichever is actually populated.
  const f = fields as {
    identifiers?: { ehrEncounterId?: string };
    basicInformation?: { type?: string };
    subjective?: { chiefComplaintNotes?: string };
    cc?: string;
    assessment?: { diagnoses?: Array<{ code?: string; description?: string }> };
    diagnoses?: Array<{ code?: string; description?: string }>;
  };
  const diagnosesRaw = f.assessment?.diagnoses ?? f.diagnoses ?? [];
  return {
    kind: 'loaded',
    data: {
      encounterId: f.identifiers?.ehrEncounterId,
      type: f.basicInformation?.type,
      chiefComplaint: f.subjective?.chiefComplaintNotes ?? f.cc,
      diagnoses: diagnosesRaw.map((d) => d.description ?? d.code ?? 'Unlabeled diagnosis'),
    },
  };
}

export function mapReferralFields(fields: RawFields): SectionStatus<ReferralSnapshot> {
  if (!fields) return { kind: 'empty' };
  const f = fields as {
    referringProvider?: { firstName?: string; lastName?: string };
    targetProvider?: { firstName?: string; lastName?: string; specialty?: string };
  };
  const referringProviderName = joinName(f.referringProvider?.firstName, f.referringProvider?.lastName);
  const targetProviderName = joinName(f.targetProvider?.firstName, f.targetProvider?.lastName);
  return {
    kind: 'loaded',
    data: { referringProviderName, targetProviderName, targetSpecialty: f.targetProvider?.specialty },
  };
}

function joinName(firstName?: string, lastName?: string): string | undefined {
  const name = [firstName, lastName].filter(Boolean).join(' ');
  return name.length > 0 ? name : undefined;
}

// --- Entity API reads (on-demand; retried with backoff on transient failure) ---

export async function fetchPatientSnapshot(sdk: VimSDK): Promise<SectionStatus<PatientSnapshot>> {
  const result = await retryEntityFetch<Partial<Patient>>(() => sdk.ehr.api.patient.getPatient());
  if (result.outcome === 'unsupported') return { kind: 'unsupported' };
  if (result.outcome === 'error') return { kind: 'error', message: result.message };
  return {
    kind: 'loaded',
    data: {
      patientId: result.data.identifiers?.ehrPatientId ?? result.data.identifiers?.id ?? '',
      firstName: result.data.demographics?.firstName,
      lastName: result.data.demographics?.lastName,
    },
  };
}

export async function fetchProblems(sdk: VimSDK): Promise<SectionStatus<ProblemEntry[]>> {
  const result = await retryEntityFetch<Diagnosis[]>(() => sdk.ehr.api.patient.getProblems());
  if (result.outcome === 'unsupported') return { kind: 'unsupported' };
  if (result.outcome === 'error') return { kind: 'error', message: result.message };
  return {
    kind: 'loaded',
    data: result.data.map((d) => ({ description: d.description ?? d.code ?? 'Unlabeled problem', code: d.code })),
  };
}

// Local shape for Order — the SDK's Order type isn't imported directly since
// no sibling has confirmed its exact export name; fields here match the ones
// confirmed in the reference (identifiers.ehrOrderId, basicInformation.{type,
// orderName,reason}, orderingProvider.{firstName,lastName} — no CPT/procedure
// code, no status field).
interface RawOrder {
  identifiers?: { ehrOrderId?: string };
  basicInformation?: { type?: string; orderName?: string; reason?: string };
  orderingProvider?: { firstName?: string; lastName?: string };
}

export async function fetchOrderSnapshot(sdk: VimSDK): Promise<SectionStatus<OrderSnapshot>> {
  const result = await retryEntityFetch<RawOrder>(() => sdk.ehr.api.order.getOrderById());
  if (result.outcome === 'unsupported') return { kind: 'unsupported' };
  if (result.outcome === 'error') return { kind: 'error', message: result.message };
  const rawType = result.data.basicInformation?.type;
  return {
    kind: 'loaded',
    data: {
      orderId: result.data.identifiers?.ehrOrderId,
      orderName: result.data.basicInformation?.orderName,
      reason: result.data.basicInformation?.reason,
      typeLabel: mapOrderTypeLabel(rawType),
      rawType,
      orderingProviderName: joinName(result.data.orderingProvider?.firstName, result.data.orderingProvider?.lastName),
    },
  };
}
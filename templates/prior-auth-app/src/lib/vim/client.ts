/**
 * The single module (besides workerClient.ts) that imports @vimconnect/app-sdk.
 * Everything else in the app depends only on the narrow types in ./types.
 *
 * DEV-ONLY simulator seam: NEXT_PUBLIC_SIM_MODE is inlined as a build-time
 * literal by Next.js, so with the flag unset (the default) SIM_MODE collapses
 * to the literal `false` and every SIM_MODE branch below is dead code the
 * bundler eliminates — subscribeOrderEvents/loadOrderContext/subscribeChartPatient
 * reduce to exactly their real-SDK bodies, and simulateOrderEvent/
 * simulateChartPatient/simulateContextFailure become permanent no-ops.
 */
import type { VimSDK, Order, Insurance, Diagnosis } from '@vimconnect/app-sdk';
import type { DiagnosisRead, InsuranceRead, OrderContextResult, OrderEventType, OrderRead } from './types';
import { retryFetch } from './retry';

const SIM_MODE = process.env.NEXT_PUBLIC_SIM_MODE === 'true';

/** Exported so lib/vim/workerClient.ts can map the same SDK entities without duplicating field paths. */
export function toOrderRead(order: Order): OrderRead | undefined {
  const ehrOrderId = order.identifiers?.ehrOrderId;
  const orderName = order.basicInformation?.orderName;
  if (!ehrOrderId || !orderName) return undefined;
  const providerName = [order.orderingProvider?.firstName, order.orderingProvider?.lastName].filter(Boolean).join(' ');
  return {
    ehrOrderId,
    ehrEncounterId: order.basicInformation?.ehrEncounterId,
    orderType: order.basicInformation?.type ?? 'PROCEDURE',
    orderName,
    reason: order.basicInformation?.reason,
    orderingProviderName: providerName || undefined,
    orderingProviderNpi: order.orderingProvider?.npi,
  };
}

export function toInsuranceRead(insurance: Insurance): InsuranceRead {
  return {
    payerId: insurance.payerId,
    payerName: insurance.payerName ?? '',
    groupId: insurance.groupId,
    memberId: insurance.memberId,
    isPrimary: Boolean(insurance.isPrimary),
  };
}

export function toDiagnosisRead(diagnosis: Diagnosis): DiagnosisRead | undefined {
  if (!diagnosis.code) return undefined;
  return {
    code: diagnosis.code,
    system: diagnosis.system ?? 'ICD-10',
    description: diagnosis.description ?? diagnosis.code,
    status: diagnosis.status,
  };
}

// ---------------------------------------------------------------------------
// Order events — dispatches only the id, per the reference: a workflow event
// carries an id reference, never inline entity fields. loadOrderContext (below)
// does the follow-up Entity API reads.
// ---------------------------------------------------------------------------

const simOrderListeners: Array<(ehrOrderId: string, eventType: OrderEventType) => void> = [];

/** DEV-ONLY, no-op unless NEXT_PUBLIC_SIM_MODE === 'true'. */
export function simulateOrderEvent(ehrOrderId: string, eventType: OrderEventType = 'order_select'): void {
  if (!SIM_MODE) return;
  simOrderListeners.forEach((cb) => cb(ehrOrderId, eventType));
}

export function subscribeOrderEvents(sdk: VimSDK, onOrderEvent: (ehrOrderId: string, eventType: OrderEventType) => void): () => void {
  if (SIM_MODE) {
    simOrderListeners.push(onOrderEvent);
    return () => {
      const i = simOrderListeners.indexOf(onOrderEvent);
      if (i !== -1) simOrderListeners.splice(i, 1);
    };
  }
  return sdk.ehr.workflow.on(['order_select', 'order_sign'], (event) => {
    const ehrOrderId = event.entities.order?.identifiers?.ehrOrderId;
    if (ehrOrderId) onOrderEvent(ehrOrderId, event.type);
  });
}

// ---------------------------------------------------------------------------
// Context load — the retry-wrapped follow-up fetch of order + insurance +
// diagnoses, run concurrently. See build plan §3/§4 for why this is a
// separate step from the event subscription above.
// ---------------------------------------------------------------------------

interface SimFixtureContext {
  order: OrderRead;
  insurance: InsuranceRead | undefined;
  diagnoses: DiagnosisRead[];
}

const simFixturesByOrderId = new Map<string, SimFixtureContext>();
const simFailingOrderIds = new Set<string>();

/** DEV-ONLY. Registers the context a subsequent simulateOrderEvent(ehrOrderId) should resolve to. */
export function registerSimFixture(fixture: SimFixtureContext): void {
  if (!SIM_MODE) return;
  simFixturesByOrderId.set(fixture.order.ehrOrderId, fixture);
}

/** DEV-ONLY. Makes loadOrderContext fail for this order id until the fixture is re-registered. */
export function simulateContextFailure(ehrOrderId: string): void {
  if (!SIM_MODE) return;
  simFailingOrderIds.add(ehrOrderId);
}

export async function loadOrderContext(sdk: VimSDK, ehrOrderId: string): Promise<OrderContextResult> {
  if (SIM_MODE) {
    if (simFailingOrderIds.has(ehrOrderId)) {
      simFailingOrderIds.delete(ehrOrderId);
      return { ok: false, message: 'Simulated context load failure.' };
    }
    const fixture = simFixturesByOrderId.get(ehrOrderId);
    if (!fixture) return { ok: false, message: `No simulated fixture registered for order ${ehrOrderId}.` };
    return { ok: true, ...fixture };
  }

  const isValid = () => true;
  const [order, insurances, diagnoses] = await Promise.all([
    retryFetch(() => sdk.ehr.api.order.getOrderById(), isValid),
    retryFetch(() => sdk.ehr.api.patient.getInsurances(), isValid),
    retryFetch(() => sdk.ehr.api.patient.getProblems(), isValid),
  ]);

  const orderRead = order ? toOrderRead(order) : undefined;
  if (!orderRead) return { ok: false, message: 'Could not load order details from the EHR.' };

  const insuranceReads = (insurances ?? []).map(toInsuranceRead);
  const primaryInsurance = insuranceReads.find((i) => i.isPrimary) ?? insuranceReads[0];
  const diagnosisReads = (diagnoses ?? []).map(toDiagnosisRead).filter((d): d is DiagnosisRead => Boolean(d));

  return { ok: true, order: orderRead, insurance: primaryInsurance, diagnoses: diagnosisReads };
}

// ---------------------------------------------------------------------------
// Patient-context — used only to detect the patient leaving and trigger RESET.
// Reports presence (Boolean of the context object), never an extracted id: a
// sparse payload that happens to omit identifiers must not read as "gone".
// Both keys are watched because opening an encounter empties chart_open:patient
// while encounter_open:patient populates — the patient hasn't left.
// ---------------------------------------------------------------------------

const simChartPatientListeners: Array<(present: boolean) => void> = [];
const simEncounterPatientListeners: Array<(present: boolean) => void> = [];

/** DEV-ONLY, no-op unless NEXT_PUBLIC_SIM_MODE === 'true'. */
export function simulateChartPatient(present: boolean): void {
  if (!SIM_MODE) return;
  simChartPatientListeners.forEach((cb) => cb(present));
}

/** DEV-ONLY, no-op unless NEXT_PUBLIC_SIM_MODE === 'true'. */
export function simulateEncounterPatient(present: boolean): void {
  if (!SIM_MODE) return;
  simEncounterPatientListeners.forEach((cb) => cb(present));
}

export function subscribeChartPatient(sdk: VimSDK, onChange: (present: boolean) => void): () => void {
  if (SIM_MODE) {
    simChartPatientListeners.push(onChange);
    return () => {
      const i = simChartPatientListeners.indexOf(onChange);
      if (i !== -1) simChartPatientListeners.splice(i, 1);
    };
  }
  return sdk.ehr.context.onChange('chart_open:patient', (_previous, current) => {
    onChange(Boolean(current));
  });
}

export function subscribeEncounterPatient(sdk: VimSDK, onChange: (present: boolean) => void): () => void {
  if (SIM_MODE) {
    simEncounterPatientListeners.push(onChange);
    return () => {
      const i = simEncounterPatientListeners.indexOf(onChange);
      if (i !== -1) simEncounterPatientListeners.splice(i, 1);
    };
  }
  return sdk.ehr.context.onChange('encounter_open:patient', (_previous, current) => {
    onChange(Boolean(current));
  });
}
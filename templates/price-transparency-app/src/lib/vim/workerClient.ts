/**
 * Worker-side counterpart to client.ts — the SDK boundary for the headless
 * offscreen app (src/app/offscreen/app/page.tsx). Same boundary rule: only
 * this file (plus client.ts) imports @vimconnect/app-sdk; callers depend on
 * the narrow types in ./types.
 *
 * The Worker's Entity API (`handle.api`) is dynamically indexed
 * (`[namespace: string]: unknown`) rather than statically typed like the UI
 * SDK's `sdk.ehr.api`, so every namespace access here is defensively cast
 * and guarded with `typeof === 'function'`, exactly like client.ts.
 */
import type {
  WorkerSDK,
  WorkerWorkflowHandle,
  HookDeclaration,
  Order,
  Insurance,
  UnsubscribeFn,
} from '@vimconnect/app-sdk';
import type { EncounterSelfPayRead, InsuranceRead, OrderEventType, OrderRead } from './types';
import { toEncounterSelfPayRead, toInsuranceRead, toOrderRead } from './client';
import { retryFetch } from './retry';

const ORDER_EVENT_TYPES: OrderEventType[] = ['order_select', 'order_sign'];

async function fetchOrderFromHandle(
  handle: WorkerWorkflowHandle,
  inlineOrder: Order | undefined,
  onDebug?: (message: string) => void,
): Promise<OrderRead | null> {
  const orderApi = handle.api.order as { getOrderById?: () => Promise<{ success: boolean; data?: Order }> } | undefined;
  if (typeof orderApi?.getOrderById !== 'function') {
    onDebug?.('handle.api.order.getOrderById is not available on this connection — using inline entity only');
    return inlineOrder ? toOrderRead(inlineOrder) : null;
  }

  const data = await retryFetch(() => orderApi.getOrderById!(), () => handle.api.isValid(), onDebug);
  const order = data ?? inlineOrder;
  return order ? toOrderRead(order) : null;
}

/**
 * Registers the worker's order_select/order_sign handlers — the headless
 * counterpart to client.ts's subscribeOrderEvents. `workflow.register` (unlike
 * the UI's `workflow.on`) takes one event id at a time and hands back a
 * TTL-scoped handle per invocation, so this registers both events and shares
 * one handler. Declares the 'notify' operation so `handle.hub` (needed to
 * push the cost notification) is actually populated — see HookDeclaration.
 *
 * `event.entities.order` on this generic WorkflowEvent is an id reference
 * only (confirmed live on the UI side — see client.ts); fetchOrderFromHandle
 * resolves the real fields via the handle's own Entity API.
 */
export function subscribeWorkerOrderEvents(
  sdk: WorkerSDK,
  onOrderEvent: (order: OrderRead, eventType: OrderEventType, handle: WorkerWorkflowHandle) => void | Promise<void>,
  onDebug?: (message: string) => void,
): UnsubscribeFn[] {
  const decl: HookDeclaration = { operations: ['notify'] };
  return ORDER_EVENT_TYPES.map((eventType) =>
    sdk.ehr.workflow.register(eventType, decl, async (event, handle) => {
      const inlineOrder = (event.entities as Record<string, unknown>).order as Order | undefined;
      onDebug?.(`${eventType} — inline entities.order: ${JSON.stringify(inlineOrder ?? null)}`);

      const order = await fetchOrderFromHandle(handle, inlineOrder, onDebug);
      if (!order) {
        onDebug?.(`${eventType}: no order data resolved — closing handle without acting`);
        handle.close();
        return;
      }
      await onOrderEvent(order, eventType, handle);
    }),
  );
}

/**
 * Continuous read of the open encounter's self-pay flag, from the Worker
 * side — the headless counterpart to client.ts's subscribeEncounterSelfPay.
 *
 * UNVERIFIED against a live EHR: WorkerContextCallback's data parameter is
 * typed as the bare generic `T | null` in the installed .d.ts, but the
 * original vim-demo-app worker page read fields off a `.fields` bag instead
 * (`curr?.fields`), suggesting the Worker's context.register may deliver a
 * lower-level `{ id, fields }` shape rather than the typed entity directly —
 * unlike the UI SDK's `context.onChange`, which does hand back the typed
 * entity. Handles both shapes defensively and logs the raw payload so this
 * can be corrected from real data, same as the order-fetch fields above.
 */
export function subscribeWorkerEncounterSelfPay(
  sdk: WorkerSDK,
  onChange: (encounter: EncounterSelfPayRead | undefined) => void,
  onDebug?: (message: string) => void,
): UnsubscribeFn {
  return sdk.ehr.context.register<unknown>('encounter_open:encounter', {}, (_previous, current) => {
    onDebug?.(`encounter_open:encounter — raw payload: ${JSON.stringify(current ?? null)}`);
    if (!current) {
      onChange(undefined);
      return;
    }
    const candidate = current as { fields?: unknown };
    const encounterLike = (candidate.fields ?? current) as Parameters<typeof toEncounterSelfPayRead>[0];
    onChange(toEncounterSelfPayRead(encounterLike));
  });
}

/** On-demand read of the current patient's insurances via the handle's Entity API. */
export async function getPatientInsurancesFromHandle(handle: WorkerWorkflowHandle): Promise<InsuranceRead[]> {
  const patientApi = handle.api.patient as { getInsurances?: () => Promise<{ success: boolean; data?: Insurance[] }> } | undefined;
  if (typeof patientApi?.getInsurances !== 'function') return [];
  try {
    const response = await patientApi.getInsurances();
    if (!response.success || !response.data) return [];
    return response.data.map(toInsuranceRead);
  } catch {
    return [];
  }
}
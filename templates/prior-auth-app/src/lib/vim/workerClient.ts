/**
 * Worker-side counterpart to client.ts — the SDK boundary for the headless
 * offscreen app (src/app/offscreen/app/page.tsx). Same boundary rule: only
 * this file (plus client.ts) imports @vimconnect/app-sdk; callers depend on
 * the narrow types in ./types.
 *
 * The Worker's Entity API (`handle.api`) is dynamically indexed
 * (`[namespace: string]: unknown`) rather than statically typed like the UI
 * SDK's `sdk.ehr.api`, so every namespace access here is defensively cast
 * and guarded with `typeof === 'function'`.
 */
import type { WorkerSDK, WorkerWorkflowHandle, HookDeclaration, Order, Insurance, Diagnosis, UnsubscribeFn } from '@vimconnect/app-sdk';
import type { DiagnosisRead, InsuranceRead, OrderContextResult, OrderEventType } from './types';
import { toDiagnosisRead, toInsuranceRead, toOrderRead } from './client';
import { retryFetch } from './retry';

const ORDER_EVENT_TYPES: OrderEventType[] = ['order_select', 'order_sign'];

async function loadOrderContextFromHandle(handle: WorkerWorkflowHandle): Promise<OrderContextResult> {
  const orderApi = handle.api.order as { getOrderById?: () => Promise<{ success: boolean; data?: Order }> } | undefined;
  const patientApi = handle.api.patient as
    | { getInsurances?: () => Promise<{ success: boolean; data?: Insurance[] }>; getProblems?: () => Promise<{ success: boolean; data?: Diagnosis[] }> }
    | undefined;
  const isValid = () => handle.api.isValid();

  if (typeof orderApi?.getOrderById !== 'function') {
    return { ok: false, message: 'handle.api.order.getOrderById is not available on this connection.' };
  }

  const [order, insurances, diagnoses] = await Promise.all([
    retryFetch(() => orderApi.getOrderById!(), isValid),
    typeof patientApi?.getInsurances === 'function' ? retryFetch(() => patientApi.getInsurances!(), isValid) : Promise.resolve(undefined),
    typeof patientApi?.getProblems === 'function' ? retryFetch(() => patientApi.getProblems!(), isValid) : Promise.resolve(undefined),
  ]);

  const orderRead = order ? toOrderRead(order) : undefined;
  if (!orderRead) return { ok: false, message: 'Could not load order details from the EHR.' };

  const insuranceReads = (insurances ?? []).map(toInsuranceRead);
  const primaryInsurance = insuranceReads.find((i) => i.isPrimary) ?? insuranceReads[0];
  const diagnosisReads = (diagnoses ?? []).map(toDiagnosisRead).filter((d): d is DiagnosisRead => Boolean(d));

  return { ok: true, order: orderRead, insurance: primaryInsurance, diagnoses: diagnosisReads };
}

/**
 * Registers the worker's order_select/order_sign handlers. `workflow.register`
 * (unlike the UI's `workflow.on`) takes one event id at a time and hands back
 * a TTL-scoped handle per invocation, so this registers both events and
 * shares one handler. Declares the 'notify' operation so `handle.hub` (needed
 * to push the auth-required notification) is actually populated.
 *
 * Fetches order/insurance/diagnoses concurrently (loadOrderContextFromHandle)
 * to stay well inside the handle's 10-second TTL — see build plan §5 step 9.
 */
export function subscribeWorkerOrderEvents(
  sdk: WorkerSDK,
  onOrderContext: (context: OrderContextResult, eventType: OrderEventType, handle: WorkerWorkflowHandle) => void | Promise<void>,
): UnsubscribeFn[] {
  const decl: HookDeclaration = { operations: ['notify'] };
  return ORDER_EVENT_TYPES.map((eventType) =>
    sdk.ehr.workflow.register(eventType, decl, async (_event, handle) => {
      const context = await loadOrderContextFromHandle(handle);
      if (!handle.api.isValid()) {
        handle.close();
        return;
      }
      await onOrderContext(context, eventType, handle);
    }),
  );
}

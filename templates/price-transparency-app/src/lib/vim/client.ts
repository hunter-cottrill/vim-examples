/**
 * The single module that imports @vimconnect/app-sdk. Everything else in the
 * app depends only on the narrow types in ./types — see the build plan's
 * architecture section for why this boundary exists.
 */
import type { VimSDK, Order, Insurance, Encounter } from '@vimconnect/app-sdk';
import type { EncounterSelfPayRead, InsuranceRead, OrderEventType, OrderRead } from './types';
import { retryFetch } from './retry';

/** Exported so lib/vim/workerClient.ts can map the same SDK entities without duplicating field paths. */
export function toOrderRead(order: Order): OrderRead {
  const providerName = [order.orderingProvider?.firstName, order.orderingProvider?.lastName]
    .filter(Boolean)
    .join(' ');
  return {
    ehrOrderId: order.identifiers?.ehrOrderId,
    ehrEncounterId: order.basicInformation?.ehrEncounterId,
    orderType: order.basicInformation?.type,
    orderName: order.basicInformation?.orderName,
    reason: order.basicInformation?.reason,
    orderingProviderName: providerName || undefined,
  };
}

export function toInsuranceRead(insurance: Insurance): InsuranceRead {
  return {
    payerId: insurance.payerId,
    payerName: insurance.payerName,
    groupId: insurance.groupId,
    memberId: insurance.memberId,
    isPrimary: insurance.isPrimary,
  };
}

export function toEncounterSelfPayRead(encounter: Encounter | undefined): EncounterSelfPayRead | undefined {
  if (!encounter) return undefined;
  return {
    ehrEncounterId: encounter.identifiers?.ehrEncounterId,
    selfPay: encounter.basicInformation?.selfPay,
  };
}

/**
 * Subscribes to the order_select/order_sign workflow events — the only
 * point-of-order trigger the SDK exposes. Confirmed workflow-only: `order`
 * has no Context key of its own, so this is a one-shot event subscription,
 * never a continuous context read.
 *
 * The event itself only sets `order` as the current context entity — its
 * inlined `entities.order` fields arrive empty in practice (confirmed live:
 * the event fires with an id but no basicInformation). The real fields are
 * expected from a follow-up `getOrderById()` call, which the docs describe as
 * "resolved from the current context" — i.e. exactly the order this event
 * just made current. Confirmed live that `getOrderById()` can reject with
 * "No order is in the current EHR context" in the same tick the event fires
 * — the EHR's context population appears to lag the event by a beat — so
 * this retries a few times with backoff before giving up. `onDebug`
 * (optional) reports the raw inline entity and every getOrderById() attempt
 * as JSON, so a caller can tell live whether a given EHR's order data gap is
 * a timing issue, a missing capability, or the sandbox genuinely not
 * populating these fields — see build plan Step 0/§8 open questions.
 * Defensive against `sdk.ehr.api.order` or `getOrderById` being absent at
 * runtime even though the SDK's types declare them unconditionally.
 */
export function subscribeOrderEvents(
  sdk: VimSDK,
  onOrderEvent: (order: OrderRead, eventType: OrderEventType) => void,
  onDebug?: (message: string) => void,
): () => void {
  return sdk.ehr.workflow.on(['order_select', 'order_sign'], (event) => {
    const inlineOrder = event.entities.order;
    onDebug?.(`${event.type} — inline entities.order: ${JSON.stringify(inlineOrder ?? null)}`);

    const orderApi = sdk.ehr.api.order as { getOrderById?: () => Promise<{ success: boolean; data?: Order; error?: string }> } | undefined;
    if (typeof orderApi?.getOrderById !== 'function') {
      onDebug?.('sdk.ehr.api.order.getOrderById is not available on this connection — using inline entity only');
      if (inlineOrder) onOrderEvent(toOrderRead(inlineOrder), event.type);
      return;
    }

    void retryFetch(() => orderApi.getOrderById!(), () => true, onDebug).then((data) => {
      const order = data ?? inlineOrder;
      if (order) onOrderEvent(toOrderRead(order), event.type);
    });
  });
}

/**
 * Continuous read of the open encounter's self-pay flag — the only place
 * `selfPay` exists anywhere in the SDK schema. There is no on-demand Entity
 * API read for Encounter beyond procedure codes, so this must be a live
 * context subscription; the caller correlates it to an order via
 * ehrEncounterId (unverified against a live EHR — see build plan Step 0).
 */
export function subscribeEncounterSelfPay(
  sdk: VimSDK,
  onChange: (encounter: EncounterSelfPayRead | undefined) => void,
): () => void {
  return sdk.ehr.context.onChange('encounter_open:encounter', (_previous, current) => {
    onChange(toEncounterSelfPayRead(current));
  });
}

/** On-demand read of the current patient's insurances via the Entity API. */
export async function getPatientInsurances(sdk: VimSDK): Promise<InsuranceRead[]> {
  const response = await sdk.ehr.api.patient.getInsurances();
  if (!response.success || !response.data) return [];
  return response.data.map(toInsuranceRead);
}

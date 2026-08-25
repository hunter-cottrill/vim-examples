/**
 * Narrow local read types returned by lib/vim/client.ts. The rest of the app
 * depends only on these — never on @vimconnect/app-sdk's own entity types —
 * so lib/vim is the single place that knows the SDK's actual shapes.
 */

export type OrderEventType = 'order_select' | 'order_sign';

export interface OrderRead {
  ehrOrderId?: string;
  ehrEncounterId?: string;
  orderType?: 'LAB' | 'DI' | 'PROCEDURE' | 'RX';
  /** Free text — the SDK's Order entity carries no CPT/procedure code field. */
  orderName?: string;
  reason?: string;
  orderingProviderName?: string;
}

export interface InsuranceRead {
  payerId?: string;
  payerName?: string;
  groupId?: string;
  memberId?: string;
  isPrimary?: boolean;
}

export interface EncounterSelfPayRead {
  ehrEncounterId?: string;
  selfPay?: boolean;
}

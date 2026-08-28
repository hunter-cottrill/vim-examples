/**
 * Narrow local read types returned by lib/vim/client.ts and lib/vim/workerClient.ts.
 * The rest of the app depends only on these — never on @vimconnect/app-sdk's own
 * entity types — so lib/vim is the single place that knows the SDK's actual shapes.
 */

export type OrderEventType = 'order_select' | 'order_sign';

export interface OrderRead {
  ehrOrderId: string;
  ehrEncounterId?: string;
  orderType: 'LAB' | 'DI' | 'PROCEDURE' | 'RX';
  /** Free text — the SDK's Order entity carries no CPT/procedure code field. */
  orderName: string;
  reason?: string;
  orderingProviderName?: string;
  /** Unconfirmed field on order.orderingProvider — read defensively, may be absent. */
  orderingProviderNpi?: string;
}

export interface InsuranceRead {
  payerId?: string;
  payerName: string;
  groupId?: string;
  memberId?: string;
  isPrimary: boolean;
}

export interface DiagnosisRead {
  code: string;
  system: string;
  description: string;
  status?: string;
}

/** Result of resolving a fired order_select/order_sign event into full context. */
export type OrderContextResult =
  | { ok: true; order: OrderRead; insurance: InsuranceRead | undefined; diagnoses: DiagnosisRead[] }
  | { ok: false; message: string };

/**
 * Typed accessors over the SDK's dynamic dispatch surface.
 *
 * `ehr.api.<namespace>.<method>` and `ehr.context.<entity>` are indexed by
 * runtime strings from the manifest, so there is no static type for the specific
 * method. These small helpers confine that dynamic access (and its casts) so the
 * UI never reaches into `as any`, and so a method that is declared but not
 * implemented on a given EHR is handled (returns null) instead of throwing.
 */
import type { VimSDK } from '@vimconnect/app-sdk';

export type ApiMethod = (...args: unknown[]) => Promise<unknown>;

export interface Capability {
  available: boolean;
  reason?: string;
  disruptive?: boolean;
  permissionState?: string;
}

export interface WritebackNamespace {
  hasPermission(operation: 'update', options?: { fields?: string[] }): boolean;
  requestPermission(operation: 'update', options?: { fields?: string[] }): Promise<string>;
  update(data: Record<string, unknown>, options?: { mode?: string }): Promise<unknown>;
}

function apiNamespace(sdk: VimSDK, namespace: string): Record<string, unknown> | null {
  const api = sdk.ehr.api as unknown as Record<string, unknown>;
  const ns = api[namespace];
  return ns && typeof ns === 'object' ? (ns as Record<string, unknown>) : null;
}

export function getApiMethod(sdk: VimSDK, namespace: string, method: string): ApiMethod | null {
  const ns = apiNamespace(sdk, namespace);
  const fn = ns?.[method];
  return typeof fn === 'function' ? (fn as ApiMethod) : null;
}

export function getCapability(sdk: VimSDK, namespace: string, method: string): Capability | null {
  const ns = apiNamespace(sdk, namespace);
  const fn = ns?.getCapability;
  if (typeof fn !== 'function') return null;
  const result = (fn as (m: string) => unknown).call(ns, method);
  return result && typeof result === 'object' ? (result as Capability) : null;
}

export function getWritebackNamespace(sdk: VimSDK, entity: string): WritebackNamespace | null {
  const context = sdk.ehr.context as unknown as Record<string, unknown>;
  const ns = context[entity];
  if (!ns || typeof ns !== 'object') return null;
  const candidate = ns as Record<string, unknown>;
  return typeof candidate.update === 'function' ? (candidate as unknown as WritebackNamespace) : null;
}

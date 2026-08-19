/**
 * SDOH app — Vim SDK connection layer.
 *
 * Aligned to the Vim demo app baseline: static import, typed `VimSDK`, and the
 * shared sdk-invoke helpers for guarded dynamic dispatch. This is the ONLY file
 * that imports the SDK — rules/tests/UI depend on the narrow local types below.
 */
import { initVimSDK, getVimSDK, type VimSDK } from '@vimconnect/app-sdk';
import { getWritebackNamespace, type Capability } from './sdk-invoke';
import type { PatientLike, ReferralLike } from './sdoh-rules';

/** Initialize the SDK with an access token and mark the app ENABLED in the Hub. */
export async function initSdk(accessToken: string): Promise<VimSDK> {
  const sdk = await initVimSDK({ accessToken });
  sdk.hub.setActivationStatus('ENABLED');
  return sdk;
}

export function requireSdk(): VimSDK {
  const sdk = getVimSDK();
  if (!sdk) throw new Error('SDK not initialized — call initSdk(token) first.');
  return sdk;
}

/** Subscribe to patient context. Data arrives under `curr.fields`. Returns unsubscribe. */
export function onPatient(cb: (patient: PatientLike | null) => void): () => void {
  const sdk = requireSdk() as unknown as {
    ehr: { context: { onChange: (k: string, cb: (p: unknown, c: { fields?: PatientLike } | null) => void) => () => void } };
  };
  return sdk.ehr.context.onChange('chart_open:patient', (_prev, curr) => cb(curr?.fields ?? null));
}

/** Subscribe to a referral being started (for the transportation-barrier check). */
export function onReferralStart(cb: (referral: ReferralLike | null) => void): () => void {
  const sdk = requireSdk() as unknown as {
    ehr: { context: { onChange: (k: string, cb: (p: unknown, c: { fields?: ReferralLike } | null) => void) => () => void } };
  };
  return sdk.ehr.context.onChange('referral_start:referral', (_prev, curr) => cb(curr?.fields ?? null));
}

export type WritebackOutcome =
  | { ok: true }
  | { ok: false; reason: 'denied' | 'not_configured' | 'error'; detail?: string };

/**
 * Write SDOH Z-codes to the encounter as diagnoses, gated by the permission ceremony.
 * getCapability('update') -> requestPermission('update',{fields}) -> hasPermission -> update.
 * update() takes a NESTED object; mode 'append' preserves existing diagnoses.
 */
export async function writeZCodes(
  codes: Array<{ code: string; description: string }>
): Promise<WritebackOutcome> {
  const sdk = requireSdk();
  const wb = getWritebackNamespace(sdk, 'encounter');
  if (!wb) return { ok: false, reason: 'not_configured' };

  const cap = (sdk.ehr.context as unknown as { encounter: { getCapability: (op: string) => Capability } })
    .encounter.getCapability('update');
  if (!cap?.available) return { ok: false, reason: 'not_configured' };

  try {
    if (cap.disruptive && cap.permissionState === 'requestable') {
      const result = await wb.requestPermission('update', { fields: ['assessment.diagnoses'] });
      if (result === 'denied') return { ok: false, reason: 'denied' };
    }
    if (!wb.hasPermission('update')) return { ok: false, reason: 'denied' };

    await wb.update(
      { assessment: { diagnoses: codes.map((c) => ({ code: c.code, description: c.description })) } },
      { mode: 'append' }
    );
    return { ok: true };
  } catch (err) {
    const detail = err instanceof Error ? err.message : String(err);
    return { ok: false, reason: 'error', detail };
  }
}

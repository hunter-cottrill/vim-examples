/**
 * Referral guidance app — Vim SDK connection layer.
 *
 * This is the ONLY file that imports the SDK — domain modules and tests depend
 * only on their own narrow local types, never on `@vimconnect/app-sdk` directly.
 * Referral-specific context reads and writeback land here in a later step; for
 * now this only proves the connection: init + mark the app ENABLED in the Hub.
 */
import { initVimSDK, getVimSDK, type VimSDK } from '@vimconnect/app-sdk';
import { getWritebackNamespace, type Capability } from './sdk-invoke';
import type { PatientLike, ReferralLike } from './referral-engine';

// DEV-ONLY simulator seam. NEXT_PUBLIC_SIM_MODE is inlined as a build-time literal
// by Next.js, so with the flag unset (the default) `SIM_MODE` collapses to the
// literal `false` and every branch below is dead code the bundler eliminates —
// onPatient/onReferralStart reduce to exactly their pre-simulator real-SDK bodies,
// and simulatePatient/simulateReferralStart become permanent no-ops. This file
// remains the only one importing @vimconnect/app-sdk; the simulator functions
// below import nothing from it.
const SIM_MODE = process.env.NEXT_PUBLIC_SIM_MODE === 'true';

const simPatientListeners: Array<(patient: PatientLike | null) => void> = [];
const simReferralListeners: Array<(referral: ReferralLike | null) => void> = [];

/** DEV-ONLY, no-op unless NEXT_PUBLIC_SIM_MODE === 'true'. Fires a fixture through
 * the exact same listeners onPatient() registered — indistinguishable downstream
 * from a real chart_open:patient context change. See src/dev/SimulatorControls.tsx. */
export function simulatePatient(patient: PatientLike | null): void {
  if (!SIM_MODE) return;
  simPatientListeners.forEach((cb) => cb(patient));
}

/** DEV-ONLY, no-op unless NEXT_PUBLIC_SIM_MODE === 'true'. Fires a fixture through
 * the exact same listeners onReferralStart() registered — indistinguishable
 * downstream from a real referral_start:referral context change. */
export function simulateReferralStart(referral: ReferralLike | null): void {
  if (!SIM_MODE) return;
  simReferralListeners.forEach((cb) => cb(referral));
}

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
  if (SIM_MODE) {
    simPatientListeners.push(cb);
    return () => {
      const i = simPatientListeners.indexOf(cb);
      if (i !== -1) simPatientListeners.splice(i, 1);
    };
  }
  const sdk = requireSdk();
  return sdk.ehr.context.onChange('chart_open:patient', (_prev, curr) => {
    // TEMP (Step 2 live-payload verification) — remove once confirmed against a real EHR.
    console.log('[referral-guidance] chart_open:patient payload:', curr?.fields);
    cb(curr?.fields ?? null);
  });
}

/** Subscribe to a referral being started. */
export function onReferralStart(cb: (referral: ReferralLike | null) => void): () => void {
  if (SIM_MODE) {
    simReferralListeners.push(cb);
    return () => {
      const i = simReferralListeners.indexOf(cb);
      if (i !== -1) simReferralListeners.splice(i, 1);
    };
  }
  const sdk = requireSdk();
  return sdk.ehr.context.onChange('referral_start:referral', (_prev, curr) => {
    // TEMP (Step 2 live-payload verification) — remove once confirmed against a real EHR.
    console.log('[referral-guidance] referral_start:referral payload:', curr?.fields);
    cb(curr?.fields ?? null);
  });
}

export type WritebackOutcome =
  | { ok: true }
  | { ok: false; reason: 'denied' | 'not_configured' | 'error'; detail?: string };

/**
 * Append a note to the referral's basicInformation.notes field, gated by the
 * permission ceremony: getCapability('update') -> requestPermission('update',
 * {fields}) if requestable -> hasPermission('update') -> update(...). Notes-only
 * for v1 — never attempts structured targetProvider writeback (see PLAN.md
 * Section 3: that field's writability is unverified for any EHR).
 * update() takes a NESTED object; mode 'append' preserves any existing notes text.
 */
export async function writeReferralNote(note: string): Promise<WritebackOutcome> {
  const sdk = requireSdk();
  const wb = getWritebackNamespace(sdk, 'referral');
  if (!wb) return { ok: false, reason: 'not_configured' };

  const cap = (sdk.ehr.context as unknown as { referral: { getCapability: (op: string) => Capability } })
    .referral.getCapability('update');
  if (!cap?.available) return { ok: false, reason: 'not_configured' };

  try {
    if (cap.disruptive && cap.permissionState === 'requestable') {
      const result = await wb.requestPermission('update', { fields: ['basicInformation.notes'] });
      if (result === 'denied') return { ok: false, reason: 'denied' };
    }
    if (!wb.hasPermission('update')) return { ok: false, reason: 'denied' };

    await wb.update({ basicInformation: { notes: note } }, { mode: 'append' });
    return { ok: true };
  } catch (err) {
    const detail = err instanceof Error ? err.message : String(err);
    return { ok: false, reason: 'error', detail };
  }
}

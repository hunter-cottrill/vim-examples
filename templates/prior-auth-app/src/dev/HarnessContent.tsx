'use client';

import { PriorAuthCard } from '@/components/PriorAuthCard';
import { SimulatorControls } from '@/components/SimulatorControls';
import { usePriorAuthLifecycle } from '@/hooks/usePriorAuthLifecycle';

/**
 * Drives the real PA lifecycle hook and the real UI components against the
 * SIM_MODE seam in lib/vim/client.ts — passes `null` in place of a VimSDK,
 * which the hook (and the seam) only ever touch when SIM_MODE is false. See
 * build plan §8.
 */
export function HarnessContent() {
  const { paState, dispatch, handleRetryContext, handleSubmit, handleRecheck } = usePriorAuthLifecycle(null);

  return (
    <div className="page">
      <div className="page-header">
        <h1>Prior Authorization — Dev Harness</h1>
        <div className="page-subtitle">
          Drives the real domain logic and UI with simulated EHR data. Only reachable when NEXT_PUBLIC_SIM_MODE=true.
        </div>
      </div>
      <div className="page-content">
        <SimulatorControls dispatch={dispatch} />
        <PriorAuthCard state={paState} onRetryContext={handleRetryContext} onSubmit={handleSubmit} onRecheck={handleRecheck} />
      </div>
    </div>
  );
}

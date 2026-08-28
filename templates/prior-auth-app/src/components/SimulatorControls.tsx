'use client';

import type { Dispatch } from 'react';
import { registerSimFixture, simulateChartPatient, simulateEncounterPatient, simulateContextFailure, simulateOrderEvent } from '@/lib/vim/client';
import { simulateSubmitFailure } from '@/dev/simControls';
import type { PriorAuthInput } from '@/lib/priorAuth/types';
import { FIXTURES } from '@/dev/fixtures';

interface SimulatorControlsProps {
  dispatch: Dispatch<PriorAuthInput>;
}

/** DEV-ONLY. Rendered only when NEXT_PUBLIC_SIM_MODE === 'true' (see src/app/app/page.tsx). */
export function SimulatorControls({ dispatch }: SimulatorControlsProps) {
  function fireFixture(fixtureId: string) {
    const fixture = FIXTURES.find((f) => f.id === fixtureId);
    if (!fixture) return;
    simulateChartPatient(true);
    registerSimFixture({ order: fixture.order, insurance: fixture.insurance, diagnoses: fixture.diagnoses });
    simulateOrderEvent(fixture.order.ehrOrderId);
  }

  function fireContextFailure() {
    const ehrOrderId = 'order-context-failure-demo';
    simulateChartPatient(true);
    simulateContextFailure(ehrOrderId);
    simulateOrderEvent(ehrOrderId);
  }

  return (
    <div className="card">
      <div className="section-title" style={{ marginBottom: 'var(--space-md)' }}>
        Simulator
      </div>
      <div className="input-group">
        {FIXTURES.map((fixture) => (
          <button key={fixture.id} type="button" className="btn btn-sm" onClick={() => fireFixture(fixture.id)}>
            {fixture.label}
          </button>
        ))}
      </div>
      <div className="input-group">
        <button type="button" className="btn btn-sm" onClick={fireContextFailure}>
          Simulate context load failure
        </button>
        <button type="button" className="btn btn-sm" onClick={() => simulateSubmitFailure()}>
          Force next submission to fail
        </button>
        <button type="button" className="btn btn-sm" onClick={() => dispatch({ type: 'POLL_EXHAUSTED' })}>
          Force pending request to time out
        </button>
      </div>
      <div className="input-group">
        <button type="button" className="btn btn-sm" onClick={() => simulateEncounterPatient(true)}>
          Open encounter
        </button>
        <button type="button" className="btn btn-sm" onClick={() => simulateChartPatient(false)}>
          Chart context empties
        </button>
        <button type="button" className="btn btn-sm" onClick={() => simulateEncounterPatient(false)}>
          Encounter context empties
        </button>
      </div>
    </div>
  );
}

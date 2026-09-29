'use client';
/**
 * DEV-ONLY. Drives the simulator. Every button feeds data in at the SDK client
 * boundary, so the panel below runs the same code it would against a real EHR.
 */
import { useCallback, useState } from 'react';
import { SIM_PATIENT_LABELS, simulateContext, simulateEvent } from '@/lib/vim-client';
import { useLearning } from '@/lib/use-learning';
import { LearningPanel } from '@/components/LearningPanel';

const noConnect = async () => {};

export function HarnessContent() {
  const state = useLearning(useCallback(noConnect, []));
  const [patientIndex, setPatientIndex] = useState(0);
  const btn = { marginRight: 6, marginBottom: 6 } as const;

  return (
    <div style={{ display: 'flex', gap: 24, fontFamily: 'system-ui, sans-serif', padding: 16, flexWrap: 'wrap' }}>
      <aside style={{ maxWidth: 320 }}>
        <h1 style={{ fontSize: 16 }}>Simulator</h1>
        <label style={{ fontSize: 13 }}>
          Patient{' '}
          <select value={patientIndex} onChange={(e) => setPatientIndex(Number(e.target.value))}>
            {SIM_PATIENT_LABELS.map((l, i) => <option key={l} value={i}>{l}</option>)}
          </select>
        </label>
        <h2 style={{ fontSize: 14 }}>Provider actions</h2>
        <button style={btn} onClick={() => { simulateContext('chart', patientIndex); simulateEvent('chart_open'); }}>Open chart</button>
        <button style={btn} onClick={() => { simulateContext('chart', null); simulateContext('encounter', patientIndex); simulateEvent('encounter_open'); }}>Open an encounter</button>
        <button style={btn} onClick={() => { simulateContext('encounter', null); simulateContext('chart', patientIndex); }}>Back to the chart</button>
        <button style={btn} onClick={() => { simulateContext('chart', null); simulateContext('encounter', null); }}>Leave the patient</button>
        <h2 style={{ fontSize: 14 }}>Raw signals</h2>
        <p style={{ fontSize: 12, color: '#777' }}>Fire one piece at a time, to see which signal drives what.</p>
        <button style={btn} onClick={() => simulateEvent('chart_open')}>Event only: chart_open</button>
        <button style={btn} onClick={() => simulateContext('chart', patientIndex)}>Context only: chart present</button>
        <button style={btn} onClick={() => simulateContext('chart', null)}>Context only: chart empty</button>
      </aside>
      <LearningPanel state={state} />
    </div>
  );
}

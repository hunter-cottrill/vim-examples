'use client';
/**
 * DEV-ONLY. Drives the simulator. Every button feeds data in at the SDK client
 * boundary, so the panel runs the same code it would against a real EHR.
 *
 * After each click, the feedback line reports what was sent and whether
 * anything received it. That comes from the simulator's real listener counts,
 * not from a guess about which modules are built.
 */
import { useCallback, useState } from 'react';
import { connectToVim, SIM_PATIENT_LABELS, simulateContext, simulateEvent } from '@/lib/vim-client';
import type { PresenceKey } from '@/lib/presence-tracker';
import { useLearning } from '@/lib/use-learning';
import { LearningPanel } from '@/components/LearningPanel';

// Calls the real connectToVim, so Module 1 is exercised here exactly as in the app.
const simConnect = () => connectToVim('simulator');

const CONTEXT_KEY: Record<PresenceKey, string> = {
  chart: 'chart_open:patient',
  encounter: 'encounter_open:patient',
};

interface Delivery {
  label: string;
  kind: 'event' | 'context';
  reached: number;
}

interface LastAction {
  action: string;
  deliveries: Delivery[];
}

function event(type: Parameters<typeof simulateEvent>[0]): Delivery {
  return { label: type, kind: 'event', reached: simulateEvent(type) };
}

function context(key: PresenceKey, patientIndex: number | null): Delivery {
  const state = patientIndex === null ? 'empty' : 'present';
  return { label: `${CONTEXT_KEY[key]} ${state}`, kind: 'context', reached: simulateContext(key, patientIndex) };
}

function Feedback({ last }: { last: LastAction | null }) {
  if (!last) {
    return <p style={{ fontSize: 12, color: '#777' }}>Click a button to send a signal. This line reports what was sent, and whether anything received it.</p>;
  }
  return (
    <div role="status" style={{ fontSize: 12, background: '#f5f5f5', borderRadius: 6, padding: '8px 10px', marginTop: 8 }}>
      <strong>{last.action}</strong> sent:
      <ul style={{ margin: '4px 0 0', paddingLeft: 18 }}>
        {last.deliveries.map((d, i) => (
          <li key={i}>
            <code>{d.label}</code> {d.kind} —{' '}
            {d.reached > 0 ? (
              <span style={{ color: '#1a7f37' }}>delivered</span>
            ) : (
              <span style={{ color: '#9a6700' }}>
                nothing listening yet ({d.kind === 'event' ? 'Module 3 subscribes to events' : 'Module 4 watches context'})
              </span>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}

export function HarnessContent() {
  const state = useLearning(useCallback(simConnect, []));
  const [patientIndex, setPatientIndex] = useState(0);
  const [last, setLast] = useState<LastAction | null>(null);
  const btn = { marginRight: 6, marginBottom: 6 } as const;

  // Signals are sent in order, left to right — the same order the EHR sends them.
  const send = (action: string, signals: Array<() => Delivery>) => setLast({ action, deliveries: signals.map((s) => s()) });

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
        <button style={btn} onClick={() => send('Open chart', [() => context('chart', patientIndex), () => event('chart_open')])}>Open chart</button>
        <button style={btn} onClick={() => send('Open an encounter', [() => context('chart', null), () => context('encounter', patientIndex), () => event('encounter_open')])}>Open an encounter</button>
        <button style={btn} onClick={() => send('Back to the chart', [() => context('encounter', null), () => context('chart', patientIndex)])}>Back to the chart</button>
        <button style={btn} onClick={() => send('Leave the patient', [() => context('chart', null), () => context('encounter', null)])}>Leave the patient</button>

        <h2 style={{ fontSize: 14 }}>Raw signals</h2>
        <p style={{ fontSize: 12, color: '#777' }}>Fire one piece at a time, to see which signal drives what.</p>
        <button style={btn} onClick={() => send('Event only', [() => event('chart_open')])}>Event only: chart_open</button>
        <button style={btn} onClick={() => send('Context only', [() => context('chart', patientIndex)])}>Context only: chart present</button>
        <button style={btn} onClick={() => send('Context only', [() => context('chart', null)])}>Context only: chart empty</button>

        <Feedback last={last} />
      </aside>
      <LearningPanel state={state} />
    </div>
  );
}

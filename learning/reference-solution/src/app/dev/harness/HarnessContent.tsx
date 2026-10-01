'use client';
/**
 * DEV-ONLY. Drives the simulator. Every button feeds data in at the SDK client
 * boundary, so the panel runs the same code it would against a real EHR.
 *
 * After each click, the feedback line reports what was sent and whether
 * anything received it. That comes from the simulator's real listener counts,
 * not from a guess about which modules are built.
 */
import { useCallback, useEffect, useState } from 'react';
import { connectToVim, SIM_PATIENT_LABELS, simulateContext, simulateEvent } from '@/lib/vim-client';
import type { PresenceKey } from '@/lib/presence-tracker';
import { isNotBuilt, type NotifyDecision } from '@/lib/learning-types';
import { setSimPanelOpen, simulatedNotifications, simulateWorkerEvent, startWorker, type SimNotification } from '@/lib/worker-client';
import { SIM_PATIENTS } from '@/dev/fixtures';
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
    return <p className="subtle">Click a button to send a signal. This line reports what was sent, and whether anything received it.</p>;
  }
  return (
    <div role="status" className="feedback">
      <p className="feedback-title"><strong>{last.action}</strong> sent:</p>
      <ul className="feedback-rows">
        {last.deliveries.map((d, i) => (
          <li key={i} className="feedback-row">
            <span className="code">{d.label}</span>
            <span className="subtle">{d.kind}</span>
            {d.reached > 0 ? (
              <span className="badge badge-success">delivered</span>
            ) : (
              <>
                <span className="badge badge-warning">nothing listening yet</span>
                <span className="feedback-hint">{d.kind === 'event' ? 'Module 3 subscribes to events' : 'Module 4 watches context'}</span>
              </>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}

const DECISION_TEXT: Record<string, string> = {
  notify: 'notified the provider',
  panel_open: 'stayed quiet — the panel is already open',
  throttled: 'stayed quiet — already notified about this patient recently',
};

/** Module 9 (optional) — the Worker, which runs whether or not the panel is open. */
function WorkerBox({ status, panelOpen, onPanelOpen, lastDecision, notifications }: {
  status: 'starting' | 'running' | 'not_built';
  panelOpen: boolean;
  onPanelOpen: (open: boolean) => void;
  lastDecision: string | null;
  notifications: SimNotification[];
}) {
  return (
    <section className="worker">
      <div className="worker-head">
        <h2>Worker</h2>
        <span className="eyebrow">Module 9 · optional</span>
      </div>
      {status === 'not_built' ? (
        <div className="module-pending">
          <span className="badge badge-neutral">Not built yet</span>
          <p>Open <span className="code">src/lib/worker-client.ts</span> and find <span className="code">MODULE 9</span>.</p>
        </div>
      ) : (
        <>
          <label className="switch">
            <input type="checkbox" checked={panelOpen} onChange={(e) => onPanelOpen(e.target.checked)} /> UI panel open
          </label>
          <p className="subtle">In a real EHR a closed panel means the UI app isn&apos;t running at all. Here the panel stays visible so you can compare.</p>
          <p>{lastDecision ? <>On the last <span className="code">chart_open</span>, the Worker <strong>{lastDecision}</strong>.</> : <span className="muted">Open a chart to send the Worker a <span className="code">chart_open</span> event.</span>}</p>
          <div className="notifications">
            <span className="eyebrow">Notifications</span>
            {notifications.length === 0 ? <p className="subtle">None yet.</p> : notifications.map((n, i) => (
              <div key={i} className="notification">
                <span className="dot" aria-hidden />
                <span><span className="notification-title">{n.title}</span> — {n.text}</span>
                <span className="notification-time">{n.at}</span>
              </div>
            ))}
          </div>
        </>
      )}
    </section>
  );
}

export function HarnessContent() {
  const state = useLearning(useCallback(simConnect, []));
  const [patientIndex, setPatientIndex] = useState(0);
  const [last, setLast] = useState<LastAction | null>(null);

  // Module 9 — start the Worker alongside the UI app, as the hub does.
  const [workerStatus, setWorkerStatus] = useState<'starting' | 'running' | 'not_built'>('starting');
  const [panelOpen, setPanelOpen] = useState(true);
  const [lastDecision, setLastDecision] = useState<string | null>(null);
  const [notifications, setNotifications] = useState<SimNotification[]>([]);
  useEffect(() => {
    // The Worker starts asynchronously, so this effect's cleanup can run before
    // it has finished starting (React's dev mode mounts components twice). If
    // that happens, unregister it the moment it's ready, or two Workers run.
    let stop: (() => void) | undefined;
    let cancelled = false;
    startWorker({ accessToken: 'simulator', idToken: 'simulator' })
      .then((unregister) => {
        if (cancelled) { unregister(); return; }
        stop = unregister;
        setWorkerStatus('running');
      })
      .catch((err) => { if (isNotBuilt(err)) setWorkerStatus('not_built'); else throw err; });
    return () => { cancelled = true; stop?.(); };
  }, []);
  const togglePanel = (open: boolean) => { setSimPanelOpen(open); setPanelOpen(open); };
  const toWorker = async () => {
    const id = SIM_PATIENTS[patientIndex]?.patient.identifiers?.ehrPatientId ?? null;
    const [decision] = await simulateWorkerEvent('chart_open', id);
    if (decision) setLastDecision(DECISION_TEXT[(decision as NotifyDecision).notify ? 'notify' : (decision as { reason: string }).reason]);
    setNotifications(simulatedNotifications());
  };

  // Signals are sent in order, left to right — the same order the EHR sends them.
  const send = (action: string, signals: Array<() => Delivery>) => setLast({ action, deliveries: signals.map((s) => s()) });

  return (
    <div className="harness">
      <aside className="console">
        <div>
          <p className="eyebrow">Plays the EHR</p>
          <h1 className="console-title">Simulator</h1>
        </div>

        <label className="field-label">
          Patient
          <select className="input" value={patientIndex} onChange={(e) => setPatientIndex(Number(e.target.value))}>
            {SIM_PATIENT_LABELS.map((l, i) => <option key={l} value={i}>{l}</option>)}
          </select>
        </label>

        <div className="console-group">
          <h2 className="eyebrow">Provider actions</h2>
          <div className="button-row">
            <button type="button" className="btn btn-secondary" onClick={() => { send('Open chart', [() => context('chart', patientIndex), () => event('chart_open')]); void toWorker(); }}>Open chart</button>
            <button type="button" className="btn btn-secondary" onClick={() => send('Open an encounter', [() => context('chart', null), () => context('encounter', patientIndex), () => event('encounter_open')])}>Open an encounter</button>
            <button type="button" className="btn btn-secondary" onClick={() => send('Back to the chart', [() => context('encounter', null), () => context('chart', patientIndex)])}>Back to the chart</button>
            <button type="button" className="btn btn-secondary" onClick={() => send('Leave the patient', [() => context('chart', null), () => context('encounter', null)])}>Leave the patient</button>
          </div>
        </div>

        <div className="console-group">
          <h2 className="eyebrow">Raw signals</h2>
          <p className="subtle">Fire one piece at a time, to see which signal drives what.</p>
          <div className="button-row">
            <button type="button" className="btn btn-ghost btn-sm" onClick={() => { send('Event only', [() => event('chart_open')]); void toWorker(); }}>Event only: chart_open</button>
            <button type="button" className="btn btn-ghost btn-sm" onClick={() => send('Context only', [() => context('chart', patientIndex)])}>Context only: chart present</button>
            <button type="button" className="btn btn-ghost btn-sm" onClick={() => send('Context only', [() => context('chart', null)])}>Context only: chart empty</button>
          </div>
        </div>

        <Feedback last={last} />
        <WorkerBox status={workerStatus} panelOpen={panelOpen} onPanelOpen={togglePanel} lastDecision={lastDecision} notifications={notifications} />
      </aside>
      <LearningPanel state={state} />
    </div>
  );
}

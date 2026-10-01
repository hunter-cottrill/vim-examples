'use client';
import { useState, type ReactNode } from 'react';
import type { Loadable, WriteResult } from '@/lib/learning-types';
import type { LearningState } from '@/lib/use-learning';
import { SIM_MODE } from '@/lib/vim-client';
import { SimBanner } from './SimBanner';

function Module({ n, title, unbuilt, needs, children }: { n: number; title: string; unbuilt: ReadonlySet<number>; needs?: number; children: ReactNode }) {
  const notBuilt = unbuilt.has(n);
  const blocked = !notBuilt && needs !== undefined && unbuilt.has(needs);
  const pending = notBuilt || blocked;
  return (
    <section className={pending ? 'module module--pending' : 'module'}>
      <div className="module-head">
        <h2 className="module-title">{title}</h2>
        <span className="eyebrow">Module {n}</span>
      </div>
      {notBuilt ? (
        <div className="module-pending">
          <span className="badge badge-neutral">Not built yet</span>
          <p>Open <span className="code">src/lib/vim-client.ts</span> and find <span className="code">MODULE {n}</span>.</p>
        </div>
      ) : blocked ? (
        <div className="module-pending">
          <span className="badge badge-purple">Needs Module {needs} first</span>
          <p>Nothing is fetched until the app knows a patient is on screen.</p>
        </div>
      ) : children}
    </section>
  );
}

function LoadState<T>({ value, children }: { value: Loadable<T>; children: (data: T) => ReactNode }) {
  switch (value.kind) {
    case 'idle': return <p className="muted">Waiting for a patient.</p>;
    case 'loading': return <p className="muted">Loading…</p>;
    case 'unsupported': return <p className="muted">This EHR doesn&apos;t provide this.</p>;
    case 'error': return <p><span className="badge badge-error">Error</span> <span className="muted">{value.message}</span></p>;
    case 'loaded': return <>{children(value.data)}</>;
  }
}

const RESULT_BADGE: Record<WriteResult, string> = {
  written: 'badge-success',
  denied: 'badge-warning',
  unavailable: 'badge-neutral',
  failed: 'badge-error',
};

function Pills({ items }: { items: string[] }) {
  if (items.length === 0) return <span className="subtle">none</span>;
  return <>{items.map((i) => <span key={i} className="code">{i}</span>)}</>;
}

export function LearningPanel({ state }: { state: LearningState }) {
  const [note, setNote] = useState('');
  return (
    <main className="app-frame">
      <div className="app-frame-header">
        <span className="connect-dot" aria-hidden />
        Vim learning app
        <span className="eyebrow">App panel</span>
      </div>
      <SimBanner />

      <div className="panel">
        <Module n={1} title="Session" unbuilt={state.unbuilt}>
          {state.connection === 'connecting' && <p className="muted">Connecting…</p>}
          {state.connection === 'connected' && (SIM_MODE
            ? <p className="row"><span className="badge badge-success">Built</span> <span className="muted">In the simulator there&apos;s no session to start — this runs for real when you go live in Module 7.</span></p>
            : <p className="row"><span className="badge badge-success">Connected</span> <span className="muted">The hub knows the app is ready.</span></p>)}
          {state.connection === 'failed' && <p className="row"><span className="badge badge-error">Couldn&apos;t connect</span> <span className="muted">{state.connectionError}</span></p>}
        </Module>

        <Module n={2} title="What this session supports" unbuilt={state.unbuilt}>
          {state.session ? (
            <ul className="rows">
              <li className="row-kv"><span className="row-label">Events</span><span className="pills"><Pills items={state.session.events} /></span></li>
              <li className="row-kv"><span className="row-label">Context keys</span><span className="pills"><Pills items={state.session.contexts} /></span></li>
              <li className="row-kv"><span className="row-label">Entities</span><span className="pills"><Pills items={state.session.entities} /></span></li>
              <li className="row-kv"><span className="row-label">Writable</span><span className="pills"><Pills items={state.session.writable} /></span></li>
            </ul>
          ) : <p className="muted">Not read yet.</p>}
        </Module>

        <Module n={3} title="Workflow events" unbuilt={state.unbuilt}>
          {state.events.length === 0 ? <p className="muted">No events yet.</p> : (
            <ul className="rows">
              {state.events.map((e, i) => <li key={i} className="row"><span className="subtle">{e.at}</span><span className="code">{e.type}</span></li>)}
            </ul>
          )}
        </Module>

        <Module n={4} title="Patient presence" unbuilt={state.unbuilt}>
          <p className="presence">
            <span className={state.patientPresent ? 'dot dot-success' : 'dot dot-neutral'} aria-hidden />
            {state.patientPresent ? 'A patient is on screen.' : 'No patient on screen.'}
          </p>
        </Module>

        <Module n={5} title="Patient details" unbuilt={state.unbuilt} needs={4}>
          <LoadState value={state.patient}>
            {(p) => (
              <div>
                <p className="patient-name">{p.name ?? 'Name not provided'}</p>
                <p className="patient-meta">MRN {p.mrn ?? '—'} · EHR id {p.ehrPatientId ?? '—'}</p>
              </div>
            )}
          </LoadState>
          {state.problems.kind !== 'idle' && <LoadState value={state.problems}>
            {(rows) => rows.length === 0 ? <p className="muted">No problems on the list.</p> : (
              <ul className="rows">
                {rows.map((r, i) => <li key={i} className="row"><span className="code">{r.code ?? '—'}</span><span>{r.description ?? <span className="subtle">No description</span>}</span></li>)}
              </ul>
            )}
          </LoadState>}
        </Module>

        <Module n={6} title="Writeback" unbuilt={state.unbuilt} needs={4}>
          {!state.writeback ? <p className="muted">Waiting for a patient.</p> : !state.writeback.available ? (
            <p className="row"><span className="badge badge-neutral">Not available here</span>{state.writeback.reason && <span className="muted">{state.writeback.reason}</span>}</p>
          ) : (
            <div className="writeback">
              <textarea className="input" value={note} onChange={(e) => setNote(e.target.value)} rows={2} placeholder="A note to append to the encounter" aria-label="Note to append to the encounter" />
              <div className="writeback-actions">
                {state.lastWrite ? <span className={`badge ${RESULT_BADGE[state.lastWrite]}`}>Result: {state.lastWrite}</span> : <span />}
                <button type="button" className="btn btn-primary" disabled={!note.trim()} onClick={() => void state.writeNote(note.trim())}>
                  Append to encounter note
                </button>
              </div>
            </div>
          )}
        </Module>
      </div>
    </main>
  );
}

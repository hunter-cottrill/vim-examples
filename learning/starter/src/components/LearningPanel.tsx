'use client';
import { useState, type ReactNode } from 'react';
import type { Loadable } from '@/lib/learning-types';
import type { LearningState } from '@/lib/use-learning';
import { SIM_MODE } from '@/lib/vim-client';
import { SimBanner } from './SimBanner';

const card = { border: '1px solid #ddd', borderRadius: 8, padding: 12, marginBottom: 10 } as const;
const muted = { color: '#777', fontSize: 13 } as const;

function Module({ n, title, unbuilt, needs, children }: { n: number; title: string; unbuilt: ReadonlySet<number>; needs?: number; children: ReactNode }) {
  const notBuilt = unbuilt.has(n);
  const blocked = !notBuilt && needs !== undefined && unbuilt.has(needs);
  return (
    <section style={{ ...card, ...(notBuilt ? { borderStyle: 'dashed', background: '#fafafa' } : {}) }}>
      <div style={{ fontSize: 12, color: '#888' }}>Module {n}</div>
      <h2 style={{ fontSize: 15, margin: '2px 0 8px' }}>{title}</h2>
      {notBuilt ? <p style={muted}>Not built yet — open <code>src/lib/vim-client.ts</code> and find <code>MODULE {n}</code>.</p>
        : blocked ? <p style={muted}>Needs Module {needs} first — nothing is fetched until the app knows a patient is on screen.</p>
        : children}
    </section>
  );
}

function LoadState<T>({ value, children }: { value: Loadable<T>; children: (data: T) => ReactNode }) {
  switch (value.kind) {
    case 'idle': return <p style={muted}>Waiting for a patient.</p>;
    case 'loading': return <p style={muted}>Loading…</p>;
    case 'unsupported': return <p style={muted}>This EHR doesn't provide this.</p>;
    case 'error': return <p style={{ color: '#b00' }}>{value.message}</p>;
    case 'loaded': return <>{children(value.data)}</>;
  }
}

export function LearningPanel({ state }: { state: LearningState }) {
  const [note, setNote] = useState('');
  return (
    <main style={{ fontFamily: 'system-ui, sans-serif', padding: 16, maxWidth: 440 }}>
      <SimBanner />

      <Module n={1} title="Session" unbuilt={state.unbuilt}>
        {state.connection === 'connecting' && <p style={muted}>Connecting…</p>}
        {state.connection === 'connected' && (SIM_MODE
          ? <p>Built. In the simulator there's no session to start — this runs for real when you go live in Module 7.</p>
          : <p>Connected. The hub knows the app is ready.</p>)}
        {state.connection === 'failed' && <p style={{ color: '#b00' }}>Couldn't connect: {state.connectionError}</p>}
      </Module>

      <Module n={2} title="What this session supports" unbuilt={state.unbuilt}>
        {state.session ? (
          <ul style={{ margin: 0, paddingLeft: 18, fontSize: 13 }}>
            <li><strong>Events:</strong> {state.session.events.join(', ') || 'none'}</li>
            <li><strong>Context keys:</strong> {state.session.contexts.join(', ') || 'none'}</li>
            <li><strong>Entities:</strong> {state.session.entities.join(', ') || 'none'}</li>
            <li><strong>Writable:</strong> {state.session.writable.join(', ') || 'none'}</li>
          </ul>
        ) : <p style={muted}>Not read yet.</p>}
      </Module>

      <Module n={3} title="Workflow events" unbuilt={state.unbuilt}>
        {state.events.length === 0 ? <p style={muted}>No events yet.</p> : (
          <ul style={{ margin: 0, paddingLeft: 18, fontSize: 13 }}>
            {state.events.map((e, i) => <li key={i}>{e.at} — <code>{e.type}</code></li>)}
          </ul>
        )}
      </Module>

      <Module n={4} title="Patient presence" unbuilt={state.unbuilt}>
        <p>{state.patientPresent ? 'A patient is on screen.' : 'No patient on screen.'}</p>
      </Module>

      <Module n={5} title="Patient details" unbuilt={state.unbuilt} needs={4}>
        <LoadState value={state.patient}>
          {(p) => (
            <p style={{ margin: '0 0 8px' }}>
              <strong>{p.name ?? 'Name not provided'}</strong><br />
              <span style={muted}>MRN {p.mrn ?? '—'} · EHR id {p.ehrPatientId ?? '—'}</span>
            </p>
          )}
        </LoadState>
        {state.problems.kind !== 'idle' && <LoadState value={state.problems}>
          {(rows) => rows.length === 0 ? <p style={muted}>No problems on the list.</p> : (
            <ul style={{ margin: 0, paddingLeft: 18, fontSize: 13 }}>
              {rows.map((r, i) => <li key={i}><code>{r.code ?? '—'}</code> {r.description ?? 'No description'}</li>)}
            </ul>
          )}
        </LoadState>}
      </Module>

      <Module n={6} title="Writeback" unbuilt={state.unbuilt} needs={4}>
        {!state.writeback ? <p style={muted}>Waiting for a patient.</p> : !state.writeback.available ? (
          <p style={muted}>Not available here{state.writeback.reason ? ` — ${state.writeback.reason}` : '.'}</p>
        ) : (
          <>
            <textarea value={note} onChange={(e) => setNote(e.target.value)} rows={2} style={{ width: '100%', boxSizing: 'border-box' }} placeholder="A note to append to the encounter" />
            <button type="button" disabled={!note.trim()} onClick={() => void state.writeNote(note.trim())} style={{ marginTop: 6 }}>
              Append to encounter note
            </button>
            {state.lastWrite && <p style={muted}>Result: {state.lastWrite}</p>}
          </>
        )}
      </Module>
    </main>
  );
}

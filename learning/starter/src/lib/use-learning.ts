'use client';
/**
 * Wires each module's SDK function to React state. Shared by the real app
 * page and the dev harness, so both run exactly the same code path.
 */
import { useEffect, useRef, useState } from 'react';
import { isNotBuilt, type EventEntry, type Loadable, type PatientCard, type ProblemRow, type SessionSummary, type WritebackCheck, type WriteResult } from './learning-types';
import {
  appendEncounterNote,
  checkEncounterWriteback,
  describeSession,
  fetchPatient,
  fetchProblems,
  onPatientPresence,
  onWorkflowEvent,
} from './vim-client';

export interface LearningState {
  connection: 'connecting' | 'connected' | 'failed';
  connectionError: string | null;
  session: SessionSummary | null;
  events: EventEntry[];
  patientPresent: boolean;
  patient: Loadable<PatientCard>;
  problems: Loadable<ProblemRow[]>;
  writeback: WritebackCheck | null;
  lastWrite: WriteResult | null;
  writeNote: (text: string) => Promise<void>;
  /** Modules whose function in vim-client.ts hasn't been written yet. */
  unbuilt: ReadonlySet<number>;
}

const MAX_EVENTS = 8;

/**
 * Run one module's function. If it hasn't been built yet, record that and
 * carry on, so the rest of the panel still works.
 */
function attempt<T>(markUnbuilt: (module: number) => void, fn: () => T): T | undefined {
  try {
    return fn();
  } catch (err) {
    if (isNotBuilt(err)) {
      markUnbuilt(err.module);
      return undefined;
    }
    throw err;
  }
}

export function useLearning(connect: () => Promise<void>): LearningState {
  const [connection, setConnection] = useState<LearningState['connection']>('connecting');
  const [connectionError, setConnectionError] = useState<string | null>(null);
  const [session, setSession] = useState<SessionSummary | null>(null);
  const [events, setEvents] = useState<EventEntry[]>([]);
  const [patientPresent, setPatientPresent] = useState(false);
  const [presenceNonce, setPresenceNonce] = useState(0);
  const [patient, setPatient] = useState<Loadable<PatientCard>>({ kind: 'idle' });
  const [problems, setProblems] = useState<Loadable<ProblemRow[]>>({ kind: 'idle' });
  const [writeback, setWriteback] = useState<WritebackCheck | null>(null);
  const [lastWrite, setLastWrite] = useState<WriteResult | null>(null);
  const [unbuilt, setUnbuilt] = useState<ReadonlySet<number>>(new Set());
  const markUnbuilt = (module: number) => setUnbuilt((prev) => new Set(prev).add(module));
  const started = useRef(false);
  const generation = useRef(0);

  // MODULE 1 — connect, then MODULES 2–4 subscribe.
  useEffect(() => {
    if (started.current) return;
    started.current = true;
    let unsubscribers: Array<() => void> = [];
    (async () => {
      try {
        try {
          await connect();
        } catch (err) {
          if (isNotBuilt(err)) markUnbuilt(err.module);
          throw err;
        }
        setConnection('connected');
        const summary = attempt(markUnbuilt, describeSession); // MODULE 2
        if (summary) setSession(summary);
        unsubscribers = [
          // MODULE 3
          attempt(markUnbuilt, () =>
            onWorkflowEvent((type) =>
              setEvents((prev) => [{ type, at: new Date().toLocaleTimeString() }, ...prev].slice(0, MAX_EVENTS)),
            ),
          ),
          // MODULE 4
          attempt(markUnbuilt, () =>
            onPatientPresence(
              () => {
                setPatientPresent(true);
                setPresenceNonce((n) => n + 1);
              },
              () => setPatientPresent(false),
            ),
          ),
        ].filter((off): off is () => void => typeof off === 'function');
      } catch (err) {
        setConnection('failed');
        setConnectionError(err instanceof Error ? err.message : String(err));
      }
    })();
    return () => unsubscribers.forEach((off) => off());
  }, [connect]);

  // MODULE 5 — fetch when a patient arrives; clear when they leave.
  // MODULE 6 — check writeback for the same patient.
  useEffect(() => {
    const current = ++generation.current;
    if (!patientPresent) {
      setPatient({ kind: 'idle' });
      setProblems({ kind: 'idle' });
      setWriteback(null);
      setLastWrite(null);
      return;
    }
    setPatient({ kind: 'loading' });
    setProblems({ kind: 'loading' });
    void (async () => {
      const load = async <T,>(fn: () => Promise<Loadable<T>>): Promise<Loadable<T>> => {
        try {
          return await fn();
        } catch (err) {
          if (isNotBuilt(err)) {
            markUnbuilt(err.module);
            return { kind: 'idle' };
          }
          return { kind: 'error', message: err instanceof Error ? err.message : String(err) };
        }
      };
      const [p, pr] = await Promise.all([load(fetchPatient), load(fetchProblems)]);
      if (generation.current !== current) return; // patient left or changed mid-fetch
      setPatient(p);
      setProblems(pr);
      const check = attempt(markUnbuilt, checkEncounterWriteback); // MODULE 6
      if (check) setWriteback(check);
    })();
  }, [patientPresent, presenceNonce]);

  async function writeNote(text: string): Promise<void> {
    try {
      setLastWrite(await appendEncounterNote(text));
    } catch (err) {
      if (isNotBuilt(err)) markUnbuilt(err.module);
      else setLastWrite('failed');
    }
  }

  return { connection, connectionError, session, events, patientPresent, patient, problems, writeback, lastWrite, writeNote, unbuilt };
}

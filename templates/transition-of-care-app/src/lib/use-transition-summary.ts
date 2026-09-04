'use client';

/**
 * Shared orchestration hook used by BOTH the real app (src/app/app/page.tsx,
 * passing a real OAuth `connect`) and the dev harness (passing a no-op
 * `connect`, since SIM_MODE's vim-client functions need no real SDK at all).
 * Neither surface re-implements this logic — this is the one fetch-reason-
 * render pipeline.
 */
import { useEffect, useRef, useState } from 'react';
import { fetchHospitalizationRecord } from './hospitalizationClient';
import { onChartOpen, onPatientPresenceChange, fetchMedications, fetchPatientSnapshot, fetchProblems } from './vim-client';
import { evaluateHospitalization, resolvePatientKey } from './transition/hospitalizationLookup';
import { derivePageStatus } from './transition/pageStatus';
import { reconcileDiagnoses, reconcileMedications } from './transition/reconciliation';
import type { HospitalizationLookupResult, PageStatus, TransitionSummary } from './transition/types';

export function useTransitionSummary(connect: () => Promise<void>): PageStatus {
  const [ready, setReady] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [patientPresent, setPatientPresent] = useState(false);
  const [summary, setSummary] = useState<TransitionSummary | null>(null);
  const initRef = useRef(false);
  const generationRef = useRef(0);
  const [chartNonce, setChartNonce] = useState(0);

  useEffect(() => {
    if (initRef.current) return;
    initRef.current = true;

    let unsubscribers: Array<() => void> = [];

    (async () => {
      try {
        await connect();
        setReady(true);
        console.log('[toc] connected, subscribing');

        unsubscribers = [
                    // chart_open is the fast path when the panel is already open. It is
          // one-shot, so it is an accelerator, not the source of truth.
          onChartOpen(() => {
            setPatientPresent(true);
            setChartNonce((n) => n + 1);
          }),
          onPatientPresenceChange(
            () => {
              setPatientPresent(true);
              setChartNonce((n) => n + 1);
            },
            () => setPatientPresent(false),
          ),
        ];
      } catch (err) {
        setError(err instanceof Error ? err.message : String(err));
      }
    })();

    return () => unsubscribers.forEach((unsub) => unsub());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready, patientPresent, chartNonce]);

  useEffect(() => {
    console.log('[toc] effect', { ready, patientPresent, chartNonce });
    if (!ready) return;
    if (patientPresent) {
      void runFetchCycle();
    } else {
      generationRef.current += 1;  // abandon any in-flight cycle
      setSummary(null);
      setError(null);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready, patientPresent, chartNonce]);

  async function runFetchCycle() {
    const generation = ++generationRef.current;
    setSummary(null);
    setError(null);

    const patientStatus = await fetchPatientSnapshot();
    if (generationRef.current !== generation) return;

    if (patientStatus.kind !== 'loaded') {
      const message =
        patientStatus.kind === 'unsupported'
          ? 'Patient data is not available from this EHR.'
          : patientStatus.kind === 'error'
            ? patientStatus.message
            : 'No patient data returned.';
      setError(message);
      return;
    }
    const patient = patientStatus.data;

    const [problems, medications] = await Promise.all([fetchProblems(), fetchMedications()]);
    if (generationRef.current !== generation) return;

    const patientKey = resolvePatientKey(patient);
    let hospitalization: HospitalizationLookupResult;
    if (patientKey === null) {
      hospitalization = { kind: 'unavailable' };
    } else {
      try {
        const record = await fetchHospitalizationRecord(patientKey);
        hospitalization = evaluateHospitalization(record, new Date().toISOString());
      } catch (err) {
        hospitalization = { kind: 'error', message: err instanceof Error ? err.message : String(err) };
      }
    }
    if (generationRef.current !== generation) return;

    // 'empty' (confirmed no problems/medications on the chart) is a real
    // basis for reconciliation — every discharge item is then correctly
    // 'none' (outstanding). Only 'unsupported'/'error' skip reconciliation,
    // since there we genuinely don't know what's on the chart.
    const currentProblems = problems.kind === 'loaded' ? problems.data : problems.kind === 'empty' ? [] : null;
    const currentMedications = medications.kind === 'loaded' ? medications.data : medications.kind === 'empty' ? [] : null;

    const diagnosisReconciliation =
      hospitalization.kind === 'found' && currentProblems !== null
        ? reconcileDiagnoses(hospitalization.record.dischargeDiagnoses, currentProblems)
        : [];
    const medicationReconciliation =
      hospitalization.kind === 'found' && currentMedications !== null
        ? reconcileMedications(hospitalization.record.dischargeMedications, currentMedications)
        : [];

    setSummary({ patient, problems, medications, hospitalization, diagnosisReconciliation, medicationReconciliation });
  }

  if (error) return { kind: 'error', message: error };
  if (!ready) return { kind: 'connecting' };
  return derivePageStatus(patientPresent, summary);
}

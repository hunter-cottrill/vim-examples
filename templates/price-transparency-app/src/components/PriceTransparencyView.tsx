'use client';

import { useEffect, useState } from 'react';
import type { VimSDK } from '@vimconnect/app-sdk';
import {
  getPatientInsurances,
  subscribeEncounterSelfPay,
  subscribeOrderEvents,
  type InsuranceRead,
  type OrderEventType,
  type OrderRead,
} from '@/lib/vim';
import {
  calculateEstimate,
  evaluateGfeEligibility,
  formatCents,
  matchOrderToCpt,
  type CrosswalkMatch,
  type EstimateResult,
  type GfeEligibility,
} from '@/lib/pricing';

const GFE_LABEL: Record<GfeEligibility, string> = {
  required: 'Good Faith Estimate required',
  recommended: 'Good Faith Estimate recommended',
  'not-applicable': 'Good Faith Estimate not applicable',
};

const GFE_CLASS: Record<GfeEligibility, string> = {
  required: 'gfe-badge gfe-badge-required',
  recommended: 'gfe-badge gfe-badge-recommended',
  'not-applicable': 'gfe-badge gfe-badge-not-applicable',
};

/** 'manual-test' marks an order simulated via the debug panel, not a real EHR event. */
type DisplayEventType = OrderEventType | 'manual-test';

/**
 * The result state (an estimate is ready) is the only state distinct enough
 * to need its own card content; every other case — no order yet, an order
 * that couldn't be identified, one that needs the provider to confirm which
 * procedure it is — reads as "still waiting for enough context to price
 * this," so they share one 'waiting' card with a reason to explain why.
 */
type CardState =
  | { kind: 'waiting'; reason: 'no-order' | 'no-match' | 'ambiguous' | 'computing' }
  | { kind: 'result' };

interface Props {
  sdk: VimSDK;
}

export function PriceTransparencyView({ sdk }: Props) {
  const [currentOrder, setCurrentOrder] = useState<OrderRead | null>(null);
  const [lastEventType, setLastEventType] = useState<DisplayEventType | null>(null);
  const [crosswalk, setCrosswalk] = useState<CrosswalkMatch | null>(null);
  const [selectedCpt, setSelectedCpt] = useState<string | null>(null);
  const [insurances, setInsurances] = useState<InsuranceRead[]>([]);
  const [selfPayByEncounter, setSelfPayByEncounter] = useState<Map<string, boolean | undefined>>(new Map());
  const [estimate, setEstimate] = useState<EstimateResult | null>(null);
  const [gfe, setGfe] = useState<GfeEligibility | null>(null);
  const [debugLog, setDebugLog] = useState<{ at: string; text: string }[]>([]);
  // Open by default while live EHR verification (build plan Step 0) is in progress.
  const [debugOpen, setDebugOpen] = useState(true);
  const [manualOrderName, setManualOrderName] = useState('');

  function pushDebug(text: string) {
    setDebugLog((prev) => [{ at: new Date().toLocaleTimeString(), text }, ...prev].slice(0, 50));
  }

  // Shared by the real order_select/order_sign subscription and the debug
  // panel's "simulate an order" override below, so both run through the
  // exact same read → reason pipeline.
  function applyOrder(order: OrderRead, eventType: DisplayEventType) {
    pushDebug(
      `resolved order → orderName="${order.orderName ?? ''}" type=${order.orderType ?? 'unknown'} ehrOrderId=${order.ehrOrderId ?? 'n/a'}`,
    );
    setCurrentOrder(order);
    setLastEventType(eventType);
    setEstimate(null);
    setGfe(null);

    const searchText = [order.orderName, order.reason].filter(Boolean).join(' ');
    const match = matchOrderToCpt(searchText);
    setCrosswalk(match);
    setSelectedCpt(match.confidence === 'high' ? match.match.cpt : null);
  }

  // Trigger: order_select/order_sign — see build plan §3. Workflow-only;
  // `order` has no Context key, so this is the only way to observe it.
  useEffect(() => {
    return subscribeOrderEvents(sdk, applyOrder, (message) => pushDebug(message));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sdk]);

  // Continuous read of the open encounter's selfPay flag — the only place
  // that field exists in the SDK schema. Correlated to the order below via
  // ehrEncounterId (see build plan §3 — this correlation needs live
  // verification against a real EHR; the debug log below is where to watch
  // for it during that spike).
  useEffect(() => {
    return subscribeEncounterSelfPay(sdk, (encounter) => {
      if (!encounter?.ehrEncounterId) return;
      pushDebug(`encounter context: ${encounter.ehrEncounterId} selfPay=${String(encounter.selfPay)}`);
      setSelfPayByEncounter((prev) => new Map(prev).set(encounter.ehrEncounterId as string, encounter.selfPay));
    });
  }, [sdk]);

  // Read → reason: once a CPT is resolved (auto or provider-confirmed),
  // resolve insurance + self-pay and run the deterministic estimate.
  useEffect(() => {
    if (!selectedCpt || !currentOrder) return;
    let cancelled = false;

    (async () => {
      const insuranceList = await getPatientInsurances(sdk);
      if (cancelled) return;
      setInsurances(insuranceList);
      const primary = insuranceList.find((i) => i.isPrimary) ?? insuranceList[0];

      const encounterSelfPay = currentOrder.ehrEncounterId
        ? selfPayByEncounter.get(currentOrder.ehrEncounterId)
        : undefined;
      const selfPayResolved: boolean | 'unknown' = encounterSelfPay === undefined ? 'unknown' : encounterSelfPay;

      const result = calculateEstimate({
        cpt: selectedCpt,
        payerId: primary?.payerId,
        groupId: primary?.groupId,
        selfPay: selfPayResolved === true,
      });
      setEstimate(result);
      setGfe(evaluateGfeEligibility({ selfPay: selfPayResolved, contractedRateFound: result.source === 'contracted-rate' }));
      pushDebug(
        `priced ${selectedCpt}: patient owes ${formatCents(result.patientResponsibilityCents)} (source: ${result.source}, selfPay: ${String(selfPayResolved)})`,
      );
    })();

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedCpt, currentOrder, selfPayByEncounter, sdk]);

  const cardState: CardState =
    estimate && gfe
      ? { kind: 'result' }
      : !currentOrder
        ? { kind: 'waiting', reason: 'no-order' }
        : crosswalk?.confidence === 'ambiguous' && !selectedCpt
          ? { kind: 'waiting', reason: 'ambiguous' }
          : crosswalk?.confidence === 'none'
            ? { kind: 'waiting', reason: 'no-match' }
            // A CPT is resolved (high-confidence match or provider-confirmed)
            // but the async insurance/estimate lookup hasn't finished yet.
            : { kind: 'waiting', reason: 'computing' };

  return (
    <div className="page">
      <header className="page-header">
        <h1>Price Transparency</h1>
        <p className="page-subtitle">
          An estimate appears automatically when a provider selects or signs an order.
        </p>
      </header>

      <div className="page-content">
        <section className="card">
          {currentOrder && (
            <>
              <div className="field-row">
                <div className="field-label">Order name</div>
                <div>{currentOrder.orderName || '(no order name provided)'}</div>
              </div>
              <div className="field-row">
                <div className="field-label">Type</div>
                <div>{currentOrder.orderType ?? 'unknown'}</div>
              </div>
              {currentOrder.orderingProviderName && (
                <div className="field-row">
                  <div className="field-label">Ordering provider</div>
                  <div>{currentOrder.orderingProviderName}</div>
                </div>
              )}
              <div className="field-row">
                <div className="field-label">Event</div>
                <div>{lastEventType}</div>
              </div>
            </>
          )}

          {cardState.kind === 'waiting' && cardState.reason === 'no-order' && (
            <div className="empty-state">Waiting for an order to be selected or signed…</div>
          )}

          {cardState.kind === 'waiting' && cardState.reason === 'no-match' && (
            <div className="empty-state">
              {currentOrder?.orderName ? (
                <>
                  Couldn&apos;t match &ldquo;{currentOrder.orderName}&rdquo; to a known billable procedure — no cost
                  estimate is shown for this order.
                </>
              ) : (
                <>This EHR didn&apos;t provide an order name or reason to identify a procedure from — no cost estimate can be shown for this order.</>
              )}
            </div>
          )}

          {cardState.kind === 'waiting' && cardState.reason === 'computing' && (
            <div className="empty-state">Calculating estimate…</div>
          )}

          {cardState.kind === 'waiting' && cardState.reason === 'ambiguous' && crosswalk?.confidence === 'ambiguous' && (
            <div className="field-row">
              <h2>Which procedure is this?</h2>
              <div className="procedure-picker">
                {crosswalk.candidates.map((candidate) => (
                  <button
                    key={candidate.cpt}
                    type="button"
                    className="btn btn-primary btn-sm procedure-picker-option"
                    onClick={() => {
                      pushDebug(`provider confirmed procedure: ${candidate.cpt}`);
                      setSelectedCpt(candidate.cpt);
                    }}
                  >
                    {candidate.description} <span className="procedure-picker-cpt">CPT {candidate.cpt}</span>
                  </button>
                ))}
              </div>
            </div>
          )}

          {cardState.kind === 'result' && estimate && gfe && (
            <div className="estimate-card">
              <h2>Estimated patient cost</h2>
              <div className="estimate-amount">{formatCents(estimate.patientResponsibilityCents)}</div>
              <div className="estimate-subline">patient owes for CPT {estimate.cpt}</div>

              <div className="estimate-breakdown">
                <div className="estimate-breakdown-row">
                  <span>Allowed amount</span>
                  <span>{formatCents(estimate.allowedAmountCents)}</span>
                </div>
                <div className="estimate-breakdown-row">
                  <span>Insurance covers</span>
                  <span>{formatCents(estimate.insurancePortionCents)}</span>
                </div>
                {estimate.breakdown.deductibleAppliedCents > 0 && (
                  <div className="estimate-breakdown-row estimate-breakdown-row-muted">
                    <span>— deductible applied</span>
                    <span>{formatCents(estimate.breakdown.deductibleAppliedCents)}</span>
                  </div>
                )}
                {estimate.breakdown.coinsuranceCents > 0 && (
                  <div className="estimate-breakdown-row estimate-breakdown-row-muted">
                    <span>— coinsurance</span>
                    <span>{formatCents(estimate.breakdown.coinsuranceCents)}</span>
                  </div>
                )}
                {estimate.breakdown.copayCents > 0 && (
                  <div className="estimate-breakdown-row estimate-breakdown-row-muted">
                    <span>— copay</span>
                    <span>{formatCents(estimate.breakdown.copayCents)}</span>
                  </div>
                )}
              </div>

              <div className={GFE_CLASS[gfe]}>{GFE_LABEL[gfe]}</div>
              {gfe !== 'not-applicable' && (
                <p className="estimate-subline" style={{ marginTop: 'var(--space-sm)' }}>
                  Good Faith Estimate document generation is not wired up yet (build plan Step 4).
                </p>
              )}
            </div>
          )}
        </section>

        <div className="section-collapsible">
          <div className="section-header" onClick={() => setDebugOpen((v) => !v)}>
            <span className="section-chevron">{debugOpen ? '▾' : '▸'}</span>
            <span className="section-title">Debug log ({debugLog.length})</span>
          </div>
          <div className={`section-content ${debugOpen ? '' : 'collapsed'}`}>
            <div className="section-inner">
              <div className="field-row">
                <div className="field-label">Insurances read from patient.getInsurances()</div>
                <div>
                  {insurances.length === 0
                    ? '(none read yet)'
                    : insurances.map((i) => `${i.payerName ?? i.payerId ?? 'unknown payer'}${i.isPrimary ? ' (primary)' : ''}`).join(', ')}
                </div>
              </div>
              <div className="field-row">
                <div className="field-label">
                  Simulate an order (dev only — this EHR sandbox isn&apos;t populating orderName)
                </div>
                <div className="input-group">
                  <input
                    className="input"
                    type="text"
                    placeholder="e.g. MRI knee, comprehensive metabolic panel…"
                    value={manualOrderName}
                    onChange={(e) => setManualOrderName(e.target.value)}
                  />
                  <button
                    type="button"
                    className="btn btn-primary btn-sm"
                    disabled={!manualOrderName.trim()}
                    onClick={() => {
                      applyOrder({ orderName: manualOrderName, ehrOrderId: 'manual-test' }, 'manual-test');
                      setManualOrderName('');
                    }}
                  >
                    Simulate order
                  </button>
                </div>
              </div>
              <div className="activity-log">
                {debugLog.map((entry, i) => (
                  <div key={i} className="log-entry">
                    <span className="log-timestamp">{entry.at}</span> {entry.text}
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

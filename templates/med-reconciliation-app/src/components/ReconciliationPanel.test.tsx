import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { PATIENT_FIXTURES } from '@/dev/fixtures';
import { resolveRawChartPayload } from '@/lib/entity-mapping';
import { reconcile } from '@/lib/med-rec/engine';
import type { ChartContext, ReconciliationResult } from '@/lib/med-rec/types';
import { ConnectingView, ErrorView, WaitingView } from './StateViews';
import { ReconciliationPanel } from './ReconciliationPanel';

/**
 * Render smoke tests via react-dom/server — no jsdom, no browser, no extra
 * dependencies, and it still catches the whole class of "the component throws
 * on a shape the engine can legitimately produce" bug.
 *
 * Driven from the real fixtures through the real resolver and engine, so the
 * shapes rendered here are exactly the shapes the app produces.
 */

function load(key: string): { context: ChartContext; result: ReconciliationResult } {
  const fixture = PATIENT_FIXTURES.find((candidate) => candidate.key === key);
  if (!fixture) throw new Error(`No fixture named '${key}'`);
  const context = resolveRawChartPayload(fixture.source);
  return { context, result: reconcile(context) };
}

function renderPanel(key: string, openedFromNotification = false): string {
  const { context, result } = load(key);
  return renderToStaticMarkup(
    <ReconciliationPanel result={result} context={context} openedFromNotification={openedFromNotification} />,
  );
}

describe('ReconciliationPanel', () => {
  it('renders every fixture without throwing', () => {
    for (const fixture of PATIENT_FIXTURES) {
      if (fixture.key === 'chartLoadFailure') continue; // resolves to an error, never to a panel
      expect(() => renderPanel(fixture.key), `fixture '${fixture.key}' threw`).not.toThrow();
    }
  });

  it('shows all three finding titles for the demo chart', () => {
    const html = renderPanel('theDemoChart');
    expect(html).toContain('Two medications in the same class');
    expect(html).toContain('No medication on the list in the class typically used for this problem');
    expect(html).toContain('No problem on the list matching this medication');
  });

  it('never uses a clinical-judgement title', () => {
    // Golden rule 2: findings describe the data, not the conclusion.
    const html = PATIENT_FIXTURES.filter((f) => f.key !== 'chartLoadFailure')
      .map((f) => renderPanel(f.key))
      .join('');
    for (const forbidden of ['no longer indicated', 'not indicated', 'untreated', 'care gap', 'therapeutic duplication']) {
      expect(html.toLowerCase()).not.toContain(forbidden);
    }
  });

  it('labels the chart-stated counts differently from the inferred findings', () => {
    const html = renderPanel('theDemoChart');
    expect(html).toContain('Stated on the chart');
    expect(html).toContain("Inferred from this app&#x27;s drug vocabulary");
  });

  it('shows both exclusion reasons as their own section', () => {
    const html = renderPanel('theDemoChart');
    expect(html).toContain('Not analyzed');
    expect(html).toContain('outside this app&#x27;s drug vocabulary');
    expect(html).toContain('no medication name on the record');
  });

  it('renders an ambiguous match with the weaker evidence label', () => {
    expect(renderPanel('ambiguousCombination')).toContain('matched more than one ingredient');
  });

  it('explains the suppression rather than letting the absence read as "nothing found"', () => {
    const html = renderPanel('unmappedProblemSuppresses');
    expect(html).toContain('Nothing to reconcile');
    expect(html).toContain('was not evaluated for this chart');
  });

  it('does not claim suppression when every problem mapped', () => {
    expect(renderPanel('cleanChart')).not.toContain('was not evaluated for this chart');
  });

  it('states when it fell back to the chart-open payload', () => {
    expect(renderPanel('entityApiFallback')).toContain('the direct entity read was unavailable');
    expect(renderPanel('theDemoChart')).toContain('Read directly from the EHR');
  });

  it('renders the empty medication list without an exclusions section', () => {
    const html = renderPanel('emptyMedicationList');
    expect(html).toContain('No medications on this chart');
    expect(html).not.toContain('Not analyzed');
  });

  it('carries the standing limitations on every result', () => {
    for (const key of ['theDemoChart', 'cleanChart', 'emptyMedicationList']) {
      const html = renderPanel(key);
      expect(html).toContain('does not expose medication status');
      expect(html).toContain('Dispense and fill history is not connected');
      expect(html).toContain('does not check drug interactions');
    }
  });

  it('acknowledges a notification only when it was for this patient', () => {
    expect(renderPanel('theDemoChart', true)).toContain('Opened from a Hub notification');
    expect(renderPanel('theDemoChart', false)).not.toContain('Opened from a Hub notification');
  });
});

describe('state views', () => {
  it('renders the connecting and waiting states', () => {
    expect(renderToStaticMarkup(<ConnectingView />)).toContain('Connecting to Vim');
    expect(renderToStaticMarkup(<WaitingView text="Open a chart." />)).toContain('Open a chart.');
  });

  it('renders a distinct message for each error reason', () => {
    const initFailed = renderToStaticMarkup(<ErrorView reason="sdk_init_failed" />);
    const loadFailed = renderToStaticMarkup(<ErrorView reason="chart_load_failed" />);
    expect(initFailed).toContain('connect to Vim');
    expect(loadFailed).toContain('read this chart');
    expect(initFailed).not.toBe(loadFailed);
  });
});

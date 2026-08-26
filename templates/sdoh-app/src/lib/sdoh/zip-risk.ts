// FABRICATED ILLUSTRATIVE DEMO DATA. This table is NOT a real deprivation
// index, census/ADI lookup, or any authoritative public-health source — it is
// a small bundled crosswalk that stands in for one in this reference app.
// Never present it as authoritative in UI copy, README text, or demo
// narration; it exists only to exercise the "address -> neighborhood risk
// signal" rule end to end without a live geocoding/ADI integration.
//
// Real ZIP codes are used (so the demo reads naturally) but the risk tier
// assigned to each is invented for this app, not sourced from any dataset.

import type { RiskTier, ZipRiskMatch } from './types';

export const ZIP5_RISK_TABLE: Record<string, RiskTier> = {
  // New York
  '10453': 'elevated',
  '10454': 'elevated',
  '10021': 'typical',
  '10028': 'typical',
  // Illinois
  '60624': 'elevated',
  '60609': 'elevated',
  '60611': 'typical',
  '60614': 'typical',
  // California
  '90059': 'elevated',
  '90011': 'elevated',
  '90210': 'typical',
  '90405': 'typical',
  // Texas
  '75215': 'elevated',
  '75216': 'elevated',
  '75225': 'typical',
  '78746': 'typical',
  // Pennsylvania
  '19132': 'elevated',
  '19133': 'elevated',
  '19103': 'typical',
  '19106': 'typical',
  // Ohio
  '44105': 'elevated',
  '44108': 'elevated',
  '44122': 'typical',
  '44124': 'typical',
  // Georgia
  '30310': 'elevated',
  '30315': 'elevated',
  '30327': 'typical',
  '30305': 'typical',
  // Michigan
  '48205': 'elevated',
  '48213': 'elevated',
  '48304': 'typical',
  '48009': 'typical',
  // Arizona
  '85009': 'elevated',
  '85017': 'elevated',
  '85251': 'typical',
  '85253': 'typical',
  // Florida
  '33013': 'elevated',
  '33142': 'elevated',
  '33109': 'typical',
  '33480': 'typical',
};

// Coarser fallback used only when the exact ZIP5 isn't in the table above.
// Every entry here is 'elevated' — the crosswalk only uses the 3-digit
// prefix to extend the elevated-risk signal, not to assert a "typical" tier
// from a much larger, less specific area.
export const ZIP3_RISK_TABLE: Record<string, RiskTier> = {
  '104': 'elevated', // NY (Bronx area)
  '112': 'elevated', // NY (Brooklyn area)
  '606': 'elevated', // IL (Chicago area)
  '482': 'elevated', // MI (Detroit area)
  '770': 'elevated', // TX (Houston area)
  '191': 'elevated', // PA (Philadelphia area)
  '441': 'elevated', // OH (Cleveland area)
  '303': 'elevated', // GA (Atlanta area)
  '850': 'elevated', // AZ (Phoenix area)
  '330': 'elevated', // FL (Miami area)
};

export function matchZipRisk(zipCode: string | null): ZipRiskMatch {
  if (!zipCode) return { confidence: 'none' };
  const zip5 = zipCode.trim().slice(0, 5);

  const exact = ZIP5_RISK_TABLE[zip5];
  if (exact) return { confidence: 'high', tier: exact, source: 'exact_zip' };

  const zip3 = zip5.slice(0, 3);
  const prefixTier = ZIP3_RISK_TABLE[zip3];
  if (prefixTier) return { confidence: 'ambiguous', tier: prefixTier, source: 'zip3_prefix' };

  return { confidence: 'none' };
}

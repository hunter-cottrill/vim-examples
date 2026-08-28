// Bundled crosswalk: the SDK gives a ZIP code, never a coordinate. This is
// the only place a ZIP turns into a lat/lon, and it always stays an
// area-level approximation — see the disclosure comment in
// zip3-centroids.ts. A ZIP3 not present in the table yields 'none', never a
// guessed coordinate.
import { ZIP3_CENTROIDS } from './zip3-centroids';
import type { ZipMatch } from './types';

export function matchZipCrosswalk(zipCode: string | null): ZipMatch {
  const zip3 = (zipCode ?? '').slice(0, 3);
  const centroid = ZIP3_CENTROIDS[zip3];

  if (!centroid) {
    return { zip3, confidence: 'none' };
  }

  return { zip3, confidence: 'high', lat: centroid.lat, lon: centroid.lon };
}

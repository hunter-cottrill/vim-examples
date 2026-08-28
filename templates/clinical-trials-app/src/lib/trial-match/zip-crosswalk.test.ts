import { describe, expect, it } from 'vitest';
import { matchZipCrosswalk } from './zip-crosswalk';

describe('matchZipCrosswalk', () => {
  it('resolves a known ZIP3 (Denver, 802xx) to high confidence with a coordinate', () => {
    const match = matchZipCrosswalk('80202');
    expect(match.confidence).toBe('high');
    expect(match.zip3).toBe('802');
    expect(match.lat).toBeCloseTo(39.7, 0);
    expect(match.lon).toBeCloseTo(-105.0, 0);
  });

  it('resolves an unrecognized ZIP3 to none with no coordinate', () => {
    const match = matchZipCrosswalk('00000');
    expect(match.confidence).toBe('none');
    expect(match.lat).toBeUndefined();
    expect(match.lon).toBeUndefined();
  });

  it('resolves a null ZIP code to none', () => {
    const match = matchZipCrosswalk(null);
    expect(match.confidence).toBe('none');
  });
});

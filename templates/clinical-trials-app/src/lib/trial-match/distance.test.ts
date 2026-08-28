import { describe, expect, it } from 'vitest';
import { haversineMiles } from './distance';

describe('haversineMiles', () => {
  it('returns 0 for identical coordinates', () => {
    expect(haversineMiles(39.7392, -104.9903, 39.7392, -104.9903)).toBeCloseTo(0, 5);
  });

  it('computes the known Denver-to-Boulder distance within tolerance', () => {
    // Denver, CO -> Boulder, CO is ~25 miles.
    const miles = haversineMiles(39.7392, -104.9903, 40.015, -105.2705);
    expect(miles).toBeGreaterThan(20);
    expect(miles).toBeLessThan(30);
  });

  it('computes the known Denver-to-NYC distance within tolerance', () => {
    // Denver, CO -> New York, NY is ~1630 miles.
    const miles = haversineMiles(39.7392, -104.9903, 40.7128, -74.006);
    expect(miles).toBeGreaterThan(1600);
    expect(miles).toBeLessThan(1670);
  });
});

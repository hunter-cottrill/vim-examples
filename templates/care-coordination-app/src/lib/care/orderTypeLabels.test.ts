import { describe, it, expect } from 'vitest';
import { mapOrderTypeLabel, ORDER_TYPE_LABELS } from './orderTypeLabels';

describe('mapOrderTypeLabel', () => {
  it('maps a known raw type to its display label', () => {
    expect(mapOrderTypeLabel('lab')).toBe('Lab order');
  });

  it('falls back to the raw string verbatim for an unknown type', () => {
    expect(mapOrderTypeLabel('some-future-type')).toBe('some-future-type');
  });

  it('falls back to a generic label when no raw type is given', () => {
    expect(mapOrderTypeLabel(undefined)).toBe('Order');
  });
});

describe('ORDER_TYPE_LABELS vocabulary integrity', () => {
  it('has no empty keys or values', () => {
    for (const [key, value] of Object.entries(ORDER_TYPE_LABELS)) {
      expect(key.length).toBeGreaterThan(0);
      expect(value.length).toBeGreaterThan(0);
    }
  });

  it('has no duplicate keys', () => {
    const keys = Object.keys(ORDER_TYPE_LABELS);
    expect(new Set(keys).size).toBe(keys.length);
  });
});
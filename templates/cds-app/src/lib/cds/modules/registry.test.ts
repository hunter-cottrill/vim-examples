import { describe, it, expect } from 'vitest';
import { getEnabledModules, getModule } from './registry';
import type { ModuleContext } from './types';

const base: ModuleContext = {
  existingDiagnoses: [],
  existingCpts: [],
  isSigned: false,
  problems: [],
};

describe('diagnosis-gap module gating', () => {
  const mod = getModule('diagnosis-gap');

  it('is registered and enabled', () => {
    expect(mod).toBeDefined();
    expect(getEnabledModules().some((m) => m.id === 'diagnosis-gap')).toBe(true);
  });

  it('triggers when a chief complaint is present and no diagnosis is coded', () => {
    expect(mod!.trigger({ ...base, chiefComplaint: 'sore throat' })).toBe(true);
  });

  it('does NOT trigger when a diagnosis already exists', () => {
    expect(mod!.trigger({ ...base, chiefComplaint: 'sore throat', existingDiagnoses: ['J02.9'] })).toBe(false);
  });

  it('does NOT trigger on a signed encounter', () => {
    expect(mod!.trigger({ ...base, chiefComplaint: 'sore throat', isSigned: true })).toBe(false);
  });

  it('does NOT trigger with no chief complaint', () => {
    expect(mod!.trigger(base)).toBe(false);
  });
});

import { describe, expect, it } from 'vitest';
import { parseOnboardingV2State } from '../onboardingStateApi';
import { gateForClaimant } from '../../home/onboarding/profileGate';
import { tapGate } from '../../home/onboarding/profileGate';

const GATE = { status: 'incomplete', missing: ['first_name'], isAdmin: false } as never;

describe('parseOnboardingV2State', () => {
  it('claimant: gate does not apply', () => {
    expect(parseOnboardingV2State({ flag_on: true, claimant: true, profile_gate_applies: false })).toEqual({ profileGateApplies: false });
  });
  it('flag off / not a claimant: gate applies', () => {
    expect(parseOnboardingV2State({ flag_on: false, claimant: false, profile_gate_applies: true })).toEqual({ profileGateApplies: true });
    expect(parseOnboardingV2State({ flag_on: true, claimant: false, profile_gate_applies: true })).toEqual({ profileGateApplies: true });
  });
  it('null, malformed and non-boolean fail closed', () => {
    for (const raw of [null, undefined, 'x', 3, {}, { profile_gate_applies: 'false' }, { profile_gate_applies: 0 }, { profile_gate_applies: null }]) {
      expect(parseOnboardingV2State(raw)).toEqual({ profileGateApplies: true });
    }
  });
});

describe('gateForClaimant', () => {
  it('claimant gets null, which tapGate opens', () => {
    expect(gateForClaimant(GATE, { profileGateApplies: false })).toBeNull();
    expect(tapGate(gateForClaimant(GATE, { profileGateApplies: false })).kind).toBe('open');
  });
  it('applies, loading (undefined) and error keep the real gate', () => {
    expect(gateForClaimant(GATE, { profileGateApplies: true })).toBe(GATE);
    expect(gateForClaimant(GATE, undefined)).toBe(GATE);
    expect(gateForClaimant('loading', undefined)).toBe('loading');
  });
});

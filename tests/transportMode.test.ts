import { describe, expect, it } from 'vitest';
import { Plane, TrainFront, Footprints, CarTaxiFront } from 'lucide-react';
import {
  resolveTransportMode,
  isTransportMode,
  minutesLabel,
} from '@/lib/transportMode';

describe('resolveTransportMode', () => {
  it('defaults missing / nullish to metro (legacy-venue preservation)', () => {
    // The most important guarantee: existing London venues have no `mode` and
    // must keep rendering as metro (TfL roundel) — never break, never throw.
    expect(resolveTransportMode(undefined).mode).toBe('metro');
    expect(resolveTransportMode(null).mode).toBe('metro');
    expect(resolveTransportMode('').mode).toBe('metro');
  });

  it('falls back to metro for an unknown string', () => {
    expect(resolveTransportMode('garbage').mode).toBe('metro');
    expect(resolveTransportMode('plane').mode).toBe('metro'); // 'plane' is not the mode key
  });

  it('resolves a known mode to its icon + label + walk flag', () => {
    const air = resolveTransportMode('airport');
    expect(air.mode).toBe('airport');
    expect(air.Icon).toBe(Plane);
    expect(air.label).toBe('Nearest airport');
    expect(air.isWalk).toBe(false);

    const metro = resolveTransportMode('metro');
    expect(metro.Icon).toBe(TrainFront);
    expect(metro.isWalk).toBe(true);
  });

  it('is case- and whitespace-insensitive', () => {
    expect(resolveTransportMode('  AirPort ').mode).toBe('airport');
  });

  it('classifies walk-from-stop modes vs ride modes', () => {
    expect(resolveTransportMode('walk').isWalk).toBe(true);
    expect(resolveTransportMode('bus').isWalk).toBe(true);
    expect(resolveTransportMode('taxi').isWalk).toBe(false);
    expect(resolveTransportMode('shuttle').isWalk).toBe(false);
  });
});

describe('isTransportMode', () => {
  it('accepts known modes (case-insensitive) and rejects others', () => {
    expect(isTransportMode('taxi')).toBe(true);
    expect(isTransportMode('AIRPORT')).toBe(true);
    expect(isTransportMode('plane')).toBe(false);
    expect(isTransportMode(null)).toBe(false);
    expect(isTransportMode(42)).toBe(false);
  });
});

describe('minutesLabel', () => {
  it('says "walk" for walk modes, "away" for ride modes', () => {
    expect(minutesLabel(resolveTransportMode('walk'), 12)).toEqual({
      Icon: Footprints,
      text: '12 min walk',
    });
    const taxi = minutesLabel(resolveTransportMode('taxi'), 30);
    expect(taxi?.text).toBe('30 min away');
    expect(taxi?.Icon).toBe(CarTaxiFront);
  });

  it('returns null for a missing / non-finite value', () => {
    const meta = resolveTransportMode('metro');
    expect(minutesLabel(meta, null)).toBeNull();
    expect(minutesLabel(meta, undefined)).toBeNull();
    expect(minutesLabel(meta, NaN)).toBeNull();
  });
});

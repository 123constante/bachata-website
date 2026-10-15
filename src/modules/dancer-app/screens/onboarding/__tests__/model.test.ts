import { describe, expect, it } from 'vitest';
import { EXPERIENCE_BANDS, ROLE_CHOICES, startedYearForBand, stageAfterSave, stageFor } from '../model';

const strength = (missing: string[]) => ({ strength: { pct: 0, next_step: null, missing: missing as never } });

describe('experience bands: ONE mapping to dance_started_year', () => {
  const now = new Date('2026-10-15T12:00:00Z');
  it.each([
    ['new', 2026],
    ['one-two', 2025],
    ['three-five', 2022],
    ['six-plus', 2018],
  ] as const)('%s -> %i', (id, year) => expect(startedYearForBand(id, now)).toBe(year));

  it('every band lands inside the server range (1950..this year)', () => {
    for (const b of EXPERIENCE_BANDS) {
      const y = startedYearForBand(b.id, now);
      expect(y).toBeGreaterThanOrEqual(1950);
      expect(y).toBeLessThanOrEqual(2026);
    }
  });
});

describe('stages', () => {
  it('Both is the database value Lead and Follow', () => {
    expect(ROLE_CHOICES.map((c) => [c.label, c.value])).toEqual([['Leader', 'Leader'], ['Follower', 'Follower'], ['Both', 'Lead and Follow']]);
  });
  it('starts at the first missing required step; nothing to ask = done', () => {
    expect(stageFor(strength(['first_name', 'city', 'role', 'photo']))).toBe('name');
    expect(stageFor(strength(['role', 'photo']))).toBe('role');
    expect(stageFor(strength(['started_year', 'styles', 'bio_social']))).toBe('in');
    expect(stageFor(strength(['bio_social']))).toBe('done');
  });
  it('after a save, a missing required step always wins over the card you were on', () => {
    expect(stageAfterSave(strength(['photo']), 'role')).toBe('photo');
    expect(stageAfterSave(strength(['started_year', 'styles']), 'role')).toBe('in');
    expect(stageAfterSave(strength(['styles']), 'years')).toBe('styles');
    expect(stageAfterSave(strength([]), 'styles')).toBe('nice');
  });
});

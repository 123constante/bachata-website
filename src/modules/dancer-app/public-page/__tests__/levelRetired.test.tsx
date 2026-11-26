import { afterEach, describe, expect, it, vi } from 'vitest';
import { mapDancerPublicProfile } from '@/modules/profile/dancerPublicProfile';
import { NO_EXTRAS, buildPublicDancerPage } from '../model';
import { SHAPES } from './shapes';

// Dancer level retired (owner 2026-11-24). The LIVE /dancers/:slug page is this V2 page; slice A1
// gated only DancerProfileGrid, so prod kept showing "Level: Intermediate" (2026-11-26).
const f = vi.hoisted(() => ({ on: true }));
vi.mock('@/lib/levelRetiredFlag', () => ({
  get LEVEL_RETIRED_ENABLED() {
    return f.on;
  },
}));

const build = () => buildPublicDancerPage(mapDancerPublicProfile(SHAPES['complete + all extras'] as never), NO_EXTRAS, []);

describe('public dancer page V2: level retired', () => {
  afterEach(() => {
    f.on = true;
  });

  it('flag ON: no Level fact, Dancing and Style stay', () => {
    const { facts } = build();
    expect(facts.level).toBeNull();
    expect(facts.dancing).toMatch(/years?$/);
    expect(facts.style).toBe('Sensual, Dominican');
  });

  it('flag OFF: today's Level fact unchanged', () => {
    f.on = false;
    expect(build().facts.level).not.toBeNull();
  });
});

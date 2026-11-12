import { describe, expect, it } from 'vitest';
import { CLAIM_COPY, claimView, homeMain, homeShapeOf, previewLine, type HomeProfile } from '../homeModel';
import { CLAIM_STATUSES } from '@/lib/claimMyDancerProfile';
import type { StrengthStep } from '../../../api/types';

const ALL: StrengthStep[] = ['first_name', 'city', 'role', 'photo', 'started_year', 'styles', 'bio_social'];
const profile = (missing: StrengthStep[]): HomeProfile => ({
  strength: { pct: 0, missing, next_step: missing[0] ?? null },
  bio: null,
  instagram: null,
  facebook: null,
  website_url: null,
});

describe('Home main card: shape x data', () => {
  it('D1 stub: one headline, one button, plain numbers line, no kicker, no progress count', () => {
    const m = homeMain(profile(ALL), null);
    expect(homeShapeOf(profile(ALL))).toBe('stub');
    expect(m).toMatchObject({ shape: 'stub', title: 'Finish your profile', button: { label: 'Add your first name' } });
    expect(JSON.stringify(m)).not.toMatch(/step 1|of 4|%/i);
  });
  it('D2 unfinished: the 4 steps once, done ticked, one next', () => {
    const m = homeMain(profile(['role', 'photo', 'styles']), 3);
    expect(m.shape).toBe('unfinished');
    if (m.shape !== 'unfinished') return;
    expect(m.rows.map((r) => r.done)).toEqual([true, true, false, false]);
    expect(m.rows.filter((r) => r.next).map((r) => r.step)).toEqual(['role']);
    expect(m.button.label).toBe('Choose how you dance');
  });
  it.each([
    [0, null],
    [null, null],
    [12, 12],
  ])('D3 complete with nights=%s -> attended %s; empty is an action, never a 0', (nights, shown) => {
    const m = homeMain(profile(['styles']), nights);
    expect(m.shape).toBe('complete');
    if (m.shape !== 'complete') return;
    expect(m.attended).toBe(shown);
    expect(m.empty === null).toBe(shown !== null);
    expect(JSON.stringify(m)).not.toMatch(/"attended":0/);
  });
});

describe('Preview line', () => {
  it('uses placeholders for the gaps', () => {
    expect(previewLine({ first_name: null, avatar_url: null })).toBe('Your name here \u00B7 No photo');
    expect(previewLine({ first_name: 'Ana', avatar_url: 'x' })).toBe('Ana \u00B7 Photo added');
  });
});

describe('Claim statuses (D4)', () => {
  it.each([...CLAIM_STATUSES, 'unavailable' as const])('%s has copy and never "In beta"', (s) => {
    const c = CLAIM_COPY[claimView(s)];
    expect(c.title.length).toBeGreaterThan(0);
    expect(JSON.stringify(c)).not.toMatch(/in beta|day after/i);
  });
  it('maps the four drawn states', () => {
    expect(claimView('linked')).toBe('linked');
    expect(claimView('no_match')).toBe('no_match');
    expect(claimView('ambiguous')).toBe('ambiguous');
    expect(claimView('email_unproven')).toBe('email_unproven');
  });
});

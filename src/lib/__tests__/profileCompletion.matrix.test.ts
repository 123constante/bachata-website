/**
 * One fact, three surfaces. "Is this person's dancer profile finished?" is read
 * by the Finish-your-profile screen, the reminder banner and the party-rating
 * gate. All three must read it through the SAME helpers in
 * lib/profileCompletion, so this matrix crosses every shape the prod survey
 * found (2026-10-10: 25 accounts -- 4 complete, 11 with no profile row, the rest
 * missing one or more of first name / city / dance role / photo) with every
 * surface, and asserts the surfaces agree.
 */
import { describe, expect, it, vi } from 'vitest';
// dancerEditorPayloads (drift check below) reaches the generated client; nothing here calls it.
vi.mock('@/integrations/supabase/client', () => ({ supabase: {} }));
import { DANCE_ROLE_OPTIONS, isDanceRoleValue } from '@/lib/auth-otp-routing';
import { PARTNER_ROLE_OPTIONS } from '@/components/profile/dancerConstants';
import { dancerRoleFromStored } from '@/lib/dancerEditorPayloads';
import {
  PROFILE_FIELDS,
  RATE_BLOCKED_REASON,
  bannerModel,
  finishProfileHref,
  finishScreenMode,
  missingProfileFields,
  needsFinishing,
  postLoginDecision,
  ratingGate,
  type ProfileCompletion,
  type ProfileField,
} from '../profileCompletion';

const incomplete = (missing: ProfileField[]): ProfileCompletion => ({
  status: 'incomplete',
  missing,
  profileId: 'persona-1',
});

const SHAPES: { name: string; c: ProfileCompletion }[] = [
  { name: 'complete', c: { status: 'complete', missing: [], profileId: 'persona-1' } },
  { name: 'missing first name', c: incomplete(['first_name']) },
  { name: 'missing city', c: incomplete(['based_city_id']) },
  { name: 'missing dance role', c: incomplete(['dance_role']) },
  { name: 'missing photo', c: incomplete(['avatar_url']) },
  { name: 'missing role + photo (the commonest prod shape)', c: incomplete(['dance_role', 'avatar_url']) },
  { name: 'all missing', c: incomplete([...PROFILE_FIELDS]) },
  { name: 'no profile row', c: { status: 'no_profile', missing: [...PROFILE_FIELDS], profileId: null } },
];

const NOT_KNOWN: { name: string; c: ProfileCompletion }[] = [
  { name: 'signed out', c: { status: 'signed_out', missing: [], profileId: null } },
  { name: 'still loading', c: { status: 'loading', missing: [], profileId: null } },
  { name: 'check failed', c: { status: 'error', missing: [], profileId: null } },
];

const LABEL: Record<ProfileField, RegExp> = {
  first_name: /first name/i,
  based_city_id: /city/i,
  dance_role: /dance role/i,
  avatar_url: /photo/i,
};

describe('missingProfileFields mirrors profile_complete_v1 (trimmed, non-empty)', () => {
  it.each([
    ['full row', { first_name: 'Ana', based_city_id: 'c1', dance_role: 'Leader', avatar_url: 'https://x/a.jpg' }, []],
    ['whitespace name counts as missing', { first_name: '   ', based_city_id: 'c1', dance_role: 'Leader', avatar_url: 'u' }, ['first_name']],
    ['empty-string photo counts as missing', { first_name: 'Ana', based_city_id: 'c1', dance_role: 'Leader', avatar_url: '' }, ['avatar_url']],
    ['null role', { first_name: 'Ana', based_city_id: 'c1', dance_role: null, avatar_url: 'u' }, ['dance_role']],
    ['stub row (sign-up trigger)', { first_name: null, based_city_id: null, dance_role: null, avatar_url: null }, [...PROFILE_FIELDS]],
    ['no row at all', null, [...PROFILE_FIELDS]],
  ] as const)('%s', (_n, row, expected) => {
    expect(missingProfileFields(row)).toEqual(expected);
  });
});

describe.each(SHAPES)('$name: every surface reads the same fact', ({ c }) => {
  const unfinished = needsFinishing(c);

  it('banner shows exactly when the profile is unfinished', () => {
    expect(bannerModel(c, { dismissed: false, pathname: '/parties' }) !== null).toBe(unfinished);
  });

  it('rating is blocked exactly when the profile is unfinished, and never silently', () => {
    const gate = ratingGate(c);
    expect(gate.allowed).toBe(!unfinished);
    if (!gate.allowed) {
      expect(gate.reason.length).toBeGreaterThan(0);
      expect(gate.linkLabel.length).toBeGreaterThan(0);
    }
  });

  it('the screen collects exactly the missing fields (or explains why it cannot)', () => {
    const mode = finishScreenMode(c);
    expect(mode.kind === 'done').toBe(!unfinished);
    if (c.status === 'incomplete') expect(mode).toEqual({ kind: 'form', fields: c.missing });
    if (c.status === 'no_profile') expect(mode.kind).toBe('no_profile');
  });

  if (c.status === 'incomplete') {
    it('banner names every missing field and links to the screen', () => {
      const model = bannerModel(c, { dismissed: false, pathname: '/parties' })!;
      for (const f of c.missing) expect(model.body).toMatch(LABEL[f]);
      expect(model.cta).toEqual({ kind: 'link', label: 'Finish profile', href: finishProfileHref('/parties') });
    });
    it(`rating reason is "${RATE_BLOCKED_REASON}" with a link to the screen`, () => {
      const gate = ratingGate(c, '/event/e1#level-rating');
      expect(gate).toMatchObject({ allowed: false, reason: RATE_BLOCKED_REASON, href: finishProfileHref('/event/e1#level-rating') });
    });
  }

  if (c.status === 'no_profile') {
    it('nothing points at a form the person cannot fill: banner and gate both offer the WhatsApp contact', () => {
      const model = bannerModel(c, { dismissed: false, pathname: '/parties' })!;
      expect(model.cta.kind).toBe('external');
      const gate = ratingGate(c);
      expect(gate.allowed).toBe(false);
      if (!gate.allowed) expect(gate.external).toBe(true);
    });
  }

  it('dismissing hides the banner for this page view only and never changes the gate', () => {
    expect(bannerModel(c, { dismissed: true, pathname: '/parties' })).toBeNull();
    expect(ratingGate(c).allowed).toBe(!unfinished);
  });

  it('the banner never sits on top of the screen it links to, or on sign-in', () => {
    for (const pathname of ['/finish-profile', '/auth', '/auth/callback']) {
      expect(bannerModel(c, { dismissed: false, pathname })).toBeNull();
    }
  });
});

describe.each(NOT_KNOWN)('$name: no surface claims anything', ({ c }) => {
  it('no banner, rating not blocked by this gate, screen not a form', () => {
    expect(needsFinishing(c)).toBe(false);
    expect(bannerModel(c, { dismissed: false, pathname: '/parties' })).toBeNull();
    expect(ratingGate(c).allowed).toBe(true);
    expect(finishScreenMode(c).kind).not.toBe('form');
  });
});

describe('post-login prompt: shown once, right after sign-in, unless skipped', () => {
  const base = { pending: true, skipped: false, pathname: '/' };
  it.each([
    ['incomplete, just signed in', { ...base, status: 'incomplete' as const }, 'redirect'],
    ['no profile row, just signed in', { ...base, status: 'no_profile' as const }, 'redirect'],
    ['complete, just signed in', { ...base, status: 'complete' as const }, 'clear'],
    ['skipped this session', { ...base, skipped: true, status: 'incomplete' as const }, 'clear'],
    ['still loading', { ...base, status: 'loading' as const }, 'wait'],
    ['check failed', { ...base, status: 'error' as const }, 'clear'],
    ['still on the callback page', { ...base, pathname: '/auth/callback', status: 'incomplete' as const }, 'wait'],
    ['already on the screen', { ...base, pathname: '/finish-profile', status: 'incomplete' as const }, 'clear'],
    ['not just signed in', { ...base, pending: false, status: 'incomplete' as const }, 'none'],
  ])('%s -> %s', (_n, input, expected) => {
    expect(postLoginDecision(input)).toBe(expected);
  });
});

// DANCE_ROLE_OPTIONS is spelled out (auth-otp-routing must stay import-free for
// the /auth/callback chunk budget), so lock it to the two existing vocabularies.
describe('dance-role vocabulary cannot drift', () => {
  it('labels are the badge words, values the stored spellings the editor reads back', () => {
    expect(DANCE_ROLE_OPTIONS.map((o) => o.label)).toEqual([...PARTNER_ROLE_OPTIONS]);
    for (const o of DANCE_ROLE_OPTIONS) expect(dancerRoleFromStored(o.value)).toBe(o.label);
    expect(DANCE_ROLE_OPTIONS.map((o) => o.value)).toEqual(['Leader', 'Follower', 'Lead and Follow']);
    expect(isDanceRoleValue('Both')).toBe(false);
  });
});

describe('finishProfileHref', () => {
  it('carries a safe returnTo and drops an unsafe one', () => {
    expect(finishProfileHref('/event/e1?occ=2#level-rating')).toBe(
      `/finish-profile?returnTo=${encodeURIComponent('/event/e1?occ=2#level-rating')}`,
    );
    expect(finishProfileHref('https://evil.example')).toBe('/finish-profile');
    expect(finishProfileHref()).toBe('/finish-profile');
  });
});

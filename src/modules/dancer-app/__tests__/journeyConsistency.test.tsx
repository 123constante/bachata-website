// @vitest-environment jsdom
/**
 * Definition of done, step 2, for the dancer journey inside /app: every screen x
 * every prod data shape, through the real routes and gate (renderInShell + the
 * in-memory backend, as the slice-B audit tests do). Each cell asserts:
 *
 *   a. no text points at a control that is not on screen;
 *   b. every empty / not-found state offers something to do;
 *   c. every disabled control has a visible reason (and Options' Terms / Privacy are live links);
 *   d. avatars only through PersonAvatar, the no-photo disc never black / see-through.
 *
 * Shapes are the prod ones from the 2026-10-15 survey (api/fixtures DANCER_SHAPES)
 * crossed with the going shapes (get_my_going_v1: 0 nights, past-only, upcoming + past,
 * a cancelled night, an event not live). Going P2: the going switch is ON here (every
 * going word is on screen); the off state is covered in screens/nights and screens/home.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { ReactNode } from 'react';
import { cleanup, screen, waitFor } from '@testing-library/react';

vi.mock('@/lib/goingCheckin', () => ({ GOING_CHECKIN_ENABLED: true }));
vi.mock('@/hooks/useAuth', async (importOriginal) =>
  (await import('@/modules/dancer-app/shell/testAuth')).authModuleMock(importOriginal));

const h = vi.hoisted(() => {
  const s = {
    reply: { upcoming: [], past: [] } as MyGoingReply,
    rpc: async (fn: string, args?: Record<string, unknown>): Promise<unknown> => {
      if (fn === 'get_my_going_v1') return { data: s.reply, error: null };
      if (fn === 'series_level_summary_p5_v1') {
        return { data: { series_id: String(args?.p_series_id), vote_count: 0, threshold: 7, counts: null, derived_level: null, my_level: null }, error: null };
      }
      return { data: [], error: null };
    },
    from: () => ({ select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: { slug: 'london-gb' }, error: null }) }) }) }),
  };
  return s;
});
vi.mock('@/integrations/supabase/getSupabase', () => ({ getSupabase: async () => ({ rpc: h.rpc, from: h.from }) }));
vi.mock('@/integrations/supabase/client', () => ({
  supabase: { rpc: (f: string, a?: Record<string, unknown>) => h.rpc(f, a), from: () => h.from() },
}));
vi.mock('@/contexts/CityContext', () => ({
  CityProvider: ({ children }: { children: ReactNode }) => children,
  useCity: () => ({ citySlug: 'london-gb', setCitySlug: () => {} }),
}));
vi.mock('@/hooks/useCalendarEventsRpc', () => ({ useCalendarEvents: () => ({ data: [], isLoading: false, isError: false }) }));

import { renderInShell, resetShell } from '@/modules/dancer-app/shell/renderInShell';
import { DANCER_SHAPES } from '@/modules/dancer-app/api/fixtures';
import type { MyDancerEdit } from '@/modules/dancer-app/api/types';
import { cancelled, night as goingNight, notLive, type MyGoingReply } from '@/modules/dancer-app/screens/nights/__tests__/goingShapes';
import { avatars, disabled, emptyStates, pointers } from './journeyChecks';
import { organiserHomeKey } from '@/modules/dancer-app/screens/options/NoProfileWayOut';

const night = (id: string, n: number) => goingNight(id, `Night ${id}`, n);
const NONE: MyGoingReply = { upcoming: [], past: [] };

type Shape = { label: string; profile: MyDancerEdit | null; reply: MyGoingReply };
const SHAPES: Shape[] = [
  { label: 'no profile', profile: null, reply: NONE },
  { label: 'empty profile (sign-up stub)', profile: DANCER_SHAPES.emptyStub.profile, reply: NONE },
  { label: 'complete, upcoming + past nights', profile: DANCER_SHAPES.fourFieldComplete.profile, reply: { upcoming: [night('u', 3)], past: [night('p', -2)] } },
  { label: 'complete, no nights', profile: DANCER_SHAPES.fourFieldComplete.profile, reply: NONE },
  { label: 'complete, past-only nights', profile: DANCER_SHAPES.fourFieldComplete.profile, reply: { upcoming: [], past: [night('p1', -2), night('p2', -9)] } },
  { label: 'complete, cancelled + event not live', profile: DANCER_SHAPES.fourFieldComplete.profile, reply: { upcoming: [cancelled('c', 'Night c', 3), notLive('n', 'Night n', 5)], past: [] } },
  { label: 'hidden profile', profile: DANCER_SHAPES.paused.profile, reply: { upcoming: [night('u', 3)], past: [] } },
  { label: 'no photo', profile: DANCER_SHAPES.noPhoto.profile, reply: { upcoming: [night('u', 3)], past: [] } },
];

const SCREENS = [
  ['welcome (onboarding)', '/app/welcome'],
  ['home', '/app/home'],
  ['nights', '/app/nights'],
  ['me', '/app/me'],
  ['edit', '/app/me/edit'],
  ['photo', '/app/me/photo'],
  ['my page', '/app/page'],
  ['options', '/app/options'],
] as const;

beforeEach(() => { h.reply = NONE; localStorage.clear(); sessionStorage.clear(); });
afterEach(() => { cleanup(); resetShell(); });

/** Lands, then waits until nothing on screen is still loading. */
const land = async (path: string, shape: Shape) => {
  h.reply = shape.reply;
  renderInShell({ path, backend: { profile: shape.profile } });
  const settled = () => {
    const text = document.body.textContent ?? '';
    expect(text).not.toMatch(/Loading/);
    expect(document.querySelector('[aria-busy="true"]')).toBeNull();
    expect(screen.queryByTestId('dancer-app-content') ?? screen.queryByTestId(/^today-/)).not.toBeNull();
  };
  await waitFor(settled);
  await new Promise((r) => setTimeout(r, 30));
  await waitFor(settled);
};

describe.each(SCREENS)('%s', (_name, path) => {
  it.each(SHAPES)('$label', async (shape) => {
    await land(path, shape);
    const root = document.body;
    const photos = shape.profile?.avatar_url ? [shape.profile.avatar_url] : [];
    expect(pointers(root), 'a: copy points at a control that is not on screen').toEqual([]);
    expect(emptyStates(root), 'b: an empty state offers nothing to do').toEqual([]);
    expect(disabled(root), 'c: a disabled control has no visible reason').toEqual([]);
    expect(avatars(root, photos), 'd: an avatar outside PersonAvatar').toEqual([]);
  });
});

describe('c: Terms and Privacy on Options are live, enabled links for every shape that shows them', () => {
  it.each(SHAPES.filter((s) => s.profile))('$label', async (shape) => {
    await land('/app/options', shape);
    for (const [id, href] of [['opt-terms', '/terms'], ['opt-privacy', '/privacy']] as const) {
      const row = screen.getByTestId(id);
      expect(row.tagName).toBe('A');
      expect(row.getAttribute('href')).toBe(href);
      expect(row.hasAttribute('disabled')).toBe(false);
      expect(row.getAttribute('aria-disabled')).not.toBe('true');
    }
  });
});

describe('d: the dancer avatar is drawn on the screens that show it, for every shape with a profile', () => {
  const AVATAR_SCREENS = [['home', '/app/home', 'me-photo'], ['me', '/app/me', 'me-photo'], ['edit', '/app/me/edit', 'me-photo']] as const;
  describe.each(AVATAR_SCREENS)('%s', (_n, path, testId) => {
    it.each(SHAPES.filter((s) => s.profile))('$label', async (shape) => {
      await land(path, shape);
      const face = screen.queryByTestId(testId) ?? screen.getByTestId(`${testId}-placeholder`);
      expect(face.getAttribute('data-face')).toBe(shape.profile?.avatar_url ? 'photo' : shape.profile?.first_name ? 'initial' : 'glyph');
    });
  });
});

/**
 * Walk bug 1 (PR #789): with no dancer profile, Options and Home were only "message us" -- no Sign out,
 * no Account settings, so the person was trapped. Every signed-in shape in DANCER_SHAPES, plus the
 * organiser with no dancer side, x Options and Home x each way out.
 *   - Options: Sign out + Account settings for every shape.
 *   - Home: with no profile, Home itself carries both (the full Home keeps them one tab away, on Options:
 *     the owner decision changes only the no-profile state).
 *   - "Go to my organiser area" only for an organiser with no dancer profile.
 */
describe('walk bug 1: a way out (Sign out, Account settings) for every shape', () => {
  type WayOutShape = { label: string; profile: MyDancerEdit | null; organisers: number };
  const WAY_OUT_SHAPES: WayOutShape[] = [
    ...Object.values(DANCER_SHAPES)
      .filter((s) => s.signedIn)
      .map((s) => ({ label: s.label, profile: s.profile, organisers: 0 })),
    { label: 'organiser, no dancer profile', profile: null, organisers: 1 },
    { label: 'organiser and dancer', profile: DANCER_SHAPES.organiserAlsoDancer.profile, organisers: 1 },
  ];
  const landAs = async (path: string, s: WayOutShape) => {
    renderInShell({ path, backend: { profile: s.profile }, organisers: s.organisers });
    await waitFor(() => {
      expect(document.body.textContent ?? '').not.toMatch(/Loading/);
      expect(screen.queryByTestId('dancer-app-content')).not.toBeNull();
    });
    // The no-profile way out may arrive a moment later (on-demand chunk).
    if (!s.profile) await screen.findByTestId('no-profile-way-out');
  };
  const settingsLink = () =>
    screen.getAllByRole('link', { name: 'Account settings' }).filter((a) => a.getAttribute('href') === '/account/settings?from=app');
  const organiserLink = () => screen.queryByRole('link', { name: 'Go to my organiser area' });

  it('the way out reads the organiser side through the same cache key as the gate', async () => {
    const { organiserHomeQueryKey } = await import('@/modules/organiser/shared/selfServeApi');
    expect(organiserHomeKey('u-1')).toEqual(organiserHomeQueryKey('u-1'));
  });

  describe.each([['options', '/app/options'], ['home', '/app/home']] as const)('%s', (name, path) => {
    it.each(WAY_OUT_SHAPES)('$label', async (s) => {
      await landAs(path, s);
      const root = document.body;
      expect(pointers(root), 'a: copy points at a control that is not on screen').toEqual([]);
      if (name === 'home' && s.profile) {
        // The full Home: Sign out and Account settings live on Options, one tab away.
        expect(screen.getAllByRole('link').some((a) => a.getAttribute('href') === '/app/options')).toBe(true);
        return;
      }
      expect(screen.getByRole('button', { name: 'Sign out' })).toBeTruthy();
      expect(settingsLink().length).toBeGreaterThan(0);
      if (!s.profile) {
        // The "message us" text and control stay (owner decision): the way out is added under them.
        expect(screen.getByTestId('message-us').getAttribute('href')).toMatch(/^https:\/\/wa\.me\//);
        expect(Boolean(organiserLink()), 'organiser link only for an organiser').toBe(s.organisers > 0);
        if (s.organisers > 0) expect(organiserLink()?.getAttribute('href')).toBe('/account/o');
        // The control works: it opens the same sign-out confirm the full Options uses.
        screen.getByRole('button', { name: 'Sign out' }).click();
        await screen.findByTestId('opt-signout-confirm');
      }
    });
  });
});

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
 * crossed with the attendance shapes (0 nights, past-only, upcoming + past).
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { ReactNode } from 'react';
import { cleanup, screen, waitFor } from '@testing-library/react';

vi.mock('@/hooks/useAuth', async (importOriginal) =>
  (await import('@/modules/dancer-app/shell/testAuth')).authModuleMock(importOriginal));

const h = vi.hoisted(() => {
  const s = {
    rows: [] as Record<string, unknown>[],
    rpc: async (fn: string, args?: Record<string, unknown>): Promise<unknown> => {
      if (fn === 'get_my_event_attendance_v2') return { data: s.rows, error: null };
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
import { addDaysToKey, londonTodayKey } from '@/lib/londonDate';
import { avatars, disabled, emptyStates, pointers } from './journeyChecks';

const today = londonTodayKey();
const night = (id: string, n: number, status = 'going') => ({
  event_id: id, status, updated_at: null, name: `Night ${id}`, occurrence_date: addDaysToKey(today, n), city_name: 'London', start_time: '21:00:00', type: 'party', is_active: true,
});

type Shape = { label: string; profile: MyDancerEdit | null; rows: Record<string, unknown>[] };
const SHAPES: Shape[] = [
  { label: 'no profile', profile: null, rows: [] },
  { label: 'empty profile (sign-up stub)', profile: DANCER_SHAPES.emptyStub.profile, rows: [] },
  { label: 'complete, upcoming + past nights', profile: DANCER_SHAPES.fourFieldComplete.profile, rows: [night('u', 3), night('p', -2)] },
  { label: 'complete, no nights', profile: DANCER_SHAPES.fourFieldComplete.profile, rows: [] },
  { label: 'complete, past-only nights', profile: DANCER_SHAPES.fourFieldComplete.profile, rows: [night('p1', -2), night('p2', -9, 'interested')] },
  { label: 'hidden profile', profile: DANCER_SHAPES.paused.profile, rows: [night('u', 3)] },
  { label: 'no photo', profile: DANCER_SHAPES.noPhoto.profile, rows: [night('u', 3)] },
];

const SCREENS = [
  ['welcome (onboarding)', '/app/welcome'],
  ['home', '/app/home'],
  ['nights', '/app/nights'],
  ['me', '/app/me'],
  ['edit', '/app/me/edit'],
  ['photo', '/app/me/photo'],
  ['options', '/app/options'],
] as const;

beforeEach(() => { h.rows = []; localStorage.clear(); sessionStorage.clear(); });
afterEach(() => { cleanup(); resetShell(); });

/** Lands, then waits until nothing on screen is still loading. */
const land = async (path: string, shape: Shape) => {
  h.rows = shape.rows;
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

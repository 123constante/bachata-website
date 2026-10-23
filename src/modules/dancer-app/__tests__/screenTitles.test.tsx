// @vitest-environment jsdom
/**
 * Fix pass on review slice B: S6 (one page-title style on every dancer screen), S8 (prototype section labels on
 * Nights and Me), N8 (Page and Photo pin their primary actions at the bottom; Page's checklist uses tick discs).
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { ReactNode } from 'react';
import { cleanup, screen, within } from '@testing-library/react';

vi.mock('@/hooks/useAuth', async (importOriginal) =>
  (await import('@/modules/dancer-app/shell/testAuth')).authModuleMock(importOriginal));

const h = vi.hoisted(() => ({ rows: [] as Record<string, unknown>[] }));
const rpc = async (fn: string, args?: Record<string, unknown>) => {
  if (fn === 'get_my_event_attendance_v2') return { data: h.rows, error: null };
  if (fn === 'series_level_summary_p5_v1') {
    return { data: { series_id: String(args?.p_series_id), vote_count: 0, threshold: 7, counts: null, derived_level: null, my_level: null }, error: null };
  }
  if (fn === 'my_nights_lineup_people_v1') return { data: { total: 0, people: [] }, error: null };
  return { data: null, error: { message: `unexpected rpc ${fn}` } };
};
vi.mock('@/integrations/supabase/getSupabase', () => ({ getSupabase: async () => ({ rpc }) }));
vi.mock('@/integrations/supabase/client', () => ({ supabase: { rpc: (f: string, a?: Record<string, unknown>) => rpc(f, a) } }));
vi.mock('@/contexts/CityContext', () => ({
  CityProvider: ({ children }: { children: ReactNode }) => children,
  useCity: () => ({ citySlug: 'london-gb', setCitySlug: () => {} }),
}));
vi.mock('@/components/account/profiles/useProfileSides', () => ({
  useProfileSides: () => ({ facts: {}, state: { status: 'ready', sides: [{ kind: 'dancer', key: 'dancer', firstName: 'Ana', avatarUrl: null, to: '/app/home' }] }, openRequestCount: 0 }),
}));

import { renderInShell, resetShell } from '../shell/renderInShell';
import { addDaysToKey, londonTodayKey } from '@/lib/londonDate';
import type { DancerShapeName } from '../api/fixtures';

const row = (id: string, n: number) => ({
  event_id: id, status: 'going', updated_at: null, name: `Night ${id}`, occurrence_date: addDaysToKey(londonTodayKey(), n), city_name: 'London', start_time: '21:00:00', type: 'party', is_active: true,
});

beforeEach(() => { h.rows = []; localStorage.clear(); sessionStorage.clear(); });
afterEach(() => { cleanup(); resetShell(); });

describe('S6: every dancer screen titles itself through ScreenTitle (28px/800)', () => {
  it.each([
    ['/app/me', 'Me', 'fourFieldComplete'],
    ['/app/me/edit', 'Edit my profile', 'fourFieldComplete'],
    ['/app/options', 'Options', 'fourFieldComplete'],
    ['/app/page', 'My page', 'fourFieldComplete'],
    ['/app/nights', 'Nights', 'fourFieldComplete'],
    ['/app/me/photo', 'Your photo', 'fourFieldComplete'],
    ['/app/welcome', null, 'nameCityOnly'],
  ] as Array<[string, string | null, DancerShapeName]>)('%s', async (path, name, shape) => {
    renderInShell({ path, backend: { shape } });
    const title = await screen.findByRole('heading', { level: 1, ...(name ? { name } : {}) });
    expect(title.hasAttribute('data-screen-title')).toBe(true);
    expect(title.className).toContain('text-[28px]');
    expect(screen.getAllByRole('heading', { level: 1 })).toHaveLength(1);
  });
});

describe('S8: section labels are sentence case 15px/700 (SectionTitle), not the organiser UPPERCASE label', () => {
  it('Nights: Upcoming and Past', async () => {
    h.rows = [row('a', 2), row('b', -6)];
    renderInShell({ path: '/app/nights' });
    for (const text of ['Upcoming', 'Past']) {
      const label = await screen.findByText(text);
      expect(label.hasAttribute('data-section-title'), text).toBe(true);
      expect(label.className).not.toContain('uppercase');
    }
  });
  it('Me: My profile', async () => {
    renderInShell({ path: '/app/me' });
    const label = await screen.findByText('My profile');
    expect(label.hasAttribute('data-section-title')).toBe(true);
  });
});

describe('N8: Page and Photo pin their primary actions at the bottom', () => {
  it('Page: View and Share sit in the sticky bar', async () => {
    renderInShell({ path: '/app/page' });
    const view = await screen.findByTestId('page-view');
    const bar = view.closest('[data-sticky-actions]') as HTMLElement;
    expect(bar).not.toBeNull();
    expect(within(bar).getByTestId('page-share')).toBeTruthy();
  });
  it('Photo: the pick buttons sit in the sticky bar', async () => {
    renderInShell({ path: '/app/me/photo' });
    const input = await screen.findByTestId('photo-input-camera');
    expect(input.closest('[data-sticky-actions]')).not.toBeNull();
    expect(screen.getByTestId('photo-input-library').closest('[data-sticky-actions]')).not.toBeNull();
  });
  it('Page checklist: a tick disc per line, filled when done and an empty ring when not', async () => {
    // fourFieldComplete: name, photo, role + city are on the page; no bio.
    renderInShell({ path: '/app/page' });
    const items = within(await screen.findByTestId('page-look')).getAllByRole('listitem');
    expect(items.map((li) => li.getAttribute('data-done'))).toEqual(['true', 'true', 'true', 'false']);
    expect(items.map((li) => li.querySelector('[data-testid="page-look-tick"]') !== null)).toEqual([true, true, true, true]);
    expect(items.map((li) => li.querySelector('[data-testid="page-look-tick"] svg') !== null)).toEqual([true, true, true, false]);
  });
});

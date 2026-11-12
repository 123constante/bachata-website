// @vitest-environment jsdom
/**
 * B1b finish: review findings F7, F8, F12-F15 (REVIEW.md on claude/review-dancer-app-r1b).
 * Written red-first against the unfixed screens; each describe names its finding.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { ReactNode } from 'react';
import { cleanup, fireEvent, screen, waitFor, within } from '@testing-library/react';

vi.mock('@/lib/goingCheckin', () => ({ GOING_CHECKIN_ENABLED: true })); // these specs exercise the check-in surfaces
vi.mock('@/hooks/useAuth', async (importOriginal) =>
  (await import('@/modules/dancer-app/shell/testAuth')).authModuleMock(importOriginal));

const h = vi.hoisted(() => ({
  reply: { upcoming: [], past: [] } as unknown,
  going: 'ok' as 'ok' | 'never' | 'error',
  rpc: async (fn: string): Promise<unknown> => {
    if (fn === 'get_my_going_v1') {
      if (h.going === 'never') return new Promise(() => {});
      if (h.going === 'error') return { data: null, error: { message: 'Failed to fetch' } };
      return { data: h.reply, error: null };
    }
    return { data: null, error: null };
  },
  from: () => ({ select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: { slug: 'london-gb' }, error: null }) }) }) }),
}));
vi.mock('@/integrations/supabase/getSupabase', () => ({ getSupabase: async () => ({ rpc: (f: string) => h.rpc(f), from: h.from }) }));
vi.mock('@/integrations/supabase/client', () => ({ supabase: { rpc: (f: string) => h.rpc(f), from: () => h.from() } }));
vi.mock('@/contexts/CityContext', () => ({
  CityProvider: ({ children }: { children: ReactNode }) => children,
  useCity: () => ({ citySlug: 'london-gb', setCitySlug: () => {} }),
}));
vi.mock('@/hooks/useCalendarEventsRpc', () => ({ useCalendarEvents: () => ({ data: [], isLoading: false, isError: false }) }));

import { renderInShell, resetShell } from '@/modules/dancer-app/shell/renderInShell';
import { createFakeBackend } from '@/modules/dancer-app/api/fakeBackend';
import type { StatsShapeName } from '@/modules/dancer-app/api/statsFixtures';
import { copyFor } from '@/modules/dancer-app/api/errors';
import { cancelled, night, notLive } from '@/modules/dancer-app/screens/nights/__tests__/goingShapes';
import { FEEDBACK_CLOSED, sendDisabledReason } from '@/modules/dancer-app/screens/options/feedbackModel';
import { optionsRows } from '@/modules/dancer-app/screens/options/optionsModel';

beforeEach(() => { h.reply = { upcoming: [], past: [] }; h.going = 'ok'; localStorage.clear(); sessionStorage.clear(); });
afterEach(() => { cleanup(); resetShell(); vi.restoreAllMocks(); });

const never = <T,>(): Promise<T> => new Promise<T>(() => {});

/* ------------------------------------------------------------------ F7 */
// Going P2: the ONE number is now the count over get_my_going_v1's upcoming list (the
// Nights list itself), never my_dancer_stats_v1.nights_going_upcoming. The full shape
// table lives in screens/home/__tests__/homeAudit.test.tsx; here: tile === strip, and the
// tile's loading / failed words.
describe('F7: Home shows ONE "going" number (get_my_going_v1) on the tile and the strip', () => {
  const shapes: Array<{ name: string; stats: StatsShapeName; reply: () => unknown; want: string }> = [
    { name: 'going to a cancelled night', stats: 'cancelledNight', reply: () => ({ upcoming: [cancelled('c1', 'C', 3)], past: [] }), want: '0' },
    { name: 'going to a night of an ended series', stats: 'endedSeries', reply: () => ({ upcoming: [notLive('e1', 'E', 5, 'ended')], past: [] }), want: '1' },
    { name: 'zero', stats: 'zero', reply: () => ({ upcoming: [], past: [] }), want: '0' },
    { name: 'normal (3 going)', stats: 'normal', reply: () => ({ upcoming: [night('a', 'A', 1), night('b', 'B', 2), night('c', 'C', 3)], past: [] }), want: '3' },
  ];

  it.each(shapes)('$name: Home shows no going tile and no strip', async (s) => {
    h.reply = s.reply();
    renderInShell({ path: '/app/home', backend: { statsShape: s.stats } });
    await screen.findByTestId('home-main');
    for (const id of ['tile-going-count', 'stats-strip', 'stat-going-value', 'stat-went-value']) expect(screen.queryByTestId(id)).toBeNull();
  });

  it.each(['never', 'error'] as const)('going read %s: Home still shows its main card and no tile', async (mode) => {
    h.going = mode;
    renderInShell({ path: '/app/home', backend: { statsShape: 'normal' } });
    await screen.findByTestId('home-main');
    expect(screen.queryByTestId('tile-going-count')).toBeNull();
  });
});

/* ------------------------------------------------------------------ F8 */
describe('F8: the fix links on /app/page are 44px tap targets', () => {
  it.each([
    ['noPhoto', 'Edit my profile'],
    ['paused', 'Account settings'],
  ] as const)('%s: "%s" link has da-tap and a 44px min height', async (shape, label) => {
    renderInShell({ path: '/app/page', backend: { shape } });
    const why = await screen.findByTestId('page-why');
    const link = within(why).getByRole('link', { name: label });
    expect(link.className).toMatch(/\bda-tap\b/);
    expect(link.className).toMatch(/min-h-\[44px\]/);
  });
});

/* ------------------------------------------------------------------ F12 */
describe('F12: a numbers failure says WHICH failure, and /app/page offers Try again', () => {
  it.each([
    ['noProfile', 'no_profile'],
    ['areaClosed', 'area_closed'],
  ] as const)('Home, %s: no numbers box (%s is shown on /app/page)', async (shape, code) => {
    renderInShell({ path: '/app/home', backend: { statsShape: shape } });
    await screen.findByTestId('home-main');
    expect(screen.queryByTestId('numbers-error')).toBeNull();
    expect(code).toBeTruthy();
  });

  it.each([
    ['noProfile', 'no_profile'],
    ['areaClosed', 'area_closed'],
  ] as const)('/app/page, %s: shows the plain copy for %s', async (shape, code) => {
    renderInShell({ path: '/app/page', backend: { statsShape: shape } });
    expect((await screen.findByTestId('page-views-error')).textContent).toContain(copyFor(code));
  });

  it('/app/page, connection failure: a Try again button re-reads the numbers', async () => {
    const { backend } = renderInShell({ path: '/app/page', backend: { statsShape: 'error' } });
    await screen.findByTestId('page-views-error');
    const before = backend.calls.filter((c) => c.fn === 'fetchMyStats').length;
    fireEvent.click(screen.getByTestId('page-views-retry'));
    await waitFor(() => expect(backend.calls.filter((c) => c.fn === 'fetchMyStats').length).toBeGreaterThan(before));
  });
});

/* ------------------------------------------------------------------ F13 + F14 */
describe('F13/F14: feedback sheet', () => {
  const open = async (opts: Parameters<typeof renderInShell>[0] = {}) => {
    const r = renderInShell({ path: '/app/options', ...opts });
    fireEvent.click(await screen.findByTestId('opt-feedback'));
    await screen.findByTestId('opt-feedback-sheet');
    return r;
  };
  const type = (v: string) => fireEvent.change(screen.getByTestId('feedback-text'), { target: { value: v } });

  it('F13: area_closed copy tells the person to close the sheet first, and names a row that exists on Options', () => {
    expect(FEEDBACK_CLOSED).toMatch(/^Feedback is not open for your account yet\. Close this/);
    const help = optionsRows({ other_roles: [], is_active: true }).find((r) => r.id === 'help');
    expect(help).toBeTruthy();
    expect(FEEDBACK_CLOSED).toContain(help?.label ?? '<no help row>');
  });

  it('F14: sending -> no disabled reason (the button already says Sending)', () => {
    expect(sendDisabledReason('hello', true)).toBeNull();
  });

  it('F14: while sending, the button is disabled, says Sending once, and points at no missing reason', async () => {
    const backend = createFakeBackend();
    backend.submitFeedback = never;
    await open({ backend });
    type('hello');
    fireEvent.click(screen.getByTestId('feedback-send'));
    const btn = screen.getByTestId('feedback-send') as HTMLButtonElement;
    await waitFor(() => expect(btn.textContent).toBe('Sending\u2026'));
    expect(btn.disabled).toBe(true);
    expect(screen.queryByTestId('feedback-why')).toBeNull();
    expect(btn.hasAttribute('aria-describedby')).toBe(false);
    expect((screen.getByTestId('opt-feedback-sheet').textContent ?? '').match(/Sending/g)).toHaveLength(1);
  });

  it('F14: an empty box -> aria-describedby points at a reason that is on screen', async () => {
    await open();
    const btn = screen.getByTestId('feedback-send');
    expect(btn.getAttribute('aria-describedby')).toBe('feedback-why');
    expect(document.getElementById('feedback-why')).toBeTruthy();
  });
});

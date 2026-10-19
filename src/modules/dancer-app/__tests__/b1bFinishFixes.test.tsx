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
  rows: [] as Record<string, unknown>[],
  rpc: async (fn: string): Promise<unknown> => {
    if (fn === 'get_my_event_attendance_v2') return { data: h.rows, error: null };
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
import { STATS_SHAPES, type StatsShapeName } from '@/modules/dancer-app/api/statsFixtures';
import { fmt } from '@/modules/dancer-app/api/numbersModel';
import { copyFor } from '@/modules/dancer-app/api/errors';
import { addDaysToKey, londonTodayKey } from '@/lib/londonDate';
import { FEEDBACK_CLOSED, sendDisabledReason } from '@/modules/dancer-app/screens/options/feedbackModel';
import { optionsRows } from '@/modules/dancer-app/screens/options/optionsModel';

beforeEach(() => { h.rows = []; localStorage.clear(); sessionStorage.clear(); });
afterEach(() => { cleanup(); resetShell(); vi.restoreAllMocks(); });

const today = londonTodayKey();
const row = (id: string, n: number, status = 'going', over: Record<string, unknown> = {}) => ({
  event_id: id, status, updated_at: null, name: `Night ${id}`, occurrence_date: addDaysToKey(today, n), city_name: 'London', start_time: '21:00:00', type: 'party', is_active: true, ...over,
});
const never = <T,>(): Promise<T> => new Promise<T>(() => {});

/* ------------------------------------------------------------------ F7 */
describe('F7: Home shows ONE "going" number (my_dancer_stats_v1) on the tile and the strip', () => {
  const shapes: Array<{ name: string; stats: StatsShapeName; rows: () => Record<string, unknown>[] }> = [
    // The attendance list still says Going (it has no cancelled check); the stats do not count it.
    { name: 'going to a cancelled night', stats: 'cancelledNight', rows: () => [row('c1', 3)] },
    // The series is no longer listed (is_active false) but its night is still scheduled.
    { name: 'going to a night of an ended series', stats: 'endedSeries', rows: () => [row('e1', 5, 'going', { is_active: false })] },
    { name: 'zero', stats: 'zero', rows: () => [] },
    { name: 'normal (3 going + 2 interested in the list)', stats: 'normal', rows: () => [row('a', 1), row('b', 2), row('c', 3), row('d', 4, 'interested'), row('e', 5, 'interested')] },
    // The list stops at its 100-row API cap; the stats count all 1500.
    { name: 'huge (999+)', stats: 'over999', rows: () => Array.from({ length: 100 }, (_, i) => row(`h${i}`, i + 1)) },
  ];

  it.each(shapes)('$name: tile === strip', async (s) => {
    h.rows = s.rows();
    renderInShell({ path: '/app/home', backend: { statsShape: s.stats } });
    const fixture = STATS_SHAPES[s.stats];
    if ('error' in fixture) throw new Error('not a payload shape');
    const want = fmt(fixture.stats.nights_going_upcoming);
    await screen.findByTestId('stats-strip');
    // Let the attendance list land too: the old tile counted that list.
    await waitFor(() => expect(screen.getByTestId('home-hero').textContent).not.toMatch(/Loading/));
    const tile = screen.getByTestId('tile-going-count').textContent;
    const stripCell = screen.queryByTestId('stat-going-value');
    if (stripCell) expect(tile).toBe(stripCell.textContent);
    else expect(screen.getByTestId('stats-strip-empty')).toBeTruthy();
    expect(tile).toBe(want);
  });

  it('while the numbers load, the tile says Loading, not a number', async () => {
    const backend = createFakeBackend({ statsShape: 'normal' });
    backend.fetchMyStats = never;
    h.rows = [row('a', 1)];
    renderInShell({ path: '/app/home', backend });
    await screen.findByTestId('numbers-loading');
    await waitFor(() => expect(screen.getByTestId('home-hero').textContent).toMatch(/Night a/));
    expect(screen.getByTestId('tile-going-count').textContent).toBe('Loading\u2026');
  });

  it('when the numbers fail, the tile says so in words, not a number from another source', async () => {
    h.rows = [row('a', 1), row('b', 2)];
    renderInShell({ path: '/app/home', backend: { statsShape: 'error' } });
    await screen.findByTestId('numbers-error');
    await waitFor(() => expect(screen.getByTestId('home-hero').textContent).toMatch(/Night a/));
    const tile = screen.getByTestId('tile-going-count').textContent ?? '';
    expect(tile).not.toMatch(/\d/);
    expect(tile).toBe('Could not load');
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
    expect((link as HTMLElement).style.minHeight).toBe('44px');
  });
});

/* ------------------------------------------------------------------ F12 */
describe('F12: a numbers failure says WHICH failure, and /app/page offers Try again', () => {
  it.each([
    ['noProfile', 'no_profile'],
    ['areaClosed', 'area_closed'],
  ] as const)('Home, %s: the error box shows the plain copy for %s', async (shape, code) => {
    renderInShell({ path: '/app/home', backend: { statsShape: shape } });
    expect((await screen.findByTestId('numbers-error')).textContent).toContain(copyFor(code));
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

/* ------------------------------------------------------------------ F15 */
describe('F15: partner tile', () => {
  it('rate_limited says the real limit (once every 30 days), not "a few minutes"', async () => {
    const { backend } = renderInShell({ path: '/app/home' });
    const btn = (await screen.findByTestId('partner-notify')) as HTMLButtonElement;
    await waitFor(() => expect(btn.disabled).toBe(false));
    backend.failNextWith('rate_limited');
    fireEvent.click(btn);
    const err = (await screen.findByTestId('partner-error')).textContent ?? '';
    expect(err).toMatch(/once every 30 days/);
    expect(err).not.toMatch(/few minutes/);
  });

  it('invalid_feature does not ask the person to try again', async () => {
    const { backend } = renderInShell({ path: '/app/home' });
    const btn = (await screen.findByTestId('partner-notify')) as HTMLButtonElement;
    await waitFor(() => expect(btn.disabled).toBe(false));
    backend.failNextWith('invalid_feature');
    fireEvent.click(btn);
    const err = (await screen.findByTestId('partner-error')).textContent ?? '';
    expect(err).not.toMatch(/try again/i);
    expect(err).toMatch(/nothing you need to do/);
  });

  it('while its status loads, the button is disabled and says Loading', async () => {
    const backend = createFakeBackend();
    backend.fetchMyFeatureInterest = never;
    renderInShell({ path: '/app/home', backend });
    const btn = (await screen.findByTestId('partner-notify')) as HTMLButtonElement;
    expect(btn.disabled).toBe(true);
    expect(btn.textContent).toBe('Loading\u2026');
  });
});

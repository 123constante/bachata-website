// @vitest-environment jsdom
/**
 * /app/nights over get_my_going_v1 (Going P2), table-driven over every reply
 * shape (goingShapes.ts) x the going switch. Going only: no "Interested" word
 * anywhere. Upcoming vs past is the RPC's own split; a night's lifecycle
 * (cancelled / event not live) reads in the going module's words; the time is
 * starts_at_local as stored. Every empty state says what the person can do with
 * a control that exists (D130: the home link top left, never a Browse button).
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { ReactNode } from 'react';
import { cleanup, screen, within } from '@testing-library/react';

const h = vi.hoisted(() => ({
  on: true,
  reply: { upcoming: [], past: [] } as unknown,
  calls: [] as string[],
  fail: false,
  rpc: null as unknown as (fn: string, args?: Record<string, unknown>) => Promise<unknown>,
}));
vi.mock('@/lib/goingCheckin', () => ({ get GOING_CHECKIN_ENABLED() { return h.on; } }));
vi.mock('@/hooks/useAuth', async (importOriginal) =>
  (await import('@/modules/dancer-app/shell/testAuth')).authModuleMock(importOriginal));
h.rpc = async (fn: string, args?: Record<string, unknown>) => {
  h.calls.push(fn);
  if (fn === 'get_my_going_v1') return h.fail ? { data: null, error: { message: 'Failed to fetch' } } : { data: h.reply, error: null };
  if (fn === 'series_level_summary_p5_v1') {
    return { data: { series_id: String(args?.p_series_id), vote_count: 0, threshold: 7, counts: null, derived_level: null, my_level: null }, error: null };
  }
  return { data: null, error: { message: `unexpected rpc ${fn}` } };
};
vi.mock('@/integrations/supabase/getSupabase', () => ({ getSupabase: async () => ({ rpc: h.rpc }) }));
vi.mock('@/integrations/supabase/client', () => ({ supabase: { rpc: (f: string, a?: Record<string, unknown>) => h.rpc(f, a) } }));
vi.mock('@/contexts/CityContext', () => ({
  CityProvider: ({ children }: { children: ReactNode }) => children,
  useCity: () => ({ citySlug: 'london-gb', setCitySlug: () => {} }),
}));

import { renderInShell, resetShell } from '@/modules/dancer-app/shell/renderInShell';
import { GOING_COPY, nightLine } from '@/modules/going';
import { mapMyGoing, statusLabel, nightNote, goingUpcomingCount, nextNight, nudgeCandidates } from '../nightsModel';
import { GOING_SHAPES, cancelled, night, notLive, today, type MyGoingReply } from './goingShapes';

beforeEach(() => { h.on = true; h.reply = GOING_SHAPES.empty(); h.calls = []; h.fail = false; localStorage.clear(); sessionStorage.clear(); });
afterEach(() => { cleanup(); resetShell(); });

const open = () => renderInShell({ path: '/app/nights' });
const rows = (testId: string) => within(screen.getByTestId(testId)).queryAllByTestId('night-row');
const text = () => screen.getByTestId('dancer-screen-nights').textContent ?? '';

/** shape -> [upcoming rows, past rows, statuses in order]. */
const EXPECT: Record<string, { up: number; past: number; empty: boolean }> = {
  empty: { up: 0, past: 0, empty: true },
  upcomingOnly: { up: 2, past: 0, empty: false },
  pastOnly: { up: 0, past: 2, empty: false },
  // The cancelled PAST night is not listed: "Nights you went to" holds only nights that happened.
  cancelledNight: { up: 2, past: 0, empty: false },
  endedNight: { up: 0, past: 1, empty: false },
  eventNotLive: { up: 1, past: 1, empty: false },
  many: { up: 40, past: 100, empty: false },
};

describe('Nights x every get_my_going_v1 shape (switch on)', () => {
  it.each(Object.keys(GOING_SHAPES))('%s', async (shape) => {
    h.reply = GOING_SHAPES[shape]();
    open();
    const e = EXPECT[shape];
    if (e.empty) {
      const empty = await screen.findByTestId('nights-empty');
      expect(empty.textContent).toContain(GOING_COPY.myUpcomingEmpty);
      expect(empty.textContent).toContain(GOING_COPY.myUpcomingEmptyHow);
      expect(empty.textContent).toMatch(/Bachata Calendar link at the top left/);
      expect(within(empty).queryAllByRole('link')).toHaveLength(0);
    } else {
      await screen.findByTestId('nights-upcoming');
      expect(rows('nights-upcoming')).toHaveLength(e.up);
      expect(rows('nights-past')).toHaveLength(e.past);
      if (e.up === 0) {
        const up = screen.getByTestId('nights-upcoming-empty');
        expect(up.textContent).toContain(GOING_COPY.myUpcomingEmptyHow);
        expect(up.textContent).toMatch(/Bachata Calendar link at the top left/);
      }
      if (e.past === 0) expect(screen.getByTestId('nights-past-empty').textContent).toBe(GOING_COPY.myPastEmpty);
    }
    // Going only (owner decision 6), and never a Browse verb (D130).
    expect(text()).not.toMatch(/interested/i);
    expect(text()).not.toMatch(/Browse/i);
    expect(h.calls).toContain('get_my_going_v1');
    // No other attendance read (the retired family all carry "attendance" in the name).
    expect(h.calls.filter((c) => /attendance/.test(c))).toEqual([]);
  });

  it('tags and lifecycle words come from the going module', async () => {
    h.reply = {
      upcoming: [night('a', 'Alpha', 2), cancelled('x', 'Xray', 3), notLive('p', 'Papa', 4)],
      past: [night('c', 'Gamma', -3), cancelled('y', 'Yankee', -4), notLive('q', 'Quebec', -5, 'ended')],
    } satisfies MyGoingReply;
    open();
    await screen.findByTestId('nights-upcoming');
    const up = rows('nights-upcoming');
    expect(up.map((r) => r.getAttribute('data-status'))).toEqual(['live', 'cancelled', 'not_live']);
    expect(up[0].textContent).toMatch(new RegExp(`Alpha.*${GOING_COPY.tagGoing}`));
    expect(up[1].textContent).toContain(GOING_COPY.tagCancelled);
    expect(up[1].textContent).toContain(GOING_COPY.cancelled);
    expect(up[2].textContent).toContain(GOING_COPY.tagGoing);
    expect(up[2].textContent).toContain(GOING_COPY.notLive);
    // "Nights you went to": the cancelled past night (Yankee) is not there -- nobody went to it.
    const past = rows('nights-past');
    expect(past.map((r) => r.getAttribute('data-status'))).toEqual(['ended', 'ended']);
    expect(past[0].textContent).toContain(GOING_COPY.tagWent);
    expect(screen.getByTestId('nights-past').textContent).not.toContain('Yankee');
    // A past night of an event that has since ended still "Went" (no not-live line on a record).
    expect(past[1].textContent).toContain(GOING_COPY.tagWent);
    expect(past[1].textContent).not.toContain(GOING_COPY.notLive);
  });

  it('starts_at_local renders AS STORED through nightLine (a late-night stamp keeps its own date and hour)', async () => {
    h.reply = { upcoming: [night('l', 'Late', 3, { starts_at_local: '2099-01-02T23:30:00', occurrence_date: '2099-01-02' })], past: [] };
    open();
    await screen.findByTestId('nights-upcoming');
    expect(rows('nights-upcoming')[0].textContent).toContain(nightLine('2099-01-02T23:30:00')!);
    expect(nightLine('2099-01-02T23:30:00')).toBe('Friday 2 Jan \u00b7 11:30 PM');
  });

  it('a night with no public event has no link', async () => {
    h.reply = { upcoming: [night('n', 'Nolink', 3, { public_event_id: null })], past: [] };
    open();
    await screen.findByTestId('nights-upcoming');
    expect(within(rows('nights-upcoming')[0]).queryAllByRole('link')).toHaveLength(0);
  });

  it('a failed read says so and offers Try again', async () => {
    h.fail = true;
    open();
    const alert = await screen.findByRole('alert');
    expect(within(alert).getByRole('button', { name: 'Try again' })).toBeTruthy();
  });
});

describe('switch off: nothing about going renders and no going RPC runs', () => {
  it('empty state without the going line; get_my_going_v1 is never called', async () => {
    h.on = false;
    h.reply = GOING_SHAPES.many();
    open();
    const empty = await screen.findByTestId('nights-empty');
    expect(empty.textContent).not.toContain(GOING_COPY.myUpcomingEmptyHow);
    expect(empty.textContent).toMatch(/Bachata Calendar link at the top left/);
    expect(screen.queryByTestId('nights-upcoming')).toBeNull();
    expect(h.calls).not.toContain('get_my_going_v1');
  });
});

describe('the one mapping (nightsModel) x shapes', () => {
  it.each(Object.keys(GOING_SHAPES))('%s: count, hero and nudge', (shape) => {
    const m = mapMyGoing(GOING_SHAPES[shape]() as never);
    const live = m.upcoming.filter((n) => n.status === 'live');
    expect(goingUpcomingCount(m.upcoming)).toBe(m.upcoming.filter((n) => n.status !== 'cancelled').length);
    expect(nextNight(m.upcoming)).toBe(live[0] ?? null);
    for (const n of nudgeCandidates(m.past, today())) {
      expect(n.status).toBe('ended');
      expect(n.listed).toBe(true);
    }
    for (const n of [...m.upcoming, ...m.past]) {
      expect([GOING_COPY.tagGoing, GOING_COPY.tagWent, GOING_COPY.tagCancelled]).toContain(statusLabel(n));
      if (n.status === 'cancelled') expect(nightNote(n)).toBe(GOING_COPY.cancelled);
    }
  });

  it.each(Object.keys(GOING_SHAPES))('%s: the past list never holds a cancelled night (so no vote, no nudge on one)', (shape) => {
    const m = mapMyGoing(GOING_SHAPES[shape]() as never);
    expect(m.past.filter((n) => n.status === 'cancelled')).toEqual([]);
  });

  it('a cancelled night is never the hero nor counted; an event not live is counted but never the hero', () => {
    const m = mapMyGoing(GOING_SHAPES.cancelledNight() as never);
    expect(goingUpcomingCount(m.upcoming)).toBe(1);
    expect(nextNight(m.upcoming)?.name).toBe('Alpha');
    const p = mapMyGoing(GOING_SHAPES.eventNotLive() as never);
    expect(goingUpcomingCount(p.upcoming)).toBe(1);
    expect(nextNight(p.upcoming)).toBeNull();
    expect(nudgeCandidates(p.past, today())).toEqual([]);
  });
});

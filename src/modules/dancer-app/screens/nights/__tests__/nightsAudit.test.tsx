// @vitest-environment jsdom
/**
 * Slice B audit fixes on /app/nights: L3 (past tense on past nights), L22 (the
 * zero-nights empty state covers Going AND Interested), L14 (one browse verb,
 * one noun). Seeds: 0 and 15 nights.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { ReactNode } from 'react';
import { cleanup, screen, within } from '@testing-library/react';

vi.mock('@/lib/goingCheckin', () => ({ GOING_CHECKIN_ENABLED: true })); // these specs exercise the check-in surfaces
vi.mock('@/hooks/useAuth', async (importOriginal) =>
  (await import('@/modules/dancer-app/shell/testAuth')).authModuleMock(importOriginal));

const h = vi.hoisted(() => ({
  rows: [] as Record<string, unknown>[],
  rpc: null as unknown as (fn: string, args?: Record<string, unknown>) => Promise<unknown>,
}));
h.rpc = async (fn: string, args?: Record<string, unknown>) => {
  if (fn === 'get_my_event_attendance_v2') return { data: h.rows, error: null };
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
import { addDaysToKey, londonTodayKey } from '@/lib/londonDate';
import { mapNight, statusLabel } from '../nightsModel';

const today = londonTodayKey();
const day = (n: number) => addDaysToKey(today, n);
const row = (id: string, name: string, n: number, status = 'going') => ({
  event_id: id, status, updated_at: null, name, occurrence_date: day(n), city_name: 'London', start_time: '21:00:00', type: 'party', is_active: true,
});

beforeEach(() => { h.rows = []; localStorage.clear(); sessionStorage.clear(); });
afterEach(() => { cleanup(); resetShell(); });

const nights = () => renderInShell({ path: '/app/nights' });

describe('L3: past nights read in the past tense', () => {
  it.each([
    ['going', 3, 'Going'],
    ['interested', 3, 'Interested'],
    ['going', -6, 'Went'],
    ['interested', -6, 'Was interested'],
    ['not_going', -6, 'Not going'],
  ] as const)('%s, %i days: %s', (status, n, label) => {
    expect(statusLabel(mapNight(row('s', 'X', n, status), today))).toBe(label);
  });

  it('the Past list shows Went / Was interested, the Upcoming list Going / Interested', async () => {
    h.rows = [row('a', 'Alpha', 2), row('b', 'Beta', 4, 'interested'), row('c', 'Gamma', -6), row('d', 'Delta', -9, 'interested')];
    nights();
    const past = await screen.findByTestId('nights-past');
    const pastRows = within(past).getAllByTestId('night-row').map((r) => r.textContent ?? '');
    expect(pastRows[0]).toMatch(/Gamma.*Went/);
    expect(pastRows[1]).toMatch(/Delta.*Was interested/);
    const upRows = within(screen.getByTestId('nights-upcoming')).getAllByTestId('night-row').map((r) => r.textContent ?? '');
    expect(upRows[0]).toMatch(/Alpha.*Going/);
    expect(upRows[1]).toMatch(/Beta.*Interested/);
  });
});

describe('L22: zero nights', () => {
  it('one empty state that covers Going and Interested and says how to find a night (D130: no browse link)', async () => {
    nights();
    const empty = await screen.findByTestId('nights-empty');
    expect(empty.textContent).toMatch(/^No nights saved yet\./);
    expect(empty.textContent).toMatch(/Interested/);
    expect(empty.textContent).toMatch(/Going/);
    expect(within(empty).queryAllByRole('link')).toHaveLength(0);
    expect(empty.textContent).toMatch(/Bachata Calendar link at the top left/);
    expect(screen.queryByText(/not going to anything/)).toBeNull();
  });

  it('only past nights: Upcoming says nothing is coming up and what to do (D130)', async () => {
    h.rows = [row('c', 'Gamma', -6)];
    nights();
    const up = await screen.findByTestId('nights-upcoming-empty');
    expect(up.textContent).toMatch(/No upcoming nights/);
    expect(within(up).queryAllByRole('link')).toHaveLength(0);
    expect(up.textContent).toMatch(/Bachata Calendar link at the top left/);
  });
});

describe('D130: no browse verb', () => {
  it('no "Browse" anything on Nights', async () => {
    nights();
    await screen.findByTestId('nights-empty');
    expect(screen.getByTestId('dancer-screen-nights').textContent).not.toMatch(/Browse/i);
  });
});

describe('seeds', () => {
  it('15 nights (8 upcoming, 7 past): every row renders', async () => {
    h.rows = Array.from({ length: 15 }, (_, i) => row(`s${i}`, `Night ${i}`, i < 8 ? i + 1 : -(i - 6), i % 2 ? 'interested' : 'going'));
    nights();
    const up = await screen.findByTestId('nights-upcoming');
    expect(within(up).getAllByTestId('night-row')).toHaveLength(8);
    expect(within(screen.getByTestId('nights-past')).getAllByTestId('night-row')).toHaveLength(7);
  });
});

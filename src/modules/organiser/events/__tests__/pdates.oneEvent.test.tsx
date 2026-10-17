// @vitest-environment jsdom
/**
 * P-DATES on one event (PARITY-GAP C39, C59): every coming date opens its own
 * sessions and line-up in one tap (not only the next date), and the past
 * dates are listed, collapsed, each opening that date read-only.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, screen, within } from '@testing-library/react';
import { Route } from 'react-router-dom';

const rpc = vi.hoisted(() => vi.fn());
vi.mock('@/integrations/supabase/client', () => ({
  supabase: { rpc, from: () => ({ select: () => ({ is: () => ({ order: async () => ({ data: [], error: null }) }) }) }) },
}));
vi.mock('@/hooks/useAuth', () => ({ useAuth: () => ({ user: { id: 'u1' } }) }));

import OneEvent from '../OneEvent';
import { ORG_PATHS } from '@/modules/organiser/shell/paths';
import { A, AFTER, BEFORE, FROZEN, PAST, answer, defaultWorld, mount, type World } from '@/modules/organiser/flows/add/__tests__/fixtures';

let world: World;
let hasMore = false;
beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(FROZEN);
  rpc.mockReset();
  world = defaultWorld();
  hasMore = false;
  answer(rpc, () => world);
  const base = rpc.getMockImplementation() as (fn: string, args: Record<string, unknown>) => Promise<unknown>;
  rpc.mockImplementation(async (fn: string, args: Record<string, unknown>) => {
    if (fn !== 'admin_event_workspace_p5') return base(fn, args);
    const id = String(args.p_series_id);
    return {
      data: {
        series: { series: { id, name: 'Friday Social', format: 'recurring', lifecycle_status: 'live', version: 9, default_local_start_time: '20:00:00',
          recurrence_rule: { mode: 'weekly', weekdays: [5], interval: 1, end: { kind: 'none' } }, removed_dates: [] }, program: [] },
        occurrences: (world.occs[id] ?? []).map((o) => ({ id: o.id, occurrence_date: o.date, lifecycle_status: o.status, version: o.version, materialised_start_utc: `${o.date}T20:00:00Z` })),
        meta: { has_more: hasMore },
      },
      error: null,
    };
  });
});
afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

const routes = <Route path="/account/o/events/:seriesId" element={<OneEvent />} />;

describe('P-DATES: one event', () => {
  it('every coming date has a Sessions link to THAT date’s session editor (C59)', async () => {
    mount(ORG_PATHS.event(A), routes);
    const links = await screen.findAllByTestId('org-coming-sessions');
    expect(links.map((l) => l.getAttribute('href'))).toEqual([ORG_PATHS.dateLineup(A, BEFORE), ORG_PATHS.dateLineup(A, AFTER)]);
    links.forEach((l) => expect(l.className).toMatch(/min-h-\[(4[4-9]|5\d)px\]/));
  });

  it('the past dates are listed collapsed under "Past dates" and open that date (C39)', async () => {
    mount(ORG_PATHS.event(A), routes);
    const toggle = await screen.findByTestId('org-dates-past-toggle');
    expect(toggle.getAttribute('aria-expanded')).toBe('false');
    expect(toggle.textContent).toContain('Past dates (1)');
    fireEvent.click(toggle);
    const past = await screen.findByTestId('org-dates-past');
    const rows = within(past).getAllByTestId('org-date-row');
    expect(rows).toHaveLength(1);
    fireEvent.click(rows[0]);
    expect(screen.getByTestId('where').textContent).toBe(ORG_PATHS.dateLineup(A, PAST));
  });

  it('over the 100-date read, the past list says older dates are not listed (REVIEW P-DATES 4)', async () => {
    hasMore = true;
    mount(ORG_PATHS.event(A), routes);
    expect((await screen.findByTestId('org-dates-truncated')).textContent).toContain('newest 100');
  });

  it('the coming dates are not listed twice (the past list carries no upcoming card)', async () => {
    mount(ORG_PATHS.event(A), routes);
    await screen.findByTestId('org-dates-past-toggle');
    expect(screen.queryByText(/Upcoming dates \(/)).toBeNull();
  });
});

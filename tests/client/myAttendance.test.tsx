// @vitest-environment jsdom
/**
 * /account/attendance (the dancer home's "My attendance"), Going P2: read from
 * get_my_going_v1 through the going module, table-driven over every reply shape
 * (empty, upcoming only, past only, cancelled night, ended night, event not live,
 * many) x the going switch. Going only (no "Interested"); the night lifecycle in
 * the module's words; starts_at_local as stored; every empty state offers a
 * control that is on screen (Browse events). A past night that went ahead links
 * to its event's own rating card.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { ReactNode } from 'react';
import { cleanup, render, screen, within } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';

const h = vi.hoisted(() => ({ on: true, reply: { upcoming: [], past: [] } as unknown, calls: [] as string[], fail: false }));
vi.mock('@/lib/goingCheckin', () => ({ get GOING_CHECKIN_ENABLED() { return h.on; } }));
vi.mock('@/integrations/supabase/rpcLoose', () => ({
  rpcLoose: async (fn: string) => {
    h.calls.push(fn);
    if (fn === 'get_my_going_v1') return h.fail ? { data: null, error: { message: 'Failed to fetch' } } : { data: h.reply, error: null };
    return { data: null, error: { message: `unexpected rpc ${fn}` } };
  },
}));
vi.mock('@/hooks/useAuth', () => ({ useAuth: () => ({ user: { id: 'u1' }, isLoading: false, authStatus: 'ready' }) }));
vi.mock('@/components/auth/AuthGuard', () => ({ AuthGuard: ({ children }: { children: ReactNode }) => <>{children}</> }));
vi.mock('@/components/layout/GlobalLayout', () => ({
  default: ({ children, backHref }: { children: ReactNode; backHref?: string }) => (
    <div data-back={backHref}>{children}</div>
  ),
}));
vi.mock('@/contexts/CityContext', () => ({ useCity: () => ({ citySlug: 'london-gb' }) }));
vi.mock('@/lib/seo', () => ({ useSeo: () => undefined }));

import MyAttendance, { RATE_ANCHOR } from '@/pages/MyAttendance';
import { LEVEL_RATING_ANCHOR } from '@/components/LevelRatingPrompt';
import { DANCER_HOME_PATH } from '@/lib/accountRouting';
import { GOING_COPY, nightLine } from '@/modules/going';
import { GOING_SHAPES, cancelled, night, notLive } from '@/modules/dancer-app/screens/nights/__tests__/goingShapes';

const mount = () =>
  render(
    <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
      <MemoryRouter initialEntries={['/account/attendance']}>
        <MyAttendance />
      </MemoryRouter>
    </QueryClientProvider>,
  );

beforeEach(() => { h.on = true; h.reply = GOING_SHAPES.empty(); h.calls = []; h.fail = false; });
afterEach(cleanup);

const cards = (testId: string) => (screen.queryByTestId(testId) ? within(screen.getByTestId(testId)).getAllByTestId('attendance-night') : []);

/** shape -> upcoming cards, past cards, rate links. */
const EXPECT: Record<string, { up: number; past: number; rate: number }> = {
  empty: { up: 0, past: 0, rate: 0 },
  upcomingOnly: { up: 2, past: 0, rate: 0 },
  pastOnly: { up: 0, past: 2, rate: 2 },
  // The cancelled PAST night is not listed: "Nights you went to" holds only nights that happened.
  cancelledNight: { up: 2, past: 0, rate: 0 },
  endedNight: { up: 0, past: 1, rate: 1 },
  eventNotLive: { up: 1, past: 1, rate: 0 },
  many: { up: 40, past: 100, rate: 100 },
};

describe('My attendance x every get_my_going_v1 shape', () => {
  it('the rating link lands on the rating card anchor', () => {
    expect(RATE_ANCHOR).toBe(LEVEL_RATING_ANCHOR);
  });

  it.each(Object.keys(GOING_SHAPES))('%s', async (shape) => {
    h.reply = GOING_SHAPES[shape]();
    mount();
    const e = EXPECT[shape];
    if (e.up + e.past === 0) {
      const empty = await screen.findByTestId('attendance-empty');
      expect(empty.textContent).toContain(GOING_COPY.myUpcomingEmpty);
      expect(empty.textContent).toContain(GOING_COPY.myUpcomingEmptyHow);
      expect(within(empty).getByRole('button', { name: 'Browse events' })).toBeTruthy();
    } else {
      await screen.findAllByTestId('attendance-night');
      expect(cards('attendance-upcoming')).toHaveLength(e.up);
      expect(cards('attendance-past')).toHaveLength(e.past);
      if (e.up === 0) {
        const none = screen.getByTestId('attendance-upcoming-empty');
        expect(none.textContent).toContain(GOING_COPY.myUpcomingEmptyHow);
        expect(within(none).getByRole('link', { name: 'Browse events' })).toBeTruthy();
      }
    }
    expect(screen.queryAllByTestId('attendance-rate')).toHaveLength(e.rate);
    expect(document.body.textContent).not.toMatch(/interested/i);
    expect(h.calls).toEqual(['get_my_going_v1']);
    expect(document.querySelector('[data-back]')?.getAttribute('data-back')).toBe(DANCER_HOME_PATH);
  });

  it('lifecycle words and tags come from the going module; the time is starts_at_local as stored', async () => {
    h.reply = {
      upcoming: [night('a', 'Alpha', 2, { starts_at_local: '2099-01-02T23:30:00' }), cancelled('x', 'Xray', 3), notLive('p', 'Papa', 4)],
      past: [night('c', 'Gamma', -3)],
    };
    mount();
    await screen.findAllByTestId('attendance-night');
    const up = cards('attendance-upcoming');
    expect(up[0].textContent).toContain(nightLine('2099-01-02T23:30:00')!);
    expect(up[0].textContent).toContain(GOING_COPY.tagGoing);
    expect(up[1].textContent).toContain(GOING_COPY.tagCancelled);
    expect(up[1].textContent).toContain(GOING_COPY.cancelled);
    expect(up[2].textContent).toContain(GOING_COPY.notLive);
    const past = cards('attendance-past');
    expect(past[0].textContent).toContain(GOING_COPY.tagWent);
    expect(within(past[0]).getByTestId('attendance-rate').getAttribute('href')).toBe(`/event/ev-c#${LEVEL_RATING_ANCHOR}`);
  });

  it('a cancelled past night is never under "Nights you went to" (and never offered a rating)', async () => {
    h.reply = { upcoming: [], past: [night('c', 'Gamma', -3), cancelled('y', 'Yankee', -4)] };
    mount();
    await screen.findAllByTestId('attendance-night');
    const past = cards('attendance-past');
    expect(past).toHaveLength(1);
    expect(past[0].textContent).toContain('Gamma');
    expect(screen.getByTestId('attendance-past').textContent).not.toContain('Yankee');
  });

  it('a failed read says so and offers Try again', async () => {
    h.fail = true;
    mount();
    expect(await screen.findByRole('button', { name: GOING_COPY.retry })).toBeTruthy();
  });
});

describe('switch off: no going RPC, no going words', () => {
  it('shows the neutral empty card with Browse events; get_my_going_v1 never runs', async () => {
    h.on = false;
    h.reply = GOING_SHAPES.many();
    mount();
    const empty = await screen.findByTestId('attendance-empty');
    expect(empty.textContent).not.toContain(GOING_COPY.myUpcomingEmptyHow);
    expect(within(empty).getByRole('button', { name: 'Browse events' })).toBeTruthy();
    expect(screen.queryAllByTestId('attendance-night')).toHaveLength(0);
    expect(h.calls).toEqual([]);
  });
});

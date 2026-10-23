// @vitest-environment jsdom
/**
 * TODAY's festival hub going row (src/pages/FestivalHub.tsx, Going P2): each
 * festival card shows the count, the people and the ONE "I'm going" button for
 * its single night, through src/modules/going (get_nights_going_v1 /
 * set_my_going_v1). The night's P5 occurrence id comes from event_view_p5.
 *
 * Changed rule (owner decision 2, Going P2): only FINISHED profiles may say
 * going. The old "Going is not gated by completeness" rows are now: an
 * unfinished profile sees the button disabled with the missing field named and
 * a link to finish it, and no write is sent; a finished (or not-yet-known)
 * profile's tap sends set_my_going_v1 for the night, never set_attendance.
 * The clock and Math.random are pinned (countdown + random confetti layer).
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
vi.mock('@/lib/goingCheckin', () => ({ GOING_CHECKIN_ENABLED: true })); // these specs exercise the check-in surfaces
import type { ReactNode } from 'react';
import { cleanup, fireEvent, render, screen, waitFor, act } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';
import { installJsdomPolyfills } from '../../client/jsdomPolyfills';
import { a11yTree } from './helpers/a11yTree';
import { VIEWPORTS, setViewport } from './helpers/viewports';

const OCC = '3f2157c6-3582-4297-850c-008c80f2c12f';
const h = vi.hoisted(() => ({
  user: null as null | { id: string },
  rpc: vi.fn(),
  going: false,
}));
vi.mock('@/hooks/useAuth', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/hooks/useAuth')>()),
  useAuth: () => ({ user: h.user, isLoading: false, authStatus: 'ready' }),
}));
// `auth` too: getSupabase (rpcLoose, the going module's reads) checks the client has it.
vi.mock('@/integrations/supabase/client', () => ({ supabase: { rpc: (...a: unknown[]) => h.rpc(...a), auth: {} } }));
vi.mock('@/components/layout/GlobalLayout', () => ({ default: ({ children }: { children: ReactNode }) => <div>{children}</div> }));
vi.mock('@/lib/festivalsList', async (orig) => ({
  ...(await orig<typeof import('@/lib/festivalsList')>()),
  fetchPublicFestivalsList: async () => [
    { id: 'fest-1', name: 'Costa Bachata Congress', city: 'Alicante', date: '2026-12-20', start_time: '2026-12-20T10:00:00Z', poster_url: null },
  ],
}));

import FestivalHub from '@/pages/FestivalHub';
import { ProfileGateContext } from '@/hooks/useAuth';
import { profileGateValue, type ProfileCompletion } from '@/lib/profileCompletion';

const mount = (completion?: ProfileCompletion) =>
  render(
    <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } })}>
      <MemoryRouter initialEntries={['/festivals']}>
        {completion ? (
          <ProfileGateContext.Provider value={profileGateValue(completion)}>
            <FestivalHub />
          </ProfileGateContext.Provider>
        ) : (
          <FestivalHub />
        )}
      </MemoryRouter>
    </QueryClientProvider>,
  );

const settled = async () => {
  await screen.findByText('Costa Bachata Congress');
  await act(async () => {
    await new Promise((r) => setTimeout(r, 150));
  });
};
const callsOf = (fn: string) => h.rpc.mock.calls.filter(([n]) => n === fn);
const LEGACY = /set_attendance|get_event_attendance|get_my_event_attendance|get_festival_attendance/;

beforeEach(() => {
  installJsdomPolyfills();
  vi.useFakeTimers({ toFake: ['Date'], now: new Date('2026-10-15T12:00:00Z') });
  vi.spyOn(Math, 'random').mockReturnValue(0.5);
  h.user = null;
  h.going = false;
  h.rpc.mockReset().mockImplementation(async (name: string) => {
    if (name === 'event_view_p5') {
      return {
        data: {
          occurrence_id: OCC,
          occurrence_effective: { occurrence_id: OCC, starts_at: '2026-12-20T10:00:00+00:00', ends_at: '2026-12-22T23:00:00+00:00', is_cancelled: false },
          event: { lifecycle_status: 'live' },
        },
        error: null,
      };
    }
    if (name === 'get_nights_going_v1') {
      return {
        data: [{ occurrence_id: OCC, going_count: 5, people: [
          { dancer_profile_id: 'd1', first_name: 'Ana', photo_url: null },
          { dancer_profile_id: null, first_name: 'Ben', photo_url: null },
        ] }],
        error: null,
      };
    }
    if (name === 'get_my_going_v1') {
      return { data: { upcoming: h.going ? [{ occurrence_id: OCC, is_cancelled: false }] : [], past: [] }, error: null };
    }
    if (name === 'set_my_going_v1') return { data: { occurrence_id: OCC, going: true, changed: true, going_count: 6 }, error: null };
    return { data: null, error: null };
  });
});
afterEach(() => {
  cleanup();
  vi.useRealTimers();
  vi.restoreAllMocks();
});

const COMPLETE: ProfileCompletion = { status: 'complete', missing: [], profileId: 'p1' };
const ROWS: { name: string; user: typeof h.user; going: boolean; completion?: ProfileCompletion }[] = [
  { name: 'signed out', user: null, going: false },
  { name: 'signed in, finished, not going', user: { id: 'u1' }, going: false, completion: COMPLETE },
  { name: 'signed in, finished, going', user: { id: 'u1' }, going: true, completion: COMPLETE },
  { name: 'signed in, unfinished (photo missing)', user: { id: 'u1' }, going: false, completion: { status: 'incomplete', missing: ['avatar_url'], profileId: 'p1' } },
];

describe.each(VIEWPORTS)('festival hub at $name', (vp) => {
  beforeEach(() => setViewport(vp));

  it.each(ROWS)('$name', async ({ user, going, completion }) => {
    h.user = user;
    h.going = going;
    mount(completion);
    await settled();
    expect(a11yTree()).toMatchSnapshot();
    expect(h.rpc.mock.calls.filter(([n]) => LEGACY.test(String(n)))).toEqual([]);
  });

  it('signed-out tap: no write, the sign-in prompt opens', async () => {
    mount();
    await settled();
    fireEvent.click(screen.getByTestId('festival-going-button'));
    await act(async () => {
      await new Promise((r) => setTimeout(r, 60));
    });
    expect(callsOf('set_my_going_v1')).toHaveLength(0);
    expect(a11yTree()).toMatchSnapshot();
  });

  it.each([
    ['incomplete', { status: 'incomplete', missing: ['avatar_url'], profileId: 'p1' } as ProfileCompletion],
    ['no profile', { status: 'no_profile', missing: ['first_name'], profileId: null } as ProfileCompletion],
  ])('signed-in, %s: the button is disabled with its reason and no write is sent', async (_n, completion) => {
    h.user = { id: 'u1' };
    mount(completion);
    await settled();
    const button = screen.getByTestId('festival-going-button') as HTMLButtonElement;
    expect(button.disabled).toBe(true);
    expect(screen.getByTestId('festival-going-button-message').textContent).toMatch(/you.re going/);
    fireEvent.click(button);
    await act(async () => {
      await new Promise((r) => setTimeout(r, 60));
    });
    expect(callsOf('set_my_going_v1')).toHaveLength(0);
  });

  it.each([
    ['no completeness provider (server decides)', undefined],
    ['complete', COMPLETE],
  ])('signed-in, %s: the tap sends set_my_going_v1 for the night', async (_n, completion) => {
    h.user = { id: 'u1' };
    mount(completion);
    await settled();
    fireEvent.click(screen.getByTestId('festival-going-button'));
    await waitFor(() => expect(callsOf('set_my_going_v1')).toHaveLength(1));
    expect(callsOf('set_my_going_v1')[0][1]).toEqual({ p_occurrence_id: OCC, p_going: true });
    expect(callsOf('set_attendance')).toHaveLength(0);
  });
});

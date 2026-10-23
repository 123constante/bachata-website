// @vitest-environment jsdom
/**
 * Festival hub going rows (Going P2), table-driven:
 *   FestivalGoing x going 0/1/3/8/9/200 x viewer (signed out / guest /
 *   unfinished / no profile / finished not going / going) x night (live / ended
 *   / cancelled / event not live) -- the state, words and button are the going
 *   module's mapping (goingStateFor), the count/people/"+N more" its GoingPeople.
 * Page level: every card shares ONE get_nights_going_v1 request; the switch off
 * sends no going read at all; a night that cannot load says so with a retry,
 * never a made-up "0 going"; a festival with no visible night shows nothing.
 */
import type { ReactNode } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen, act, fireEvent, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';
import { installJsdomPolyfills } from './jsdomPolyfills';

const h = vi.hoisted(() => ({
  on: true,
  rpc: vi.fn(),
  user: null as null | { id: string; is_anonymous?: boolean },
  festivals: [] as Array<{ id: string; name: string; city: string; date: string; start_time: string; poster_url: null }>,
}));
vi.mock('@/lib/goingCheckin', () => ({
  get GOING_CHECKIN_ENABLED() {
    return h.on;
  },
}));
vi.mock('@/hooks/useAuth', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/hooks/useAuth')>()),
  useAuth: () => ({ user: h.user, isLoading: false, authStatus: 'ready' }),
}));
vi.mock('@/integrations/supabase/client', () => ({ supabase: { rpc: (...a: unknown[]) => h.rpc(...a), auth: {} } }));
vi.mock('@/components/layout/GlobalLayout', () => ({ default: ({ children }: { children: ReactNode }) => <div>{children}</div> }));
vi.mock('@/lib/festivalsList', async (orig) => ({
  ...(await orig<typeof import('@/lib/festivalsList')>()),
  fetchPublicFestivalsList: async () => h.festivals,
}));

import { ProfileGateContext } from '@/hooks/useAuth';
import { profileGateValue, type ProfileCompletion } from '@/lib/profileCompletion';
import { goingCountText, goingStateFor, moreText, GOING_COPY, type GoingViewer } from '@/modules/going';
import { FestivalGoing } from '@/pages/FestivalHubGoing';
import type { FestivalNight } from '@/pages/festivalHubNights';
import FestivalHub from '@/pages/FestivalHub';

const OCC = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const NOW = new Date('2026-10-15T12:00:00Z');
const callsOf = (fn: string) => h.rpc.mock.calls.filter(([n]) => n === fn);

const people = (n: number) =>
  Array.from({ length: Math.min(n, 8) }, (_, i) => ({
    dancer_profile_id: i % 2 === 0 ? `d${i}` : null,
    first_name: `Dancer${i}`,
    photo_url: i % 3 === 0 ? `https://media.example/p${i}.webp` : null,
  }));

let state = { count: 0, going: false };
const rpcImpl = async (fn: string, a?: { p_occurrence_ids?: string[]; p_target?: { series_id: string } }) => {
  if (fn === 'get_nights_going_v1') {
    return { data: (a?.p_occurrence_ids ?? []).map((id) => ({ occurrence_id: id, going_count: state.count, people: people(state.count) })), error: null };
  }
  if (fn === 'get_my_going_v1') return { data: { upcoming: state.going ? [{ occurrence_id: OCC }] : [], past: [] }, error: null };
  if (fn === 'event_view_p5') {
    const id = a?.p_target?.series_id ?? '';
    if (id === 'fest-hidden') return { data: null, error: null };
    if (id === 'fest-broken') return { data: null, error: { message: 'boom' } };
    const occ = `occ-${id}`;
    return {
      data: {
        occurrence_id: occ,
        occurrence_effective: { occurrence_id: occ, starts_at: '2026-12-20T10:00:00+00:00', ends_at: '2026-12-22T23:00:00+00:00', is_cancelled: false },
        event: { lifecycle_status: 'live' },
      },
      error: null,
    };
  }
  return { data: null, error: null };
};

beforeEach(() => {
  installJsdomPolyfills();
  h.on = true;
  h.user = null;
  state = { count: 0, going: false };
  h.rpc.mockReset().mockImplementation(rpcImpl);
});
afterEach(cleanup);

type ViewerRow = {
  name: string;
  user: typeof h.user;
  completion?: ProfileCompletion;
  viewer: GoingViewer;
  going: boolean;
};
const VIEWERS: ViewerRow[] = [
  { name: 'signed out', user: null, viewer: { kind: 'signed_out' }, going: false },
  { name: 'guest (anonymous)', user: { id: 'g', is_anonymous: true }, viewer: { kind: 'anonymous' }, going: false },
  {
    name: 'unfinished (role + photo missing)',
    user: { id: 'u1' },
    completion: { status: 'incomplete', missing: ['dance_role', 'avatar_url'], profileId: 'p1' },
    viewer: { kind: 'unfinished', missing: ['dance_role', 'avatar_url'] },
    going: false,
  },
  { name: 'no dancer profile', user: { id: 'u1' }, completion: { status: 'no_profile', missing: [], profileId: null }, viewer: { kind: 'no_profile' }, going: false },
  { name: 'finished, not going', user: { id: 'u1' }, completion: { status: 'complete', missing: [], profileId: 'p1' }, viewer: { kind: 'finished' }, going: false },
  { name: 'finished, going', user: { id: 'u1' }, completion: { status: 'complete', missing: [], profileId: 'p1' }, viewer: { kind: 'finished' }, going: true },
];

const NIGHT = (over: Partial<FestivalNight>): FestivalNight => ({
  festivalId: 'fest-1',
  occurrenceId: OCC,
  startsAtLocal: '2026-12-20T10:00:00+00:00',
  endsAtLocal: '2026-12-22T23:00:00+00:00',
  isCancelled: false,
  eventLive: true,
  ...over,
});
const NIGHTS = [
  { name: 'live', status: 'live', night: NIGHT({}) },
  { name: 'ended', status: 'ended', night: NIGHT({ startsAtLocal: '2026-10-01T20:00:00', endsAtLocal: '2026-10-03T23:00:00' }) },
  { name: 'cancelled', status: 'cancelled', night: NIGHT({ isCancelled: true }) },
  { name: 'event not live (paused)', status: 'not_live', night: NIGHT({ eventLive: false }) },
] as const;
const COUNTS = [0, 1, 3, 8, 9, 200];

const CELLS = COUNTS.flatMap((count) => VIEWERS.flatMap((v) => NIGHTS.map((n) => ({ count, v, n }))));

const renderRow = (v: ViewerRow, night: FestivalNight) => {
  const ui = (
    <FestivalGoing
      festivalId="fest-1"
      night={night}
      nightFailed={false}
      onRetryNight={() => {}}
      batchIds={[OCC]}
      ready
      now={NOW}
      onSignIn={() => {}}
    />
  );
  return render(
    <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
      <MemoryRouter initialEntries={['/festivals']}>
        {v.completion ? <ProfileGateContext.Provider value={profileGateValue(v.completion)}>{ui}</ProfileGateContext.Provider> : ui}
      </MemoryRouter>
    </QueryClientProvider>,
  );
};

describe('FestivalGoing: count x viewer x night', () => {
  it.each(CELLS)('$count going | $v.name | $n.name', async ({ count, v, n }) => {
    state = { count, going: v.going };
    h.user = v.user;
    renderRow(v, n.night);
    const past = n.status === 'ended';
    await screen.findByText(goingCountText(count, past));
    const expected = goingStateFor({ viewer: v.viewer, night: n.status, going: v.going, count, returnTo: '/festivals' });
    await waitFor(() => expect(screen.getByTestId('festival-going').getAttribute('data-state')).toBe(expected.state));
    const button = screen.getByTestId('festival-going-button') as HTMLButtonElement;
    expect(button.textContent).toBe(expected.control.label);
    expect(button.disabled).toBe(!expected.control.enabled);
    // A disabled button always has its reason on screen.
    if (!expected.control.enabled) expect(screen.getByTestId('festival-going-button-message').textContent).toBeTruthy();
    // Up to 8 people; a link only for a non-null id; "+N more" = count - shown.
    const shown = Math.min(count, 8);
    expect(screen.queryAllByTestId('going-person-link')).toHaveLength(Math.ceil(shown / 2));
    expect(screen.queryAllByTestId('going-person')).toHaveLength(Math.floor(shown / 2));
    expect(screen.queryAllByTestId('going-photo')).toHaveLength(Math.ceil(shown / 3));
    const more = screen.queryByTestId('going-more');
    if (count > 8) expect(more?.textContent).toContain(moreText(count - 8).replace(/ more$/, ''));
    else expect(more).toBeNull();
    // No word on this row says "Interested".
    expect(document.body.textContent).not.toMatch(/interested/i);
  });
});

const mountHub = () =>
  render(
    <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
      <MemoryRouter initialEntries={['/festivals']}>
        <FestivalHub />
      </MemoryRouter>
    </QueryClientProvider>,
  );
const fest = (id: string, name: string) => ({ id, name, city: 'Alicante', date: '2099-12-20', start_time: '2099-12-20T10:00:00Z', poster_url: null as null });

describe('FestivalHub page', () => {
  it('every card shares ONE get_nights_going_v1 request, with the P5 ids from event_view_p5', async () => {
    h.festivals = [fest('fest-a', 'Alpha Fest'), fest('fest-b', 'Beta Fest'), fest('fest-c', 'Gamma Fest')];
    state = { count: 3, going: false };
    mountHub();
    await waitFor(() => expect(screen.getAllByText('3 going')).toHaveLength(3));
    expect(callsOf('event_view_p5')).toHaveLength(3);
    expect(callsOf('get_nights_going_v1')).toHaveLength(1);
    expect([...(callsOf('get_nights_going_v1')[0][1] as { p_occurrence_ids: string[] }).p_occurrence_ids].sort()).toEqual(['occ-fest-a', 'occ-fest-b', 'occ-fest-c']);
    expect(h.rpc.mock.calls.filter(([n]) => /attendance/.test(String(n)))).toEqual([]);
  });

  it('switch off: no night read, no going read, no going words', async () => {
    h.on = false;
    h.festivals = [fest('fest-a', 'Alpha Fest')];
    mountHub();
    await screen.findByText('Alpha Fest');
    await act(async () => {
      await new Promise((r) => setTimeout(r, 80));
    });
    expect(callsOf('event_view_p5')).toHaveLength(0);
    expect(callsOf('get_nights_going_v1')).toHaveLength(0);
    expect(callsOf('get_my_going_v1')).toHaveLength(0);
    expect(screen.queryByTestId('festival-going')).toBeNull();
    expect(document.body.textContent).not.toMatch(/going/i);
  });

  it('a night that cannot load says so with a retry; a festival with no visible night shows nothing', async () => {
    h.festivals = [fest('fest-broken', 'Broken Fest'), fest('fest-hidden', 'Hidden Fest'), fest('fest-a', 'Alpha Fest')];
    state = { count: 0, going: false };
    mountHub();
    await screen.findByText(GOING_COPY.peopleLoadFailed);
    await screen.findByText('No one going yet');
    expect(screen.getAllByTestId('festival-going')).toHaveLength(1);
    // The going read still runs once, for the one night that is known.
    await waitFor(() => expect(callsOf('get_nights_going_v1')).toHaveLength(1));
    expect((callsOf('get_nights_going_v1')[0][1] as { p_occurrence_ids: string[] }).p_occurrence_ids).toEqual(['occ-fest-a']);
    const before = callsOf('event_view_p5').length;
    fireEvent.click(screen.getByRole('button', { name: GOING_COPY.retry }));
    await waitFor(() => expect(callsOf('event_view_p5').length).toBe(before + 1));
  });
});

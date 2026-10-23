// @vitest-environment jsdom
/**
 * TODAY's event-page "Who's going" tile (RsvpBlock, Going P2 design A) and level
 * vote (LevelRatingPrompt) states for signed-out / anonymous / incomplete /
 * complete, and for every closed-night reason, as the accessible tree at 390x844
 * and desktop. Since Going P2 BOTH are profile-gated (the database refuses
 * `profile_incomplete`); both facts are asserted beside the snapshots. The full
 * shape matrix of the tile is tests/client/rsvpBlock.test.tsx.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
vi.mock('@/lib/goingCheckin', () => ({ GOING_CHECKIN_ENABLED: true })); // these specs exercise the check-in surfaces
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';
import { installJsdomPolyfills } from '../../client/jsdomPolyfills';
import { a11yTree } from './helpers/a11yTree';
import { VIEWPORTS, setViewport } from './helpers/viewports';

const h = vi.hoisted(() => ({
  user: null as null | { id: string; is_anonymous?: boolean },
  rpc: vi.fn(),
  myGoing: false,
  myLevel: null as string | null,
  rate: vi.fn(),
}));
vi.mock('@/hooks/useAuth', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/hooks/useAuth')>()),
  useAuth: () => ({ user: h.user, isLoading: false }),
}));
// `auth` too: getSupabase (rpcLoose, so the dancer-area gate read) checks the client has it.
vi.mock('@/integrations/supabase/client', () => ({ supabase: { rpc: (...a: unknown[]) => h.rpc(...a), auth: {} } }));
vi.mock('sonner', () => ({ toast: { error: vi.fn() } }));

import { RsvpBlock } from '@/modules/event-page/bento/blocks/RsvpBlock';
import { LevelRatingPrompt } from '@/components/LevelRatingPrompt';
import { ProfileGateContext } from '@/hooks/useAuth';
import { profileGateValue, type ProfileCompletion } from '@/lib/profileCompletion';
import type { EventPageSnapshotOccurrence } from '@/modules/event-page/types';

const PUBLIC_ID = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
const OCC = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc';
const occ = (over: Partial<EventPageSnapshotOccurrence> = {}) =>
  // Fixed wall clocks: the tile prints the night ("Thursday 29 Oct \u00b7 9 PM"), so a relative date would move the snapshot daily.
  ({ occurrenceId: OCC, startsAt: '2099-10-29 21:00:00', endsAt: null, timezone: 'Europe/London', isCancelled: false, isPast: false, ...over }) as EventPageSnapshotOccurrence;

const COMPLETE: ProfileCompletion = { status: 'complete', missing: [], profileId: 'p1' };
const INCOMPLETE: ProfileCompletion = { status: 'incomplete', missing: ['avatar_url'], profileId: 'p1' };
const NO_PROFILE: ProfileCompletion = { status: 'no_profile', missing: ['first_name', 'based_city_id', 'dance_role', 'avatar_url'], profileId: null };

const mountRsvp = (props: { occurrence?: EventPageSnapshotOccurrence; lifecycle?: string } = {}) => {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  return render(
    <QueryClientProvider client={qc}>
      <MemoryRouter initialEntries={['/event/some-night?occurrenceId=' + OCC]}>
        <RsvpBlock
          publicEventId={PUBLIC_ID}
          occurrenceId={OCC}
          occurrence={props.occurrence ?? occ()}
          seriesLifecycle={props.lifecycle ?? 'live'}
        />
      </MemoryRouter>
    </QueryClientProvider>,
  );
};

const mountLevel = (completion: ProfileCompletion | 'no-provider', compact = false) =>
  render(
    <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
      <MemoryRouter initialEntries={['/event/ev1?occ=2']}>
        {completion === 'no-provider' ? (
          <LevelRatingPrompt seriesId="ev1" compact={compact} />
        ) : (
          <ProfileGateContext.Provider value={profileGateValue(completion)}>
            <LevelRatingPrompt seriesId="ev1" compact={compact} />
          </ProfileGateContext.Provider>
        )}
      </MemoryRouter>
    </QueryClientProvider>,
  );

const settled = async () => {
  await screen.findByTestId('rsvp-block');
  await waitFor(() => {
    expect(screen.getByTestId('rsvp-block').getAttribute('data-state')).not.toBe('loading');
    expect(screen.getByTestId('going-people')).toBeTruthy();
  });
  await new Promise((r) => setTimeout(r, 40));
};
const setCalls = () => h.rpc.mock.calls.filter(([n]) => n === 'set_my_going_v1');

beforeEach(() => {
  installJsdomPolyfills();
  localStorage.clear();
  h.user = null;
  h.myGoing = false;
  h.myLevel = null;
  h.rate.mockReset().mockResolvedValue({ data: {}, error: null });
  h.rpc.mockReset().mockImplementation(async (name: string, args?: { p_occurrence_ids?: string[]; p_going?: boolean }) => {
    // Outside the dancer area: "Finish your profile" goes to the site's Finish screen.
    if (name === 'dancer_area_gate_v1') return { data: { open: false, allowed: false }, error: null };
    if (name === 'get_nights_going_v1') {
      return {
        data: (args?.p_occurrence_ids ?? []).map((id) => ({
          occurrence_id: id,
          going_count: 4,
          people: [
            { dancer_profile_id: 'd1', first_name: 'Ana', photo_url: null },
            { dancer_profile_id: null, first_name: 'Leo', photo_url: null },
          ],
        })),
        error: null,
      };
    }
    if (name === 'get_my_going_v1') return { data: { upcoming: h.myGoing ? [{ occurrence_id: OCC }] : [], past: [] }, error: null };
    if (name === 'set_my_going_v1') return { data: { occurrence_id: OCC, going: args?.p_going, changed: true, going_count: 5 }, error: null };
    if (name === 'rate_series_level_p5_v1') return h.rate();
    if (name === 'series_level_summary_p5_v1')
      return { data: { series_id: 'ev1', vote_count: 3, threshold: 7, counts: null, derived_level: null, my_level: h.myLevel }, error: null };
    return { data: null, error: null };
  });
});
afterEach(cleanup);

const VIEWER_ROWS: { name: string; user: typeof h.user; going: boolean }[] = [
  { name: 'signed out', user: null, going: false },
  { name: 'anonymous session', user: { id: 'anon1', is_anonymous: true }, going: false },
  { name: 'signed in, not going', user: { id: 'u1' }, going: false },
  { name: 'signed in, going', user: { id: 'u1' }, going: true },
];
const CLOSED_ROWS: { name: string; props: Parameters<typeof mountRsvp>[0] }[] = [
  { name: 'cancelled night', props: { occurrence: occ({ isCancelled: true }) } },
  { name: 'ended night', props: { occurrence: occ({ startsAt: '2020-01-02 21:00:00', endsAt: '2020-01-03 01:00:00' }) } },
  { name: 'series not live (draft)', props: { lifecycle: 'draft' } },
];

describe.each(VIEWPORTS)('event page Who\u2019s going at $name', (vp) => {
  beforeEach(() => setViewport(vp));

  it.each(VIEWER_ROWS)('$name', async ({ user, going }) => {
    h.user = user;
    h.myGoing = going;
    mountRsvp();
    await settled();
    expect(a11yTree()).toMatchSnapshot();
  });

  it.each(CLOSED_ROWS)('closed: $name', async ({ props }) => {
    h.user = { id: 'u1' };
    mountRsvp(props);
    await settled();
    expect(a11yTree()).toMatchSnapshot();
  });

  it.each([
    ['incomplete', INCOMPLETE, false],
    ['no profile', NO_PROFILE, false],
    ['complete', COMPLETE, true],
  ] as const)('Going IS gated by profile completeness (%s): only a finished profile reaches set_my_going_v1', async (_n, completion, reaches) => {
    h.user = { id: 'u1' };
    // Going P2: the database refuses an unfinished profile, so the button is off
    // with the reason, inside the dancer area or not.
    const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    render(
      <QueryClientProvider client={qc}>
        <MemoryRouter>
          <ProfileGateContext.Provider value={profileGateValue(completion)}>
            <RsvpBlock publicEventId={PUBLIC_ID} occurrenceId={OCC} occurrence={occ()} seriesLifecycle="live" />
          </ProfileGateContext.Provider>
        </MemoryRouter>
      </QueryClientProvider>,
    );
    await settled();
    fireEvent.click(screen.getByTestId('rsvp-going'));
    if (reaches) {
      await waitFor(() => expect(setCalls().length).toBe(1));
      expect(setCalls()[0][1]).toEqual({ p_occurrence_id: OCC, p_going: true });
    } else {
      expect((screen.getByTestId('rsvp-going') as HTMLButtonElement).disabled).toBe(true);
      await new Promise((r) => setTimeout(r, 40));
      expect(setCalls()).toHaveLength(0);
    }
  });

  it('signed-out Going sends nothing and asks to sign in', async () => {
    mountRsvp();
    await settled();
    fireEvent.click(screen.getByTestId('rsvp-going'));
    // The prompt is a lazy chunk: wait for it, not for a fixed time.
    await screen.findByRole('dialog', {}, { timeout: 5000 });
    await screen.findByRole('button', { name: 'Close' });
    expect(setCalls()).toHaveLength(0);
    expect(a11yTree()).toMatchSnapshot();
  });
});

const LEVEL_ROWS: { name: string; completion: ProfileCompletion | 'no-provider'; blocked: boolean }[] = [
  { name: 'signed out / no provider', completion: 'no-provider', blocked: false },
  { name: 'incomplete (photo missing)', completion: INCOMPLETE, blocked: true },
  { name: 'no profile row', completion: NO_PROFILE, blocked: true },
  { name: 'complete', completion: COMPLETE, blocked: false },
  { name: 'check loading', completion: { status: 'loading', missing: [], profileId: null }, blocked: false },
];

describe.each(VIEWPORTS)('level vote at $name', (vp) => {
  beforeEach(() => setViewport(vp));

  describe.each([false, true])('compact=%s', (compact) => {
    it.each(LEVEL_ROWS)('$name', async ({ completion, blocked }) => {
      h.user = completion === 'no-provider' ? null : { id: 'u1' };
      mountLevel(completion, compact);
      await new Promise((r) => setTimeout(r, 120));
      const tile = screen.queryByTestId('level-rating-mixed') as HTMLButtonElement | null;
      if (tile) expect(tile.disabled).toBe(blocked);
      expect({ tilesShown: tile !== null, tree: a11yTree() }).toMatchSnapshot();
    });
  });

  it('complete, already voted: shows the voter\'s level', async () => {
    h.user = { id: 'u1' };
    h.myLevel = 'strong';
    mountLevel(COMPLETE);
    await new Promise((r) => setTimeout(r, 120));
    expect(a11yTree()).toMatchSnapshot();
  });
});

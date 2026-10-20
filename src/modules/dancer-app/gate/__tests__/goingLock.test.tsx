// @vitest-environment jsdom
/**
 * B1b S1: the Going / Interested lock (gate/useGoingLock), ONE mapping read by
 * both write surfaces -- the event page block (RsvpBlock) and the festival hub.
 *
 * Every person state x both surfaces gives the same lock: locked or not, the
 * same words, and a link to the onboarding that brings the person back to the
 * page they were on. The link target is a real route. A locked person can still
 * remove an old RSVP. No network: supabase.rpc is mocked.
 */
import type { ReactNode } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter, useLocation } from 'react-router-dom';
import { toast } from 'sonner';
import { installJsdomPolyfills } from '../../../../../tests/client/jsdomPolyfills';

type Gate = 'closed' | 'allowed' | 'loading' | 'error';
const h = vi.hoisted(() => ({
  user: null as null | { id: string; is_anonymous?: boolean; user_metadata?: Record<string, unknown> },
  gate: 'closed' as 'closed' | 'allowed' | 'loading' | 'error',
  myStatus: null as string | null,
  /** F9: the person's own RSVP read fails (status stays unknown). */
  statusFails: false,
  /** How many festivals the hub lists (F10: the lock line shows once, not per card). */
  festivals: 1,
  rpc: vi.fn(),
}));
vi.mock('@/lib/goingCheckin', () => ({ GOING_CHECKIN_ENABLED: true })); // these specs exercise the check-in surfaces
vi.mock('@/hooks/useAuth', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/hooks/useAuth')>()),
  useAuth: () => ({ user: h.user, isLoading: false, authStatus: 'ready' }),
}));
// `auth` too: getSupabase (rpcLoose, so the dancer-area gate read) checks the client has it.
vi.mock('@/integrations/supabase/client', () => ({ supabase: { rpc: (...a: unknown[]) => h.rpc(...a), auth: {} } }));
vi.mock('sonner', () => ({ toast: { error: vi.fn() } }));
vi.mock('@/components/layout/GlobalLayout', () => ({ default: ({ children }: { children: ReactNode }) => <div>{children}</div> }));
vi.mock('@/lib/festivalsList', async (orig) => ({
  ...(await orig<typeof import('@/lib/festivalsList')>()),
  fetchPublicFestivalsList: async () =>
    [
      { id: 'fest-1', name: 'Costa Bachata Congress', city: 'Alicante', date: '2026-12-20', start_time: '2026-12-20T10:00:00Z', poster_url: null },
      { id: 'fest-2', name: 'Second Sensual Weekend', city: 'Porto', date: '2027-01-20', start_time: '2027-01-20T10:00:00Z', poster_url: null },
    ].slice(0, h.festivals),
}));

import { ProfileGateContext, type ProfileGateValue } from '@/hooks/useAuth';
import { PROFILE_FIELDS, profileGateValue, type ProfileCompletion, type ProfileField } from '@/lib/profileCompletion';
import { CATCHALL_CLIENT_PATHS } from '@/components/catchallClientPaths';
import { RsvpBlock } from '@/modules/event-page/bento/blocks/RsvpBlock';
import { eventPageQueryKey } from '@/modules/event-page/useEventPageQuery';
import type { EventPageSnapshotOccurrence } from '@/modules/event-page/types';
import { asWallClock } from '@/lib/time/wallClock';
import FestivalHub from '@/pages/FestivalHub';
import { DANCER_APP_PATHS } from '../../shell/routes';
import { GOING_LOCK_LINK_LABEL, GOING_UNLOCKED, goingLockFor, missingFromGate } from '../useGoingLock';

const PUBLIC_ID = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
const OCC = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc';
const EVENT_PATH = `/event/some-night?occurrenceId=${OCC}`;
const FESTIVALS_PATH = '/festivals';

const incomplete = (missing: ProfileField[]): ProfileCompletion => ({ status: 'incomplete', missing, profileId: 'p1' });
const COMPLETE: ProfileCompletion = { status: 'complete', missing: [], profileId: 'p1' };
const NO_PROFILE: ProfileCompletion = { status: 'no_profile', missing: [...PROFILE_FIELDS], profileId: null };

type Expected = { locked: false } | { locked: true; reason: string };
type Row = {
  name: string;
  user: typeof h.user;
  gate: Gate;
  profile: ProfileCompletion | 'loading' | null;
  expected: Expected;
};

const DANCER = { id: 'u1' };
const ORGANISER = { id: 'u2', user_metadata: { user_type: 'organiser' } };
const OPEN: Expected = { locked: false };
const locked = (reason: string): Expected => ({ locked: true, reason });

// The words are written out here, not computed: this is the copy the person reads.
const ROWS: Row[] = [
  { name: 'signed out', user: null, gate: 'closed', profile: null, expected: OPEN },
  { name: 'anonymous', user: { id: 'anon', is_anonymous: true }, gate: 'allowed', profile: incomplete(['avatar_url']), expected: OPEN },
  { name: 'not in the dancer area, incomplete', user: DANCER, gate: 'closed', profile: incomplete([...PROFILE_FIELDS]), expected: OPEN },
  { name: 'allowed, complete', user: DANCER, gate: 'allowed', profile: COMPLETE, expected: OPEN },
  { name: 'allowed, no dancer profile', user: DANCER, gate: 'allowed', profile: NO_PROFILE, expected: OPEN },
  { name: 'allowed, profile check loading', user: DANCER, gate: 'allowed', profile: 'loading', expected: OPEN },
  { name: 'allowed, no profile check published', user: DANCER, gate: 'allowed', profile: null, expected: OPEN },
  { name: 'allowed, profile check failed', user: DANCER, gate: 'allowed', profile: { status: 'error', missing: [], profileId: null }, expected: OPEN },
  { name: 'gate loading, incomplete', user: DANCER, gate: 'loading', profile: incomplete(['avatar_url']), expected: OPEN },
  { name: 'gate failed, incomplete', user: DANCER, gate: 'error', profile: incomplete(['avatar_url']), expected: OPEN },
  { name: 'organiser-type, allowed, incomplete', user: ORGANISER, gate: 'allowed', profile: incomplete(['avatar_url']), expected: OPEN },
  // F10: Interested is locked too, so the words name both.
  { name: 'allowed, missing first name only', user: DANCER, gate: 'allowed', profile: incomplete(['first_name']), expected: locked("Add your first name to say you're going or interested") },
  { name: 'allowed, missing city only', user: DANCER, gate: 'allowed', profile: incomplete(['based_city_id']), expected: locked("Add your city to say you're going or interested") },
  { name: 'allowed, missing role only', user: DANCER, gate: 'allowed', profile: incomplete(['dance_role']), expected: locked("Choose how you dance to say you're going or interested") },
  { name: 'allowed, missing photo only', user: DANCER, gate: 'allowed', profile: incomplete(['avatar_url']), expected: locked("Add your photo to say you're going or interested") },
  { name: 'allowed, missing everything', user: DANCER, gate: 'allowed', profile: incomplete([...PROFILE_FIELDS]), expected: locked("Add your first name and a few details to say you're going or interested") },
  { name: 'allowed, missing city, role and photo', user: DANCER, gate: 'allowed', profile: incomplete(['based_city_id', 'dance_role', 'avatar_url']), expected: locked("Add your city and a few details to say you're going or interested") },
  { name: 'allowed, missing role and photo', user: DANCER, gate: 'allowed', profile: incomplete(['dance_role', 'avatar_url']), expected: locked("Choose how you dance and a few details to say you're going or interested") },
];

// typeof first: the app tsconfig has no strictNullChecks, so `p === null` narrows nothing.
const gateValue = (p: Row['profile']): ProfileGateValue | 'loading' | null =>
  typeof p === 'string' ? p : p === null ? null : profileGateValue(p);

const occ = (): EventPageSnapshotOccurrence => ({
  occurrenceId: OCC,
  startsAt: asWallClock('2026-12-20T20:00:00'),
  endsAt: asWallClock('2026-12-20T23:59:00'),
  localDate: asWallClock('2026-12-20T00:00:00'),
  timezone: 'Europe/London',
  isCancelled: false,
  cancellationReasonLabel: null,
  isLive: false,
  isPast: false,
  isUpcoming: true,
  lineup: { teachers: [], djs: [], dancers: [], vendors: [], videographers: [] },
});

/** Where the router is now: a tap that falls through to a festival card navigates away. */
const Where = () => <span data-testid="where">{useLocation().pathname}</span>;

const wrap = (row: Row, path: string, child: ReactNode) => {
  const value = gateValue(row.profile);
  return (
    <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
      <MemoryRouter initialEntries={[path]}>
        {value === null ? child : <ProfileGateContext.Provider value={value}>{child}</ProfileGateContext.Provider>}
        <Where />
      </MemoryRouter>
    </QueryClientProvider>
  );
};

type Seen = { locked: boolean; reason: string | null; href: string | null; goingDisabled: boolean; interestedDisabled: boolean };

const SURFACES = {
  'event page block': {
    path: EVENT_PATH,
    mount: (row: Row) =>
      render(
        wrap(
          row,
          EVENT_PATH,
          <RsvpBlock snapshotQueryKey={eventPageQueryKey('page').slice(0, 2)} publicEventId={PUBLIC_ID} occurrenceId={OCC} occurrence={occ()} seriesLifecycle="live" goingCountLabel="4 going" />,
        ),
      ),
    settled: async () => {
      await screen.findByTestId('rsvp-block');
      await waitFor(() => expect(screen.getByTestId('rsvp-block').getAttribute('aria-busy')).toBe('false'));
      await act(async () => {
        await new Promise((r) => setTimeout(r, 30));
      });
    },
    buttons: () => [screen.getByTestId('rsvp-going'), screen.getByTestId('rsvp-interested')] as HTMLButtonElement[],
    lockLine: () => screen.queryByTestId('rsvp-lock'),
    setCalls: () => h.rpc.mock.calls.filter(([n]) => n === 'set_my_occurrence_attendance_p5_v1').map(([, a]) => a.p_status),
  },
  'festival hub': {
    path: FESTIVALS_PATH,
    mount: (row: Row) => render(wrap(row, FESTIVALS_PATH, <FestivalHub />)),
    settled: async () => {
      await screen.findByText('Costa Bachata Congress');
      await act(async () => {
        await new Promise((r) => setTimeout(r, 120));
      });
    },
    buttons: () => {
      const going = screen.getAllByRole('button').find((b) => /Going/.test(b.textContent ?? '') && !/Interested/.test(b.textContent ?? ''));
      const interested = screen.getAllByRole('button').find((b) => /Interested/.test(b.textContent ?? '') && !/Going/.test(b.textContent ?? ''));
      return [going, interested] as HTMLButtonElement[];
    },
    lockLine: () => screen.queryByTestId('festival-going-lock'),
    setCalls: () => h.rpc.mock.calls.filter(([n]) => n === 'set_attendance').map(([, a]) => a.p_status ?? null),
  },
} as const;

const observe = (s: (typeof SURFACES)[keyof typeof SURFACES]): Seen => {
  const [going, interested] = s.buttons();
  const line = s.lockLine();
  const link = line?.querySelector('a') ?? null;
  return {
    locked: line !== null,
    reason: line ? (line.textContent ?? '').replace(GOING_LOCK_LINK_LABEL, '').trim() : null,
    href: link?.getAttribute('href') ?? null,
    goingDisabled: going.disabled,
    interestedDisabled: interested.disabled,
  };
};

// A signed-in person's gate read goes through the lazily loaded client: wait for its answer to land.
const gateAsked = async () => {
  if (!h.user || h.user.is_anonymous) return;
  await waitFor(() => expect(h.rpc.mock.calls.some(([n]) => n === 'dancer_area_gate_v1')).toBe(true));
  await act(async () => {
    await new Promise((r) => setTimeout(r, 30));
  });
};

const welcomeFor = (path: string) => `/app/welcome?returnTo=${encodeURIComponent(path)}`;

beforeEach(() => {
  installJsdomPolyfills();
  localStorage.clear();
  h.user = null;
  h.gate = 'closed';
  h.myStatus = null;
  h.statusFails = false;
  h.festivals = 1;
  h.rpc.mockReset().mockImplementation(async (name: string, args: { p_status?: string | null }) => {
    if (name === 'get_my_occurrence_attendance_p5_v1' && h.statusFails) {
      return { data: null, error: { code: '57014', message: 'canceling statement' } };
    }
    if (name === 'dancer_area_gate_v1') {
      if (h.gate === 'loading') return new Promise(() => {});
      if (h.gate === 'error') return { data: null, error: { message: 'boom' } };
      return { data: { open: false, allowed: h.gate === 'allowed' }, error: null };
    }
    if (name === 'get_my_occurrence_attendance_p5_v1') return { data: h.myStatus, error: null };
    if (name === 'set_my_occurrence_attendance_p5_v1') {
      h.myStatus = args.p_status ?? null;
      return { data: { event_id: PUBLIC_ID, occurrence_id: OCC, status: h.myStatus, updated_at: null }, error: null };
    }
    if (name === 'get_event_attendance_counts') return { data: [{ event_id: 'fest-1', interested_count: 3, going_count: 5 }], error: null };
    if (name === 'get_my_event_attendance_v1') return { data: h.myStatus ? [{ event_id: 'fest-1', status: h.myStatus, updated_at: null }] : [], error: null };
    if (name === 'set_attendance') return { data: null, error: null };
    return { data: [], error: null };
  });
});
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe('useGoingLock: one mapping, both surfaces', () => {
  for (const [surfaceName, surface] of Object.entries(SURFACES)) {
    it.each(ROWS)(`${surfaceName}: %s`, async (row) => {
      h.user = row.user;
      h.gate = row.gate;
      surface.mount(row);
      await surface.settled();
      await gateAsked();
      const seen = observe(surface);
      if (row.expected.locked) {
        expect(seen).toEqual({
          locked: true,
          reason: `${row.expected.reason}.`,
          href: welcomeFor(surface.path),
          goingDisabled: true,
          interestedDisabled: true,
        });
      } else {
        expect(seen).toEqual({ locked: false, reason: null, href: null, goingDisabled: false, interestedDisabled: false });
      }
    });
  }

  it.each(ROWS)('the hook mapping agrees with what both surfaces show: %s', (row) => {
    const lock = goingLockFor({
      signedIn: Boolean(row.user && !row.user.is_anonymous),
      organiser: row.user === ORGANISER,
      area: row.gate === 'allowed' ? { status: 'ready', open: false, allowed: true } : row.gate === 'closed' ? { status: 'ready', open: false, allowed: false } : { status: row.gate, open: false, allowed: false },
      gate: gateValue(row.profile),
      returnTo: EVENT_PATH,
    });
    expect(lock).toEqual(row.expected.locked ? { locked: true, reason: row.expected.reason, href: welcomeFor(EVENT_PATH) } : GOING_UNLOCKED);
  });
});

describe('a locked person keeps their old RSVP', () => {
  const LOCKED_ROW = ROWS.find((r) => r.name === 'allowed, missing photo only')!;
  for (const [surfaceName, surface] of Object.entries(SURFACES)) {
    it(`${surfaceName}: an old Going still shows and can be removed; Interested stays locked`, async () => {
      h.user = LOCKED_ROW.user;
      h.gate = 'allowed';
      h.myStatus = 'going';
      surface.mount(LOCKED_ROW);
      await surface.settled();
      await gateAsked();
      const seen = observe(surface);
      expect(seen.locked).toBe(true);
      expect(seen.goingDisabled).toBe(false);
      expect(seen.interestedDisabled).toBe(true);
      const [going, interested] = surface.buttons();
      fireEvent.click(interested);
      fireEvent.click(going);
      await waitFor(() => expect(surface.setCalls()).toEqual([null]));
    });
  }
});

describe('the lock never points at something that is not there', () => {
  it('the link target is a real route of the dancer area and of the catchall table', () => {
    expect(DANCER_APP_PATHS).toContain('/app/welcome');
    expect(CATCHALL_CLIENT_PATHS).toContain('/app/welcome');
  });

  it('the locked event block shows the link it names, and the going count stays beside it (F10)', async () => {
    h.user = DANCER;
    h.gate = 'allowed';
    SURFACES['event page block'].mount(ROWS.find((r) => r.name === 'allowed, missing photo only')!);
    await SURFACES['event page block'].settled();
    await gateAsked();
    const link = screen.getByRole('link', { name: GOING_LOCK_LINK_LABEL });
    expect(link.getAttribute('href')).toBe(welcomeFor(EVENT_PATH));
    expect(screen.getByTestId('rsvp-meta').textContent).toContain('4 going');
    expect(screen.getByTestId('rsvp-meta').textContent).toContain("Add your photo to say you're going or interested.");
  });

  it('every missing-field list the gate can carry is read back exactly (no lost step)', () => {
    const lists = Array.from({ length: 15 }, (_, i) => PROFILE_FIELDS.filter((_, bit) => ((i + 1) >> bit) & 1));
    for (const missing of lists) expect(missingFromGate(profileGateValue(incomplete(missing)))).toEqual(missing);
  });

  // F11: the fields come from the gate's data. Rewording the rating card must not lose them.
  it.each([
    ['photo', ['avatar_url']],
    ['city and role', ['based_city_id', 'dance_role']],
    ['everything', [...PROFILE_FIELDS]],
  ] as [string, ProfileField[]][])('missing %s is read from the gate data, whatever the rating copy says', (_n, missing) => {
    const real = profileGateValue(incomplete(missing));
    const reworded: ProfileGateValue = { ...real, gateFor: (r: string) => ({ ...real.gateFor(r), reason: 'Reworded rating card copy' }) };
    expect(missingFromGate(reworded)).toEqual(missing);
  });
});

describe('F9: a locked person whose RSVP read failed can still reach the retry', () => {
  it.each([
    ['going', 'rsvp-going'],
    ['interested', 'rsvp-interested'],
  ])('event page block: %s stays tappable and a tap re-reads the status', async (_n, testId) => {
    h.user = DANCER;
    h.gate = 'allowed';
    h.statusFails = true;
    SURFACES['event page block'].mount(ROWS.find((r) => r.name === 'allowed, missing photo only')!);
    await SURFACES['event page block'].settled();
    await gateAsked();
    const button = screen.getByTestId(testId) as HTMLButtonElement;
    expect(button.disabled).toBe(false);
    const reads = () => h.rpc.mock.calls.filter(([n]) => n === 'get_my_occurrence_attendance_p5_v1').length;
    const before = reads();
    fireEvent.click(button);
    await act(async () => {});
    expect(vi.mocked(toast.error)).toHaveBeenCalledWith("Couldn't load your RSVP. Please try again.");
    await waitFor(() => expect(reads()).toBe(before + 1));
    expect(SURFACES['event page block'].setCalls()).toEqual([]);
  });
});

describe('F10: the festival hub shows the lock once, and a locked tap stays put', () => {
  const LOCKED_ROW = ROWS.find((r) => r.name === 'allowed, missing photo only')!;

  it.each([1, 2])('%i festival card(s): one lock line, above the first card', async (n) => {
    h.user = DANCER;
    h.gate = 'allowed';
    h.festivals = n;
    SURFACES['festival hub'].mount(LOCKED_ROW);
    await SURFACES['festival hub'].settled();
    await gateAsked();
    const lines = screen.getAllByTestId('festival-going-lock');
    expect(lines).toHaveLength(1);
    const firstCard = screen.getByText('Costa Bachata Congress');
    expect(lines[0].compareDocumentPosition(firstCard) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it.each(['going', 'interested'])(
    'a tap on the locked %s button (disabled, so the tap lands on what is under it) does not open the festival',
    async (which) => {
      h.user = DANCER;
      h.gate = 'allowed';
      SURFACES['festival hub'].mount(LOCKED_ROW);
      await SURFACES['festival hub'].settled();
      await gateAsked();
      const [going, interested] = SURFACES['festival hub'].buttons();
      const button = which === 'going' ? going : interested;
      expect(button.disabled).toBe(true);
      // The Button has disabled:pointer-events-none, so a real tap hits the element under it.
      fireEvent.click(button.parentElement!);
      await act(async () => {});
      expect(screen.getByTestId('where').textContent).toBe(FESTIVALS_PATH);
    },
  );
});

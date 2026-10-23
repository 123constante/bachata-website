// @vitest-environment jsdom
/**
 * People arc S3: /djs/:id over every prod DJ shape (survey 2026-10-23, 40 DJs: 23 with no upcoming
 * gig, 10 with one, 7 with 2+; 11 with past gigs; 28 with no DJ name, 5 with a "DJ " prefix; 5 with
 * no photo; 5 with no city; 2 with no name at all; longest name 20). Flag ON = PersonFrame + the DJ
 * world; flag OFF = today's page, unchanged (its own head, share and guestbook).
 */
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { installJsdomPolyfills } from '../../../tests/client/jsdomPolyfills';
import type { PersonRole } from '@/modules/person-page/personRoles';

type Appearance = { event_id: string; event_name: string; event_start_time: string | null; event_location: string | null };
const h = vi.hoisted(() => ({
  rpc: vi.fn(),
  flags: { personWorlds: true, personHub: false } as Record<string, boolean>,
  app: { data: [] as Appearance[], isFetched: true, isError: false, refetch: vi.fn() },
  roles: { snapshot: null as { roles: PersonRole[] } | null, answered: true },
}));
vi.mock('@/integrations/supabase/client', () => ({ supabase: { rpc: (fn: string, args: unknown) => h.rpc(fn, args) } }));
vi.mock('@/lib/featureFlags', () => ({ flags: new Proxy({}, { get: (_t, k: string) => h.flags[k] ?? false }) }));
vi.mock('@/lib/seo', async (orig) => ({
  ...(await orig<typeof import('@/lib/seo')>()),
  useEntitySlugOrId: () => ({ id: 'dj1', slug: 'papacito', arrivedViaUuid: false, notFound: false }),
  useCanonicalReplaceState: () => undefined,
}));
vi.mock('@/hooks/useProfileProgramAppearances', () => ({ useProfileProgramAppearances: () => h.app }));
vi.mock('@/modules/person-page/AlsoRoles', () => ({ AlsoRoles: () => null }));
vi.mock('@/modules/person-page/usePersonRoles', () => ({ usePersonSnapshot: () => h.roles, usePersonRoles: () => h.roles.snapshot?.roles ?? [] }));

import DJProfile from '../DJProfile';
import { londonTodayKey, addDaysToKey } from '@/lib/londonDate';

const today = londonTodayKey();
const at = (days: number, clock = '22:00:00') => `${addDaysToKey(today, days)} ${clock}+00`;
const gig = (n: number, days: number, clock?: string): Appearance => ({ event_id: `e${n}`, event_name: `Party ${n}`, event_start_time: at(days, clock), event_location: 'BPM Dance Studios' });

const ROW = {
  id: 'dj1', display_name: null, dj_name: null, first_name: null, surname: null, photo_url: null, cover_url: null,
  bio: null, genres: null, nationality: null, nationality_code: null, city_id: null, city_name: null, city_slug: null,
  person_entity_id: null, instagram: null, facebook: null, website: null, soundcloud: null, mixcloud: null,
  pricing: null, faq: [], gallery_urls: null, languages: null, achievements: null, upcoming_events: [],
};

type Shape = {
  who: string;
  row: Partial<typeof ROW> & Record<string, unknown>;
  gigs: Appearance[];
  roles: PersonRole[];
  big: string;
  small: string | null;
  count: string | null;
  upcoming: number;
  played: number;
  empty: boolean;
  invite: boolean;
  tabs: boolean;
};

const SHAPES: Shape[] = [
  { who: 'thin: no DJ name, no photo, no city, no gigs, DJ only', row: { first_name: 'Bobby', surname: 'Blanco' }, gigs: [], roles: ['dj'],
    big: 'Bobby Blanco', small: null, count: null, upcoming: 0, played: 0, empty: true, invite: true, tabs: false },
  { who: 'no name at all', row: {}, gigs: [], roles: [], big: 'DJ', small: null, count: null, upcoming: 0, played: 0, empty: true, invite: true, tabs: false },
  { who: 'one upcoming, "DJ " prefix, photo, city', row: { dj_name: 'DJ  Nadia', first_name: 'Nadia', surname: 'Ruiz', photo_url: ['https://x/p.jpg'], city_name: 'London SE1 7PB' },
    gigs: [gig(1, 3)], roles: ['dj'], big: 'Nadia', small: 'Nadia Ruiz', count: null, upcoming: 1, played: 0, empty: false, invite: true, tabs: false },
  { who: 'Papacito: DJ name differs, 2 upcoming + past, DJ + dancer', row: { dj_name: 'Morcilla', first_name: 'Papacito', city_name: 'London', nationality_code: 'za', instagram: 'dj_morcilla' },
    gigs: [gig(1, 0), gig(2, 69, '21:30:00'), gig(3, -20), gig(4, -50)], roles: ['dj', 'dancer'], big: 'Morcilla', small: 'Papacito', count: '2 gigs coming up', upcoming: 2, played: 2, empty: false, invite: false, tabs: true },
  { who: 'past only (played at), DJ + teacher', row: { first_name: 'Nick', surname: 'Chata' }, gigs: [gig(1, -3), gig(2, -40), gig(3, -90)], roles: ['dj', 'teacher'],
    big: 'Nick Chata', small: null, count: null, upcoming: 0, played: 3, empty: false, invite: true, tabs: true },
  { who: 'long name (20), DJ name equal to the public name', row: { dj_name: 'Alessandro Bellomont', first_name: 'Alessandro', surname: 'Bellomont' },
    gigs: [gig(1, 1), gig(2, 2), gig(3, 3), gig(4, 4)], roles: ['dj', 'dancer', 'teacher'], big: 'Alessandro Bellomont', small: null, count: '4 gigs coming up', upcoming: 4, played: 0, empty: false, invite: false, tabs: true },
];

const mount = (path = '/djs/papacito') =>
  render(
    <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
      <MemoryRouter initialEntries={[path]}>
        <Routes>
          <Route path="/djs/:id" element={<DJProfile />} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );

beforeEach(() => {
  installJsdomPolyfills();
  h.rpc.mockReset();
  h.flags.personWorlds = true;
  h.app = { data: [], isFetched: true, isError: false, refetch: vi.fn() };
  h.roles = { snapshot: null, answered: true };
});
afterEach(cleanup);

describe.each(SHAPES)('DJ world (flag ON): $who', (s) => {
  beforeEach(() => {
    h.rpc.mockResolvedValue({ data: { ...ROW, ...s.row }, error: null });
    h.app.data = s.gigs;
    h.roles = { snapshot: { roles: s.roles }, answered: true };
  });

  it('renders the frame and the sleeve with the one name rule and a count only from 2', async () => {
    mount();
    const frame = await screen.findByTestId('person-frame');
    expect(within(frame).getByTestId('frame-back').getAttribute('href')).toBe('/djs');
    expect(within(frame).getByTestId('frame-share')).toBeTruthy();
    expect(screen.getByTestId('dj-name').textContent).toBe(s.big);
    expect(screen.getByTestId('dj-name').textContent).not.toMatch(/^DJ\s+\S/);
    expect(screen.queryByTestId('dj-real-name')?.textContent ?? null).toBe(s.small);
    expect(screen.queryByTestId('dj-count')?.textContent ?? null).toBe(s.count);
    expect(!!screen.queryByTestId('role-tabs')).toBe(s.tabs);
    // Today's page parts are gone: no old head, no bottom share, no guestbook.
    expect(screen.queryByTestId('dj-head')).toBeNull();
    expect(screen.queryByTestId('dj-share')).toBeNull();
    expect(document.body.textContent).not.toMatch(/guestbook|coming soon/i);
  });

  it('shows Upcoming, Played at, the empty action and the invite only when they apply', async () => {
    mount();
    await screen.findByTestId('dj-world');
    expect(screen.queryAllByTestId('dj-gig')).toHaveLength(s.upcoming);
    expect(screen.queryAllByTestId('dj-record')).toHaveLength(s.played);
    expect(!!screen.queryByTestId('dj-upcoming')).toBe(s.upcoming > 0);
    expect(!!screen.queryByTestId('dj-played')).toBe(s.played > 0);
    expect(screen.queryByTestId('dj-empty-action')?.getAttribute('href') ?? null).toBe(s.empty ? '/parties' : null);
    const invite = screen.queryByTestId('dj-invite');
    expect(!!invite).toBe(s.invite);
    if (invite) {
      expect(invite.textContent).toBe('Dance bachata too? Get your own card');
      expect(invite.getAttribute('href')).toBe('/auth?mode=signup&returnTo=%2Fdjs%2Fpapacito');
      expect(invite.style.minHeight).toBe('44px');
    }
    for (const row of screen.queryAllByTestId('dj-gig')) expect(row.getAttribute('href')).toMatch(/^\/event\/e\d$/);
  });
});

describe('DJ world (flag ON): dates and facts', () => {
  beforeEach(() => {
    h.rpc.mockResolvedValue({ data: { ...ROW, dj_name: 'Morcilla', first_name: 'Papacito' }, error: null });
  });

  it('a gig row reads the stored wall clock: full weekday, time as stored, the next gig first', async () => {
    h.app.data = [gig(2, 69, '23:30:00'), gig(1, 0, '22:00:00')];
    mount();
    const rows = await screen.findAllByTestId('dj-gig');
    expect(rows[0].getAttribute('href')).toBe('/event/e1');
    expect(rows[0].textContent).toMatch(/(Monday|Tuesday|Wednesday|Thursday|Friday|Saturday|Sunday) \d{1,2} [A-Z][a-z]+ \u00b7 22:00/);
    // 23:30 stays on its own day (a zone conversion would move it to the next one in BST).
    const day = Number(addDaysToKey(today, 69).slice(8));
    expect(rows[1].textContent).toContain(`${day}`);
    expect(rows[1].textContent).toMatch(/23:30/);
  });

  it('a played-at record carries "Month Year"', async () => {
    h.app.data = [{ event_id: 'p1', event_name: 'Sensual Vibes', event_start_time: '2026-09-12 22:00:00+00', event_location: null }];
    mount();
    const rec = await screen.findByTestId('dj-record');
    expect(rec.textContent).toBe('September 2026Sensual Vibes');
  });

  it('dates loading: a placeholder, no empty action yet', async () => {
    h.app = { data: [], isFetched: false, isError: false, refetch: vi.fn() };
    mount();
    await screen.findByTestId('dj-dates-loading');
    expect(screen.queryByTestId('dj-empty-action')).toBeNull();
  });

  it('dates failed: says so and Try again refetches', async () => {
    const refetch = vi.fn();
    h.app = { data: [], isFetched: true, isError: true, refetch };
    mount();
    const box = await screen.findByTestId('dj-dates-failed');
    fireEvent.click(within(box).getByRole('button', { name: 'Try again' }));
    expect(refetch).toHaveBeenCalledTimes(1);
    expect(screen.queryByTestId('dj-empty-action')).toBeNull();
  });

  it('the invite waits for the roles read', async () => {
    h.roles = { snapshot: null, answered: false };
    mount();
    await screen.findByTestId('dj-world');
    expect(screen.queryByTestId('dj-invite')).toBeNull();
  });

  it('the booking row opens the first link and names the DJ', async () => {
    h.rpc.mockResolvedValue({ data: { ...ROW, dj_name: 'Morcilla', instagram: '@dj_morcilla' }, error: null });
    mount();
    const book = await screen.findByTestId('dj-book');
    expect(book.getAttribute('href')).toBe('https://instagram.com/dj_morcilla');
    expect(book.textContent).toBe('Book Morcillainstagram.com/dj_morcilla');
  });
});

// S3 critique: nothing moves when a late read answers (measured in Chromium: the tabs pushed the
// world down 58 px on 36 of 40 DJs, and the booking row jumped when the dates came in).
describe('DJ world (flag ON): no jump when the late reads answer', () => {
  beforeEach(() => {
    h.rpc.mockResolvedValue({ data: { ...ROW, dj_name: 'Morcilla', instagram: 'dj_morcilla' }, error: null });
  });

  it.each([
    { state: 'roles read pending', roles: { snapshot: null, answered: false }, slot: true, tabs: false },
    { state: 'answered, DJ + dancer', roles: { snapshot: { roles: ['dj', 'dancer'] as PersonRole[] }, answered: true }, slot: false, tabs: true },
    { state: 'answered, DJ only', roles: { snapshot: { roles: ['dj'] as PersonRole[] }, answered: true }, slot: false, tabs: false },
    { state: 'answered, read failed', roles: { snapshot: null, answered: true }, slot: false, tabs: false },
  ])('tabs row: $state', async ({ roles, slot, tabs }) => {
    h.roles = roles;
    mount();
    await screen.findByTestId('dj-world');
    expect(!!screen.queryByTestId('role-tabs-pending')).toBe(slot);
    expect(!!screen.queryByTestId('role-tabs')).toBe(tabs);
  });

  it.each([
    { dates: 'loading', isFetched: false, isError: false, book: false },
    { dates: 'ready', isFetched: true, isError: false, book: true },
    { dates: 'failed', isFetched: true, isError: true, book: true },
  ])('booking row while the dates are $dates', async ({ isFetched, isError, book }) => {
    h.app = { data: [], isFetched, isError, refetch: vi.fn() };
    mount();
    await screen.findByTestId('dj-world');
    expect(!!screen.queryByTestId('dj-book')).toBe(book);
  });
});

describe('flag OFF: today\'s page, unchanged', () => {
  it.each(SHAPES)('$who', async (s) => {
    h.flags.personWorlds = false;
    h.rpc.mockResolvedValue({ data: { ...ROW, ...s.row, faq: null }, error: null });
    h.app.data = s.gigs;
    mount();
    await screen.findByTestId('dj-head');
    expect(screen.getByTestId('dj-back').getAttribute('href')).toBe('/djs');
    expect(screen.getByTestId('dj-share')).toBeTruthy();
    expect(screen.queryByTestId('person-frame')).toBeNull();
    expect(screen.queryByTestId('dj-world')).toBeNull();
  });
});

describe('linkText', () => {
  it.each([
    ['https://www.instagram.com/dj_morcilla/?hl=en', 'instagram.com/dj_morcilla'],
    ['https://soundcloud.com/x#top', 'soundcloud.com/x'],
    ['http://example.com/', 'example.com'],
  ])('%s', async (href, out) => {
    const { linkText } = await import('@/modules/person-page/worlds/dj');
    expect(linkText(href)).toBe(out);
  });
});

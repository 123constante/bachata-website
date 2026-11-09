// @vitest-environment jsdom
/**
 * Organiser area v2 slice 1b: the sign-in chooser, rendered. Person types (the brief's P-numbers)
 * x flag on / off. P2, P4, P12 and P14 are SEEDED fixtures (not prod accounts). Also X1: the area's
 * one Account / Help / Sign out block in the settings sheet.
 */
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { LIVE_TONIGHT, profileSides, type SidesFacts } from '@/lib/accountRouting';

const world = vi.hoisted(() => ({
  facts: null as unknown as SidesFacts,
  home: { today: '2026-11-09', organisers: [] as unknown[] },
  roles: [] as Array<{ role: string; active: boolean; complete: boolean }>,
}));
vi.mock('../useProfileSides', () => ({
  useProfileSides: () => ({ facts: world.facts, state: profileSides(world.facts), openRequestCount: 0 }),
}));
vi.mock('@/hooks/useAuth', () => ({ useAuth: () => ({ user: { id: 'me' }, signOut: async () => 'signed-out' }) }));
vi.mock('@/modules/organiser/shared/selfServeApi', async (orig) => ({
  ...(await orig<object>()),
  organiserHomeQueryKey: (id: unknown) => ['org-home', id],
  fetchOrganiserHome: async () => world.home,
}));
vi.mock('@/modules/areas/home/rolesApi', async (orig) => ({
  ...(await orig<object>()),
  myRolesQueryKey: ['my-roles'],
  fetchMyRoles: async () => world.roles,
}));
vi.mock('@/components/account/profiles/signOutToHome', () => ({
  SIGN_OUT_FAILED: 'Could not sign you out.',
  useSignOutToHome: () => ({ signOutToHome: async () => 'signed-out', busy: false }),
}));

import { ContinueAsScreen } from '../ContinueAsPage';
import { SettingsBody, X1_COPY } from '@/modules/organiser/p3/onboarding/SettingsSheet';

afterEach(cleanup);

const TODAY = '2026-11-09';
const A = { id: 'org-a', name: 'Bachata Nights', avatar_url: null };
const B = { id: 'org-b', name: 'Sensual Sundays', avatar_url: null };
const facts = (organisers: SidesFacts['organisers'], dancer: SidesFacts['dancer'] = 'complete'): SidesFacts => ({
  organisers, dancer, areaAllowed: true, dancerFace: { firstName: 'Ana', avatarUrl: null }, organiserHomeTo: '/account/p3', openRequestCount: 0, isAdmin: false,
});
const liveSeries = { lifecycle_status: 'live', next_dates: [{ occurrence_date: TODAY, lifecycle_status: 'scheduled' }] };
const page = (o: typeof A, live: boolean) => ({ ...o, series: live ? [liveSeries] : [] });
const role = (r: string) => ({ role: r, active: true, complete: true });

const Here = () => <p data-testid="landed">{useLocation().pathname + useLocation().search}</p>;
const mount = (p3Live: boolean) =>
  render(
    <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
      <MemoryRouter initialEntries={['/account/continue']}>
        <Routes>
          <Route path="/account/continue" element={<ContinueAsScreen p3Live={p3Live} />} />
          <Route path="*" element={<Here />} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );

type Cell = {
  name: string;
  f: SidesFacts;
  pages: Array<[typeof A, boolean]>;
  roles: string[];
  /** chooser entries (data-testid suffixes) in order, or the path it lands on. */
  expect: { entries: string[]; liveMarks: number } | { landed: string };
};

const ON: Cell[] = [
  { name: 'P1 one page, no event today: straight in', f: facts([A], 'no_profile'), pages: [[A, false]], roles: [], expect: { landed: '/account/p3' } },
  { name: 'P7 caught-up organiser, one page, live today: lands on the page', f: facts([A], 'no_profile'), pages: [[A, true]], roles: [], expect: { landed: '/account/p3' } },
  { name: 'P2 two pages (seeded), no event today: chooser, no mark', f: facts([A, B]), pages: [[A, false], [B, false]], roles: [], expect: { entries: ['organiser:org-a', 'organiser:org-b', 'dancer'], liveMarks: 0 } },
  { name: 'P2 two pages (seeded), live today on one: lands on that page', f: facts([A, B]), pages: [[A, false], [B, true]], roles: [], expect: { landed: '/account/p3?o=org-b' } },
  { name: 'P2 two live pages today (seeded): chooser, Live tonight on both', f: facts([A, B]), pages: [[A, true], [B, true]], roles: [], expect: { entries: ['organiser:org-a', 'organiser:org-b', 'dancer'], liveMarks: 2 } },
  { name: 'P4 manager of two pages (seeded), live today on one: lands there', f: facts([A, B]), pages: [[A, true], [B, false]], roles: [], expect: { landed: '/account/p3?o=org-a' } },
  { name: 'P3 organiser + teacher + DJ + dancer: all four kinds', f: facts([A]), pages: [[A, false]], roles: ['teacher', 'dj', 'dancer', 'organiser'], expect: { entries: ['organiser:org-a', 'dancer', 'teacher', 'dj'], liveMarks: 0 } },
  { name: 'P14 teacher + DJ + dancer, no organiser page (seeded)', f: facts([]), pages: [], roles: ['teacher', 'dj', 'dancer'], expect: { entries: ['dancer', 'teacher', 'dj'], liveMarks: 0 } },
  { name: 'P5 claim pending: no organiser entry, the dancer page only = straight in', f: facts([]), pages: [], roles: ['dancer'], expect: { landed: '/app/home' } },
  { name: 'P6 unfinished dancer + organiser: the dancer area still listed', f: facts([A], 'incomplete'), pages: [[A, false]], roles: [], expect: { entries: ['organiser:org-a', 'dancer'], liveMarks: 0 } },
  { name: 'P12 interim seat (0 seats, seeded): nothing new appears', f: facts([]), pages: [], roles: [], expect: { landed: '/app/home' } },
];

describe('chooser, P3 live: person types x journeys', () => {
  it.each(ON.map((c) => [c.name, c] as const))('%s', async (_n, c) => {
    world.facts = c.f;
    world.home = { today: TODAY, organisers: c.pages.map(([o, live]) => page(o, live)) };
    world.roles = c.roles.map(role);
    mount(true);
    if ('landed' in c.expect) {
      expect((await screen.findByTestId('landed')).textContent).toBe(c.expect.landed);
      return;
    }
    const list = await screen.findByTestId('continue-as');
    await waitFor(() => expect(list.querySelectorAll('a').length).toBe(c.expect && 'entries' in c.expect ? c.expect.entries.length : 0));
    const ids = Array.from(list.querySelectorAll('a')).map((a) => a.getAttribute('data-testid')?.replace('continue-as-', ''));
    expect(ids).toEqual(c.expect.entries);
    expect(screen.queryAllByTestId('continue-as-live-tonight').map((m) => m.textContent)).toEqual(Array(c.expect.liveMarks).fill(LIVE_TONIGHT));
    // Every entry is a 44px+ tap target and opens its own area.
    for (const a of Array.from(list.querySelectorAll('a'))) expect(a.className).toMatch(/min-h-\[72px\]/);
    if (ids.includes('teacher')) expect(screen.getByTestId('continue-as-teacher').getAttribute('href')).toBe('/account/t');
    if (ids.includes('dj')) expect(screen.getByTestId('continue-as-dj').getAttribute('href')).toBe('/account/dj');
  });

  it('a second sign-in the same day shows the chooser again (A5)', async () => {
    world.facts = facts([A, B]);
    world.home = { today: TODAY, organisers: [page(A, false), page(B, false)] };
    world.roles = [];
    mount(true);
    expect(await screen.findByTestId('continue-as')).toBeTruthy();
    cleanup();
    mount(true);
    expect(await screen.findByTestId('continue-as')).toBeTruthy();
  });

  it('a live event on a page the person does not hold puts no mark anywhere', async () => {
    world.facts = facts([A, B]);
    world.home = { today: TODAY, organisers: [page(A, false), page(B, false), page({ id: 'org-zz', name: 'Not mine', avatar_url: null }, true)] };
    world.roles = [];
    mount(true);
    await screen.findByTestId('continue-as');
    expect(screen.queryAllByTestId('continue-as-live-tonight')).toHaveLength(0);
  });
});

describe('chooser, flag off (A8): today’s landing, no new elements', () => {
  const OFF: Array<[string, SidesFacts, Array<[typeof A, boolean]>, string[], string[] | string]> = [
    ['one page, live today: straight in as today', facts([A], 'no_profile'), [[A, true]], ['teacher'], '/account/p3'],
    ['two pages, live today on one: the chooser as today, no mark', facts([A, B]), [[A, true], [B, false]], ['teacher', 'dj'], ['organiser:org-a', 'organiser:org-b', 'dancer']],
    ['organiser + teacher + DJ: no teacher or DJ entry', facts([A]), [[A, false]], ['teacher', 'dj'], ['organiser:org-a', 'dancer']],
  ];
  it.each(OFF)('%s', async (_n, f, pages, roles, want) => {
    world.facts = f;
    world.home = { today: TODAY, organisers: pages.map(([o, live]) => page(o, live)) };
    world.roles = roles.map(role);
    mount(false);
    if (typeof want === 'string') {
      expect((await screen.findByTestId('landed')).textContent).toBe(want);
      return;
    }
    const list = await screen.findByTestId('continue-as');
    expect(Array.from(list.querySelectorAll('a')).map((a) => a.getAttribute('data-testid')?.replace('continue-as-', ''))).toEqual(want);
    expect(screen.queryByTestId('continue-as-live-tonight')).toBeNull();
    expect(screen.queryByTestId('continue-as-teacher')).toBeNull();
  });
});

describe('X1: Account, Help and Sign out in one place', () => {
  it('the settings sheet carries all three, each a 44px target, the account link to /account/settings', () => {
    render(
      <MemoryRouter>
        <SettingsBody theme="light" setTheme={() => undefined} organiserId="org-a" pageName="Bachata Nights" rename={async () => undefined} onRenamed={() => undefined} />
      </MemoryRouter>,
    );
    const block = screen.getByTestId('p3-ob-account-block');
    expect(block.textContent).toContain(X1_COPY.heading);
    expect(screen.getByTestId('p3-ob-account').getAttribute('href')).toBe('/account/settings');
    expect(screen.getByTestId('p3-ob-help').getAttribute('href')).toMatch(/^mailto:/);
    expect(block.contains(screen.getByTestId('p3-ob-signout'))).toBe(true);
    for (const id of ['p3-ob-account', 'p3-ob-help']) expect((screen.getByTestId(id) as HTMLElement).style.minHeight).toBe('44px');
  });
});

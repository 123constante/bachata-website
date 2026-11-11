// @vitest-environment jsdom
/**
 * Organiser area v2 slice 1b: the sign-in chooser, rendered. Person types (the brief's P-numbers)
 * x flag on / off. P2, P4 and P14 are SEEDED fixtures (not prod accounts). Also X1: the area's
 * one Account / Help / Sign out block in the settings sheet.
 * P12 (interim seat) is not a cell: no interim or helper seat exists (entity_members.member_role =
 * owner | manager | contributor | ambassador, prod 2026-11-09), so a P12 person IS the dancer-only
 * person, already covered. Fix round, PR #1511 review.
 */
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { LIVE_TONIGHT, profileSides, type SidesFacts } from '@/lib/accountRouting';
import { P3_START_PATH, continueAsLanding } from '@/lib/auth-otp-routing';

const world = vi.hoisted(() => ({
  facts: null as unknown as SidesFacts,
  home: { today: '2026-11-09', organisers: [] as unknown[] },
  roles: [] as Array<{ role: string; active: boolean; complete: boolean }>,
  /** Set to replace the roles read (the retry cells). */
  rolesFn: null as null | (() => Promise<unknown>),
}));
vi.mock('../useProfileSides', () => ({
  useProfileSides: () => ({ facts: world.facts, state: profileSides(world.facts), openRequestCount: world.facts.openRequestCount }),
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
  fetchMyRoles: async () => (world.rolesFn ? world.rolesFn() : world.roles),
}));
vi.mock('@/components/account/profiles/signOutToHome', () => ({
  SIGN_OUT_FAILED: 'Could not sign you out.',
  useSignOutToHome: () => ({ signOutToHome: async () => 'signed-out', busy: false }),
}));

import { ContinueAsScreen } from '../ContinueAsPage';
import { SettingsBody, X1_COPY } from '@/modules/organiser/p3/onboarding/SettingsSheet';

afterEach(() => { cleanup(); world.rolesFn = null; vi.restoreAllMocks(); });

const TODAY = '2026-11-09';
const A = { id: 'org-a', name: 'Bachata Nights', avatar_url: null };
const B = { id: 'org-b', name: 'Sensual Sundays', avatar_url: null };
const facts = (organisers: SidesFacts['organisers'], dancer: SidesFacts['dancer'] = 'complete'): SidesFacts => ({
  organisers, dancer, areaAllowed: true, dancerFace: { firstName: 'Ana', avatarUrl: null }, organiserHomeTo: '/account/p3', openRequestCount: 0, isAdmin: false,
});
const liveSeries = { lifecycle_status: 'live', next_dates: [{ occurrence_date: TODAY, lifecycle_status: 'scheduled' }] };
const page = (o: typeof A, live: boolean, role: 'owner' | 'manager' = 'owner') => ({ ...o, role, series: live ? [liveSeries] : [] });
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
  pages: Array<[typeof A, boolean] | [typeof A, boolean, 'owner' | 'manager']>;
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
  { name: 'P4 manager of two pages (seeded, role: manager rows), live today on one: lands there', f: facts([A, B]), pages: [[A, true, 'manager'], [B, false, 'manager']], roles: [], expect: { landed: '/account/p3?o=org-a' } },
  { name: 'P3 organiser + teacher + DJ + dancer: all four kinds', f: facts([A]), pages: [[A, false]], roles: ['teacher', 'dj', 'dancer', 'organiser'], expect: { entries: ['organiser:org-a', 'dancer', 'teacher', 'dj'], liveMarks: 0 } },
  { name: 'P14 teacher + DJ + dancer, no organiser page (seeded)', f: facts([]), pages: [], roles: ['teacher', 'dj', 'dancer'], expect: { entries: ['dancer', 'teacher', 'dj'], liveMarks: 0 } },
  { name: 'P5 claim pending (open request, no page): lands on P3 Welcome', f: { ...facts([]), openRequestCount: 1 }, pages: [], roles: ['dancer'], expect: { landed: P3_START_PATH } },
  { name: 'dancer only, no open request: the dancer app', f: facts([]), pages: [], roles: ['dancer'], expect: { landed: '/app/home' } },
  { name: 'P6 unfinished dancer + organiser: the dancer area still listed', f: facts([A], 'incomplete'), pages: [[A, false]], roles: [], expect: { entries: ['organiser:org-a', 'dancer'], liveMarks: 0 } },
];

describe('chooser, P3 live: person types x journeys', () => {
  it.each(ON.map((c) => [c.name, c] as const))('%s', async (_n, c) => {
    world.facts = c.f;
    world.home = { today: TODAY, organisers: c.pages.map(([o, live, r]) => page(o, live, r)) };
    world.roles = c.roles.map(role);
    mount(true);
    if ('landed' in c.expect) {
      // The screen and the ONE rule agree whenever the rule already decides without the extra reads.
      const base = continueAsLanding(c.f, true);
      if (base.kind === 'go' && c.f.organisers?.length === 0) expect(base.to).toBe(c.expect.landed);
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

  it('the chooser writes nothing to storage, so a later sign-in decides afresh (A5)', async () => {
    const set = vi.spyOn(Storage.prototype, 'setItem');
    world.facts = facts([A, B]);
    world.home = { today: TODAY, organisers: [page(A, false), page(B, false)] };
    world.roles = [];
    mount(true);
    expect(await screen.findByTestId('continue-as')).toBeTruthy();
    expect(set).not.toHaveBeenCalled();
  });

  it('roles read race: first read rejects (not_signed_in), the retry succeeds -> organiser + teacher, one page, sees the chooser', async () => {
    let calls = 0;
    world.rolesFn = async () => { calls += 1; if (calls === 1) throw new Error('not_signed_in'); return [role('teacher'), role('organiser')]; };
    world.facts = facts([A], 'no_profile');
    world.home = { today: TODAY, organisers: [page(A, false)] };
    mount(true);
    // Never a straight redirect while the read is retrying.
    expect(screen.queryByTestId('landed')).toBeNull();
    const list = await screen.findByTestId('continue-as', undefined, { timeout: 3000 });
    expect(calls).toBe(2);
    expect(Array.from(list.querySelectorAll('a')).map((a) => a.getAttribute('data-testid'))).toEqual(['continue-as-organiser:org-a', 'continue-as-teacher']);
    expect(screen.queryByTestId('landed')).toBeNull();
  });

  it('roles read fails twice: lands as today (never stranded)', async () => {
    world.rolesFn = async () => { throw new Error('not_signed_in'); };
    world.facts = facts([A], 'no_profile');
    world.home = { today: TODAY, organisers: [page(A, false)] };
    mount(true);
    expect((await screen.findByTestId('landed', undefined, { timeout: 3000 })).textContent).toBe('/account/p3');
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
    expect(screen.getByTestId('p3-ob-signout').textContent).toBe('Sign out');
    // Measured through the CLASS: the min-height its classes get from the stylesheet (last rule wins), plus any inline style.
    for (const id of ['p3-ob-account', 'p3-ob-help', 'p3-ob-signout']) expect(tapHeight(screen.getByTestId(id) as HTMLElement)).toBeGreaterThanOrEqual(44);
  });
});

/** The px min-height an element's classes resolve to in onboarding.css (top-level single-class rules, source order) or its inline style. */
const topLevelOnly = (css: string): string => {
  // Drop every at-rule block (@media, @keyframes ...) by brace depth: only the always-on rules count.
  let out = '';
  let depth = 0;
  let inAt = false;
  for (let i = 0; i < css.length; i++) {
    const c = css[i];
    if (depth === 0 && c === '@') inAt = true;
    if (c === '{') depth++;
    if (!inAt) out += c;
    if (c === '}') { depth--; if (depth === 0 && inAt) inAt = false; }
  }
  return out;
};
const OB_CSS = topLevelOnly(readFileSync(resolve(__dirname, '../../../../modules/organiser/p3/onboarding/onboarding.css'), 'utf8').replace(/\/\*[\s\S]*?\*\//g, ''));
function tapHeight(el: HTMLElement): number {
  let best: { at: number; px: number } | null = null;
  for (const cls of Array.from(el.classList)) {
    const re = new RegExp(`(^|\\})\\s*\\.${cls}\\s*\\{([^}]*)\\}`, 'g');
    for (let m = re.exec(OB_CSS); m; m = re.exec(OB_CSS)) {
      const h = /min-height:\s*(\d+)px/.exec(m[2]);
      if (h && (!best || m.index > best.at)) best = { at: m.index, px: Number(h[1]) };
    }
  }
  const inline = parseInt(el.style.minHeight || '0', 10);
  return Math.max(best?.px ?? 0, inline);
}
describe('tapHeight reads the stylesheet', () => {
  it('a 52px base button made small resolves to 44px; an unknown class to 0', () => {
    const b = document.createElement('button');
    b.className = 'p3-ob-btn p3-ob-btn-sm';
    expect(tapHeight(b)).toBe(44);
    b.className = 'p3-ob-btn';
    expect(tapHeight(b)).toBe(52);
    b.className = 'nope';
    expect(tapHeight(b)).toBe(0);
  });
});

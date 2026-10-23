// @vitest-environment jsdom
/**
 * W2-C DJ page (owner pick D-C, behind flags.personHub), table-driven: the name steps 36/30/26 and
 * wraps (never clipped), dates come first (max 3 + "See N more dates"), the no-dates card says what
 * the visitor can do (Instagram button ONLY with an Instagram link), and flag OFF keeps today's page.
 */
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { installJsdomPolyfills } from '../../../../tests/client/jsdomPolyfills';
import { flags } from '@/lib/featureFlags';
import type { DjGig } from '../DjTiles';
import { datesView, gigRows, gigWhen, kicker, listenLinks, nameSize, noDates, seeMoreLabel } from '../djRoleModel';

const h = vi.hoisted(() => ({ rpc: vi.fn(), gigs: [] as unknown[], fetched: true, failed: false }));
vi.mock('@/integrations/supabase/client', () => ({ supabase: { rpc: (fn: string, args: unknown) => h.rpc(fn, args) } }));
vi.mock('@/lib/seo', async (orig) => ({
  ...(await orig<typeof import('@/lib/seo')>()),
  useEntitySlugOrId: () => ({ id: 'dj1', slug: 'roger', arrivedViaUuid: false, notFound: false }),
  useCanonicalReplaceState: () => undefined,
}));
vi.mock('@/hooks/useProfileProgramAppearances', () => ({ useProfileProgramAppearances: () => ({ data: h.fetched && !h.failed ? h.gigs : undefined, isFetched: h.fetched, isError: h.failed }) }));
vi.mock('@/modules/person-page/AlsoRoles', () => ({ AlsoRoles: () => <div data-testid="also-stub" /> }));
vi.mock('@/modules/person-page/RoleSwitchBar', () => ({
  RoleSwitch: ({ current, fallback }: { current: string; fallback?: React.ReactNode }) => (
    <div data-testid="switch-stub" data-current={current}>{fallback}</div>
  ),
}));

import DJProfile from '@/pages/DJProfile';

const gig = (i: number, iso = `2099-10-${String(10 + i).padStart(2, '0')}T21:00:00`): DjGig => ({ eventId: `e${i}`, name: `Night ${i}`, startTime: iso, location: 'Camden' });

describe('name size steps by length, 36 / 30 / 26', () => {
  it.each([
    ['DJ Roger', 36],
    ['DJ Sixteen Chars', 36],
    ['DJ Seventeen Char', 30],
    ['DJ Carlos De La Cruz Fernand', 30],
    ['DJ Carlos De La Cruz Fernandez-Montenegro', 26],
  ])('%s -> %ipx', (name, px) => expect(nameSize(name)).toBe(px));
});

describe('kicker', () => {
  it.each([['London', 'DJ \u00b7 LONDON'], [null, 'DJ'], ['  ', 'DJ']])('%j -> %s', (c, want) => expect(kicker(c)).toBe(want));
});

describe('gig time: read exactly as stored (naive "local-as-UTC", never Intl-converted)', () => {
  it.each([
    ['2026-10-24T21:00:00+00:00', { day: '24', mon: 'Oct', time: '21:00' }], // BST date: still 21:00
    ['2026-12-05T21:30:00Z', { day: '05', mon: 'Dec', time: '21:30' }],
    ['2026-10-24T23:30:00+00:00', { day: '24', mon: 'Oct', time: '23:30' }], // no day rollover (same day as DJProfile dateKey)
    ['2026-10-24 21:00:00', { day: '24', mon: 'Oct', time: '21:00' }],
    ['2026-10-24T00:00:00+00:00', { day: '24', mon: 'Oct', time: null }],
    ['2026-10-24', { day: '24', mon: 'Oct', time: null }],
    [null, null],
    ['garbage', null],
  ])('%j', (iso, want) => expect(gigWhen(iso)).toEqual(want));
});

describe('dates first: max 3 + "See N more dates"', () => {
  it.each([
    [0, 0, 0], [1, 1, 0], [3, 3, 0], [4, 3, 1], [6, 3, 3], [13, 3, 10],
  ])('%i dates -> %i shown, %i behind the button', (n, shown, more) => {
    const rows = gigRows(Array.from({ length: n }, (_, i) => gig(i)));
    expect(datesView(rows, false)).toMatchObject({ more });
    expect(datesView(rows, false).rows).toHaveLength(shown);
    expect(datesView(rows, true)).toEqual({ rows, more: 0 });
    if (n) expect(rows.map((r) => r.next)).toEqual(rows.map((_, i) => i === 0));
  });
  it.each([[1, 'See 1 more date'], [3, 'See 3 more dates']])('%i -> %s', (n, s) => expect(seeMoreLabel(n)).toBe(s));
  it('row sub line: venue \u00b7 time; missing parts drop out', () => {
    expect(gigRows([gig(1)])[0].sub).toBe('Camden \u00b7 21:00');
    expect(gigRows([{ ...gig(1), location: null }])[0].sub).toBe('21:00');
    expect(gigRows([{ ...gig(1), location: null, startTime: '2099-01-01' }])[0].sub).toBeNull();
  });
});

describe('no dates: says what the visitor can do', () => {
  it('with Instagram: the Instagram button', () => {
    expect(noDates('https://instagram.com/roger').action).toEqual({ label: 'Open Instagram', href: 'https://instagram.com/roger', external: true });
  });
  it('without Instagram: no Instagram button, a calendar link that exists', () => {
    const e = noDates(null);
    expect(e.action.label).not.toMatch(/instagram/i);
    expect(e.hint).not.toMatch(/instagram/i);
    expect(e.action).toEqual({ label: 'See the calendar', href: '/', external: false });
  });
});

describe('Listen & book links', () => {
  it.each([
    [{}, []],
    [{ soundcloud: 'soundcloud.com/r' }, ['SoundCloud:https://soundcloud.com/r']],
    [{ instagram: 'instagram.com/roger.dj' }, ['Instagram:https://instagram.com/roger.dj']],
    [{ instagram: '@roger.dj' }, ['Instagram:https://instagram.com/roger.dj']],
    [{ instagram: 'roger.dj' }, ['Instagram:https://instagram.com/roger.dj']],
    [{ instagram: 'https://www.instagram.com/roger' , website: ' ' }, ['Instagram:https://www.instagram.com/roger']],
    [{ mixcloud: 'https://mixcloud.com/r', website: 'roger.com', facebook: 'fb.com/r' }, ['Mixcloud:https://mixcloud.com/r', 'Website:https://roger.com', 'Facebook:https://fb.com/r']],
  ])('%j', (p, want) => {
    const base = { soundcloud: null, mixcloud: null, instagram: null, website: null, facebook: null };
    expect(listenLinks({ ...base, ...p }).map((l) => `${l.label}:${l.href}`)).toEqual(want);
  });
});

// --- the page, through DJProfile ------------------------------------------------------------
const ROW = {
  id: 'dj1', display_name: 'DJ Roger', dj_name: 'DJ Roger', first_name: null, surname: null,
  photo_url: null, cover_url: null, bio: 'Sensual sets.', genres: null, nationality: null, city_id: null,
  city_name: 'London', city_slug: null, person_entity_id: null, instagram: null, facebook: null,
  website: null, soundcloud: null, mixcloud: null, pricing: null, faq: null, gallery_urls: null,
  languages: null, achievements: null, upcoming_events: [],
};
const appearance = (i: number) => ({ event_id: `e${i}`, event_name: `Night ${i}`, event_start_time: `2099-10-${String(10 + i).padStart(2, '0')}T21:00:00`, event_location: 'Camden' });

const setHub = (on: boolean) => { (flags as { personHub: boolean }).personHub = on; };
const mount = (row: Record<string, unknown> = ROW) => {
  h.rpc.mockResolvedValue({ data: row, error: null });
  return render(
    <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
      <MemoryRouter initialEntries={['/djs/roger']}>
        <Routes><Route path="/djs/:id" element={<DJProfile />} /></Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );
};

beforeEach(() => { installJsdomPolyfills(); h.rpc.mockReset(); h.gigs = []; h.fetched = true; h.failed = false; });
afterEach(() => { cleanup(); setHub(false); document.body.style.background = ''; document.documentElement.style.background = ''; });

describe('DJProfile behind flags.personHub', () => {
  it('OFF: today\'s page (classic hero, Back + Share head, Also row), no W2-C page', async () => {
    mount();
    await screen.findByTestId('dj-head');
    expect(screen.getByTestId('also-stub')).toBeTruthy();
    expect(screen.queryByTestId('dj-role-page')).toBeNull();
    expect(screen.queryByTestId('switch-stub')).toBeNull();
  });

  it('ON: switcher on top, hero, then dates before About, Photos, Listen & book', async () => {
    setHub(true);
    h.gigs = Array.from({ length: 6 }, (_, i) => appearance(i));
    mount({ ...ROW, gallery_urls: ['https://x/a.jpg'], soundcloud: 'soundcloud.com/r', instagram: 'https://instagram.com/r' });
    const page = await screen.findByTestId('dj-role-page');
    expect(screen.queryByTestId('dj-head')).toBeNull();
    expect(screen.queryByTestId('also-stub')).toBeNull();
    expect(screen.getByTestId('switch-stub').dataset.current).toBe('dj');
    const order = [...page.querySelectorAll('[data-testid="dj-hero"], h2')].map((e) => (e.tagName === 'H2' ? e.textContent : 'hero'));
    expect(order).toEqual(['hero', 'Upcoming dates', 'About', 'Photos', 'Listen & book']);
    expect(screen.getByTestId('dj-kicker').textContent).toBe('DJ \u00b7 LONDON');
    expect(screen.getAllByTestId('dj-date')).toHaveLength(3);
    fireEvent.click(screen.getByText('See 3 more dates'));
    expect(screen.getAllByTestId('dj-date')).toHaveLength(6);
    expect(screen.queryByTestId('dj-more-dates')).toBeNull();
  });

  it.each([
    ['DJ Roger', '36px'],
    ['DJ Carlos De La Cruz Fernandez-Montenegro', '26px'],
  ])('ON: %s wraps at %s, no overflow-hidden clip on the hero or the name', async (name, px) => {
    setHub(true);
    mount({ ...ROW, dj_name: name, display_name: name });
    const h1 = await screen.findByTestId('dj-name');
    expect(h1.textContent).toBe(name);
    expect(h1.style.fontSize).toBe(px);
    expect(h1.style.overflowWrap).toBe('anywhere');
    for (let el: HTMLElement | null = h1; el && el.dataset.testid !== 'dj-role-page'; el = el.parentElement) {
      expect(el.style.overflow).not.toBe('hidden');
      expect(el.className).not.toMatch(/overflow-hidden|truncate|line-clamp/);
    }
  });

  it.each([
    ['with Instagram', 'https://instagram.com/r', 'Open Instagram'],
    ['without Instagram', null, 'See the calendar'],
  ])('ON, no dates, %s', async (_n, ig, action) => {
    setHub(true);
    mount({ ...ROW, instagram: ig });
    const card = await screen.findByTestId('dj-no-dates');
    expect(card.textContent).toContain('No dates booked right now.');
    expect(screen.getByTestId('dj-no-dates-action').textContent).toBe(action);
    expect(screen.queryByText('Open Instagram') !== null).toBe(!!ig);
  });

  it('ON: before the dates read answers, a placeholder, never a false "No dates"', async () => {
    setHub(true);
    h.fetched = false;
    mount({ ...ROW, instagram: 'https://instagram.com/r' });
    await screen.findByTestId('dj-role-page');
    expect(screen.getByTestId('dj-dates-loading')).toBeTruthy();
    expect(screen.queryByTestId('dj-no-dates')).toBeNull();
  });

  it('ON: the dates read failed: says so, never a false "No dates"', async () => {
    setHub(true);
    h.failed = true;
    mount({ ...ROW, instagram: 'https://instagram.com/r' });
    expect((await screen.findByTestId('dj-dates-failed')).textContent).toMatch(/could not load/);
    expect(screen.queryByTestId('dj-no-dates')).toBeNull();
  });

  it('ON: two rows for one event (two sets) render as two rows, no key clash', async () => {
    setHub(true);
    h.gigs = [appearance(1), appearance(1)];
    mount();
    await screen.findByTestId('dj-role-page');
    expect(screen.getAllByTestId('dj-date')).toHaveLength(2);
  });

  it('ON: the turntable keyframes ship with the page, off for reduced motion', async () => {
    setHub(true);
    mount();
    const page = await screen.findByTestId('dj-role-page');
    const css = [...page.querySelectorAll('style')].map((x) => x.textContent).join('');
    expect(css).toMatch(/@keyframes dj-spin/);
    expect(css).toMatch(/@keyframes dj-float/);
    expect(css).toMatch(/prefers-reduced-motion: reduce/);
  });

  it('ON: until the switcher has an answer, a Back to DJs link (never no way back)', async () => {
    setHub(true);
    mount();
    const back = await screen.findByTestId('dj-back');
    expect(back.getAttribute('href')).toBe('/djs');
    expect(parseInt(back.style.minHeight, 10)).toBeGreaterThanOrEqual(44);
  });
});

// @vitest-environment jsdom
/**
 * W2-C fix: the flag-ON DJ page must never throw on a shape get_public_dj_v1 really returns.
 * Prod survey 2026-10-22 (40 DJs): faq is an ARRAY for 21 (all `[]`) and null for 19; pricing is a
 * string for 1 and null for 39. The page read faq as a string and crashed ("p.faq?.trim is not a
 * function") on 21 of 40 DJs. Every text field the page reads goes through ONE boundary
 * (djRoleFields / djText); this table feeds each field every shape and renders the whole page.
 */
import { cleanup, render, screen } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { installJsdomPolyfills } from '../../../../tests/client/jsdomPolyfills';
import { flags } from '@/lib/featureFlags';
import { djRoleFields, djText, gigRows } from '../djRoleModel';
import { PAGE_GROUNDS } from '@/components/layout/pageGrounds';
import { WALL } from '@/modules/person-page/wall/tokens';

const h = vi.hoisted(() => ({ rpc: vi.fn(), gigs: [] as unknown[] }));
vi.mock('@/integrations/supabase/client', () => ({ supabase: { rpc: (fn: string, args: unknown) => h.rpc(fn, args) } }));
vi.mock('@/lib/seo', async (orig) => ({
  ...(await orig<typeof import('@/lib/seo')>()),
  useEntitySlugOrId: () => ({ id: 'dj1', slug: 'cherie', arrivedViaUuid: false, notFound: false }),
  useCanonicalReplaceState: () => undefined,
}));
vi.mock('@/hooks/useProfileProgramAppearances', () => ({ useProfileProgramAppearances: () => ({ data: h.gigs, isFetched: true, isError: false }) }));
vi.mock('@/modules/person-page/AlsoRoles', () => ({ AlsoRoles: () => <div data-testid="also-stub" /> }));
vi.mock('@/modules/person-page/RoleSwitchBar', () => ({ RoleSwitch: ({ fallback }: { fallback?: React.ReactNode }) => <div>{fallback}</div> }));

import DJProfile from '@/pages/DJProfile';

// Every shape a JSON column can hand back. `want` = what the page shows (null = no card).
const SHAPES: [string, unknown, string | null][] = [
  ['null', null, null],
  ['missing', undefined, null],
  ['empty array', [], null],
  ['empty string', '', null],
  ['blank string', '   ', null],
  ['text', ' Two hours, vinyl. ', 'Two hours, vinyl.'],
  ['array of strings', ['a', ' b ', ''], 'a\nb'],
  ['array of objects', [{ x: 1 }], null],
  ['number', 5, null],
  ['object', { q: 'a' }, null],
  ['boolean', true, null],
];

describe('djText: string -> trimmed or null; string array -> lines; anything else -> null', () => {
  it.each(SHAPES)('%s', (_n, v, want) => expect(djText(v)).toBe(want));
});

const ROW = {
  id: 'dj1', display_name: 'Cherie', dj_name: 'Cherie', first_name: null, surname: null,
  photo_url: null, cover_url: null, bio: null, genres: null, nationality: null, city_id: null,
  city_name: 'London', city_slug: null, person_entity_id: null, instagram: null, facebook: null,
  website: null, soundcloud: null, mixcloud: null, pricing: null, faq: null, gallery_urls: null,
  languages: null, achievements: null, upcoming_events: [],
};

const setHub = (on: boolean) => { (flags as { personHub: boolean }).personHub = on; };
const mount = (row: Record<string, unknown>) => {
  h.rpc.mockResolvedValue({ data: row, error: null });
  return render(
    <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
      <MemoryRouter initialEntries={['/djs/cherie']}>
        <Routes><Route path="/djs/:id" element={<DJProfile />} /></Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );
};

beforeEach(() => { installJsdomPolyfills(); h.rpc.mockReset(); h.gigs = []; setHub(true); });
afterEach(() => { cleanup(); setHub(false); });

const labels = (page: HTMLElement) => [...page.querySelectorAll('h2')].map((e) => e.textContent);

describe.each([
  ['faq', 'FAQ'],
  ['pricing', 'Pricing'],
  ['bio', 'About'],
])('flag ON, %s in every shape: the page renders, a card only with text', (field, label) => {
  it.each(SHAPES)('%s', async (_n, v, want) => {
    mount({ ...ROW, [field]: v });
    const page = await screen.findByTestId('dj-role-page');
    expect(screen.getByTestId('dj-name').textContent).toBe('Cherie');
    expect(labels(page).includes(label)).toBe(want !== null);
    if (want !== null) expect(page.textContent).toContain(want.split('\n')[0]);
  });
});

describe.each(['instagram', 'website', 'soundcloud', 'mixcloud', 'facebook', 'city_name', 'nationality_code', 'photo_url', 'gallery_urls'])(
  'flag ON, %s in every shape: the page renders',
  (field) => {
    it.each(SHAPES)('%s', async (_n, v) => {
      mount({ ...ROW, [field]: v });
      expect(await screen.findByTestId('dj-role-page')).toBeTruthy();
    });
  },
);

it('flag ON, the prod faq shape `[]` with every other field odd at once: renders, no empty cards', async () => {
  mount({ ...ROW, faq: [], pricing: 5, bio: ['x', 2], instagram: 7, website: [], city_name: {}, gallery_urls: ['https://x/a.jpg', 3, null], photo_url: [null, 4] });
  const page = await screen.findByTestId('dj-role-page');
  expect(labels(page)).toEqual(['Upcoming dates', 'About', 'Photos']);
  expect(screen.getAllByRole('img', { name: /photo/ })).toHaveLength(1);
});

it('gig rows: odd name / location / time shapes never throw', () => {
  const rows = gigRows([{ eventId: 'e', name: 5 as unknown as string, startTime: 7 as unknown as string, location: [] as unknown as string }]);
  expect(rows).toEqual([{ eventId: 'e', name: 'Event', day: '-', mon: '', sub: null, next: true }]);
});

it.each([['soundcloud'], ['mixcloud'], ['facebook'], ['website']])('%s as an array of links: the first one, never a joined multi-line href', (k) => {
  const f = djRoleFields({ ...ROW, [k]: [' ', 'a.com', 'b.com'] });
  expect(f.links[k as keyof typeof f.links]).toBe('a.com');
});

it('djRoleFields: one boundary for the whole page', () => {
  const f = djRoleFields({ ...ROW, faq: ['Q?', 'A.'], pricing: ' ', website: 'www.instagram.com/cherie', gallery_urls: ['a', 1] });
  expect(f).toMatchObject({ faq: 'Q?\nA.', pricing: null, gallery: ['a'], links: { instagram: 'www.instagram.com/cherie', website: null } });
});

// Colour seam (walk 2026-10-22): the page's soft bottom fade landed on the layout's graphite default
// (rgb(14,18,21)) below Share. The flag-ON page stands on the warm `wall` ground, which IS WALL.page.
describe('flag ON: warm to the footer', () => {
  it('the wall ground is the wall colour', () => expect(PAGE_GROUNDS.wall.base).toBe(WALL.page));
  it('the layout ground under the page is the wall, and <body> is painted warm', async () => {
    mount(ROW);
    await screen.findByTestId('dj-role-page');
    expect(document.querySelector('[data-testid="layout-bg"]')?.getAttribute('data-palette')).toBe('wall');
    expect(document.body.style.backgroundColor).toBe('rgb(30, 20, 16)');
  });
});

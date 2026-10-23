// @vitest-environment jsdom
/**
 * W1 people lists at PAGE level (src/pages/Dancers.tsx, src/pages/DJs.tsx).
 * - C1: a failed badges read never claims "No dancers yet"; the tiles render unfiltered, without labels.
 * - M7: a tile's accessible name separates the name from each role tag ("Ana Lopez, Teacher, DJ").
 * - /djs order: the PAGE renders the sorted list (upcoming gig first), not the RPC order.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { ReactNode } from 'react';
import { cleanup, render, screen } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';
import { computeAccessibleName } from 'dom-accessibility-api';
import { installJsdomPolyfills } from '../../../tests/client/jsdomPolyfills';

const h = vi.hoisted(() => ({
  dancers: [] as unknown[],
  names: [] as unknown[],
  badges: [] as unknown[],
  badgesError: false,
  djs: [] as unknown[],
}));
vi.mock('@/hooks/useAuth', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/hooks/useAuth')>()),
  useAuth: () => ({ user: null, isLoading: false, authStatus: 'ready' }),
}));
vi.mock('@/hooks/use-toast', () => ({ useToast: () => ({ toast: vi.fn() }) }));
vi.mock('@/components/layout/GlobalLayout', () => ({ default: ({ children }: { children: ReactNode }) => <div>{children}</div> }));
vi.mock('@/contexts/CityContext', () => ({ useCity: () => ({ citySlug: 'london-gb' }) }));
vi.mock('@/integrations/supabase/client', () => {
  const builder = () => {
    const b: Record<string, unknown> = {
      select: () => b,
      or: () => b,
      order: () => b,
      then: (resolve: (v: unknown) => unknown) => Promise.resolve({ data: h.dancers, error: null }).then(resolve),
    };
    return b;
  };
  return {
    supabase: {
      from: () => builder(),
      rpc: async (name: string) => {
        if (name === 'get_public_dancer_names_v1') return { data: h.names, error: null };
        if (name === 'get_public_people_badges_v1') {
          return h.badgesError ? { data: null, error: { message: 'statement timeout' } } : { data: h.badges, error: null };
        }
        if (name === 'list_public_djs_v1') return { data: h.djs, error: null };
        return { data: null, error: null };
      },
    },
  };
});

import Dancers from '@/pages/Dancers';
import DJs from '@/pages/DJs';

const mount = (el: ReactNode, at: string) =>
  render(
    <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
      <MemoryRouter initialEntries={[at]}>{el}</MemoryRouter>
    </QueryClientProvider>,
  );
const wait = (ms = 200) => new Promise((r) => setTimeout(r, ms));
const clean = (s: string) => s.replace(/\s+/g, ' ').trim();

const D = (id: string, first: string | null) => ({
  id, first_name: first, avatar_url: null, nationality: null, dance_role: null, cities: { name: 'London' }, dancing_role_details: null,
});
const B = (id: string, roles: string[], over: Record<string, unknown> = {}) => ({
  id, roles, dj_name: null, next_gig_date: null, dj_has_upcoming: false, ...over,
});

beforeEach(() => {
  installJsdomPolyfills();
  h.dancers = [D('d1', 'Ana'), D('d2', 'Fay'), D('d3', 'Tom')];
  h.names = [
    { id: 'd1', surname: 'Lopez', display_name: 'Ana Lopez', public_name: 'Ana Lopez' },
    { id: 'd2', surname: null, display_name: 'Fay', public_name: 'Fay' },
    { id: 'd3', surname: null, display_name: 'Tom', public_name: 'Tom' },
  ];
  h.badges = [B('d1', ['teacher', 'dj', 'dancer']), B('d2', ['dancer']), B('d3', ['teacher'])];
  h.badgesError = false;
  h.djs = [];
});
afterEach(() => cleanup());

describe('/dancers page', () => {
  it('C1: badges RPC error -> tiles render unfiltered, no labels, never "No dancers yet"', async () => {
    h.badgesError = true;
    mount(<Dancers />, '/dancers');
    await wait();
    expect(screen.queryByText(/No dancers yet/)).toBeNull();
    const tiles = screen.getAllByTestId('dancer-tile');
    expect(tiles.map((t) => t.getAttribute('href'))).toEqual(['/dancers/d1', '/dancers/d2', '/dancers/d3']);
    for (const labels of screen.getAllByTestId('role-labels')) expect(clean(labels.textContent ?? '')).toBe('');
  });

  it('round 2 R3: badges read OK but EMPTY while there are dancer rows -> unfiltered, never "No dancers yet"', async () => {
    h.badges = [];
    mount(<Dancers />, '/dancers');
    await wait();
    expect(screen.queryByText(/No dancers yet/)).toBeNull();
    expect(screen.getAllByTestId('dancer-tile').map((t) => t.getAttribute('href'))).toEqual(['/dancers/d1', '/dancers/d2', '/dancers/d3']);
  });

  it('badges OK -> only Dancer-role people are listed (teacher-only d3 is not)', async () => {
    mount(<Dancers />, '/dancers');
    await wait();
    expect(screen.getAllByTestId('dancer-tile').map((t) => t.getAttribute('href'))).toEqual(['/dancers/d1', '/dancers/d2']);
  });

  it('a failed background refetch with cached badges keeps the filter (review F4)', async () => {
    const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    render(
      <QueryClientProvider client={qc}>
        <MemoryRouter initialEntries={['/dancers']}><Dancers /></MemoryRouter>
      </QueryClientProvider>,
    );
    await wait();
    expect(screen.getAllByTestId('dancer-tile').map((t) => t.getAttribute('href'))).toEqual(['/dancers/d1', '/dancers/d2']);
    h.badgesError = true;
    await qc.refetchQueries({ queryKey: ['people-badges'] });
    await wait();
    expect(qc.getQueryState(['people-badges', ['d1', 'd2', 'd3']])?.status).toBe('error');
    expect(screen.getAllByTestId('dancer-tile').map((t) => t.getAttribute('href'))).toEqual(['/dancers/d1', '/dancers/d2']);
  });

  it('M7: the tile accessible name separates the tags', async () => {
    mount(<Dancers />, '/dancers');
    await wait();
    const [ana, fay] = screen.getAllByTestId('dancer-tile');
    // jsdom's name computation trims each child, so the hidden ", " reads as ","; any comma
    // between every tag is the contract (a browser reads "Ana Lopez, Teacher, DJ").
    expect(clean(computeAccessibleName(ana))).toMatch(/Ana Lopez\s*,\s*Teacher\s*,\s*DJ$/);
    expect(clean(computeAccessibleName(fay))).toMatch(/Fay$/);
  });
});

describe('/djs page', () => {
  const DJ = (id: string, djName: string, over: Record<string, unknown> = {}) => ({
    id, display_name: djName, dj_name: djName, first_name: null, surname: null, photo_url: null, bio: null, genres: null,
    nationality: null, nationality_code: null, city_id: null, city_name: null, city_slug: null, person_entity_id: null,
    has_upcoming_gig: false, next_gig_date: null, ...over,
  });

  it('renders the SORTED list: upcoming gigs first by date, then the rest in RPC order', async () => {
    h.djs = [
      DJ('j1', 'Alpha'),
      DJ('j2', 'Bravo', { has_upcoming_gig: true, next_gig_date: '2026-12-01' }),
      DJ('j3', 'Charlie'),
      DJ('j4', 'Delta', { has_upcoming_gig: true, next_gig_date: '2026-11-01' }),
    ];
    h.badges = h.djs.map((d) => B((d as { id: string }).id, ['dj']));
    mount(<DJs />, '/djs');
    await wait();
    expect(screen.getAllByTestId('dj-tile').map((t) => t.getAttribute('href'))).toEqual(['/djs/j4', '/djs/j2', '/djs/j1', '/djs/j3']);
  });

  it('M7: the DJ tile accessible name separates the tags', async () => {
    h.djs = [DJ('j1', 'DJ El Rugido')];
    h.badges = [B('j1', ['teacher', 'dj', 'dancer'], { dj_name: 'DJ El Rugido' })];
    mount(<DJs />, '/djs');
    await wait();
    const [tile] = screen.getAllByTestId('dj-tile');
    expect(clean(computeAccessibleName(tile))).toMatch(/DJ El Rugido\s*,\s*Teacher\s*,\s*DJ\s*,\s*Dancer$/);
    expect(tile.textContent).toContain('DJ El Rugido'); // tile name keeps the full stage name (7b)
  });

  it('QA: three tags never clip -- the label row wraps instead of hiding overflow (390/360 phone QA: 25/40 tiles cut)', async () => {
    h.djs = [DJ('j1', 'Alpha')];
    h.badges = [B('j1', ['teacher', 'dj', 'dancer'])];
    mount(<DJs />, '/djs');
    await wait();
    const row = screen.getByTestId('role-labels');
    expect(row.className).not.toMatch(/overflow-hidden/);
    expect(row.className).toMatch(/flex-wrap/);
    expect(row.className).not.toMatch(/(^|\s)h-\[/);
  });
});

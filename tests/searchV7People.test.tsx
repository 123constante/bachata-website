// @vitest-environment jsdom
/**
 * search_public_v7 (flags.searchV7): ONE row per person, roles as a muted line.
 * Table-driven over every visible role combination (the three public roles in
 * fixed order teacher, dj, dancer: 7 subsets) crossed with name / photo /
 * nationality shapes. RPCs mocked at the client; the DB contract is proved in
 * the admin repo.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, renderHook, screen, waitFor, within } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import type { ReactNode } from 'react';

const flagState = vi.hoisted(() => ({ searchV5: true, searchV6: true, searchV7: false, teacherDetail: true }));
const rpc = vi.hoisted(() => vi.fn());
const clickLog = vi.hoisted(() => vi.fn());

vi.mock('@/lib/featureFlags', () => ({ flags: flagState }));
vi.mock('@/integrations/supabase/client', () => ({ supabase: { rpc } }));
vi.mock('@/integrations/supabase/getSupabase', () => ({ getSupabase: async () => ({ rpc }) }));
vi.mock('@/hooks/useAuth', () => ({ useAuth: () => ({ user: null }) }));
vi.mock('@/lib/festivalsList', () => ({
  fetchPublicFestivalsList: async () => [],
  filterUpcomingFestivals: (rows: unknown[]) => rows,
}));
vi.mock('@/lib/searchClickTelemetry', () => ({ recordSearchResultClick: clickLog }));
vi.mock('@/lib/searchTelemetry', () => ({ recordSearchQuery: vi.fn() }));
vi.mock('@/lib/seo', () => ({ useSeo: () => undefined, buildSeoForRoute: () => ({}) }));
vi.mock('@/contexts/CityContext', () => ({ useCity: () => ({ citySlug: 'london' }) }));
vi.mock('@/hooks/use-mobile', () => ({ useIsMobile: () => true }));
vi.mock('@/components/layout/GlobalLayout', () => ({ default: ({ children }: { children: ReactNode }) => <div>{children}</div> }));
vi.mock('@/components/search/DiscoveryPanel', () => ({ DiscoveryPanel: () => null }));

import { useSearchResults } from '@/hooks/useSearchResults';
import { searchPublicV3 } from '@/lib/searchRpc';
import { hrefFor } from '@/lib/searchEntities';
import SearchResults from '@/pages/SearchResults';
import { SearchOverlay } from '@/components/search/SearchOverlay';

type Role = 'teacher' | 'dj' | 'dancer';
const COMBOS: Role[][] = [
  ['teacher'], ['dj'], ['dancer'],
  ['teacher', 'dj'], ['teacher', 'dancer'], ['dj', 'dancer'],
  ['teacher', 'dj', 'dancer'],
];
const LABEL: Record<Role, string> = { teacher: 'Teacher', dj: 'DJ', dancer: 'Dancer' };
const roleText = (roles: Role[]) => roles.map((r) => LABEL[r]).join(' \u00b7 ');

const person = (i: number, roles: Role[], over: Record<string, unknown> = {}) => ({
  id: `p${i}`, first_name: `First${i}`, surname: `Last${i}`, display_name: `First${i} Last${i}`,
  photo_url: null, avatar_url: null, slug: null, nationality_code: i % 2 ? 'ES' : null,
  roles, primary_role: roles[0], ...over,
});
const PEOPLE = COMBOS.map((roles, i) => person(i, roles));

const envelope = (over: Record<string, unknown> = {}) => ({
  query: 'first', events: [], organisers: [], venues: [], vendors: [], cities: [],
  people: PEOPLE, total_count: PEOPLE.length, did_you_mean: null, unrated_event_count: null, ...over,
});

const qc = () => new QueryClient({ defaultOptions: { queries: { retry: false } } });
const wrapper = ({ children }: { children: ReactNode }) => <QueryClientProvider client={qc()}>{children}</QueryClientProvider>;
const Where = () => <span data-testid="where">{useLocation().pathname}</span>;
const renderPage = (q = 'first') => render(
  <QueryClientProvider client={qc()}>
    <MemoryRouter initialEntries={[`/search?q=${q}`]}>
      <Routes><Route path="/search" element={<SearchResults />} /><Route path="*" element={<Where />} /></Routes>
    </MemoryRouter>
  </QueryClientProvider>,
);

beforeEach(() => {
  flagState.searchV5 = true; flagState.searchV6 = true; flagState.searchV7 = true; flagState.teacherDetail = true;
  rpc.mockReset(); clickLog.mockReset();
  rpc.mockResolvedValue({ data: envelope(), error: null });
});
afterEach(cleanup);

describe('hook + mapper', () => {
  it('flag ON calls search_public_v7 with v6 args and returns people', async () => {
    const { result } = renderHook(() => useSearchResults('first', 'london', { levels: ['mixed'] }), { wrapper });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    const [fn, args] = rpc.mock.calls[0];
    expect(fn).toBe('search_public_v7');
    expect(args.p_level).toEqual(['mixed']);
    expect(result.current.data?.people).toHaveLength(7);
  });

  it('flag OFF still calls v6 and keeps the old arrays', async () => {
    flagState.searchV7 = false;
    rpc.mockResolvedValue({ data: { ...envelope(), people: undefined, teachers: [person(1, ['teacher'])] }, error: null });
    const { result } = renderHook(() => useSearchResults('first', 'london'), { wrapper });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(rpc.mock.calls[0][0]).toBe('search_public_v6');
    expect(result.current.data?.teachers).toHaveLength(1);
    expect(result.current.data?.people ?? []).toHaveLength(0);
  });

  it.each(COMBOS.map((r, i) => [roleText(r), r, i] as const))('searchPublicV3 maps %s to ONE person row', async (_n, roles, i) => {
    const rows = await searchPublicV3('first', 'london', 3, false);
    expect(rpc.mock.calls[0][0]).toBe('search_public_v7');
    expect(rows.filter((r) => r.id === `p${i}`)).toHaveLength(1);
    const row = rows.find((r) => r.id === `p${i}`)!;
    if (roles.length === 1 && roles[0] === 'teacher') {
      // Teacher-only keeps today's Teacher row (review F1): /teachers/:id, no role line.
      expect(row.kind).toBe('teacher');
      expect(row.href).toBe(`/teachers/p${i}`);
      expect(row.subtitle).toBeNull();
      return;
    }
    expect(row.kind).toBe('person');
    expect(row.href).toBe(`/people/p${i}`);
    expect(row.roles).toEqual(roles);
    expect(row.telemetryKind).toBe(roles[0]);
    expect(row.nationalityCode).toBe(i % 2 ? 'ES' : null);
  });

  it('hrefFor person; old kinds unchanged', () => {
    expect(hrefFor('person', 'x')).toBe('/people/x');
    expect(hrefFor('teacher', 'x')).toBe('/teachers/x');
    expect(hrefFor('dj', 'x')).toBe('/djs/x');
    expect(hrefFor('dancer', 'x')).toBe('/dancers/x');
  });
});

describe('/search page', () => {
  // W1 S3: ONE full-width row per person; tags and link are the badges mapping's (roles are
  // always public, so Teacher shows plain while the teacher pages are closed; the row links
  // DJ page, else dancer page, else nowhere: /people/:id has no route).
  const expectedHref = (roles: Role[], open: boolean) =>
    roles.includes('dj') ? hrefFor('dj', 'X') : roles.includes('dancer') ? hrefFor('dancer', 'X') : roles.includes('teacher') && open ? hrefFor('teacher', 'X') : null;

  it('flag ON: one People section, one row per person, count "7", nothing links to /people/', async () => {
    renderPage();
    // First render in the file: give the lazy chunks time under a loaded full-suite run.
    await screen.findByRole('heading', { name: 'People' }, { timeout: 5000 });
    expect(screen.queryByRole('heading', { name: 'Teachers' })).toBeNull();
    expect(screen.queryByRole('heading', { name: 'DJs' })).toBeNull();
    expect(screen.queryByRole('heading', { name: 'Dancers' })).toBeNull();
    expect(screen.getAllByRole('link').filter((a) => a.getAttribute('href')?.startsWith('/people/'))).toHaveLength(0);
    expect(document.querySelectorAll('[data-person-tag]').length).toBeGreaterThan(0);
    expect(screen.getByText('(7)')).toBeTruthy();
    expect(screen.getByRole('tab', { name: /People/ })).toBeTruthy();
    expect(screen.queryByRole('tab', { name: /Teachers/ })).toBeNull();
  });

  describe.each([true, false])('teacher pages open = %s', (open) => {
    it.each(COMBOS.map((r, i) => [roleText(r), r, i] as const))('row for %s: tags, aria label, link, telemetry', async (_n, roles, i) => {
      flagState.teacherDetail = open;
      renderPage();
      await screen.findByRole('heading', { name: 'People' });
      const name = `First${i} Last${i}`;
      const want = expectedHref(roles, open)?.replace('X', `p${i}`) ?? null;
      await waitFor(() => expect(document.querySelector(`[data-person-id="p${i}"]`)).not.toBeNull());
      const row = document.querySelector(`[data-person-id="p${i}"]`)!;
      expect(row.getAttribute('href')).toBe(want);
      if (!want) expect(row.getAttribute('data-person-row')).toBe('plain');
      const tags = Array.from(row.querySelectorAll('[data-person-tag]')).map((e) => e.textContent);
      expect(tags).toEqual(roles.map((r) => LABEL[r])); // Teacher shows even while its pages are closed
      if (!open) expect(row.getAttribute('href') ?? '').not.toContain('/teachers/');
      if (want) {
        expect(row.getAttribute('aria-label')).toBe(`${name}, ${roles.map((r) => LABEL[r]).join(', ')}`);
        fireEvent.click(row);
        expect(clickLog).toHaveBeenCalledWith(expect.objectContaining({ kind: roles[0], id: `p${i}` }));
      }
    });
  });

  // Review F6: an old ?type= link with v7 on opens People; an empty facet says what to do.
  it.each(['teachers', 'djs', 'dancers'])('flag ON, old ?type=%s opens the People facet', async (type) => {
    render(
      <QueryClientProvider client={qc()}>
        <MemoryRouter initialEntries={[`/search?q=first&type=${type}`]}>
          <Routes><Route path="/search" element={<SearchResults />} /></Routes>
        </MemoryRouter>
      </QueryClientProvider>,
    );
    await screen.findByRole('heading', { name: 'People' });
    expect(screen.getByRole('tab', { name: /People/ }).getAttribute('aria-selected')).toBe('true');
    expect(screen.queryByTestId('search-facet-empty')).toBeNull();
  });

  it('a facet with 0 hits while others have some: says so and offers all results', async () => {
    flagState.searchV7 = false;
    rpc.mockResolvedValue({
      data: { ...envelope(), people: undefined, total_count: 1, teachers: [], djs: [], dancers: [person(0, ['dancer'])] },
      error: null,
    });
    render(
      <QueryClientProvider client={qc()}>
        <MemoryRouter initialEntries={['/search?q=first&type=people']}>
          <Routes><Route path="/search" element={<SearchResults />} /></Routes>
        </MemoryRouter>
      </QueryClientProvider>,
    );
    const empty = await screen.findByTestId('search-facet-empty');
    expect(empty.textContent).toContain('No people for');
    expect(screen.getByRole('tab', { name: /People/ }).getAttribute('aria-selected')).toBe('true');
    fireEvent.click(within(empty).getByRole('button', { name: 'Show all 1 result' }));
    await screen.findByRole('heading', { name: 'Dancers' });
    expect(screen.queryByTestId('search-facet-empty')).toBeNull();
  });

  it('flag OFF renders the old three sections unchanged', async () => {
    flagState.searchV7 = false;
    rpc.mockResolvedValue({
      data: { ...envelope(), people: undefined, total_count: 3,
        teachers: [person(0, ['teacher'])], djs: [person(0, ['dj'])], dancers: [person(0, ['dancer'])] },
      error: null,
    });
    renderPage();
    await screen.findByRole('heading', { name: 'Teachers' });
    expect(screen.getByRole('heading', { name: 'DJs' })).toBeTruthy();
    expect(screen.getByRole('heading', { name: 'Dancers' })).toBeTruthy();
    expect(screen.queryByRole('heading', { name: 'People' })).toBeNull();
    expect(rpc.mock.calls[0][0]).toBe('search_public_v6');
  });

  it('empty state says what to do and did-you-mean works', async () => {
    rpc.mockResolvedValue({ data: envelope({ people: [], total_count: 0, did_you_mean: 'carlos' }), error: null });
    renderPage('carlso');
    await screen.findByText(/No results for/);
    expect(screen.getByRole('button', { name: 'carlos' })).toBeTruthy();
  });

  it('a long name wraps instead of clipping at 390px (class contract)', async () => {
    const long = 'Maria Esperanza de los Angeles Fernandez-Montgomery Wolfeschlegelstein';
    rpc.mockResolvedValue({ data: envelope({ people: [person(9, ['teacher', 'dj', 'dancer'], { display_name: long })], total_count: 1 }), error: null });
    renderPage();
    const h = (await screen.findByText(long)).closest('span.block')!;
    expect(h.className).toMatch(/line-clamp-2|break-words/);
    expect(h.className).not.toMatch(/\btruncate\b/);
  });
});

describe('overlay', () => {
  const open = async () => {
    render(
      <QueryClientProvider client={qc()}>
        <MemoryRouter><SearchOverlay open onClose={() => undefined} /><Where /></MemoryRouter>
      </QueryClientProvider>,
    );
    fireEvent.change(screen.getByRole('combobox'), { target: { value: 'first' } });
    await screen.findAllByRole('option', {}, { timeout: 3000 });
    await waitFor(() => expect(screen.getAllByRole('option').length).toBeGreaterThan(1), { timeout: 3000 });
  };

  it('one row per person, roles in the accessible name, telemetry logs primary role', async () => {
    await open();
    const opts = screen.getAllByRole('option').slice(1);
    // overlay caps People at 5
    expect(opts).toHaveLength(5);
    expect(new Set(opts.map((o) => o.textContent)).size).toBe(5);
    expect(screen.getByRole('option', { name: 'First4 Last4, Teacher, Dancer' })).toBeTruthy();
  });

  it('click navigates to /people/:id and logs the old kind', async () => {
    await open();
    fireEvent.click(screen.getByRole('option', { name: /^First3 Last3, Teacher, DJ/ }));
    expect(clickLog).toHaveBeenCalledWith(expect.objectContaining({ kind: 'teacher', id: 'p3' }));
    expect(screen.getByTestId('where').textContent).toBe('/people/p3');
  });
});

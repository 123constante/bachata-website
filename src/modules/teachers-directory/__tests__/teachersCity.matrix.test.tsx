// @vitest-environment jsdom
/**
 * Teachers directory, one page per ACTIVE city (brief teachers-directory-city).
 * City x shape, from the prod survey of 2026-10-25: London 46 (the only active
 * city), a 5-teacher city, an active city with 0, an inactive city (Madrid: its
 * 23 teachers are no longer returned by get_public_teachers_list_v1) and an
 * unknown slug. Heading, title and empty note all come from teachersCityCopy,
 * so the page and the pure mapping are asserted against the SAME table.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { ReactNode } from 'react';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import { installJsdomPolyfills } from '../../../../tests/client/jsdomPolyfills';
import {
  DEFAULT_TEACHERS_CITY, TELL_US_LABEL, resolveTeachersCity, teachersCityCopy, teachersPath,
  teachersRedirectTarget, teachersSitemapPaths, type CityRow,
} from '../teachersCity';
import { buildSeoForRoute } from '@/lib/seo';

const { ACTIVE, INACTIVE, COUNTS } = vi.hoisted(() => ({
  ACTIVE: [
    { slug: 'london-gb', name: 'London' },
    { slug: 'manchester-gb', name: 'Manchester' },
    { slug: 'leeds-gb', name: 'Leeds' },
  ] as { slug: string; name: string }[],
  INACTIVE: [{ slug: 'madrid-es', name: 'Madrid' }] as { slug: string; name: string }[],
  COUNTS: { 'london-gb': 46, 'manchester-gb': 5, 'leeds-gb': 0, 'madrid-es': 0 } as Record<string, number>,
}));

type Shape = {
  name: string;
  slug: string;
  mode: 'active' | 'inactive' | 'unknown';
  listSlug: string;
  heading: string;
  cards: number;
  note: string | null;
  fallbackLine: string | null;
  canonical: string;
};

const SHAPES: Shape[] = [
  { name: 'London, 46 teachers', slug: 'london-gb', mode: 'active', listSlug: 'london-gb', heading: 'Bachata Teachers in London', cards: 46, note: null, fallbackLine: null, canonical: '/city/london-gb/teachers' },
  { name: 'Manchester, 5 teachers', slug: 'manchester-gb', mode: 'active', listSlug: 'manchester-gb', heading: 'Bachata Teachers in Manchester', cards: 5, note: null, fallbackLine: null, canonical: '/city/manchester-gb/teachers' },
  { name: 'Leeds, active with 0', slug: 'leeds-gb', mode: 'active', listSlug: 'leeds-gb', heading: 'Bachata Teachers in Leeds', cards: 0, note: 'No teachers listed in Leeds yet. Know one?', fallbackLine: null, canonical: '/city/leeds-gb/teachers' },
  { name: 'Madrid, inactive', slug: 'madrid-es', mode: 'inactive', listSlug: 'london-gb', heading: 'Bachata Teachers in London', cards: 46, note: 'No teachers listed in Madrid yet. Know one?', fallbackLine: 'Showing teachers in London instead.', canonical: '/city/london-gb/teachers' },
  { name: 'unknown slug', slug: 'nowhere-xx', mode: 'unknown', listSlug: 'london-gb', heading: 'Bachata Teachers in London', cards: 46, note: 'No teachers listed in that city yet. Know one?', fallbackLine: 'Showing teachers in London instead.', canonical: '/city/london-gb/teachers' },
  { name: 'upper-case slug', slug: 'MANCHESTER-GB', mode: 'active', listSlug: 'manchester-gb', heading: 'Bachata Teachers in Manchester', cards: 5, note: null, fallbackLine: null, canonical: '/city/manchester-gb/teachers' },
];

const requestedRow = (slug: string) => INACTIVE.find((c) => c.slug === slug.toLowerCase()) ?? null;

describe('teachersCity mapping (pure)', () => {
  it.each(SHAPES)('$name', (s) => {
    const view = resolveTeachersCity(s.slug, ACTIVE, requestedRow(s.slug));
    expect(view.mode).toBe(s.mode);
    expect(view.listSlug).toBe(s.listSlug);
    const copy = teachersCityCopy(view, COUNTS[view.listSlug]);
    expect(copy.heading).toBe(s.heading);
    expect(copy.note).toBe(s.note);
    expect(copy.fallbackLine).toBe(s.fallbackLine);
    expect(view.canonicalPath).toBe(s.canonical);
    const seo = buildSeoForRoute('teachers', copy.seo);
    expect(seo.title).toBe(s.heading);
    expect(seo.canonical).toBe(`https://www.bachatacalendar.co.uk${s.canonical}`);
  });

  it('no count yet (still loading) says nothing about an empty city', () => {
    expect(teachersCityCopy(resolveTeachersCity('leeds-gb', ACTIVE), null).note).toBeNull();
  });

  it('London missing from the active list still falls back to London', () => {
    const view = resolveTeachersCity('nowhere-xx', [{ slug: 'manchester-gb', name: 'Manchester' }]);
    expect(view.listSlug).toBe(DEFAULT_TEACHERS_CITY.slug);
    expect(view.cityName).toBe('London');
  });

  it('a requested row for a DIFFERENT slug is not used to name the city', () => {
    expect(resolveTeachersCity('nowhere-xx', ACTIVE, INACTIVE[0]).requestedName).toBe('that city');
  });

  it.each([
    { visitor: 'manchester-gb', to: '/city/manchester-gb/teachers' },
    { visitor: 'london-gb', to: '/city/london-gb/teachers' },
    { visitor: null, to: '/city/london-gb/teachers' },
    { visitor: '', to: '/city/london-gb/teachers' },
  ])('redirect /teachers for visitor city $visitor -> $to', ({ visitor, to }) => {
    expect(teachersRedirectTarget(visitor)).toBe(to);
  });

  it('sitemap: one URL per active city, sorted, never an inactive one', () => {
    expect(teachersSitemapPaths(ACTIVE)).toEqual(['/city/leeds-gb/teachers', '/city/london-gb/teachers', '/city/manchester-gb/teachers']);
    expect(teachersSitemapPaths([{ slug: 'london-gb', name: 'London' }])).toEqual(['/city/london-gb/teachers']);
    expect(teachersSitemapPaths([])).toEqual([]);
    expect(teachersPath('madrid-es')).toBe('/city/madrid-es/teachers');
  });
});

// ---------------------------------------------------------------------------
// Page level: the same table through Teachers.tsx with a fake Supabase that
// answers the way prod does (the RPC narrows by p_city_slug; an inactive
// city's teachers are never returned).

const h = vi.hoisted(() => ({
  rpcCalls: [] as Record<string, unknown>[],
  seo: [] as { title: string; canonical?: string }[],
  failTeachers: false,
  failCities: false,
}));

vi.mock('@/lib/seo', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/lib/seo')>()),
  useSeo: (input: { title: string; canonical?: string }) => { h.seo.push(input); },
}));
vi.mock('@/hooks/use-toast', () => ({ toast: vi.fn(), useToast: () => ({ toast: vi.fn() }) }));
vi.mock('@/integrations/supabase/rpcLoose', () => ({ rpcLoose: vi.fn() }));
vi.mock('@/lib/profileViewEmit', () => ({ emitProfileView: vi.fn() }));
vi.mock('@/components/layout/GlobalLayout', () => ({
  default: ({ children }: { children: ReactNode }) => <div>{children}</div>,
}));
vi.mock('@/integrations/supabase/client', () => {
  const ALL = [...ACTIVE.map((c) => ({ ...c, is_active: true })), ...INACTIVE.map((c) => ({ ...c, is_active: false }))];
  const builder = () => {
    const filters: [string, unknown][] = [];
    const b: Record<string, unknown> = {
      select: () => b,
      order: () => b,
      limit: () => b,
      eq: (k: string, v: unknown) => { filters.push([k, v]); return b; },
      then: (resolve: (v: unknown) => unknown) => {
        if (h.failCities) return Promise.resolve({ data: null, error: { message: 'down' } }).then(resolve);
        const rows = ALL.filter((r) => filters.every(([k, v]) => (r as Record<string, unknown>)[k] === v))
          .map(({ slug, name }) => ({ slug, name }));
        return Promise.resolve({ data: rows, error: null }).then(resolve);
      },
    };
    return b;
  };
  const teacher = (slug: string, i: number) => ({
    entity_id: `${slug}-${i}`, first_name: `T${i}`, surname: 'Teach', hide_surname: false, photo_url: null,
    city: ACTIVE.find((c) => c.slug === slug)?.name ?? null, nationality: null, nationality_code: null,
    years_teaching: 3, teaching_styles: ['Sensual'], offers_group: true, offers_private: false, languages: [], instagram: null, website: null,
  });
  return {
    supabase: {
      from: () => builder(),
      rpc: async (name: string, args: Record<string, unknown>) => {
        if (name !== 'get_public_teachers_list_v1') return { data: null, error: null };
        h.rpcCalls.push(args);
        if (h.failTeachers) return { data: null, error: { message: 'down' } };
        const slug = String(args.p_city_slug);
        const active = ACTIVE.some((c) => c.slug === slug);
        const n = active ? COUNTS[slug] : 0;
        return { data: Array.from({ length: n }, (_, i) => teacher(slug, i)), error: null };
      },
    },
  };
});

import Teachers from '@/pages/Teachers';
import TeachersCityRedirect from '../TeachersCityRedirect';

const city = vi.hoisted(() => ({ slug: null as string | null }));
vi.mock('@/contexts/CityContext', () => ({ useCity: () => ({ citySlug: city.slug, setCitySlug: vi.fn() }) }));

function Where() {
  const loc = useLocation();
  return <output data-testid="where">{loc.pathname}</output>;
}

function renderAt(path: string) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={qc}>
      <MemoryRouter initialEntries={[path]}>
        <Routes>
          <Route path="/teachers" element={<TeachersCityRedirect />} />
          <Route path="/city/:slug/teachers" element={<><Teachers /><Where /></>} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

const cardCount = () => screen.queryAllByTestId('teacher-card').length;

beforeEach(() => {
  installJsdomPolyfills();
  h.rpcCalls.length = 0;
  h.seo.length = 0;
  h.failTeachers = false;
  h.failCities = false;
  city.slug = null;
});
afterEach(cleanup);

describe('Teachers page, city x shape', () => {
  it.each(SHAPES)('$name', async (s) => {
    renderAt(`/city/${s.slug}/teachers`);
    await waitFor(() => expect(screen.getByTestId('teachers-city-heading').textContent).toBe(s.heading));
    await waitFor(() => expect(cardCount()).toBe(s.cards));
    // The list is narrowed on the SERVER: p_city_slug is never null. It is fetched in
    // parallel with the cities read on the URL's slug, so an active city costs ONE call
    // and a fallback a second one, for London.
    const slugs = h.rpcCalls.map((a) => a.p_city_slug);
    expect(slugs).toEqual(s.mode === 'active' ? [s.listSlug] : [s.slug.toLowerCase(), s.listSlug]);
    const note = screen.queryByTestId('teachers-city-note');
    if (s.note) {
      expect(note?.textContent).toContain(s.note);
      if (s.fallbackLine) expect(note?.textContent).toContain(s.fallbackLine);
      // A real action: "Tell us" opens the listing request form.
      fireEvent.click(screen.getByRole('button', { name: TELL_US_LABEL }));
      expect(await screen.findByRole('button', { name: /submit|send/i })).toBeTruthy();
      // Bristol polish: the TEACHER variant -- never "Event link" on a teacher tip.
      expect(screen.getByText('Their profile or Instagram link')).toBeTruthy();
      expect(screen.queryByText('Event link')).toBeNull();
      expect(screen.getByTestId('listing-form-heading').textContent).toMatch(/^Know a teacher/);
    } else {
      expect(note).toBeNull();
    }
    if (s.cards === 0) expect(screen.getByRole('button', { name: /See another city/ })).toBeTruthy();
    const last = h.seo[h.seo.length - 1];
    expect(last.title).toBe(s.heading);
    expect(last.canonical).toBe(`https://www.bachatacalendar.co.uk${s.canonical}`);
    // No client-side City filter tab any more.
    expect(screen.queryByRole('button', { name: /City$/ })).toBeNull();
  });

  it('the switcher lists only ACTIVE cities and navigates to the picked one', async () => {
    renderAt('/city/london-gb/teachers');
    await waitFor(() => expect(cardCount()).toBe(46));
    fireEvent.click(screen.getByTestId('teachers-city-switcher'));
    const sheet = await screen.findByTestId('teachers-city-sheet');
    const names = [...sheet.querySelectorAll('li button')].map((b) => b.textContent);
    expect(names).toEqual(['London', 'Manchester', 'Leeds']);
    expect(names).not.toContain('Madrid');
    fireEvent.click(screen.getByRole('button', { name: 'Manchester' }));
    await waitFor(() => expect(screen.getByTestId('where').textContent).toBe('/city/manchester-gb/teachers'));
    await waitFor(() => expect(screen.getByTestId('teachers-city-heading').textContent).toBe('Bachata Teachers in Manchester'));
  });

  it('a teachers read error says what to do and retries', async () => {
    h.failTeachers = true;
    renderAt('/city/london-gb/teachers');
    expect((await screen.findByTestId('teachers-load-error')).textContent).toMatch(/try again/i);
    h.failTeachers = false;
    fireEvent.click(screen.getByRole('button', { name: /Try again/ }));
    await waitFor(() => expect(cardCount()).toBe(46));
  });

  it('a cities read error is an error state, never a blank page', async () => {
    h.failCities = true;
    renderAt('/city/london-gb/teachers');
    expect(await screen.findByTestId('teachers-load-error')).toBeTruthy();
  });

  it.each([
    { visitor: 'manchester-gb', to: '/city/manchester-gb/teachers' },
    { visitor: null, to: '/city/london-gb/teachers' },
  ])('/teachers redirects visitor city $visitor to $to', async ({ visitor, to }) => {
    city.slug = visitor;
    renderAt('/teachers');
    await waitFor(() => expect(screen.getByTestId('where').textContent).toBe(to));
  });
});

// N1 / N2 (critique of PR #1049): a city change is a new list. The page stays
// mounted across the switch here (one <Route> element), which is the shape in
// which state used to leak.
describe('state resets when the city changes', () => {
  const pick = async (name: string) => {
    fireEvent.click(screen.getByTestId('teachers-city-switcher'));
    await screen.findByTestId('teachers-city-sheet');
    fireEvent.click(screen.getByRole('button', { name }));
  };

  it('N1: "Tell us" opened on an inactive city is closed after switching city', async () => {
    renderAt('/city/madrid-es/teachers');
    await waitFor(() => expect(screen.getByTestId('teachers-city-note').textContent).toContain('Madrid'));
    fireEvent.click(screen.getByRole('button', { name: TELL_US_LABEL }));
    expect(await screen.findByRole('button', { name: /submit|send/i })).toBeTruthy();
    await pick('Leeds');
    await waitFor(() => expect(screen.getByTestId('teachers-city-heading').textContent).toBe('Bachata Teachers in Leeds'));
    // Leeds (active, 0) also shows the note: it must open CLOSED.
    await waitFor(() => expect(screen.getByTestId('teachers-city-note').textContent).toContain('Leeds'));
    expect(screen.getByRole('button', { name: TELL_US_LABEL })).toBeTruthy();
    expect(screen.queryByRole('button', { name: /submit|send/i })).toBeNull();
  });

  it('N2: a Name filter set in London is cleared when switching to Manchester', async () => {
    renderAt('/city/london-gb/teachers');
    await waitFor(() => expect(cardCount()).toBe(46));
    fireEvent.click(screen.getByRole('button', { name: /Name$/ }));
    fireEvent.change(await screen.findByPlaceholderText('Search by name...'), { target: { value: 'zzz' } });
    await waitFor(() => expect(screen.getByText('No teachers match your filters.')).toBeTruthy());
    await pick('Manchester');
    await waitFor(() => expect(screen.getByTestId('teachers-city-heading').textContent).toBe('Bachata Teachers in Manchester'));
    await waitFor(() => expect(cardCount()).toBe(5));
    expect(screen.queryByText('No teachers match your filters.')).toBeNull();
    await waitFor(() => expect(screen.queryByPlaceholderText('Search by name...')).toBeNull());
  });
});

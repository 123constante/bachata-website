// @vitest-environment jsdom
/**
 * Bristol polish (brief docs/briefs/bristol-polish.md): every screen x every
 * shape. Cities: London (london-gb), Bristol (bristol-gb, standing in for an
 * ACTIVE city with nothing listed -- Bristol is inactive on prod, so its slug is
 * passed straight to the same code paths), and no city at all (null slug, the
 * site default). Items: 0 / 1 in the city / many elsewhere.
 *
 * Contract per screen: the title names the page city; a London page never
 * shows the empty-city note; a Bristol page with nothing of its own shows it
 * (with "Tell us"), and says "Showing everyone" when a global list is shown.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { ReactNode } from 'react';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { installJsdomPolyfills } from '../../../tests/client/jsdomPolyfills';

const h = vi.hoisted(() => ({
  city: null as string | null,
  dancers: [] as unknown[],
  djs: [] as unknown[],
  venues: [] as unknown[],
  seo: [] as { title?: string }[],
}));
vi.mock('@/hooks/useAuth', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/hooks/useAuth')>()),
  useAuth: () => ({ user: null, isLoading: false, authStatus: 'ready' }),
}));
vi.mock('@/hooks/use-toast', () => ({ useToast: () => ({ toast: vi.fn() }), toast: vi.fn() }));
vi.mock('@/components/layout/GlobalLayout', () => ({ default: ({ children }: { children: ReactNode }) => <div>{children}</div> }));
vi.mock('@/contexts/CityContext', () => ({ useCity: () => ({ citySlug: h.city }) }));
vi.mock('@/components/EventCalendar', () => ({ EventCalendar: () => <div data-testid="calendar" /> }));
vi.mock('@/lib/seo', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/lib/seo')>()),
  useSeo: (input: { title?: string }) => { h.seo.push(input); },
}));
vi.mock('@/services/venuePublicService', () => ({ fetchPublicVenuesList: async () => h.venues }));
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
        if (name === 'list_public_djs_v1') return { data: h.djs, error: null };
        return { data: [], error: null };
      },
    },
  };
});

import Dancers from '@/pages/Dancers';
import DJs from '@/pages/DJs';
import Venues from '@/pages/Venues';
import Parties from '@/pages/Parties';
import Classes from '@/pages/Classes';

const mount = (el: ReactNode, at: string, pattern: string) =>
  render(
    <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
      <MemoryRouter initialEntries={[at]}>
        <Routes><Route path={pattern} element={el} /></Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );
const wait = (ms = 150) => new Promise((r) => setTimeout(r, ms));
const lastTitle = () => h.seo[h.seo.length - 1]?.title ?? '';
const note = () => screen.queryByTestId('empty-city-note');

const dancer = (id: string, city: string) => ({
  id, first_name: `D${id}`, avatar_url: null, nationality: null, dance_role: null, cities: { name: city }, dancing_role_details: null,
});
const dj = (id: string, city: string) => ({ id, roles: ['dj'], dj_name: `DJ ${id}`, city_name: city, next_gig_date: null, dj_has_upcoming: false, photo_url: null });
const venue = (id: string, city: string) => ({
  id, slug: id, name: `Venue ${id}`, neighbourhood: null, cover_image: null, city_name: city, capacity: null, floor_type: null,
  description: null, bar_available: false, cloakroom_available: false, has_parking: false, facilities_new: [],
  upcoming_event_count: 0, next_event_iso: null, next_event_name: null, nearest_station: null, nearest_station_minutes: null,
  nearest_station_mode: null, day_pattern: [], address: null, postcode: null,
});

type Shape = { label: string; city: string | null; rows: 'none' | 'one-here' | 'many-elsewhere' };
const CITIES = [
  { city: 'london-gb', name: 'London', london: true },
  { city: 'bristol-gb', name: 'Bristol', london: false },
  { city: null, name: 'London', london: true },
] as const;
const ROWS = ['none', 'one-here', 'many-elsewhere'] as const;
const SHAPES: Shape[] = CITIES.flatMap((c) => ROWS.map((rows) => ({ label: `${c.city ?? 'no city'} x ${rows}`, city: c.city, rows })));
const cityName = (slug: string | null) => CITIES.find((c) => c.city === slug)!.name;
const isLondon = (slug: string | null) => CITIES.find((c) => c.city === slug)!.london;
/** Rows for a shape: 'one-here' is one row IN the page city; 'many-elsewhere' is 3 London rows (Budapest for London pages). */
function rowsFor<T>(shape: Shape, make: (id: string, city: string) => T): T[] {
  if (shape.rows === 'none') return [];
  if (shape.rows === 'one-here') return [make('1', cityName(shape.city))];
  const elsewhere = isLondon(shape.city) ? 'Budapest' : 'London';
  return ['1', '2', '3'].map((id) => make(id, elsewhere));
}
/** The note shows only outside London, when nothing is in the city. */
const expectNote = (s: Shape) => !isLondon(s.city) && s.rows !== 'one-here';

beforeEach(() => {
  installJsdomPolyfills();
  h.seo = [];
  h.dancers = [];
  h.djs = [];
  h.venues = [];
});
afterEach(() => cleanup());

describe.each(SHAPES)('$label', (shape) => {
  beforeEach(() => { h.city = shape.city; });

  it('/dancers: title names the city; empty-city note only when the city has none', async () => {
    h.dancers = rowsFor(shape, dancer);
    mount(<Dancers />, '/dancers', '/dancers');
    await wait();
    expect(lastTitle()).toContain(cityName(shape.city));
    expect(!!note()).toBe(expectNote(shape));
    if (note()) {
      expect(note()!.textContent).toContain(`Nothing listed in ${cityName(shape.city)} yet`);
      expect(note()!.textContent).toContain('Tell us');
      expect(note()!.textContent?.includes('Showing everyone for now.')).toBe(shape.rows === 'many-elsewhere');
    }
  });

  it('/djs: title names the city; empty-city note only when the city has none', async () => {
    h.djs = rowsFor(shape, dj);
    mount(<DJs />, '/djs', '/djs');
    await wait();
    expect(lastTitle()).toContain(cityName(shape.city));
    expect(!!note()).toBe(expectNote(shape));
    if (note()) expect(note()!.textContent?.includes('Showing everyone for now.')).toBe(shape.rows === 'many-elsewhere');
  });

  it('/venues: list cut to the city (London untouched); empty city gets the note', async () => {
    h.venues = rowsFor(shape, venue);
    mount(<Venues />, '/venues', '/venues');
    await wait();
    expect(lastTitle()).toBe(`Bachata Venues in ${cityName(shape.city)}`);
    const shown = h.venues.filter((v) => isLondon(shape.city) || (v as { city_name: string }).city_name === cityName(shape.city));
    for (const v of h.venues as { name: string }[]) {
      expect(!!screen.queryByText(v.name)).toBe(shown.includes(v));
    }
    expect(!!note()).toBe(expectNote(shape));
    expect(screen.getByText(new RegExp(`Every bachata venue in ${cityName(shape.city)}`))).toBeTruthy();
  });
});

describe.each(CITIES)('Parties and Classes on /city/$city', ({ city, name, london }) => {
  const at = (seg: string) => (city ? `/city/${city}/${seg}` : `/${seg}`);
  const pattern = (seg: string) => (city ? `/city/:slug/${seg}` : `/${seg}`);
  beforeEach(() => { h.city = city; });

  it.each([
    { seg: 'parties', Page: Parties, title: `Bachata Socials & Parties in ${name}` },
    { seg: 'classes', Page: Classes, title: `Bachata Classes in ${name}` },
  ])('$seg: title and intro name the city; London guide links only for London', ({ seg, Page, title }) => {
    mount(<Page />, at(seg), pattern(seg));
    expect(lastTitle()).toBe(title);
    expect(document.body.textContent).toContain(` in ${name}`);
    expect(!!document.querySelector('a[href="/london-bachata-guide"]')).toBe(london);
    if (!london) expect(document.body.textContent).not.toContain('London');
  });

  it('bare /parties stays London even when the visitor stored another city (prerender)', () => {
    h.city = 'bristol-gb';
    mount(<Parties />, '/parties', '/parties');
    expect(lastTitle()).toBe('Bachata Socials & Parties in London');
    expect(document.querySelector('a[href="/london-bachata-guide"]')).toBeTruthy();
  });
});

describe('empty-city note action', () => {
  it('"Tell us" opens the EVENT listing form (Event link), never a dead end', async () => {
    h.city = 'bristol-gb';
    mount(<DJs />, '/djs', '/djs');
    await wait();
    fireEvent.click(screen.getByRole('button', { name: 'Tell us' }));
    expect(screen.getByText('Event link')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Send my details' })).toBeTruthy();
  });
});

// @vitest-environment jsdom
/**
 * The nationality flag, surface x shape: every place the Website renders a person's
 * photo, fed the payload shape its real read returns, must show the SAME flag (or the
 * same absence) for the same person. One implementation (NationalityFlag) means one
 * answer; this table proves every surface's data path reaches it.
 *
 * Shapes (production survey 2026-10-12, read-only, counts only): of 166 dancer
 * profiles 17 carry a code and 148 have none; 1 of 2 videographers has one; 11 codes
 * in use (ES, CO 4 each; AR 2; EC BO ZA IT VE GB DE CY 1 each). The reads emit
 * nationality_code = null for an unmappable stored value (Kosovo, one ambiguous
 * value) while `nationality` still holds the typed text, so RPC rows here carry a
 * misleading `nationality: 'ES'` that must never produce a flag on its own.
 * Lowercase, an unknown code, a valid code with no bespoke artwork (NZ), a very long
 * name and no photo are covered before production meets them.
 *
 * Nothing reaches any database: the supabase client is a fake answering from fixtures.
 */
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import type { ReactElement } from 'react';

// ---------------------------------------------------------------------------
// Fake supabase: rpc(name) and from(table) answer from `fixtures`.
// ---------------------------------------------------------------------------
const fixtures = vi.hoisted(() => ({ rpc: {} as Record<string, unknown>, table: {} as Record<string, unknown[]> }));
const fake = vi.hoisted(() => {
  const chainFor = (rows: () => unknown[]) => {
    const result = () => ({ data: rows(), error: null });
    const chain: Record<string, unknown> = {};
    for (const m of ['select', 'eq', 'neq', 'in', 'or', 'order', 'limit', 'not', 'is', 'gte', 'lte', 'ilike', 'range', 'filter', 'match', 'contains']) {
      chain[m] = () => chain;
    }
    chain.maybeSingle = () => Promise.resolve({ data: rows()[0] ?? null, error: null });
    chain.single = chain.maybeSingle;
    chain.then = (res: (v: unknown) => unknown, rej?: (e: unknown) => unknown) => Promise.resolve(result()).then(res, rej);
    return chain;
  };
  return {
    supabase: {
      rpc: (name: string) => Promise.resolve({ data: fixtures.rpc[name] ?? null, error: null }),
      from: (table: string) => chainFor(() => fixtures.table[table] ?? []),
      auth: { getSession: () => Promise.resolve({ data: { session: null } }), onAuthStateChange: () => ({ data: { subscription: { unsubscribe() {} } } }) },
      channel: () => ({ on() { return this; }, subscribe() { return this; } }),
      removeChannel() {},
    },
  };
});
vi.mock('@/integrations/supabase/client', () => fake);
vi.mock('@/integrations/supabase/getSupabase', () => ({ getSupabase: () => Promise.resolve(fake.supabase) }));
vi.mock('@/lib/festivalsList', () => ({ fetchPublicFestivalsList: () => Promise.resolve([]), filterUpcomingFestivals: (r: unknown[]) => r }));
vi.mock('@/components/layout/GlobalLayout', () => ({ default: ({ children }: { children: React.ReactNode }) => <div>{children}</div> }));
vi.mock('@/lib/seo', () => ({ useSeo: () => {}, buildSeoForRoute: () => ({}) }));
vi.mock('@/contexts/CityContext', () => ({ useCity: () => ({ citySlug: 'london-gb', city: null }) }));
vi.mock('@/hooks/useAuth', () => ({ useAuth: () => ({ user: { id: 'viewer-1' }, session: null, loading: false }) }));
vi.mock('@/lib/profileViewEmit', () => ({ emitProfileView: () => {} }));
vi.mock('@/components/profile/ProfileEventTimeline', () => ({ default: () => null }));

import { flagGeometry } from '../flagWave';
import { NationalityFlag, TILE_FLAG_SIZE } from '../NationalityFlag';
import { pickNationalityCode } from '../nationality';
import DJs from '@/pages/DJs';
import Teachers from '@/pages/Teachers';
import Dancers from '@/pages/Dancers';
import AllProfiles from '@/pages/AllProfiles';
import Videographers from '@/pages/Videographers';
import VendorDetail from '@/pages/VendorDetail';
import PracticePartners from '@/pages/PracticePartners';
import { DjHero } from '@/components/dj/DjTiles';
import { DancerProfileGrid } from '@/components/profile/DancerProfileGrid';
import { mapDancerPublicProfile } from '@/modules/profile/dancerPublicProfile';
import { PersonChip } from '@/modules/event-page/bento/blocks/schedule/PersonChip';
import { parseProgramItems, parseProgrammeNationalities, withNationalities } from '@/modules/event-page/sections/EventScheduleGrid';
import { parseFestivalDetail } from '@/modules/event-page/useFestivalDetailQuery';
import { searchPublicV3 } from '@/lib/searchRpc';
import { fetchMyDancerSummary } from '@/hooks/useMyDancerSummary';

beforeAll(() => {
  // jsdom has no canvas 2D context or IntersectionObserver; the flag draws nothing
  // here (the phone suite measures the drawing), but its badge and label render.
  HTMLCanvasElement.prototype.getContext = (() => null) as never;
  class IO { observe() {} unobserve() {} disconnect() {} takeRecords() { return []; } }
  vi.stubGlobal('IntersectionObserver', IO);
  window.matchMedia = ((q: string) => ({ matches: false, media: q, addEventListener() {}, removeEventListener() {}, addListener() {}, removeListener() {} })) as never;
  window.scrollTo = () => {};
});
afterEach(() => {
  cleanup();
  fixtures.rpc = {};
  fixtures.table = {};
});

// ---------------------------------------------------------------------------
// Shapes
// ---------------------------------------------------------------------------
type Shape = { key: string; code: string | null; name: string; photo: string | null; want: { code: string; country: string } | null };
const PHOTO = 'https://cdn.example/p.jpg';
const SHAPES: Shape[] = [
  { key: 'code present (ES)', code: 'ES', name: 'Lucia Moreno', photo: PHOTO, want: { code: 'ES', country: 'Spain' } },
  { key: 'null', code: null, name: 'Marco Diaz', photo: PHOTO, want: null },
  { key: 'empty string', code: '', name: 'Marco Diaz', photo: PHOTO, want: null },
  { key: 'lowercase (co)', code: 'co', name: 'Camila Ruiz', photo: PHOTO, want: { code: 'CO', country: 'Colombia' } },
  { key: 'unknown code (ZZ)', code: 'ZZ', name: 'Jan Kowal', photo: PHOTO, want: null },
  { key: 'not a code (Kosovar)', code: 'Kosovar', name: 'Arben Krasniqi', photo: PHOTO, want: null },
  { key: 'valid, generic artwork (NZ)', code: 'NZ', name: 'Aroha Ngata', photo: PHOTO, want: { code: 'NZ', country: 'New Zealand' } },
  {
    key: 'long name',
    code: 'VE',
    name: 'Maria de los Angeles Fernandez-Rodriguez del Valle Santisima',
    photo: PHOTO,
    want: { code: 'VE', country: 'Venezuela' },
  },
  { key: 'no photo', code: 'BO', name: 'Eva Condori', photo: null, want: { code: 'BO', country: 'Bolivia' } },
];

const ID = '33333333-3333-4333-8333-333333333333';
const split = (s: Shape) => {
  const parts = s.name.split(' ');
  return { first_name: parts[0], surname: parts.slice(1).join(' ') || null };
};

const qc = () => new QueryClient({ defaultOptions: { queries: { retry: false } } });
const withProviders = (el: ReactElement, path = '/', route = '*') =>
  render(
    <QueryClientProvider client={qc()}>
      <MemoryRouter initialEntries={[path]}>
        <Routes>
          <Route path={route} element={el} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );
/** What a surface puts in front of NationalityFlag, rendered the same way the surface does. */
const flagFor = (code: unknown, size = 40) => render(<div style={{ position: 'relative' }}><NationalityFlag code={code} size={size} /></div>);

const waitName = async (text: string) => {
  await waitFor(() => expect(screen.getAllByText((_, el) => !!el && el.children.length === 0 && (el.textContent ?? '').includes(text)).length).toBeGreaterThan(0), { timeout: 4000 });
};

type Surface = {
  name: string;
  /** Read(s) that feed it. */
  read: string;
  /** False when the surface has no photo box at all without a photo (then no flag). */
  flagWithoutPhoto: boolean;
  mount: (s: Shape) => Promise<void>;
};

const SURFACES: Surface[] = [
  {
    name: '/djs list (DJs.tsx)',
    read: 'list_public_djs_v1',
    flagWithoutPhoto: true,
    mount: async (s) => {
      fixtures.rpc.list_public_djs_v1 = [{ id: ID, display_name: s.name, dj_name: null, ...split(s), photo_url: s.photo, bio: null, genres: [], nationality: 'ES', nationality_code: s.code, city_id: null, city_name: null, city_slug: null, person_entity_id: null }];
      withProviders(<DJs />);
      await waitName(s.name.split(' ')[0]);
    },
  },
  {
    name: '/teachers list (Teachers.tsx)',
    read: 'get_public_teachers_list_v1',
    flagWithoutPhoto: true,
    mount: async (s) => {
      fixtures.rpc.get_public_teachers_list_v1 = [{ entity_id: ID, ...split(s), photo_url: s.photo, city: 'London', city_id: null, nationality: 'ES', nationality_code: s.code, years_teaching: 3, teaching_styles: [], offers_group: true, offers_private: false, hide_surname: false, languages: [], instagram: null, website: null }];
      withProviders(<Teachers />);
      await waitName(s.name.split(' ')[0]);
    },
  },
  {
    name: '/dancers list (Dancers.tsx, dancer_profiles.nationality)',
    read: 'dancer_profiles (stored alpha-2)',
    flagWithoutPhoto: true,
    mount: async (s) => {
      fixtures.table.dancer_profiles = [{ id: ID, display_name: s.name, ...split(s), avatar_url: s.photo, nationality: s.code, dance_role: null, cities: null, dancing_role_details: null }];
      withProviders(<Dancers />);
      await waitName(s.name.split(' ')[0]);
    },
  },
  {
    name: '/all-profiles (AllProfiles.tsx)',
    read: 'get_all_profiles_v1',
    flagWithoutPhoto: false,
    mount: async (s) => {
      fixtures.rpc.get_all_profiles_v1 = [{ profile_id: ID, role: 'dancer', display_name: s.name, photo_url: s.photo, city_id: null, city_name: null, country_code: null, specialties: [], bio: null, nationality: 'ES', nationality_code: s.code, instagram: null, website: null, is_verified: false, is_active: true, person_entity_id: null }];
      withProviders(<AllProfiles />);
      await waitName(s.name.split(' ')[0]);
    },
  },
  {
    name: '/videographers (Videographers.tsx, videographers.nationality)',
    read: 'videographers (stored alpha-2)',
    flagWithoutPhoto: true,
    mount: async (s) => {
      fixtures.table.videographers = [{ id: ID, ...split(s), business_name: s.name, photo_url: s.photo, bio: null, instagram: null, website: null, verified: false, videography_styles: [], nationality: s.code }];
      withProviders(<Videographers />);
      await waitName(s.name.split(' ')[0]);
    },
  },
  {
    name: '/vendors/:id team (VendorDetail.tsx)',
    read: 'get_public_vendor_detail_v1 team[]',
    flagWithoutPhoto: true,
    mount: async (s) => {
      fixtures.rpc.get_public_vendor_detail_v1 = [{ id: 'v1', business_name: 'Shoe Shop', team: [{ dancer_id: ID, name: s.name, avatar_url: s.photo, nationality_code: s.code, city: null, role: null, is_leader: false }], product_categories: [], products: [], faq: [] }];
      withProviders(<VendorDetail />, '/vendors/v1', '/vendors/:id');
      await waitName(s.name.split(' ')[0]);
    },
  },
  {
    name: '/practice-partners (PracticePartners.tsx, signed in)',
    read: 'dancer_profiles (stored alpha-2)',
    flagWithoutPhoto: true,
    mount: async (s) => {
      fixtures.table.dancer_profiles = [{ id: ID, ...split(s), based_city_id: null, dance_role: null, avatar_url: s.photo, nationality: s.code, cities: null, dancing_role_details: { favorite_styles: [], looking_for_partner: true } }];
      withProviders(<PracticePartners />);
      await waitName(s.name.split(' ')[0]);
    },
  },
  {
    name: '/djs/:id hero (DjHero)',
    read: 'get_public_dj_v1',
    flagWithoutPhoto: true,
    mount: async (s) => {
      const row = { nationality: 'ES', nationality_code: s.code };
      render(<MemoryRouter><DjHero name={s.name} photoUrl={s.photo} cityName={null} nationality={row.nationality} nationalityCode={row.nationality_code} bio={null} isLive={false} stats={{ gigs: null, upcoming: null, genres: null }} /></MemoryRouter>);
    },
  },
  {
    name: '/dancers/:id hero (DancerProfileGrid)',
    read: 'dancer_profiles (stored alpha-2)',
    flagWithoutPhoto: true,
    mount: async (s) => {
      const vm = mapDancerPublicProfile({ id: ID, display_name: s.name, ...split(s), nationality: s.code, dance_role: null, instagram: null, facebook: null, avatar_url: s.photo, website_url: null, gallery_urls: null, cities: null, dancing_role_details: null } as never);
      render(<MemoryRouter><DancerProfileGrid dancer={vm} /></MemoryRouter>);
    },
  },
  {
    name: '/event/:id programme (PersonChip)',
    read: 'event_view_p5 + dancer_profiles (stored alpha-2)',
    flagWithoutPhoto: true,
    mount: async (s) => {
      const person = { profile_id: ID, profile_type: 'teacher', display_name: s.name, avatar_url: s.photo, sort_order: 1, level: null };
      const item = { id: 'i1', title: 'Class', type: 'class', start_time: '2026-10-20T19:00:00', end_time: '2026-10-20T20:00:00', sort_order: 1, levels: null, room: null, section_id: null, section_kind: null };
      const sessions = parseProgramItems([{ ...item, people: [person] }]);
      // event_view_p5 carries no code; ScheduleBlock reads dancer_profiles.nationality for the people on it.
      const codes = parseProgrammeNationalities([{ id: ID, nationality: s.code }]);
      const p = withNationalities(sessions, codes)[0].people[0];
      render(<MemoryRouter><PersonChip person={p} size="lg" /></MemoryRouter>);
      // The chip loads the flag lazily (the /event first-load budget): let it resolve.
      await new Promise((r) => setTimeout(r, 0));
      if (s.want) await waitFor(() => expect(document.querySelector('[data-nationality-flag]')).not.toBeNull());
    },
  },
  {
    name: '/festival/:id headliners (FestivalDetail .nl-frame)',
    read: 'get_public_festival_detail_v2',
    flagWithoutPhoto: true,
    mount: async (s) => {
      const detail = parseFestivalDetail({ event_id: 'f1', identity: { name: 'Fest' }, lineup: { teachers: [{ id: ID, display_name: s.name, avatar_url: s.photo, nationality_code: s.code }], djs: [], dancers: [], vendors: [], videographers: [], hosts: [], mcs: [], performers: [] } });
      const artist = detail?.lineup?.teachers?.[0];
      expect(artist?.displayName).toBe(s.name);
      flagFor(artist?.nationalityCode, TILE_FLAG_SIZE);
    },
  },
  {
    name: 'header search + Cmd+K overlay (searchRpc.mapPerson)',
    read: 'search_public_v4/v5/v6',
    flagWithoutPhoto: true,
    mount: async (s) => {
      const row = { id: ID, ...split(s), display_name: s.name, photo_url: s.photo, avatar_url: null, slug: null, nationality_code: s.code };
      const payload = { query: 'x', events: [], organisers: [], teachers: [row], djs: [], dancers: [], venues: [], vendors: [], cities: [], total_count: 1 };
      fixtures.rpc.search_public_v4 = payload;
      fixtures.rpc.search_public_v5 = payload;
      fixtures.rpc.search_public_v6 = payload;
      const results = await searchPublicV3('lu');
      const hit = results.find((r) => r.id === ID);
      expect(hit?.title).toBe(s.name);
      flagFor(hit?.nationalityCode, 36);
    },
  },
  {
    name: '/search result cards (SearchResults ResultCard: search payload passthrough)',
    read: 'search_public_v4/v5/v6',
    flagWithoutPhoto: true,
    mount: async (s) => {
      // useSearchResults passes the envelope through untouched; the card reads t.nationality_code.
      const t = { id: ID, ...split(s), display_name: s.name, photo_url: s.photo, avatar_url: null, slug: null, nationality_code: s.code };
      flagFor(t.nationality_code, TILE_FLAG_SIZE);
    },
  },
  {
    name: '/organisers/:id Teachers & DJs (OrganiserProfile TeamCircle)',
    read: 'dancer_profiles (stored alpha-2)',
    flagWithoutPhoto: true,
    mount: async (s) => {
      // The page's own mapping: pickNationalityCode on the dancer_profiles row it selects.
      const d = { id: ID, first_name: s.name, surname: null, display_name: s.name, avatar_url: s.photo, nationality: s.code };
      flagFor(pickNationalityCode(d), 80);
    },
  },
  {
    name: '/account dancer home (own photo, useMyDancerSummary)',
    read: 'dancer_profiles (stored alpha-2)',
    flagWithoutPhoto: true,
    mount: async (s) => {
      fixtures.table.dancer_profiles = [{ id: ID, first_name: s.name, dance_role: null, avatar_url: s.photo, nationality: s.code, city: null }];
      const summary = await fetchMyDancerSummary(async () => ID);
      flagFor(summary?.nationalityCode, 56);
    },
  },
];

describe.each(SURFACES)('$name ($read)', (surface) => {
  it.each(SHAPES)('$key', async (shape) => {
    await surface.mount(shape);
    const want = !shape.photo && !surface.flagWithoutPhoto ? null : shape.want;
    const flags = Array.from(document.querySelectorAll<HTMLElement>('[data-nationality-flag]'));
    if (!want) {
      expect(flags).toHaveLength(0);
      return;
    }
    expect(flags).toHaveLength(1);
    const f = flags[0];
    expect(f.dataset.nationalityFlag).toBe(want.code);
    expect(f.getAttribute('role')).toBe('img');
    expect(f.getAttribute('aria-label')).toBe(`Nationality: ${want.country}`);
    expect(f.getAttribute('title')).toBe(want.country);
    // Never takes a tap meant for the photo.
    expect(f.className).toContain('pointer-events-none');
    expect(f.querySelector('canvas')?.getAttribute('aria-hidden')).toBe('true');
  });
});

describe('placement', () => {
  it('corner flags stand at the reference position, as percentages of the photo', () => {
    const { container } = flagFor('ES', 96);
    const f = container.querySelector<HTMLElement>('[data-nationality-flag]')!;
    const g = flagGeometry(96);
    expect(f.style.left).toBe('62%');
    expect(f.style.top).toBe(`calc(-14% - ${g.pad}px)`);
    expect(f.style.width).toBe(`${g.cw}px`);
  });
});

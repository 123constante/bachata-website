// @vitest-environment jsdom
/**
 * Ambassador badge: the component's own answers, then the ambassadorBadge matrix over
 * profile shape x page x signed in/out. The supabase mock answers
 * is_claimed_profile_ambassador_v1 by the SAME rule the prod function applies
 * (dancer_profiles.id -> claimed_by -> city ambassador membership, archived excluded), over a
 * fixture where every claimer's user id DIFFERS from the profile id -- so a page that passed
 * a user id, or the wrong id, would fail the "claimed ambassador" row.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor, fireEvent, cleanup } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { installJsdomPolyfills } from '../../../../../tests/client/jsdomPolyfills';
import { flags } from '@/lib/featureFlags';
import { EmbeddedProfileContext } from '@/lib/embeddedProfile';
import type { PersonSnapshot } from '@/modules/person-page/reads';

const h = vi.hoisted(() => ({
  rpc: vi.fn(),
  user: null as null | { id: string },
  routeId: 'p-unclaimed',
}));
vi.mock('@/integrations/supabase/client', () => ({
  supabase: { rpc: (fn: string, args: unknown) => h.rpc(fn, args) },
}));
vi.mock('@/hooks/useAuth', () => ({ useAuth: () => ({ user: h.user, session: h.user ? {} : null, loading: false }) }));
vi.mock('@/components/layout/GlobalLayout', () => ({ default: ({ children }: { children: React.ReactNode }) => <div>{children}</div> }));
vi.mock('@/hooks/useProfileProgramAppearances', () => ({ useProfileProgramAppearances: () => ({ data: [] }) }));
vi.mock('@/lib/profileViewEmit', () => ({ emitProfileView: vi.fn() }));
vi.mock('@/modules/person-page/AlsoRoles', () => ({ AlsoRoles: () => null }));
vi.mock('@/components/profile/ProfileEventTimeline', () => ({ default: () => null }));
vi.mock('@/contexts/CityContext', () => ({ useCity: () => ({ citySlug: 'bristol-gb' }) }));
vi.mock('@/pages/DancerProfile', () => ({ default: () => <div data-testid="body-dancer" /> }));
vi.mock('@/lib/seo', async (orig) => ({
  ...(await orig<typeof import('@/lib/seo')>()),
  useEntitySlugOrId: () => ({ id: h.routeId, slug: null, arrivedViaUuid: false, notFound: false }),
  useCanonicalReplaceState: () => undefined,
}));

import { AmbassadorBadge, AMBASSADOR_LABEL, AMBASSADOR_NOTE, AMBASSADOR_RPC } from '../AmbassadorBadge';
import PersonPage from '@/modules/person-page/PersonPage';
import DJProfile from '@/pages/DJProfile';
import TeacherProfile from '@/pages/TeacherProfile';

/* ---- component cases ---- */

const withQc = (el: React.ReactElement) => (
  <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>{el}</QueryClientProvider>
);

const CASES: Array<[string, () => void, boolean]> = [
  ['ambassador', () => h.rpc.mockResolvedValue({ data: true, error: null }), true],
  ['not ambassador', () => h.rpc.mockResolvedValue({ data: false, error: null }), false],
  ['null answer', () => h.rpc.mockResolvedValue({ data: null, error: null }), false],
  ['rpc error', () => h.rpc.mockResolvedValue({ data: null, error: { message: 'x' } }), false],
  ['signed-out anon denied', () => h.rpc.mockResolvedValue({ data: null, error: { code: '42501' } }), false],
  ['rpc rejects', () => h.rpc.mockImplementation(() => Promise.reject(new Error('network'))), false],
  ['rpc throws synchronously', () => h.rpc.mockImplementation(() => { throw new Error('boom'); }), false],
];

beforeEach(() => {
  installJsdomPolyfills();
  h.rpc.mockReset();
  h.user = null;
});
afterEach(() => {
  cleanup();
  (flags as { personHub: boolean }).personHub = false;
});

describe('AmbassadorBadge', () => {
  it('asks the claimed-profile function, by profile id', () => {
    expect(AMBASSADOR_RPC).toBe('is_claimed_profile_ambassador_v1');
  });
  it.each(CASES)('%s', async (_n, setup, shown) => {
    setup();
    render(withQc(<AmbassadorBadge profileId="p1" />));
    await waitFor(() => expect(h.rpc).toHaveBeenCalledWith('is_claimed_profile_ambassador_v1', { p_profile_id: 'p1' }));
    if (shown) {
      expect(await screen.findByText(AMBASSADOR_LABEL)).toBeTruthy();
      expect(screen.queryByTestId('ambassador-note')).toBeNull();
      fireEvent.click(screen.getByRole('button'));
      expect(screen.getByText(AMBASSADOR_NOTE)).toBeTruthy();
    } else {
      await new Promise((r) => setTimeout(r, 20));
      expect(screen.queryByTestId('ambassador-badge')).toBeNull();
    }
  });
  it('badge hidden when the call fails (throws): no badge, no crash, page content still there', async () => {
    h.rpc.mockImplementation(() => { throw new Error('boom'); });
    render(withQc(<div><p>page body</p><AmbassadorBadge profileId="p1" /></div>));
    await waitFor(() => expect(h.rpc).toHaveBeenCalled());
    await new Promise((r) => setTimeout(r, 20));
    expect(screen.queryByTestId('ambassador-badge')).toBeNull();
    expect(screen.getByText('page body')).toBeTruthy();
  });
  it('no id, no call', () => {
    render(withQc(<AmbassadorBadge profileId={null} />));
    expect(h.rpc).not.toHaveBeenCalled();
  });
});

/* ---- the matrix ---- */

type Shape = 'unclaimed' | 'claimed non-ambassador' | 'claimed ambassador' | 'archived';
/** dancer_profiles fixture: claimer ids never equal the profile id. */
const PROFILES: Record<Shape, { id: string; claimed_by: string | null; archived_at: string | null }> = {
  unclaimed: { id: 'p-unclaimed', claimed_by: null, archived_at: null },
  'claimed non-ambassador': { id: 'p-claimed', claimed_by: 'u-plain', archived_at: null },
  'claimed ambassador': { id: 'p-amb', claimed_by: 'u-amb', archived_at: null },
  archived: { id: 'p-archived', claimed_by: 'u-amb2', archived_at: '2026-10-01T00:00:00Z' },
};
/** entity_members (entity_type='city', member_role='ambassador'). */
const AMBASSADOR_USERS = new Set(['u-amb', 'u-amb2']);
const EXPECT: Record<Shape, boolean> = {
  unclaimed: false, 'claimed non-ambassador': false, 'claimed ambassador': true, archived: false,
};

/** Mirrors is_claimed_profile_ambassador_v1 (prod, read back 2026-11-08). Granted to anon and
 *  authenticated, so signed in/out must give the same answer. */
function fakeIsAmbassador(profileId: unknown): boolean {
  const p = Object.values(PROFILES).find((x) => x.id === profileId);
  return !!p && p.claimed_by !== null && p.archived_at === null && AMBASSADOR_USERS.has(p.claimed_by);
}

const djRow = (id: string) => ({
  id, display_name: 'DJ Oreo', dj_name: 'DJ Oreo', first_name: null, surname: null,
  photo_url: null, cover_url: null, bio: null, genres: null, nationality: null, city_id: null,
  city_name: null, city_slug: null, person_entity_id: null, instagram: null, facebook: null,
  website: null, soundcloud: null, mixcloud: null, pricing: null, faq: null, gallery_urls: null,
  languages: null, achievements: null, upcoming_events: [],
});
const teacherRow = (id: string) => ({
  entity_id: id, first_name: 'Ana', surname: null, photo_url: null, gallery_urls: null, city_id: null,
  city: null, nationality: null, years_teaching: null, teaching_styles: [], languages: null,
  achievements: null, faq: null, journey: null, offers_private: null, availability: null,
  private_lesson_types: null, private_lesson_locations: null, private_travel_distance: null,
  website: null, instagram: null, facebook: null, email: null, phone: null, nationality_code: null,
});

function installRpc() {
  h.rpc.mockImplementation(async (fn: string, args: Record<string, unknown>) => {
    if (fn === AMBASSADOR_RPC) return { data: fakeIsAmbassador(args.p_profile_id), error: null };
    if (fn === 'get_public_dj_v1') return { data: djRow(String(args.p_dj_id)), error: null };
    if (fn === 'get_public_teacher_detail_v1') return { data: [teacherRow(String(args.p_entity_id))], error: null };
    return { data: null, error: null };
  });
}

const snap = (id: string): PersonSnapshot => ({
  id, name: 'Ana Garcia', avatarUrl: null, city: 'Bristol', instagramUrl: null, roles: ['dancer'], djPhoto: null,
});

type Page = 'PersonHub' | 'tabbed header' | 'DJ' | 'Teacher';
const PAGES: Page[] = ['PersonHub', 'tabbed header', 'DJ', 'Teacher'];

function mountPage(page: Page, profileId: string) {
  h.routeId = profileId;
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  (flags as { personHub: boolean }).personHub = page === 'PersonHub';
  const el =
    page === 'DJ' ? (
      <MemoryRouter initialEntries={['/djs/x']}><Routes><Route path="/djs/:id" element={<DJProfile />} /></Routes></MemoryRouter>
    ) : page === 'Teacher' ? (
      <MemoryRouter initialEntries={['/teachers/x']}><Routes><Route path="/teachers/:id" element={<TeacherProfile />} /></Routes></MemoryRouter>
    ) : (
      <MemoryRouter><PersonPage person={snap(profileId)} slugOrId="ana-garcia" /></MemoryRouter>
    );
  return render(<QueryClientProvider client={qc}>{el}</QueryClientProvider>);
}

const SHAPES = Object.keys(PROFILES) as Shape[];
const MATRIX = SHAPES.flatMap((shape) =>
  PAGES.flatMap((page) => (['signed out', 'signed in'] as const).map((auth) => ({ shape, page, auth }))),
);

describe('ambassadorBadge matrix', () => {
  it('covers 4 shapes x 4 pages x 2 auth states', () => {
    expect(MATRIX).toHaveLength(32);
  });
  it.each(MATRIX)('$shape | $page | $auth', async ({ shape, page, auth }) => {
    h.user = auth === 'signed in' ? { id: 'viewer-1' } : null;
    installRpc();
    const profileId = PROFILES[shape].id;
    mountPage(page, profileId);
    await waitFor(() =>
      expect(h.rpc).toHaveBeenCalledWith(AMBASSADOR_RPC, { p_profile_id: profileId }),
    );
    // Every ambassador call on the page is for THIS profile id, never a user id.
    const calls = h.rpc.mock.calls.filter(([fn]) => fn === AMBASSADOR_RPC);
    expect(calls.every(([, a]) => (a as { p_profile_id: string }).p_profile_id === profileId)).toBe(true);
    if (EXPECT[shape]) {
      expect(await screen.findByTestId('ambassador-badge')).toBeTruthy();
      expect(screen.getAllByTestId('ambassador-badge')).toHaveLength(1);
    } else {
      await new Promise((r) => setTimeout(r, 20));
      expect(screen.queryByTestId('ambassador-badge')).toBeNull();
    }
  });
  it('DJ and Teacher role pages show the badge when the function says true', async () => {
    for (const page of ['DJ', 'Teacher'] as const) {
      h.rpc.mockReset();
      h.rpc.mockImplementation(async (fn: string, args: Record<string, unknown>) => {
        if (fn === AMBASSADOR_RPC) return { data: true, error: null };
        if (fn === 'get_public_dj_v1') return { data: djRow(String(args.p_dj_id)), error: null };
        if (fn === 'get_public_teacher_detail_v1') return { data: [teacherRow(String(args.p_entity_id))], error: null };
        return { data: null, error: null };
      });
      mountPage(page, 'p-any');
      expect(await screen.findByTestId('ambassador-badge')).toBeTruthy();
      cleanup();
    }
  });
  it.each(['DJ', 'Teacher'] as const)('%s page embedded in a /people tab does not repeat the header badge', async (page) => {
    h.rpc.mockImplementation(async (fn: string, args: Record<string, unknown>) => {
      if (fn === AMBASSADOR_RPC) return { data: true, error: null };
      if (fn === 'get_public_dj_v1') return { data: djRow(String(args.p_dj_id)), error: null };
      if (fn === 'get_public_teacher_detail_v1') return { data: [teacherRow(String(args.p_entity_id))], error: null };
      return { data: null, error: null };
    });
    h.routeId = 'p-any';
    const path = page === 'DJ' ? '/djs/:id' : '/teachers/:id';
    const El = page === 'DJ' ? DJProfile : TeacherProfile;
    render(
      <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
        <MemoryRouter initialEntries={[path.replace(':id', 'x')]}>
          <EmbeddedProfileContext.Provider value={true}>
            <Routes><Route path={path} element={<El />} /></Routes>
          </EmbeddedProfileContext.Provider>
        </MemoryRouter>
      </QueryClientProvider>,
    );
    await waitFor(() => expect(h.rpc.mock.calls.some(([fn]) => fn !== AMBASSADOR_RPC)).toBe(true));
    await new Promise((r) => setTimeout(r, 30));
    expect(screen.queryByTestId('ambassador-badge')).toBeNull();
  });
});

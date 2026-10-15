// @vitest-environment jsdom
/**
 * TODAY's /dancers/:id PAGE (src/pages/DancerProfile.tsx), pinned as the accessible
 * tree for the production-shaped public profiles (empty stub, name+city, complete,
 * complete + all extras, photoless admin-made, surname inside display_name, hidden
 * surname, paused/unknown -> not found) and for the three viewers: a visitor, a
 * signed-in stranger, and the owner (the "Your plans" self-view). 390x844 and desktop.
 * The loader/head half is dancerRoute.today.test.ts. The query cache is seeded with the
 * rows the loader would dehydrate, so this isolates the render from the network.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { ReactNode } from 'react';
import { cleanup, render, screen } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { installJsdomPolyfills } from '../../client/jsdomPolyfills';
import { a11yTree } from './helpers/a11yTree';
import { VIEWPORTS, setViewport } from './helpers/viewports';

const h = vi.hoisted(() => ({ user: null as null | { id: string }, persona: null as string | null, attendance: [] as unknown[] }));
vi.mock('@/hooks/useAuth', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/hooks/useAuth')>()),
  useAuth: () => ({ user: h.user, isLoading: false, authStatus: 'ready' }),
}));
vi.mock('@/hooks/useMyPersonaId', () => ({ useMyPersonaId: () => h.persona }));
vi.mock('@/integrations/supabase/client', () => ({
  supabase: { rpc: async (name: string) => ({ data: name === 'get_my_event_attendance_v2' ? h.attendance : null, error: null }), from: () => ({}) },
}));
vi.mock('@/integrations/supabase/getSupabase', () => ({ getSupabase: async () => ({}) }));
vi.mock('@/components/layout/GlobalLayout', () => ({ default: ({ children }: { children: ReactNode }) => <div>{children}</div> }));

import DancerProfile from '@/pages/DancerProfile';

const IMG = 'https://cdn.example.test/p.jpg';
type Shape = { slug: string; record: Record<string, unknown> | null };
const rec = (over: Record<string, unknown>) => ({
  id: 'id-x', first_name: null, surname: null, display_name: null, nationality: null, dance_role: null, instagram: null, facebook: null,
  avatar_url: null, website_url: null, gallery_urls: null, cities: null, dancing_role_details: null, ...over,
});
const SHAPES: Record<string, Shape> = {
  'empty stub (nameless)': { slug: 'stub', record: rec({ id: 'id-1' }) },
  'name + city only': { slug: 'bea', record: rec({ id: 'id-2', first_name: 'Bea', display_name: 'Bea', cities: { name: 'London' } }) },
  'four-field complete': { slug: 'ana-lopez', record: rec({ id: 'id-3', first_name: 'Ana', surname: 'Lopez', display_name: 'Ana Lopez', dance_role: 'Follower', avatar_url: IMG, cities: { name: 'London' } }) },
  'complete + all extras': {
    slug: 'carla-ruiz',
    record: rec({
      id: 'id-4', first_name: 'Carla', surname: 'Ruiz', display_name: 'Carla Ruiz', nationality: 'Spain', dance_role: 'Lead and Follow',
      instagram: '@carla', facebook: 'carla.ruiz', website_url: 'carla.example', avatar_url: IMG, cities: { name: 'Manchester' },
      gallery_urls: [IMG, IMG],
      dancing_role_details: { dance_started_year: 2015, favorite_styles: ['Sensual', 'Dominican'], achievements: ['Best newcomer 2022'], favorite_songs: ['Obsesion'], looking_for_partner: true, partner_search_role: 'Leader', partner_search_level: ['Intermediate'], partner_practice_goals: ['Footwork'], partner_details: 'Weekday evenings' },
    }),
  },
  'admin-made, photoless': { slug: 'dani', record: rec({ id: 'id-5', first_name: 'Dani', display_name: 'Dani' }) },
  'surname inside display_name': { slug: 'eli-gomez', record: rec({ id: 'id-6', first_name: 'Eli', display_name: 'Eli Gomez', avatar_url: IMG }) },
  'hidden surname (masked by the names RPC)': { slug: 'fay', record: rec({ id: 'id-7', first_name: 'Fay', surname: null, display_name: 'Fay', avatar_url: IMG }) },
  'unknown / paused (no row)': { slug: 'gone', record: null },
};

const PLANS = [
  { event_id: 'e1', status: 'going', updated_at: null, name: 'Friday Social', occurrence_date: '2027-03-05', city_name: 'London', country: 'UK', city_slug: 'london-gb', start_time: '2027-03-05T20:00:00Z', type: 'standard', is_active: true },
  { event_id: 'f1', status: 'interested', updated_at: null, name: 'Costa Congress', occurrence_date: '2027-06-10', city_name: 'Alicante', country: 'ES', city_slug: null, start_time: '2027-06-10T10:00:00Z', type: 'festival', is_active: true },
];
const VIEWERS: { name: string; user: { id: string } | null; self: boolean }[] = [
  { name: 'visitor', user: null, self: false },
  { name: 'signed-in stranger', user: { id: 'someone-else' }, self: false },
  { name: 'owner', user: { id: 'owner' }, self: true },
];

const mount = (shape: Shape) => {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const id = (shape.record?.id as string | undefined) ?? 'id-none';
  qc.setQueryData(['entity-resolve', 'dancer_profiles', 'id', shape.slug], { id, slug: shape.slug });
  if (shape.record) qc.setQueryData(['dancer-profile', id], shape.record);
  else qc.setQueryDefaults(['dancer-profile', id], { queryFn: async () => { throw new Error('Dancer not found.'); } });
  return render(
    <QueryClientProvider client={qc}>
      <MemoryRouter initialEntries={[`/dancers/${shape.slug}`]}>
        <Routes>
          <Route path="/dancers/:id" element={<DancerProfile />} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );
};

beforeEach(() => {
  installJsdomPolyfills();
  // "11 years dancing" and "4 months 18 days" are clock-derived: pin Date (timers stay real).
  vi.useFakeTimers({ toFake: ['Date'], now: new Date('2026-10-15T12:00:00Z') });
  vi.spyOn(console, 'error').mockImplementation(() => undefined);
  h.user = null;
  h.persona = null;
  h.attendance = PLANS;
});
afterEach(() => {
  cleanup();
  vi.useRealTimers();
  vi.restoreAllMocks();
});

describe.each(VIEWPORTS)('/dancers/:id page at $name', (vp) => {
  beforeEach(() => setViewport(vp));

  describe.each(Object.entries(SHAPES))('%s', (_n, shape) => {
    it.each(VIEWERS)('as $name', async ({ user, self }) => {
      h.user = user;
      h.persona = self ? (shape.record?.id as string) ?? null : null;
      mount(shape);
      await new Promise((r) => setTimeout(r, 150));
      expect(a11yTree()).toMatchSnapshot();
    });
  });

  it('the owner sees "Your plans"; a stranger never sees the owner-only attendance', async () => {
    const shape = SHAPES['four-field complete'];
    h.user = { id: 'someone-else' };
    mount(shape);
    await new Promise((r) => setTimeout(r, 150));
    expect(document.body.textContent).not.toContain('Friday Social');
    cleanup();
    h.user = { id: 'owner' };
    h.persona = shape.record!.id as string;
    mount(shape);
    expect((await screen.findAllByText(/Friday Social/)).length).toBeGreaterThan(0);
  });
});

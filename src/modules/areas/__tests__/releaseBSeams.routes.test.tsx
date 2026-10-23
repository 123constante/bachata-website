// @vitest-environment jsdom
/**
 * RELEASE B (web) seams the two slices could not test alone: sign-up intent (B-WEB4)
 * lands on pages and routes that B-WEB3 owns. Server answers are fakes at the RPC
 * boundary, prod-shaped (a brand-new person: no teacher / DJ record, no seat).
 */
import { readFileSync } from 'node:fs';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';

const h = vi.hoisted(() => ({ rpc: vi.fn() }));
vi.mock('@/integrations/supabase/client', () => ({ supabase: { auth: {}, rpc: (...a: unknown[]) => h.rpc(...a), from: vi.fn() } }));
vi.mock('@/hooks/useAuth', () => ({ useAuth: () => ({ user: null, isLoading: false, authStatus: 'ready', retryAuth: vi.fn() }) }));
vi.mock('@/hooks/useNoindexMeta', () => ({ useNoindexMeta: () => undefined }));

import { CATCHALL_CLIENT_PATHS } from '@/components/catchallClientPaths';
import { AREA_PATHS } from '@/lib/areaPaths';
import { signupIntentLanding } from '@/lib/auth-otp-routing';
import AreaRoutes from '../home/AreaRoutes';
import { AREA_ROLES } from '../home/rolesApi';
import { AREA_HREF } from '../home/areaStatus';

const ok = (data: unknown) => Promise.resolve({ data, error: null });
beforeEach(() => {
  h.rpc.mockReset().mockImplementation((fn: string, args?: { p_role?: string }) => {
    // A new sign-up: the person exists (claim ran), the role record is empty.
    if (fn === 'my_role_details_v1') {
      const empty = args?.p_role === 'dj'
        ? { dj_name: null, genres: [], soundcloud: null, mixcloud: null, pricing: null }
        : { years_teaching: null, teaching_styles: [], offers_private: null, private_lesson_types: [], private_lesson_locations: [], private_travel_distance: null, partner_role: null };
      return ok({ role: args?.p_role, person_id: 'p1', details: empty });
    }
    if (fn === 'my_lineup_appearances_v1') return ok([]);
    if (fn === 'my_roles_v1') return ok([
      { role: 'dancer', active: true, complete: false },
      { role: 'organiser', active: false, complete: false },
      { role: 'teacher', active: false, complete: false },
      { role: 'dj', active: false, complete: false },
    ]);
    if (fn === 'my_profile_progress_v1') return ok({ percent: 20, required_left: 1, publish_ready: false, steps: [], declined: [] });
    return Promise.resolve({ data: null, error: { message: `unexpected ${fn}` } });
  });
});
afterEach(cleanup);

function Where() {
  const l = useLocation();
  return <p data-testid="where">{`${l.pathname}${l.search}`}</p>;
}
function mount(url: string, user = false) {
  void user;
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={qc}>
      <MemoryRouter initialEntries={[url]}>
        <Where />
        <Routes>
          <Route path="/account/areas" element={<AreaRoutes area="areas" />} />
          <Route path="/account/t/*" element={<AreaRoutes area="teacher" />} />
          <Route path="/account/dj/*" element={<AreaRoutes area="dj" />} />
          <Route path="/auth" element={<p>sign-in</p>} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

describe('(d) signed out, each area path goes through the sign-in guard and returns there', () => {
  it.each(Object.values(AREA_PATHS))('%s', async (path) => {
    mount(path);
    await waitFor(() => expect(screen.getByTestId('where').textContent).toBe(`/auth?mode=signin&returnTo=${encodeURIComponent(path)}`));
  });
});

describe('(c) every sign-up landing and area link is a REGISTERED route', () => {
  const routesSource = readFileSync('src/components/AnimatedRoutes.tsx', 'utf8');
  it.each(Object.values(AREA_PATHS))('%s is a Route in AnimatedRoutes and in the catchall list', (p) => {
    expect(routesSource.includes(`path="${p}"`) || routesSource.includes(`path="${p}/*"`), p).toBe(true);
    expect(CATCHALL_CLIENT_PATHS.some((c) => c === p || c === `${p}/*`), p).toBe(true);
  });
  it('the landing for each chosen-role combination is an area path or today\'s landing', () => {
    expect(signupIntentLanding({ roles: ['dancer', 'teacher'], holdsOrganiserSeat: false, todays: '/account' })).toBe(AREA_PATHS.teacher);
    expect(signupIntentLanding({ roles: ['dancer', 'dj'], holdsOrganiserSeat: false, todays: '/account' })).toBe(AREA_PATHS.dj);
    expect(signupIntentLanding({ roles: ['teacher'], holdsOrganiserSeat: true, todays: '/account/o' })).toBe('/account/o');
  });
  it('every Your areas open target is registered', () => {
    for (const r of AREA_ROLES) expect(CATCHALL_CLIENT_PATHS.some((c) => c === AREA_HREF[r] || c.startsWith(AREA_HREF[r]) || AREA_HREF[r].startsWith('/app')), AREA_HREF[r]).toBe(true);
  });
});

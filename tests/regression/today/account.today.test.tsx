// @vitest-environment jsdom
/**
 * TODAY's /account (src/pages/Account.tsx behind AuthGuard + DancerProfileGate),
 * rendered through the real route entries and the shared in-memory backend
 * (src/pages/__tests__/helpers/dancerBackend.ts, the DancerFirstGate.matrix
 * pattern). One row per shape: signed-out, no profile, incomplete, complete,
 * organiser-type, open access request. Each row pins WHERE the person lands
 * (the redirect target) and the accessible tree of the screen they land on, at
 * 390x844 and desktop. The /account/o entry (item 9) is the same rows at /account/o.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useEffect, type ReactNode } from 'react';
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import { CITY, FULL, makeBackend, type BackendState } from '../../../src/pages/__tests__/helpers/dancerBackend';
import { installJsdomPolyfills } from '../../client/jsdomPolyfills';
import { a11yTree } from './helpers/a11yTree';
import { VIEWPORTS, setViewport } from './helpers/viewports';

const h = vi.hoisted(() => ({ backend: null as unknown as { client: unknown }, signedIn: true }));
vi.mock('@/integrations/supabase/client', () => ({
  get supabase() {
    return h.backend.client;
  },
}));
vi.mock('@/integrations/supabase/getSupabase', () => ({ getSupabase: async () => h.backend.client }));
vi.mock('@/hooks/useAuth', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/hooks/useAuth')>()),
  useAuth: () => ({
    user: h.signedIn ? { id: 'u1', email: 'ana@example.com', is_anonymous: false } : null,
    session: null,
    isLoading: false,
    authStatus: 'ready',
    signOut: async () => 'signed_out',
  }),
}));
vi.mock('@/components/layout/GlobalLayout', () => ({ default: ({ children }: { children: ReactNode }) => <>{children}</> }));
vi.mock('@/contexts/CityContext', () => ({ useCity: () => ({ citySlug: 'london-gb' }) }));
vi.mock('@/components/ui/city-picker', () => ({
  CityPicker: ({ onChange }: { onChange: (id: string) => void }) => (
    <button type="button" onClick={() => onChange('city-london')}>Pick city</button>
  ),
}));
vi.mock('@/components/profile/AvatarUpload', () => ({
  AvatarUpload: ({ onChange }: { onChange: (u: string) => void }) => (
    <button type="button" onClick={() => onChange('https://img.example/new.jpg')}>Upload photo</button>
  ),
}));

import Account from '@/pages/Account';
import FinishProfile from '@/pages/FinishProfile';
import OrganiserArea from '@/modules/organiser/shell/OrganiserRoutes';

const EMPTY = { first_name: null, based_city_id: null, dance_role: null, avatar_url: null, archived_at: null };

type Shape = { name: string; signedIn: boolean; state: BackendState };
const SHAPES: Shape[] = [
  { name: 'signed out', signedIn: false, state: { row: null, organisers: 0, requests: [] } },
  { name: 'no profile', signedIn: true, state: { row: null, organisers: 0, requests: [] } },
  { name: 'incomplete (name + city, no role/photo)', signedIn: true, state: { row: { ...EMPTY, first_name: 'Ana', based_city_id: CITY.id }, organisers: 0, requests: [] } },
  { name: 'complete dancer', signedIn: true, state: { row: { ...FULL }, organisers: 0, requests: [] } },
  { name: 'organiser-type (complete)', signedIn: true, state: { row: { ...FULL }, organisers: 1, requests: [] } },
  { name: 'open access request (complete)', signedIn: true, state: { row: { ...FULL }, organisers: 0, requests: [{ status: 'open' }] } },
];

let here = '';
function Probe() {
  const l = useLocation();
  // In an effect, not during render: the react-hooks globals rule refuses a render-time write to a module variable.
  useEffect(() => {
    here = `${l.pathname}${l.search}`;
  });
  return null;
}

const mount = (shape: Shape, at: string) => {
  h.backend = makeBackend(shape.state);
  h.signedIn = shape.signedIn;
  return render(
    <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
      <MemoryRouter initialEntries={[at]}>
        <Probe />
        {/* The production route table for these paths (components/AnimatedRoutes.tsx). */}
        <Routes>
          <Route path="/account" element={<Account />} />
          <Route path="/account/dancer" element={<Account view="dancer" />} />
          <Route path="/account/o/*" element={<OrganiserArea />} />
          <Route path="/finish-profile" element={<FinishProfile />} />
          <Route path="/auth" element={<p>auth page</p>} />
          <Route path="*" element={<p>elsewhere</p>} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );
};

/** Wait for the router to stop moving and the landing screen to show its content. */
const settle = async (shape: Shape) => {
  if (!shape.signedIn) await waitFor(() => expect(here.startsWith('/auth')).toBe(true));
  else if (!shape.state.row || !shape.state.row.first_name || !shape.state.row.avatar_url)
    await waitFor(() => expect(here.startsWith('/finish-profile')).toBe(true));
  else await waitFor(() => expect(screen.queryByTestId('dancer-home') ?? screen.queryByTestId('org-page-home')).not.toBeNull());
  await waitFor(() => expect(screen.queryByTestId('home-loading')).toBeNull());
  await new Promise((r) => setTimeout(r, 60));
};

beforeEach(() => {
  installJsdomPolyfills();
  sessionStorage.clear();
  localStorage.clear();
});
afterEach(cleanup);

describe.each(VIEWPORTS)('/account entry at $name', (vp) => {
  beforeEach(() => setViewport(vp));

  describe.each(['/account', '/account/dancer', '/account/o'])('%s', (path) => {
    it.each(SHAPES)('$name', async (shape) => {
      mount(shape, path);
      await settle(shape);
      const landing = here.replace(/returnTo=[^&]*/, 'returnTo=<encoded>');
      expect({ landing, tree: a11yTree() }).toMatchSnapshot();
    });
  });
});

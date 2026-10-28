// @vitest-environment jsdom
/** S1 Switch page (C35): the login's pages as rows (name, role, Live chip); tap = choose, back = Home. */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';

const rpc = vi.hoisted(() => vi.fn());
vi.mock('@/integrations/supabase/client', () => ({ supabase: { auth: {}, rpc, from: vi.fn() } }));
const auth = vi.hoisted(() => ({ user: { id: 'u1', email: 'me@x.example' } }));
vi.mock('@/hooks/useAuth', async () => ({
  useAuth: () => ({ user: auth.user, session: null }),
  // OnboardingView reads the completeness fact (P3 W4b tap gate); no provider = today.
  ProfileGateContext: (await import('react')).createContext(null),
}));

import { ORG_PATHS } from '@/modules/organiser/shell/paths';
import HomePage from '@/modules/organiser/home';
import SwitchPage from '../index';
import { useOrganiserChoice } from '../useOrganiserChoice';

const org = (id: string, name: string, role: 'owner' | 'manager', lifecycle_status = 'live') => ({
  id, name, slug: null, avatar_url: null, city_id: null, lifecycle_status, role, latest_decision: null, series: [], team: [],
});

beforeEach(() => {
  rpc.mockReset();
  rpc.mockImplementation(async (fn: string) => {
    if (fn === 'organiser_home_v1') {
      return { data: { today: '2026-10-20', organisers: [org('a', 'Ritmo', 'owner'), org('b', 'Latino Nights', 'manager', 'draft')] }, error: null };
    }
    if (fn === 'list_organiser_access_requests_v1') return { data: [], error: null };
    return { data: null, error: { message: `unexpected ${fn}` } };
  });
  auth.user = { id: 'u1', email: 'me@x.example' };
  try { window.localStorage.clear(); } catch { /* none */ }
});
afterEach(cleanup);

function Where() {
  const loc = useLocation();
  return <p data-testid="where">{loc.pathname}{loc.search}</p>;
}
/** What a screen Home opens (Team, Change...) resolves through the shared choice. */
function ChosenProbe() {
  const { selected } = useOrganiserChoice();
  return <p data-testid="probe-page-name">{selected?.name ?? ''}</p>;
}
function mount(entry: string = ORG_PATHS.switch, homeIsHome = true) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <MemoryRouter initialEntries={[entry]}>
        <Routes>
          <Route path={ORG_PATHS.switch} element={<SwitchPage />} />
          <Route path={ORG_PATHS.home} element={homeIsHome ? <><HomePage /><Where /></> : <Where />} />
          <Route path={ORG_PATHS.team} element={<ChosenProbe />} />
          <Route path="*" element={<Where />} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

describe('Switch page (C35)', () => {
  it('lists each page with its role and a Live chip only when live; back goes Home', async () => {
    mount();
    await waitFor(() => expect(screen.getAllByTestId('switch-row')).toHaveLength(2));
    const [a, b] = screen.getAllByTestId('switch-row');
    expect(a.tagName).toBe('BUTTON');
    expect(a.textContent).toContain('Ritmo');
    expect(a.textContent).toContain('Owner');
    expect(a.textContent).toContain('Live');
    expect(b.textContent).toContain('Latino Nights');
    expect(b.textContent).toContain('Manager');
    expect(b.textContent).not.toContain('Live');
    expect(screen.getByTestId('org-back').getAttribute('href')).toBe(ORG_PATHS.home);
  });

  it('tap = choose: Home opens on that page', async () => {
    mount();
    await waitFor(() => expect(screen.getAllByTestId('switch-row')).toHaveLength(2));
    fireEvent.click(screen.getAllByTestId('switch-row')[1]);
    expect(screen.getByTestId('where').textContent).toBe(`${ORG_PATHS.home}?o=b`);
  });

  it('the choice outlives the ?o= link: a bare Home after a tap shows the page tapped (S2)', async () => {
    // The tap lands on a stand-in, not Home, so only Switch's own remember
    // can carry the choice (Home's ?o= remember is the S1 test below).
    mount(ORG_PATHS.switch, false);
    await waitFor(() => expect(screen.getAllByTestId('switch-row')).toHaveLength(2));
    fireEvent.click(screen.getAllByTestId('switch-row')[1]);
    cleanup();
    mount(ORG_PATHS.home);
    expect((await screen.findByTestId('home-page-name')).textContent).toBe('Latino Nights');
  });

  it('a ?o= link to a member page is remembered, so the screens Home opens show it (S1)', async () => {
    mount(`${ORG_PATHS.home}?o=b`);
    expect((await screen.findByTestId('home-page-name')).textContent).toBe('Latino Nights');
    cleanup();
    mount(ORG_PATHS.team);
    await waitFor(() => expect(screen.getByTestId('probe-page-name').textContent).toBe('Latino Nights'));
  });

  it('a ?o= link to a page the login is not a member of is never remembered', async () => {
    mount(`${ORG_PATHS.home}?o=stranger`);
    expect((await screen.findByTestId('home-page-name')).textContent).toBe('Ritmo');
    cleanup();
    mount(ORG_PATHS.team);
    await waitFor(() => expect(screen.getByTestId('probe-page-name').textContent).toBe('Ritmo'));
    expect(Object.values({ ...window.localStorage })).not.toContain('stranger');
  });

  it('the remembered page is per login: a second login on the same phone does not read it (N3)', async () => {
    mount();
    await waitFor(() => expect(screen.getAllByTestId('switch-row')).toHaveLength(2));
    fireEvent.click(screen.getAllByTestId('switch-row')[1]);
    cleanup();
    auth.user = { id: 'u2', email: 'other@x.example' };
    mount(ORG_PATHS.home);
    expect((await screen.findByTestId('home-page-name')).textContent).toBe('Ritmo');
    cleanup();
    auth.user = { id: 'u1', email: 'me@x.example' };
    mount(ORG_PATHS.home);
    expect((await screen.findByTestId('home-page-name')).textContent).toBe('Latino Nights');
  });
});

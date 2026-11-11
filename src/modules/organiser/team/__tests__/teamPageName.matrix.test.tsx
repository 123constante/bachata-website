// @vitest-environment jsdom
/** P3 Team screens name the page (2+ pages) and a failed join-requests read says so. Fixtures: no real two-page account exists. */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import type { ReactNode } from 'react';

const h = vi.hoisted(() => ({ rpc: vi.fn(), home: vi.fn() }));
vi.mock('@/integrations/supabase/client', () => {
  const q = { select: () => q, eq: () => q, limit: async () => ({ data: [{ id: 'x' }], error: null }) };
  return { supabase: { rpc: (...a: unknown[]) => h.rpc(...a), from: () => q, auth: {} } };
});
vi.mock('@/hooks/useAuth', () => ({ useAuth: () => ({ user: { id: 'me', email: 'me@x.example' }, signOut: vi.fn() }) }));
vi.mock('@/components/auth/AuthGuard', () => ({ AuthGuard: ({ children }: { children: ReactNode }) => <>{children}</> }));
vi.mock('@/hooks/useNoindexMeta', () => ({ useNoindexMeta: () => undefined }));
vi.mock('@/modules/organiser/shared/selfServeApi', async () => ({ ...(await vi.importActual<object>('@/modules/organiser/shared/selfServeApi')), fetchOrganiserHome: h.home }));
vi.mock('../../p3/screens/HomeScreen', () => ({ HomeScreen: () => <div /> }));
vi.mock('../../p3/screens/EventsScreen', () => ({ EventsScreen: () => <div /> }));
vi.mock('../../p3/screens/StatsScreen', () => ({ StatsScreen: () => <div /> }));

import P3Routes from '../../p3/shell/P3Routes';
import { P3_BASE, P3_PATHS } from '../../p3/shell/paths';

type Role = 'owner' | 'manager' | 'contributor';
const LONG = 'Maximiliana Concepcion Rodriguez-Villanueva de la Fuente Bachata Sensual Collective';
const NAMES = [LONG, 'Second Page', 'Third Page'];
const page = (i: number, role: Role) => ({ id: `org-${i}`, name: NAMES[i], slug: `o${i}`, avatar_url: null, city_id: null, lifecycle_status: 'live', role: role === 'contributor' ? 'manager' : role, latest_decision: null, series: [], team: [] });
const member = (id: string, r: Role, extra: Record<string, unknown> = {}) => ({ user_id: id, member_role: r, is_primary: r === 'owner', is_self: false, email: `${id}@x.example`, display_name: id, ...extra });
const REQ = { request_id: 'r1', user_id: 'u-req', requester_email: 'nadia@x.example', message: 'hi', created_at: '2026-10-01T10:00:00Z' };
type Reqs = 'ok-empty' | 'ok-2' | 'error' | 'not_authorised';

let pages = 0; let role: Role = 'owner'; let reqs: Reqs = 'ok-empty'; let reqCalls = 0; let adds = 0;
function install() {
  reqCalls = 0; adds = 0;
  h.home.mockReset().mockImplementation(async () => ({ today: '2026-10-27', organisers: Array.from({ length: pages }, (_, i) => page(i, role)) }));
  h.rpc.mockReset().mockImplementation(async (fn: string) => {
    if (fn === 'organiser_team_v1') return { data: { my_role: role, members: [member('me', role, { is_self: true, display_name: 'Me' })] }, error: null };
    if (fn === 'list_organiser_access_requests_v1') {
      reqCalls++;
      if (reqs === 'error') return { data: null, error: { message: 'boom' } };
      if (reqs === 'not_authorised') return { data: null, error: { message: 'not_authorised' } };
      return { data: reqs === 'ok-2' ? [REQ, { ...REQ, request_id: 'r2', user_id: 'u2' }] : [], error: null };
    }
    if (fn === 'organiser_team_browse_people_v1') return { data: [{ profile_id: 'pf-p', display_name: 'Priya Sharma', photo_url: null, fact: null, can_add: true }], error: null };
    if (fn === 'organiser_team_add_member_by_profile_v1') { adds++; return { data: { ok: true }, error: null }; }
    return { data: null, error: null };
  });
}
function at(path: string) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(<QueryClientProvider client={client}><MemoryRouter initialEntries={[path]}><Routes><Route path={`${P3_BASE}/*`} element={<P3Routes />} /></Routes></MemoryRouter></QueryClientProvider>);
}
beforeEach(() => { window.localStorage.clear(); });
afterEach(cleanup);

const P: (0 | 1 | 2 | 3)[] = [0, 1, 2, 3];
const R: Role[] = ['owner', 'manager', 'contributor'];
const Q: Reqs[] = ['ok-empty', 'ok-2', 'error', 'not_authorised'];
const grid = P.flatMap((p) => R.flatMap((r) => Q.map((q) => [p, r, q] as const)));
// Page 0 -> no page; the requests query never runs.
const errorExpected = (p: number, q: Reqs) => p > 0 && q === 'error';

describe.each([['Team', P3_PATHS.youTeam], ['You', P3_PATHS.you]] as const)('%s: requests error + page name', (screenName, path) => {
  it.each(grid)('pages=%i role=%s requests=%s', async (p, r, q) => {
    pages = p; role = r; reqs = q; install();
    at(path);
    await waitFor(() => expect(h.home).toHaveBeenCalled());
    if (p > 0) await waitFor(() => expect(reqCalls).toBeGreaterThan(0));
    await waitFor(() => {
      const err = screen.queryByTestId('p3-team-requests-error');
      if (errorExpected(p, q)) expect(err).not.toBeNull(); else expect(screen.queryByTestId('p3-team-requests-error')).toBeNull();
    }, { timeout: 2000 }).catch(async () => { await new Promise((x) => setTimeout(x, 50)); });
    expect(!!screen.queryByTestId('p3-team-requests-error')).toBe(errorExpected(p, q));
    if (screenName === 'Team') {
      const cap = screen.queryByTestId('p3-team-page-name');
      if (p >= 2) { expect(cap?.textContent).toBe(NAMES[0]); expect(cap?.className).toContain('truncate'); } else expect(cap).toBeNull();
    }
  });
  it('Try again refetches once', async () => {
    pages = 1; role = 'owner'; reqs = 'error'; install();
    at(path);
    const btn = await screen.findByTestId('p3-team-requests-retry');
    await waitFor(() => expect(reqCalls).toBe(1));
    reqs = 'ok-empty';
    fireEvent.click(btn);
    await waitFor(() => expect(reqCalls).toBe(2));
    await waitFor(() => expect(screen.queryByTestId('p3-team-requests-error')).toBeNull());
    expect(reqCalls).toBe(2);
    expect(btn.style.minHeight).toBe('44px');
  });
});

describe('Add someone + Done', () => {
  it.each(P.flatMap((p) => R.map((r) => [p, r] as const)))('pages=%i role=%s', async (p, r) => {
    pages = p; role = r; reqs = 'ok-empty'; install();
    at(P3_PATHS.youTeamAdd);
    await waitFor(() => expect(h.home).toHaveBeenCalled());
    const allowed = p > 0 && r !== 'contributor';
    if (allowed) {
      const face = await screen.findByTestId('add-face');
      const cap = screen.queryByTestId('p3-team-page-name');
      if (p >= 2) expect(cap?.textContent).toBe(NAMES[0]); else expect(cap).toBeNull();
      fireEvent.click(face);
      fireEvent.click(await screen.findByTestId('add-confirm-yes'));
      await waitFor(() => expect(adds).toBe(1));
      const msg = await screen.findByText(/is a Manager/);
      expect(msg.textContent).toBe(p >= 2 ? `Priya S. is a Manager of ${NAMES[0]}` : 'Priya S. is a Manager');
    } else {
      await waitFor(() => expect(screen.queryByTestId('add-loading')).toBeNull());
      expect(adds).toBe(0);
      if (p >= 2) expect(screen.getByTestId('p3-team-page-name')).not.toBeNull();
    }
  });
});

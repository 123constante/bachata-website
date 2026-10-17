// @vitest-environment jsdom
/**
 * The draft-organiser dead end (2026-10-09 first-run walk): a new organiser
 * saved as a draft had no "Send for review" anywhere, could not open its own
 * Profile (the public is_active filter hid it), and New event refused with no
 * next step. Every organiser shape x every screen x creator/member/stranger,
 * mocked at the Supabase client so the real reads run.
 *
 * The DB is modelled as the 2026-10-09 E2E rows: create_organiser_profile_v1
 * inserts is_active = false, so any read carrying the public
 * `is_active is not false` filter misses a draft; RLS
 * (organiser_profiles_ss_select) admits a non-live row to its owner/manager
 * only, and organiser_home_v1 lists owner/manager organisers only.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter, Route, Routes } from 'react-router-dom';

const db = vi.hoisted(() => ({
  rpc: vi.fn(),
  /** Filters seen on organiser_profiles reads, in order. */
  reads: [] as Array<{ table: string; filters: unknown[][] }>,
  row: null as null | Record<string, unknown>,
  /** Whether RLS shows the row to the caller. */
  visible: true,
}));

vi.mock('@/integrations/supabase/client', () => {
  const from = (table: string) => {
    const filters: unknown[][] = [];
    db.reads.push({ table, filters });
    const b: Record<string, unknown> = {};
    for (const m of ['select', 'eq', 'not', 'or', 'in', 'order', 'limit']) {
      b[m] = (...args: unknown[]) => { filters.push([m, ...args]); return b; };
    }
    b.maybeSingle = async () => {
      if (table === 'cities') return { data: { name: 'Leeds', slug: 'leeds' }, error: null };
      const row = db.row;
      if (!row || !db.visible) return { data: null, error: null };
      const hidesInactive = filters.some(([m, col, op, v]) => m === 'not' && col === 'is_active' && op === 'is' && v === false);
      if (hidesInactive && row.is_active === false) return { data: null, error: null };
      return { data: row, error: null };
    };
    return b;
  };
  return { supabase: { auth: {}, rpc: db.rpc, from } };
});
vi.mock('@/hooks/useAuth', () => ({ useAuth: () => ({ user: { id: 'u1', email: 'me@x.example' }, session: null, signOut: vi.fn() }) }));
vi.mock('@/hooks/useLondonToday', () => ({ useLondonToday: () => '2026-10-09' }));

import HomePage from '../home';
import PageScreen from '../page';
import { fetchOrganiserEntity } from '@/modules/profile/organiserPublicProfile';

type Role = 'creator' | 'member' | 'stranger';
const STATES = ['draft', 'pending_review', 'rejected', 'live', 'paused'] as const;
const ROLES: Role[] = ['creator', 'member'];

const decision = { action: 'rejected', from_state: 'pending_review', to_state: 'rejected', reason: 'Add a city photo', created_at: '2026-10-08T10:00:00Z' };
const homeOrg = (lifecycle: string, role: Role) => ({
  id: 'org-1', name: 'Firstrun Org', slug: null, avatar_url: null, city_id: 'c1', lifecycle_status: lifecycle,
  role: role === 'creator' ? 'owner' : 'manager', latest_decision: lifecycle === 'rejected' ? decision : null, series: [],
});
const entityRow = (lifecycle: string) => ({
  id: 'org-1', name: 'Firstrun Org', avatar_url: null, bio: null, socials: null, city_id: 'c1',
  instagram: null, website: null, lifecycle_status: lifecycle,
  // As create_organiser_profile_v1 writes it; approval does not have to flip it for the test to hold.
  is_active: lifecycle === 'live' ? null : false,
});

let lifecycleNow: string;
let organisersFor: () => unknown[];

function setup(lifecycle: string, role: Role) {
  lifecycleNow = lifecycle;
  organisersFor = () => (role === 'stranger' ? [] : [homeOrg(lifecycleNow, role)]);
  db.row = entityRow(lifecycle);
  // RLS: live OR owner/manager. A stranger never reaches a non-live row.
  db.visible = lifecycle === 'live' || role !== 'stranger';
}

beforeEach(() => {
  db.reads.length = 0;
  db.rpc.mockReset();
  db.rpc.mockImplementation(async (fn: string, args: Record<string, unknown>) => {
    if (fn === 'organiser_home_v1') return { data: { today: '2026-10-09', organisers: organisersFor() }, error: null };
    if (fn === 'list_my_organiser_access_requests_v1' || fn === 'list_organiser_access_requests_v1') return { data: [], error: null };
    if (fn === 'submit_organiser_profile_v1') {
      if (!['draft', 'rejected'].includes(lifecycleNow)) return { data: null, error: { message: 'invalid_state' } };
      const from = lifecycleNow;
      lifecycleNow = 'pending_review';
      // The real reply also carries the id; submitOrganiserProfile falls back to the argument.
      void args;
      return { data: { from_state: from, lifecycle_status: 'pending_review', audit_id: 'a1' }, error: null };
    }
    return { data: [], error: null };
  });
});
afterEach(cleanup);

function mount(path: string) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <MemoryRouter initialEntries={[path]}>
        <Routes>
          <Route path="/account/o" element={<HomePage />} />
          <Route path="/account/o/page" element={<PageScreen />} />
          <Route path="*" element={<span data-testid="elsewhere" />} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

const cases = STATES.flatMap((s) => ROLES.map((r) => [s, r] as const));

describe('Home: everything live (D4), New event says why it cannot work', () => {
  it.each(cases)('%s organiser, %s', async (state, role) => {
    setup(state, role);
    mount('/account/o');
    const newEvent = (await screen.findByTestId('home-new-event')) as HTMLButtonElement;
    // No status card and no review step on Home under rule 2 (D4, D22).
    expect(screen.queryByTestId('home-org-status')).toBeNull();
    expect(screen.queryByTestId('home-send-review')).toBeNull();
    if (state === 'live') {
      expect(newEvent.disabled).toBe(false);
      return;
    }
    // A control that cannot work is disabled WITH its reason.
    expect(newEvent.disabled).toBe(true);
    // One R1 line for every non-live status: it names no review step and no
    // Profile page, neither of which is on Home any more (F-S1 B1).
    const reason = screen.getByTestId('home-new-event-reason');
    expect(reason.textContent).toBe('Firstrun Org is not live, so it cannot take events. Ask the Bachata Calendar team.');
    expect(reason.textContent).not.toMatch(/review|Profile/i);
    expect(newEvent.getAttribute('aria-describedby')).toBe(reason.id);
  });

  it('stranger: no organiser, so onboarding, never a status card', async () => {
    setup('draft', 'stranger');
    mount('/account/o');
    await waitFor(() => expect(db.rpc).toHaveBeenCalledWith('organiser_home_v1'));
    await waitFor(() => expect(screen.queryByTestId('home-org-status')).toBeNull());
    expect(screen.queryByTestId('home-send-review')).toBeNull();
  });
});

describe('Page: the creator/member can open their own non-live organiser (D22: a Live chip, no review)', () => {
  it.each(cases)('%s organiser, %s', async (state, role) => {
    setup(state, role);
    mount('/account/o/page');
    expect(await screen.findByTestId('page-facts')).toBeTruthy();
    expect(screen.queryByTestId('page-missing')).toBeNull();
    expect(!!screen.queryByTestId('page-live-chip')).toBe(state === 'live');
    expect(screen.queryByTestId('profile-send-review')).toBeNull();
    expect(screen.queryByTestId('profile-status-tag')).toBeNull();
  });

  it('stranger: no organiser of theirs, so nothing to open', async () => {
    setup('draft', 'stranger');
    mount('/account/o/page');
    expect(await screen.findByTestId('page-no-organiser')).toBeTruthy();
  });
});

describe('Public read stays hidden', () => {
  it.each(STATES)('the public organiser read keeps the is_active filter (%s)', async (state) => {
    setup(state, 'stranger');
    const got = await fetchOrganiserEntity('org-1');
    const read = db.reads.find((r) => r.table === 'organiser_profiles')!;
    expect(read.filters).toContainEqual(['not', 'is_active', 'is', false]);
    expect(got === null).toBe(state !== 'live');
  });

  it.each(STATES.filter((s) => s !== 'live'))('even the creator does not get a %s organiser through the public read', async (state) => {
    setup(state, 'creator');
    expect(await fetchOrganiserEntity('org-1')).toBeNull();
  });
});

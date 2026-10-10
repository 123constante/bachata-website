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
import NewEventPage from '../events/NewEventPage';
import ProfilePage from '../profile';
import { organiserStatus } from '../shared/organiserStatus';
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
          <Route path="/account/o/events/new" element={<NewEventPage />} />
          <Route path="/account/o/profile" element={<ProfilePage />} />
          <Route path="*" element={<span data-testid="elsewhere" />} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

const cases = STATES.flatMap((s) => ROLES.map((r) => [s, r] as const));

describe('Home: the organiser status line and Send for review', () => {
  it.each(cases)('%s organiser, %s', async (state, role) => {
    setup(state, role);
    mount('/account/o');
    const copy = organiserStatus('Firstrun Org', state, state === 'rejected' ? decision.reason : null);
    const newEvent = (await screen.findByTestId('home-new-event')) as HTMLButtonElement;
    if (state === 'live') {
      expect(screen.queryByTestId('home-org-status')).toBeNull();
      expect(newEvent.disabled).toBe(false);
      return;
    }
    expect(screen.getByTestId('home-org-status-line').textContent).toBe(copy.line ?? '');
    expect(screen.getByTestId('home-org-status-tag').textContent).toBe(copy.label);
    // A control that cannot work is disabled WITH its reason.
    expect(newEvent.disabled).toBe(true);
    const reason = screen.getByTestId('home-new-event-reason');
    expect(reason.textContent).toBe(copy.newEventBlock);
    expect(newEvent.getAttribute('aria-describedby')).toBe(reason.id);
    expect(!!screen.queryByTestId('home-send-review')).toBe(copy.canSendForReview);
    if (!copy.canSendForReview) expect(screen.getByTestId('home-org-status-next').textContent).toBe(copy.next);
  });

  it.each([['draft'], ['rejected']] as const)('%s -> Send for review calls submit_organiser_profile_v1 and then shows Waiting for review', async (state) => {
    setup(state, 'creator');
    mount('/account/o');
    fireEvent.click(await screen.findByTestId('home-send-review'));
    await waitFor(() => expect(screen.getByTestId('home-org-status-line').textContent).toBe('Waiting for review: not visible to the public yet.'));
    expect(db.rpc).toHaveBeenCalledWith('submit_organiser_profile_v1', { p_organiser_id: 'org-1' });
    expect(screen.queryByTestId('home-send-review')).toBeNull();
    expect((screen.getByTestId('home-new-event-reason')).textContent).toMatch(/^Your organiser is waiting for approval/);
  });

  it('a refused send says why and reloads (already in review elsewhere)', async () => {
    setup('draft', 'creator');
    mount('/account/o');
    const button = await screen.findByTestId('home-send-review');
    lifecycleNow = 'pending_review';
    fireEvent.click(button);
    expect((await screen.findByTestId('home-send-error')).textContent).toMatch(/already in review/);
  });

  it('stranger: no organiser, so onboarding, never a status card', async () => {
    setup('draft', 'stranger');
    mount('/account/o');
    await waitFor(() => expect(db.rpc).toHaveBeenCalledWith('organiser_home_v1'));
    await waitFor(() => expect(screen.queryByTestId('home-org-status')).toBeNull());
    expect(screen.queryByTestId('home-send-review')).toBeNull();
  });
});

describe('New event: the refusal says why and what to do', () => {
  it.each(cases)('%s organiser, %s', async (state, role) => {
    setup(state, role);
    mount('/account/o/events/new');
    const create = (await screen.findByTestId('org-new-event-create')) as HTMLButtonElement;
    const copy = organiserStatus('Firstrun Org', state);
    if (state === 'live') {
      expect(screen.queryByTestId('org-new-event-block')).toBeNull();
      expect(create.disabled).toBe(false);
      return;
    }
    const block = screen.getByTestId('org-new-event-block');
    expect(block.textContent).toBe(copy.newEventBlock);
    expect(create.disabled).toBe(true);
    expect(create.getAttribute('aria-describedby')).toBe(block.id);
    // Draft or changes-needed: a way to the place the send lives.
    expect(!!screen.queryByTestId('org-new-event-go-home')).toBe(copy.canSendForReview);
  });

  it('pending_review says the organiser is waiting for approval', async () => {
    setup('pending_review', 'creator');
    mount('/account/o/events/new');
    expect((await screen.findByTestId('org-new-event-block')).textContent).toMatch(/^Your organiser is waiting for approval\./);
  });
});

describe('Profile: the creator/member can open their own non-live organiser', () => {
  it.each(cases)('%s organiser, %s', async (state, role) => {
    setup(state, role);
    mount('/account/o/profile');
    const copy = organiserStatus('Firstrun Org', state, state === 'rejected' ? decision.reason : null);
    expect((await screen.findByTestId('profile-status-tag')).textContent).toBe(copy.label);
    expect(screen.queryByTestId('profile-missing')).toBeNull();
    expect(screen.queryByTestId('profile-status-sentence')?.textContent ?? null).toBe(copy.line);
    expect(!!screen.queryByTestId('profile-send-review')).toBe(copy.canSendForReview);
  });

  it('stranger: no organiser of theirs, so nothing to open', async () => {
    setup('draft', 'stranger');
    mount('/account/o/profile');
    expect(await screen.findByTestId('profile-no-organiser')).toBeTruthy();
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

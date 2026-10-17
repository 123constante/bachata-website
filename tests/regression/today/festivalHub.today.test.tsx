// @vitest-environment jsdom
/**
 * TODAY's festival hub Going / Interested (src/pages/FestivalHub.tsx, via
 * setAttendanceRpc -> set_attendance): signed-out / signed-in, with and without
 * a stored status, and the tap behaviour. Going is not profile-gated here either:
 * the incomplete/complete rows prove the same tap sends the same RPC. The clock
 * and Math.random are pinned (the hub has a countdown and a random confetti layer).
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { ReactNode } from 'react';
import { cleanup, fireEvent, render, screen, waitFor, act } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';
import { installJsdomPolyfills } from '../../client/jsdomPolyfills';
import { a11yTree } from './helpers/a11yTree';
import { VIEWPORTS, setViewport } from './helpers/viewports';

const h = vi.hoisted(() => ({
  user: null as null | { id: string },
  rpc: vi.fn(),
  myStatus: null as string | null,
}));
vi.mock('@/hooks/useAuth', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/hooks/useAuth')>()),
  useAuth: () => ({ user: h.user, isLoading: false, authStatus: 'ready' }),
}));
// `auth` too: getSupabase (rpcLoose, so the dancer-area gate read) checks the client has it.
vi.mock('@/integrations/supabase/client', () => ({ supabase: { rpc: (...a: unknown[]) => h.rpc(...a), auth: {} } }));
vi.mock('@/components/layout/GlobalLayout', () => ({ default: ({ children }: { children: ReactNode }) => <div>{children}</div> }));
vi.mock('@/lib/festivalsList', async (orig) => ({
  ...(await orig<typeof import('@/lib/festivalsList')>()),
  fetchPublicFestivalsList: async () => [
    { id: 'fest-1', name: 'Costa Bachata Congress', city: 'Alicante', date: '2026-12-20', start_time: '2026-12-20T10:00:00Z', poster_url: null },
  ],
}));

import FestivalHub from '@/pages/FestivalHub';
import { ProfileGateContext } from '@/hooks/useAuth';
import { profileGateValue, type ProfileCompletion } from '@/lib/profileCompletion';

const mount = (completion?: ProfileCompletion) =>
  render(
    <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
      <MemoryRouter initialEntries={['/festivals']}>
        {completion ? (
          <ProfileGateContext.Provider value={profileGateValue(completion)}>
            <FestivalHub />
          </ProfileGateContext.Provider>
        ) : (
          <FestivalHub />
        )}
      </MemoryRouter>
    </QueryClientProvider>,
  );

const settled = async () => {
  await screen.findByText('Costa Bachata Congress');
  await act(async () => {
    await new Promise((r) => setTimeout(r, 120));
  });
};
const setCalls = () => h.rpc.mock.calls.filter(([n]) => n === 'set_attendance');

beforeEach(() => {
  installJsdomPolyfills();
  vi.useFakeTimers({ toFake: ['Date'], now: new Date('2026-10-15T12:00:00Z') });
  vi.spyOn(Math, 'random').mockReturnValue(0.5);
  h.user = null;
  h.myStatus = null;
  h.rpc.mockReset().mockImplementation(async (name: string) => {
    // Outside the dancer area (B1b S1): the Going lock never applies, so today's page is unchanged.
    if (name === 'dancer_area_gate_v1') return { data: { open: false, allowed: false }, error: null };
    if (name === 'get_event_attendance_counts') return { data: [{ event_id: 'fest-1', interested_count: 3, going_count: 5 }], error: null };
    if (name === 'get_my_event_attendance_v1') return { data: h.myStatus ? [{ event_id: 'fest-1', status: h.myStatus, updated_at: null }] : [], error: null };
    if (name === 'set_attendance') return { data: null, error: null };
    return { data: null, error: null };
  });
});
afterEach(() => {
  cleanup();
  vi.useRealTimers();
  vi.restoreAllMocks();
});

const ROWS: { name: string; user: typeof h.user; status: string | null }[] = [
  { name: 'signed out', user: null, status: null },
  { name: 'signed in, no status', user: { id: 'u1' }, status: null },
  { name: 'signed in, going', user: { id: 'u1' }, status: 'going' },
  { name: 'signed in, interested', user: { id: 'u1' }, status: 'interested' },
];

describe.each(VIEWPORTS)('festival hub at $name', (vp) => {
  beforeEach(() => setViewport(vp));

  it.each(ROWS)('$name', async ({ user, status }) => {
    h.user = user;
    h.myStatus = status;
    mount();
    await settled();
    expect(a11yTree()).toMatchSnapshot();
  });

  it('signed-out Going: no RPC, the sign-in prompt opens', async () => {
    mount();
    await settled();
    fireEvent.click(screen.getByRole('button', { name: /I'm Going/ }));
    await act(async () => {
      await new Promise((r) => setTimeout(r, 60));
    });
    expect(setCalls()).toHaveLength(0);
    expect(a11yTree()).toMatchSnapshot();
  });

  it.each([
    ['no completeness provider', undefined],
    ['incomplete', { status: 'incomplete', missing: ['avatar_url'], profileId: 'p1' } as ProfileCompletion],
    ['no profile', { status: 'no_profile', missing: ['first_name'], profileId: null } as ProfileCompletion],
    ['complete', { status: 'complete', missing: [], profileId: 'p1' } as ProfileCompletion],
  ])('signed-in Going (%s): the same tap sends set_attendance(going), not gated by completeness', async (_n, completion) => {
    h.user = { id: 'u1' };
    mount(completion);
    await settled();
    fireEvent.click(screen.getByRole('button', { name: /I'm Going/ }));
    await waitFor(() => expect(setCalls()).toHaveLength(1));
    expect(setCalls()[0][1]).toEqual({ p_event_id: 'fest-1', p_status: 'going' });
  });
});

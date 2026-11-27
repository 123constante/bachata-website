// @vitest-environment jsdom
import { afterEach, describe, it, expect, vi, beforeEach } from 'vitest';
import { cleanup, render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import RaffleWin from '../RaffleWin';

const h = vi.hoisted(() => ({
  rpc: vi.fn(), invoke: vi.fn(), navigate: vi.fn(),
  auth: { user: { id: 'u1', is_anonymous: false } as unknown, isLoading: false },
}));
vi.mock('@/integrations/supabase/rpcLoose', () => ({ rpcLoose: (...a: unknown[]) => h.rpc(...a) }));
vi.mock('@/integrations/supabase/getSupabase', () => ({ getSupabase: async () => ({ functions: { invoke: h.invoke } }) }));
vi.mock('@/hooks/useAuth', () => ({ useAuth: () => h.auth }));
vi.mock('@/hooks/useRaffleBoard', () => ({ fetchRaffleBoard: async () => ({ poolCount: 7, nights: [] }) }));
vi.mock('react-router-dom', async (orig) => ({ ...(await orig<typeof import('react-router-dom')>()), useNavigate: () => h.navigate, useParams: () => ({ token: 'tok' }) }));
vi.mock('@/modules/raffle-win/profile/ProfileSteps', () => ({
  ProfileSteps: ({ onDone }: { onDone: () => void }) => <button onClick={onDone}>steps-done</button>,
}));

const N1 = { occurrence_id: 'o1', title: 'Friday Bachata', start_local: '2026-12-04T20:00:00', venue_name: 'Bar', public_event_id: 'e1' };
const N2 = { occurrence_id: 'o2', title: 'Saturday Sensual', start_local: '2026-12-05T20:00:00', venue_name: 'Club', public_event_id: 'e2' };
const claim = (nights: unknown[]) => ({ data: { ok: true, win: { id: 'w1', state: 'claimed' }, open_nights: nights, first_name: 'Ana' }, error: null });
const FULL = { profile_id: 'p', avatar_url: 'a', first_name: 'Ana', dance_role: 'Lead', based_city_id: 'c', nationality: 'ES', languages: ['en'] };
const INCOMPLETE = { ...FULL, avatar_url: null };
const BEEN_TO = /have been to that event/;

type Fn = () => unknown;
function setup(map: Record<string, unknown | Fn>) {
  h.rpc.mockImplementation(async (fn: string) => {
    const v = map[fn];
    return typeof v === 'function' ? (v as Fn)() : v ?? { data: null, error: { message: 'x' } };
  });
}
const claimCalls = () => h.rpc.mock.calls.filter((c) => c[0] === 'raffle_win_claim_link_v1').length;
const go = () => render(<MemoryRouter><RaffleWin /></MemoryRouter>);
const pickAndLock = async () => {
  fireEvent.click(await screen.findByRole('button', { name: /choose my night/i }));
  fireEvent.click(await screen.findByRole('button', { name: /Friday Bachata/ }));
  fireEvent.click(await screen.findByRole('button', { name: 'Lock this night' }));
};
const afterProfile = async () => { await pickAndLock(); fireEvent.click(await screen.findByText('steps-done')); };
const sequence = (...r: unknown[]) => { let i = 0; return () => r[Math.min(i++, r.length - 1)]; };

afterEach(cleanup);
beforeEach(() => { vi.clearAllMocks(); sessionStorage.clear(); h.auth = { user: { id: 'u1', is_anonymous: false }, isLoading: false }; });

describe('RaffleWin: been-to events after onboarding', () => {
  it('fresh claim still has the night -> honesty, claim called twice', async () => {
    setup({ raffle_win_claim_link_v1: claim([N1, N2]), my_dancer_edit_v1: { data: INCOMPLETE, error: null } });
    go(); await afterProfile();
    expect(await screen.findByRole('checkbox')).toBeTruthy();
    expect(screen.getByTestId('honesty-tick')).toBeTruthy();
    expect(claimCalls()).toBe(2);
  });
  it('fresh claim lacks the chosen event -> pick, event gone, no banner', async () => {
    setup({ raffle_win_claim_link_v1: sequence(claim([N1, N2]), claim([N2])), my_dancer_edit_v1: { data: INCOMPLETE, error: null } });
    go(); await afterProfile();
    expect(await screen.findByRole('button', { name: /Saturday Sensual/ })).toBeTruthy();
    expect(screen.queryByRole('button', { name: /Friday Bachata/ })).toBeNull();
    expect(screen.queryByTestId('pick-banner')).toBeNull();
    expect(screen.queryByText(BEEN_TO)).toBeNull();
    expect(screen.getByRole('button', { name: 'Lock this night' }).getAttribute('aria-disabled')).toBe('true'); // selection cleared
  });
  it('fresh claim errors -> honesty with the old night', async () => {
    setup({ raffle_win_claim_link_v1: sequence(claim([N1]), { data: null, error: { message: 'x' } }), my_dancer_edit_v1: { data: INCOMPLETE, error: null } });
    go(); await afterProfile();
    expect(await screen.findByRole('checkbox')).toBeTruthy();
  });
  it.each([['already_been_to_event', false], ['spot_taken', true]])('lock refusal %s -> pick, banner=%s', async (reason, banner) => {
    setup({ raffle_win_claim_link_v1: claim([N1, N2]), my_dancer_edit_v1: { data: FULL, error: null },
      raffle_win_lock_v2: { data: { ok: false, reason }, error: null } });
    go(); await pickAndLock();
    fireEvent.click(await screen.findByRole('checkbox'));
    fireEvent.click(screen.getByRole('button', { name: /confirm/i }));
    expect(await screen.findByRole('button', { name: /Saturday Sensual/ })).toBeTruthy();
    expect(screen.queryByRole('button', { name: /Friday Bachata/ })).toBeNull();
    await waitFor(() => expect(!!screen.queryByTestId('pick-banner')).toBe(banner));
    expect(screen.queryByText(BEEN_TO)).toBeNull();
  });
});

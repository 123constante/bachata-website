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
vi.mock('@/modules/raffle-win/share/ShareStep', () => ({
  ShareStep: ({ onDone }: { onDone: () => void }) => <button onClick={onDone}>Skip, show my QR</button>,
}));
vi.mock('@/modules/raffle-win/profile/ProfileSteps', () => ({
  ProfileSteps: ({ missing, onDone }: { missing: string[]; onDone: () => void }) => (
    <button onClick={onDone}>steps:{missing.join(',')}</button>
  ),
}));

const N1 = { occurrence_id: 'o1', title: 'Friday Bachata', start_local: '2026-12-04T20:00:00', venue_name: 'Bar', public_event_id: 'e1' };
const claim = (win: Record<string, unknown> = { id: 'w1', state: 'claimed' }, nights: unknown[] = [N1]) =>
  ({ data: { ok: true, win, open_nights: nights, first_name: 'Ana' }, error: null });
const FULL = { profile_id: 'p', avatar_url: 'a', first_name: 'Ana', dance_role: 'Lead', based_city_id: 'c', nationality: 'ES', languages: ['en'] };
const lockOk = { data: { ok: true, win: { qr_token: 'qq', night: N1 } }, error: null };

function setup(map: Record<string, unknown>) {
  h.rpc.mockImplementation(async (fn: string) => {
    const v = map[fn];
    return typeof v === 'function' ? (v as () => unknown)() : v ?? { data: null, error: { message: 'x' } };
  });
}
const go = () => render(<MemoryRouter><RaffleWin /></MemoryRouter>);
const pickAndLock = async () => {
  fireEvent.click(await screen.findByRole('button', { name: /choose my night/i }));
  fireEvent.click(await screen.findByRole('button', { name: /Friday Bachata/ }));
  const lock = await screen.findByRole('button', { name: 'Lock this night' });
  fireEvent.click(lock);
};
const confirm = async () => {
  fireEvent.click(await screen.findByRole('checkbox'));
  fireEvent.click(screen.getByRole('button', { name: /confirm/i }));
};
const emails = () => h.invoke.mock.calls.filter((c) => c[0] === 'raffle-win-email');

afterEach(cleanup);
beforeEach(() => {
  vi.clearAllMocks(); sessionStorage.clear();
  h.auth = { user: { id: 'u1', is_anonymous: false }, isLoading: false };
});

describe('RaffleWin orchestrator', () => {
  it('signed out shows the gate and never claims', async () => {
    h.auth = { user: null, isLoading: false };
    go();
    expect(await screen.findByRole('link', { name: 'Sign in to claim' })).toBeTruthy();
    // The page pings raffle_win_link_opened_v1 on mount (fire and forget, not a claim); only the claim is forbidden.
    expect(h.rpc.mock.calls.map((c) => c[0])).not.toContain('raffle_win_claim_link_v1');
  });
  it('signed in shows won; from sign-in goes to pick', async () => {
    setup({ raffle_win_claim_link_v1: claim() });
    const a = go();
    expect(await screen.findByRole('button', { name: /choose my night/i })).toBeTruthy();
    a.unmount();
    sessionStorage.setItem('raffle_win_from_auth', '1');
    go();
    expect(await screen.findByText('Friday Bachata')).toBeTruthy();
    expect(screen.queryByRole('button', { name: /choose my night/i })).toBeNull();
    expect(sessionStorage.getItem('raffle_win_from_auth')).toBeNull();
  });
  it('already locked goes to the dashboard without the fresh flag', async () => {
    setup({ raffle_win_claim_link_v1: claim({ id: 'w1', state: 'locked', qr_token: 'q', night: N1 }) });
    go();
    await waitFor(() => expect(h.navigate).toHaveBeenCalledWith('/app/home', { replace: true }));
    expect(sessionStorage.getItem('raffle_win_fresh')).toBeNull();
  });
  it.each([
    ['none', claim(undefined, []), 'No nights open right now'],
    ['error', { data: null, error: { message: 'x' } }, 'Something went wrong'],
    ['other', { data: { ok: false, reason: 'bound_to_other_account' }, error: null }, 'Already claimed'],
    ['cancel', { data: { ok: false, reason: 'link_not_found' }, error: null }, 'This link is no longer valid'],
  ])('status screen: %s', async (_k, res, text) => {
    setup({ raffle_win_claim_link_v1: res });
    go();
    expect(await screen.findByText(text)).toBeTruthy();
  });
  it('lock success sets fresh flag, emails once, shows share, Skip goes to dashboard', async () => {
    setup({ raffle_win_claim_link_v1: claim(), my_dancer_edit_v1: { data: FULL, error: null }, raffle_win_lock_v2: lockOk });
    h.invoke.mockResolvedValue({ data: { ok: true, status: 'sent' }, error: null });
    go(); await pickAndLock(); await confirm();
    fireEvent.click(await screen.findByRole('button', { name: /skip, show my qr/i }));
    expect(sessionStorage.getItem('raffle_win_fresh')).toBe('1');
    expect(emails()).toHaveLength(1);
    expect(h.invoke).toHaveBeenCalledWith('raffle-win-email', { body: { win_id: 'w1' } });
    expect(h.navigate).toHaveBeenCalledWith('/app/home', { replace: true });
  });
  it('email failure does not block', async () => {
    setup({ raffle_win_claim_link_v1: claim(), my_dancer_edit_v1: { data: FULL, error: null }, raffle_win_lock_v2: lockOk });
    h.invoke.mockRejectedValue(new Error('down'));
    go(); await pickAndLock(); await confirm();
    fireEvent.click(await screen.findByRole('button', { name: /skip, show my qr/i }));
    expect(h.navigate).toHaveBeenCalledWith('/app/home', { replace: true });
  });
  it('confirm without a tick makes no lock call', async () => {
    setup({ raffle_win_claim_link_v1: claim(), my_dancer_edit_v1: { data: FULL, error: null } });
    go(); await pickAndLock();
    fireEvent.click(await screen.findByRole('button', { name: /confirm/i }));
    expect(h.rpc.mock.calls.some((c) => c[0] === 'raffle_win_lock_v2')).toBe(false);
  });
  it.each(['spot_taken', 'already_been_to_event', 'night_not_open', 'honesty_required'])('refusal %s returns to pick, no email', async (reason) => {
    setup({ raffle_win_claim_link_v1: claim(), my_dancer_edit_v1: { data: FULL, error: null }, raffle_win_lock_v2: { data: { ok: false, reason }, error: null } });
    go(); await pickAndLock(); await confirm();
    expect(await screen.findByRole('button', { name: /lock/i })).toBeTruthy();
    expect(emails()).toHaveLength(0);
    expect(sessionStorage.getItem('raffle_win_fresh')).toBeNull();
  });
  it('missing profile fields show steps, then honesty', async () => {
    setup({ raffle_win_claim_link_v1: claim(), my_dancer_edit_v1: { data: { ...FULL, avatar_url: null }, error: null } });
    go(); await pickAndLock();
    fireEvent.click(await screen.findByText('steps:avatar_url'));
    expect(await screen.findByRole('checkbox')).toBeTruthy();
  });
  it('server profile_incomplete shows steps for those fields', async () => {
    setup({ raffle_win_claim_link_v1: claim(), my_dancer_edit_v1: { data: FULL, error: null },
      raffle_win_lock_v2: { data: { ok: false, reason: 'profile_incomplete', missing: ['nationality'] }, error: null } });
    go(); await pickAndLock(); await confirm();
    expect(await screen.findByText('steps:nationality')).toBeTruthy();
  });
});

// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter, Route, Routes } from 'react-router-dom';

/*
 * The door invite link (organiser R4 slice a) x every answer of ticket_door_seat_accept_v1, signed out
 * and in, and the seat-only door screen x the prod door-list shapes. Prod survey 2026-11-19 (counts
 * only): 0 door invites, 0 door seats exist; tokens are 64 hex (encode(gen_random_bytes(32),'hex')).
 */
const rpc = vi.hoisted(() => vi.fn());
const auth = vi.hoisted(() => ({ v: { user: { id: 'u1' } as { id: string } | null, authStatus: 'ready' } }));
vi.mock('@/integrations/supabase/client', () => ({ supabase: { rpc: (...a: unknown[]) => rpc(...a) } }));
vi.mock('@/hooks/useAuth', () => ({ useAuth: () => auth.v }));
vi.mock('@/hooks/useNoindexMeta', () => ({ useNoindexMeta: () => undefined }));
import DoorJoinPage from '../DoorJoinPage';
import { Door } from '../../DoorScreen';
import { DOOR_JOIN_COPY as C, DOOR_PATHS, joinStepOf, parseAccept, parseMint, accessEndsWord, type JoinIn } from '../doorJoinModel';

const TOKEN = 'a'.repeat(64);
const SER = '11111111-1111-1111-1111-111111111111';
const ans = (result: string, ok = false) => ({ result, event_series_id: ok ? SER : null, expires_at: ok ? '2026-11-21T11:30:00Z' : null });

beforeEach(() => { rpc.mockReset(); auth.v = { user: { id: 'u1' }, authStatus: 'ready' }; window.history.replaceState(null, '', '/'); });
afterEach(() => cleanup());

describe('join step x input', () => {
  const A = (r: string) => parseAccept(ans(r, r === 'ok'))!;
  const CASES: Array<[string, JoinIn, string]> = [
    ['malformed token', { tokenValid: false, auth: 'signed_in', accept: 'idle' }, 'bad_link'],
    ['auth resolving', { tokenValid: true, auth: 'resolving', accept: 'idle' }, 'checking'],
    ['signed out', { tokenValid: true, auth: 'signed_out', accept: 'idle' }, 'signed_out'],
    ['signed in, not asked yet', { tokenValid: true, auth: 'signed_in', accept: 'idle' }, 'accepting'],
    ['asking', { tokenValid: true, auth: 'signed_in', accept: 'running' }, 'accepting'],
    ['call failed', { tokenValid: true, auth: 'signed_in', accept: 'failed' }, 'error'],
    ['ok', { tokenValid: true, auth: 'signed_in', accept: A('ok') }, 'ok'],
    ['unknown_invite', { tokenValid: true, auth: 'signed_in', accept: A('unknown_invite') }, 'ended'],
    ['invite_ended', { tokenValid: true, auth: 'signed_in', accept: A('invite_ended') }, 'ended'],
    ['invite_used', { tokenValid: true, auth: 'signed_in', accept: A('invite_used') }, 'used'],
    ['seat_revoked', { tokenValid: true, auth: 'signed_in', accept: A('seat_revoked') }, 'revoked'],
    ['profile_incomplete', { tokenValid: true, auth: 'signed_in', accept: A('profile_incomplete') }, 'profile'],
  ];
  it.each(CASES)('%s', (_n, i, want) => expect(joinStepOf(i)).toBe(want));

  it('an unknown answer, or ok with no event, is not trusted', () => {
    expect(parseAccept({ result: 'maybe' })).toBeNull();
    expect(parseAccept({ result: 'ok', event_series_id: null })).toBeNull();
    expect(parseAccept(null)).toBeNull();
    expect(parseMint({ result: 'ok', token: 'short' })).toBeNull();
    expect(parseMint({ result: 'ok', token: TOKEN, expires_at: 'x' })?.token).toBe(TOKEN);
    expect(parseMint({ result: 'occurrence_ended', token: null })?.result).toBe('occurrence_ended');
  });
  it('access end reads in London time', () => {
    expect(accessEndsWord('2026-11-21T11:30:00Z')).toBe('Saturday 21 November, 11:30am');
    expect(accessEndsWord('2026-07-04T02:00:00Z')).toBe('Saturday 4 July, 3am');
    expect(accessEndsWord(null)).toBeNull();
    expect(accessEndsWord('nope')).toBeNull();
  });
});

function page(path = DOOR_PATHS.join(TOKEN)) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <MemoryRouter initialEntries={[path]}>
        <Routes>
          <Route path="/door/join/:token" element={<DoorJoinPage />} />
          <Route path="/door/join" element={<DoorJoinPage />} />
          <Route path="/door/:seriesId" element={<p data-testid="seat-door">door</p>} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

describe('accept page x answer', () => {
  const MSG: Array<[string, string]> = [
    ['unknown_invite', C.ended], ['invite_ended', C.ended], ['invite_used', C.used], ['seat_revoked', C.revoked], ['profile_incomplete', C.profile],
  ];
  it.each(MSG)('%s says it in plain words, once', async (r, text) => {
    rpc.mockResolvedValue({ data: ans(r), error: null });
    page();
    expect(await screen.findByText(text)).toBeTruthy();
    expect(rpc).toHaveBeenCalledTimes(1);
    expect(rpc).toHaveBeenCalledWith('ticket_door_seat_accept_v1', { p_token: TOKEN });
  });
  it('a used-up link leaves the address bar', async () => {
    window.history.replaceState(null, '', DOOR_PATHS.join(TOKEN));
    rpc.mockResolvedValue({ data: ans('invite_ended'), error: null });
    page();
    await screen.findByText(C.ended);
    expect(window.location.pathname).toBe('/door/join');
  });
  it('ok goes straight to the door screen for that event', async () => {
    rpc.mockResolvedValue({ data: ans('ok', true), error: null });
    page();
    expect(await screen.findByTestId('seat-door')).toBeTruthy();
  });
  it('profile_incomplete sends them to finish the profile, then back to this link', async () => {
    rpc.mockResolvedValue({ data: ans('profile_incomplete'), error: null });
    page();
    const a = await screen.findByTestId('door-join-profile');
    expect(a.getAttribute('href')).toBe(`/finish-profile?returnTo=${encodeURIComponent(DOOR_PATHS.join(TOKEN))}`);
  });
  it('an error offers Try again, which asks again', async () => {
    rpc.mockResolvedValueOnce({ data: null, error: { message: 'net' } }).mockResolvedValueOnce({ data: ans('ok', true), error: null });
    page();
    fireEvent.click(await screen.findByTestId('door-join-retry'));
    expect(await screen.findByTestId('seat-door')).toBeTruthy();
    expect(rpc).toHaveBeenCalledTimes(2);
  });
  it('signed out: never asks the server; Sign in returns to this same link', () => {
    auth.v = { user: null, authStatus: 'ready' };
    page();
    expect(screen.getByText(C.signedOut)).toBeTruthy();
    expect(screen.getByTestId('door-join-signin').getAttribute('href')).toBe(`/auth?mode=signin&returnTo=${encodeURIComponent(DOOR_PATHS.join(TOKEN))}`);
    expect(rpc).not.toHaveBeenCalled();
  });
  it('while sign-in is resolving, nothing is asked', () => {
    auth.v = { user: null, authStatus: 'resolving' };
    page();
    expect(screen.getByTestId('door-join-busy').textContent).toBe(C.checking);
    expect(rpc).not.toHaveBeenCalled();
  });
  it('a malformed link (or the bare path) is "stopped working" and never asked', () => {
    page('/door/join/not-a-token');
    expect(screen.getByText(C.ended)).toBeTruthy();
    cleanup();
    page('/door/join');
    expect(screen.getByText(C.ended)).toBeTruthy();
    expect(rpc).not.toHaveBeenCalled();
  });
});

describe('seat-only door x prod list shapes: no way into the organiser area', () => {
  const row = (id: string, name: string, inAt: string | null) => ({ ticket_id: id, first_name: name, quantity_in_order: 1, ticket_type_name: 'General entry', checked_in_at: inAt });
  const SHAPES: Array<[string, unknown]> = [
    ['tickets sold', { result: 'ok', rows: [row('t1', 'Ana', null)], truncated: false, in_count: 0, total_count: 1 }],
    ['none sold', { result: 'ok', rows: [], truncated: false, in_count: 0, total_count: 0 }],
    ['seat ended / not allowed', { result: 'not_allowed', rows: [], truncated: false, in_count: null, total_count: null }],
  ];
  it.each(SHAPES)('%s', async (_n, list) => {
    rpc.mockImplementation(async () => ({ data: list, error: null }));
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    const deps = { getStream: async () => ({ getTracks: () => [{ stop: vi.fn() }] }) as unknown as MediaStream, makeDetector: async () => async () => null, every: 50 };
    const { container } = render(
      <QueryClientProvider client={client}><MemoryRouter><Door seriesId={SER} deps={deps} shortCodes nightName="Friday Social" r4 seatOnly /></MemoryRouter></QueryClientProvider>,
    );
    await waitFor(() => expect(rpc).toHaveBeenCalled());
    await waitFor(() => expect(container.querySelector('[aria-busy="true"]')).toBeNull());
    expect(screen.getByTestId('door-tab-scan')).toBeTruthy();
    const hrefs = [...container.querySelectorAll('a')].map((a) => a.getAttribute('href'));
    expect(hrefs.filter((h) => h?.startsWith('/account'))).toEqual([]);
    expect(screen.getByTestId('door-back').getAttribute('href')).toBe('/');
  });
});

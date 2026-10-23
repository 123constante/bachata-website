import { describe, expect, it, vi } from 'vitest';

vi.mock('@/integrations/supabase/client', () => ({ supabase: { rpc: vi.fn(), from: vi.fn() } }));
vi.mock('@/hooks/useAuth', () => ({ useAuth: () => ({ user: { id: 'u1' } }) }));

import { cancelInvite, FAILURE_TEXT, fetchMyInvitations, fetchOrganisers, inviteOrganiser, leaveEvent, OrganiserApiError, removeOrganiserPage, respondToInvite, searchOrganiserPages } from '../organiserApi';

const ok = (data: unknown) => vi.fn(async () => ({ data, error: null }));
const bad = (code: string, message: string) => vi.fn(async () => ({ data: null, error: { code, message } }));

describe('RPC names and arguments (ER-INTERFACE section 4, AS BUILT)', () => {
  it('series_organisers_v1', async () => {
    const rpc = ok({ organisers: [{ page_id: 'o', name: 'A', role: 'owner', status: 'accepted' }] });
    expect(await fetchOrganisers('s1', rpc)).toHaveLength(1);
    expect(rpc).toHaveBeenCalledWith('series_organisers_v1', { p_series_id: 's1' });
  });
  it('my_organiser_invites_v1', async () => {
    const rpc = ok({ invites: [] });
    expect(await fetchMyInvitations(rpc)).toEqual([]);
    expect(rpc).toHaveBeenCalledWith('my_organiser_invites_v1', {});
  });
  it('series_invite_organiser_v1 returns the invite id', async () => {
    const rpc = ok({ invite_id: 'inv1' });
    expect(await inviteOrganiser('s1', 'p1', rpc)).toBe('inv1');
    expect(rpc).toHaveBeenCalledWith('series_invite_organiser_v1', { p_series_id: 's1', p_page_id: 'p1' });
  });
  it.each([
    ['cancel', (r: never) => cancelInvite('i1', r), 'series_invite_cancel_v1', { p_invite_id: 'i1' }],
    ['accept', (r: never) => respondToInvite('i1', true, r), 'series_invite_respond_v1', { p_invite_id: 'i1', p_accept: true }],
    ['decline', (r: never) => respondToInvite('i1', false, r), 'series_invite_respond_v1', { p_invite_id: 'i1', p_accept: false }],
    ['leave', (r: never) => leaveEvent('s1', 'p1', r), 'series_leave_v1', { p_series_id: 's1', p_page_id: 'p1' }],
    ['remove', (r: never) => removeOrganiserPage('s1', 'p1', r), 'series_remove_organiser_v1', { p_series_id: 's1', p_page_id: 'p1' }],
  ])('%s', async (_n, run, fn, args) => {
    const rpc = ok({});
    await run(rpc as never);
    expect(rpc).toHaveBeenCalledWith(fn, args);
  });
});

// ER-FIX2-S4 (F2, F3, F4, F9): the server texts below are the real ones, read on prod
// with SELECT on pg_proc (2026-10-23): invite raises "invalid_payload: this page is already
// invited" / "... already organises the event"; cancel and respond raise
// "invalid_payload: this invite is no longer open"; the rate check raises 54000 "rate_limited".
describe('error mapping', () => {
  it.each([
    ['PGRST202', 'Could not find the function public.x', 'unavailable'],
    ['P0001', 'version_conflict: stale', 'conflict'],
    ['54000', 'rate_limited', 'rate_limited'],
    ['P0001', 'rate_limited', 'rate_limited'],
    ['42501', 'permission_denied: not on this event', 'refused'],
    ['P0001', 'invalid_payload: separate pages cannot generate this', 'failed'],
    ['XX000', 'boom', 'failed'],
  ])('%s %s -> %s', async (code, message, kind) => {
    await expect(inviteOrganiser('s', 'p', bad(code, message))).rejects.toMatchObject({ kind });
    await expect(inviteOrganiser('s', 'p', bad(code, message))).rejects.toBeInstanceOf(OrganiserApiError);
  });
  it('F9: a message that only CONTAINS "rate" is not the invite limit', async () => {
    await expect(removeOrganiserPage('s', 'p', bad('P0001', 'could not separate the pages'))).rejects.toMatchObject({ kind: 'failed' });
  });
  it('a search under 2 letters asks nothing', async () => expect(await searchOrganiserPages(' a ')).toEqual([]));
});

describe('decision 5: a retried invite or cancel is SUCCESS', () => {
  it.each(['invalid_payload: this page is already invited', 'invalid_payload: this page already organises the event'])('invite answered %j resolves (no invite id)', async (message) => {
    await expect(inviteOrganiser('s', 'p', bad('P0001', message))).resolves.toBeNull();
  });
  it('cancel answered "this invite is no longer open" resolves', async () => {
    await expect(cancelInvite('i1', bad('P0001', 'invalid_payload: this invite is no longer open'))).resolves.toBeUndefined();
  });
  it('F4: respond on a gone invite is "gone" (withdrawn), not a generic failure', async () => {
    await expect(respondToInvite('i1', true, bad('P0001', 'invalid_payload: this invite is no longer open'))).rejects.toMatchObject({ kind: 'gone' });
    expect(FAILURE_TEXT.gone).toBe('This invitation was withdrawn.');
  });
  it('a real refusal on invite is still an error', async () => {
    await expect(inviteOrganiser('s', 'p', bad('42501', 'permission_denied: x'))).rejects.toMatchObject({ kind: 'refused' });
  });
});

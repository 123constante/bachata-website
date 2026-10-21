import { describe, expect, it, vi } from 'vitest';

vi.mock('@/integrations/supabase/client', () => ({ supabase: { rpc: vi.fn(), from: vi.fn() } }));
vi.mock('@/hooks/useAuth', () => ({ useAuth: () => ({ user: { id: 'u1' } }) }));

import { cancelInvite, fetchMyInvitations, fetchOrganisers, inviteOrganiser, leaveEvent, OrganiserApiError, removeOrganiserPage, respondToInvite, searchOrganiserPages } from '../organiserApi';

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

describe('error mapping', () => {
  it.each([
    ['PGRST202', 'Could not find the function public.x', 'unavailable'],
    ['P0001', 'version_conflict: stale', 'conflict'],
    ['P0001', 'rate_limited: 20 a day', 'rate_limited'],
    ['42501', 'permission_denied: end run is for the owner organiser\'s team only', 'refused'],
    ['P0001', 'page already linked', 'refused'],
    ['XX000', 'boom', 'failed'],
  ])('%s %s -> %s', async (code, message, kind) => {
    await expect(inviteOrganiser('s', 'p', bad(code, message))).rejects.toMatchObject({ kind });
    await expect(inviteOrganiser('s', 'p', bad(code, message))).rejects.toBeInstanceOf(OrganiserApiError);
  });
  it('a search under 2 letters asks nothing', async () => expect(await searchOrganiserPages(' a ')).toEqual([]));
});

import { beforeEach, describe, expect, it, vi } from 'vitest';

// The exact RPC names and argument keys the team page sends (W6). The server
// reads these keys by name (admin D4 20261108220000, D7 20261109140000); a
// renamed key would be a silent default on the server, not a refusal.
const rpc = vi.fn();
vi.mock('@/integrations/supabase/client', () => ({ supabase: { rpc: (...args: unknown[]) => rpc(...args) } }));

import { fetchIncomingAccessRequests, removeOrganiserMember, resolveAccessRequest, teamOf } from '../selfServeApi';

beforeEach(() => rpc.mockReset());

describe('team RPC payloads', () => {
  it('lists one organiser\'s incoming requests', async () => {
    rpc.mockResolvedValue({ data: [{ request_id: 'r1', user_id: 'u1', requester_email: 'm@x', message: 'hi', created_at: '2026-10-03T09:00:00+00:00' }], error: null });
    const rows = await fetchIncomingAccessRequests('org-1');
    expect(rpc).toHaveBeenCalledTimes(1);
    expect(rpc.mock.calls[0][0]).toBe('list_organiser_access_requests_v1');
    expect(rpc.mock.calls[0][1]).toEqual({ p_organiser_id: 'org-1', p_scope: 'incoming' });
    expect(rows).toEqual([{ requestId: 'r1', userId: 'u1', requesterEmail: 'm@x', message: 'hi', createdAt: '2026-10-03T09:00:00+00:00' }]);
  });

  it('grants as a manager and declines with no role or note', async () => {
    rpc.mockResolvedValue({ data: { request_id: 'r1', decision: 'grant', member_role: 'manager' }, error: null });
    const granted = await resolveAccessRequest('r1', 'grant');
    expect(rpc.mock.calls[0][0]).toBe('resolve_organiser_access_request_v1');
    expect(rpc.mock.calls[0][1]).toEqual({ p_request_id: 'r1', p_decision: 'grant', p_member_role: 'manager' });
    expect(granted).toEqual({ requestId: 'r1', decision: 'grant', memberRole: 'manager' });

    rpc.mockResolvedValue({ data: { request_id: 'r2', decision: 'decline', member_role: null }, error: null });
    const declined = await resolveAccessRequest('r2', 'decline');
    expect(rpc.mock.calls[1][1]).toEqual({ p_request_id: 'r2', p_decision: 'decline' });
    expect(declined.memberRole).toBeNull();
  });

  it('removes a member by organiser and user, and reports a self-removal', async () => {
    rpc.mockResolvedValue({ data: { user_id: 'me', member_role: 'manager', self_removed: true, removed_rows: 1 }, error: null });
    const result = await removeOrganiserMember('org-1', 'me');
    expect(rpc.mock.calls[0][0]).toBe('remove_organiser_member_v1');
    expect(rpc.mock.calls[0][1]).toEqual({ p_organiser_id: 'org-1', p_user_id: 'me' });
    expect(result).toEqual({ userId: 'me', memberRole: 'manager', selfRemoved: true, removedRows: 1 });
  });

  it('throws the server refusal untouched, for the copy layer to read', async () => {
    rpc.mockResolvedValue({ data: null, error: { message: 'last_owner', code: 'P0001' } });
    await expect(removeOrganiserMember('org-1', 'me')).rejects.toEqual({ message: 'last_owner', code: 'P0001' });
  });

  it('reads the team off a home organiser, tolerating pre-D7 homes', () => {
    expect(teamOf({ team: [{ user_id: 'a', member_role: 'owner', is_self: true }] } as never).map((m) => m.userId)).toEqual(['a']);
    expect(teamOf({} as never)).toEqual([]);
    expect(teamOf(null)).toEqual([]);
  });
});

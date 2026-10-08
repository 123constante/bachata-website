import { describe, expect, it } from 'vitest';
import {
  howToAddManager,
  instantDateLabel,
  memberAction,
  memberLabel,
  ownerCount,
  parseIncomingRequests,
  parseRemoval,
  parseTeam,
  type TeamMember,
} from '../teamModel';
import { KNOWN_TEAM_CODES, TEAM_COPY, teamErrorMessage } from '../selfServeErrors';

// organiser_home_v1's team rows as admin D7 (20261109140000) builds them.
const rawTeam = [
  { user_id: 'a1', member_role: 'owner', is_primary: true, joined_at: '2026-09-01T10:00:00+00:00', is_self: true, email: 'diego@ritmo.example', display_name: 'Diego R.' },
  { user_id: 'a2', member_role: 'owner', is_primary: false, joined_at: '2026-09-02T10:00:00+00:00', is_self: false, email: 'sofia@ritmo.example', display_name: null },
  { user_id: 'b1', member_role: 'manager', is_primary: false, joined_at: '2026-09-03T10:00:00+00:00', is_self: false, email: 'ana@ritmo.example', display_name: 'Ana M.' },
  { user_id: 'c1', member_role: 'contributor', is_primary: false, joined_at: null, is_self: false, email: null, display_name: null },
  'garbage',
];

const member = (over: Partial<TeamMember>): TeamMember => ({
  userId: 'x', role: 'manager', isPrimary: false, joinedAt: null, isSelf: false, email: null, displayName: null, ...over,
});

describe('parseTeam', () => {
  it('keeps owner and manager rows only, in the server order', () => {
    const team = parseTeam(rawTeam);
    expect(team.map((m) => `${m.userId}:${m.role}:${m.isSelf}`)).toEqual(['a1:owner:true', 'a2:owner:false', 'b1:manager:false']);
    expect(team[1].displayName).toBeNull();
    expect(ownerCount(team)).toBe(2);
  });

  it('degrades a missing or shapeless team to empty', () => {
    expect(parseTeam(undefined)).toEqual([]);
    expect(parseTeam({ not: 'an array' })).toEqual([]);
  });

  it('labels a member by sign-up name, else email, else a placeholder', () => {
    expect(memberLabel(member({ displayName: 'Ana M.', email: 'ana@x' }))).toBe('Ana M.');
    expect(memberLabel(member({ email: 'ana@x' }))).toBe('ana@x');
    expect(memberLabel(member({}))).toBe('A team member');
  });
});

describe('memberAction mirrors remove_organiser_member_v1', () => {
  const me = member({ userId: 'a1', role: 'owner', isSelf: true });
  const otherOwner = member({ userId: 'a2', role: 'owner' });
  const manager = member({ userId: 'b1', role: 'manager' });

  it('an owner removes a manager and may leave when another owner remains', () => {
    const team = [me, otherOwner, manager];
    expect(memberAction(manager, 'owner', team)).toEqual({ kind: 'remove', enabled: true, note: null });
    expect(memberAction(me, 'owner', team)).toEqual({ kind: 'leave', enabled: true, note: null });
  });

  it('the last owner cannot leave (last_owner) and an owner never removes another owner (cannot_remove_owner)', () => {
    const lastOwner = memberAction(me, 'owner', [me, manager]);
    expect(lastOwner?.kind).toBe('leave');
    expect(lastOwner?.enabled).toBe(false);
    expect(lastOwner?.note).toMatch(/only owner/);
    const owner = memberAction(otherOwner, 'owner', [me, otherOwner, manager]);
    expect(owner?.kind).toBe('remove');
    expect(owner?.enabled).toBe(false);
  });

  it('a manager only leaves (naming anyone else is not_authorised)', () => {
    const self = member({ userId: 'b1', role: 'manager', isSelf: true });
    const team = [member({ userId: 'a1', role: 'owner' }), self, member({ userId: 'b2', role: 'manager' })];
    expect(memberAction(self, 'manager', team)).toEqual({ kind: 'leave', enabled: true, note: null });
    expect(memberAction(team[0], 'manager', team)).toBeNull();
    expect(memberAction(team[2], 'manager', team)).toBeNull();
  });
});

describe('access requests (D4 incoming rows)', () => {
  it('maps the rows the owner acts on and drops shapeless ones', () => {
    const rows = parseIncomingRequests([
      { request_id: 'r1', user_id: 'u9', requester_email: 'maria.k@example.com', message: 'I run the Sunday party with Diego', created_at: '2026-10-03T09:00:00+00:00', organiser_name: 'Ritmo' },
      { request_id: 'r2', user_id: 'u8', requester_email: null, message: null, created_at: '2026-10-03T10:00:00+00:00' },
      { nope: true },
    ]);
    expect(rows).toEqual([
      { requestId: 'r1', userId: 'u9', requesterEmail: 'maria.k@example.com', message: 'I run the Sunday party with Diego', createdAt: '2026-10-03T09:00:00+00:00' },
      { requestId: 'r2', userId: 'u8', requesterEmail: null, message: null, createdAt: '2026-10-03T10:00:00+00:00' },
    ]);
    expect(parseIncomingRequests(null)).toEqual([]);
  });

  it('reads a removal answer and falls back to the named user', () => {
    expect(parseRemoval({ user_id: 'b1', member_role: 'manager', self_removed: false, removed_rows: 1 }, 'b1')).toEqual({
      userId: 'b1', memberRole: 'manager', selfRemoved: false, removedRows: 1,
    });
    expect(parseRemoval(null, 'me')).toEqual({ userId: 'me', memberRole: null, selfRemoved: false, removedRows: 0 });
  });

  it('dates a real instant on the London calendar', () => {
    // 23:30 UTC on 3 Oct is 00:30 BST on Sat 4 Oct.
    expect(instantDateLabel('2026-10-03T23:30:00+00:00')).toBe('Sun 4 Oct');
    expect(instantDateLabel(null)).toBeNull();
    expect(instantDateLabel('garbage')).toBeNull();
  });

  it('says how a person asks for access, since there is no add-by-email RPC', () => {
    expect(howToAddManager('Ritmo Bachata London')).toMatch(/sign in to Bachata Calendar once.*Ritmo Bachata London.*Request access/);
  });
});

// Every refusal remove_organiser_member_v1 (D7), list_organiser_access_requests_v1
// and resolve_organiser_access_request_v1 (D4) can raise to a signed-in caller.
const SERVER_TEAM_CODES = [
  'authentication_required', 'organiser_id_required', 'user_id_required', 'not_authorised', 'organiser_not_found',
  'not_a_member', 'cannot_remove_owner', 'last_owner',
  'request_id_required', 'invalid_decision', 'invalid_member_role', 'request_not_found', 'request_not_open',
  'note_too_long', 'note_invalid', 'invalid_scope',
];

describe('teamErrorMessage', () => {
  it('has copy for every code the team RPCs raise', () => {
    expect(SERVER_TEAM_CODES.filter((c) => !KNOWN_TEAM_CODES.includes(c))).toEqual([]);
  });

  it('reads the code and never surfaces raw text', () => {
    expect(teamErrorMessage({ message: 'last_owner', code: 'P0001' })).toBe(TEAM_COPY.last_owner);
    expect(teamErrorMessage({ message: 'cannot_remove_owner' })).toMatch(/cannot be removed here/);
    expect(teamErrorMessage({ message: 'permission denied for table entity_members' })).toBe('Something went wrong. Please try again.');
    expect(teamErrorMessage({ message: 'some_future_code' })).toBe('Something went wrong. Please try again.');
  });
});

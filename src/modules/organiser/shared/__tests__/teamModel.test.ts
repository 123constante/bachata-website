import { describe, expect, it } from 'vitest';
import {
  ADD_ROLES,
  canReceiveOwnership,
  shortName,
  READ_ONLY_REASON,
  instantDateLabel,
  memberAction,
  memberLabel,
  ownerCount,
  ownerMoves,
  parseIncomingRequests,
  parseRemoval,
  parseTeam,
  parseTeamRead,
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
  it('keeps owner, manager and contributor rows, in the server order', () => {
    const team = parseTeam(rawTeam);
    expect(team.map((m) => `${m.userId}:${m.role}:${m.isSelf}`)).toEqual(['a1:owner:true', 'a2:owner:false', 'b1:manager:false', 'c1:contributor:false']);
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

  it('reads organiser_team_v1: the viewer role and the members (is_me marks the viewer)', () => {
    const read = parseTeamRead({ my_role: 'owner', members: [{ user_id: 'a', member_role: 'owner', is_me: true, email: 'a@x' }, { user_id: 'b', member_role: 'contributor', is_me: false, email: null }] });
    expect(read.myRole).toBe('owner');
    expect(read.members.map((m) => `${m.userId}:${m.role}:${m.isSelf}`)).toEqual(['a:owner:true', 'b:contributor:false']);
    expect(parseTeamRead(null)).toEqual({ myRole: null, members: [] });
    expect(parseTeamRead({ my_role: 'stranger', members: 'x' }).myRole).toBeNull();
  });
});

describe('ownerMoves mirrors the owner-only team RPCs', () => {
  const m = (role: TeamMember['role'], over: Partial<TeamMember> = {}) => member({ role, userId: role, ...over });
  it.each([
    ['owner viewing a manager', 'owner', m('manager'), { changeTo: 'contributor', canTransfer: true, note: null }],
    ['owner viewing a contributor', 'owner', m('contributor'), { changeTo: 'manager', canTransfer: true, note: null }],
  ] as const)('%s', (_n, viewer, target, expected) => {
    expect(ownerMoves(target, viewer)).toEqual(expected);
  });
  it('an owner never changes or transfers to another owner (target_is_owner, already_owner)', () => {
    const moves = ownerMoves(m('owner'), 'owner');
    expect(moves?.changeTo).toBeNull();
    expect(moves?.canTransfer).toBe(false);
    expect(moves?.note).toMatch(/cannot be changed here/);
  });
  it.each(['manager', 'contributor'] as const)('a %s gets no moves at all (owner_only)', (viewer) => {
    expect(ownerMoves(m('manager'), viewer)).toBeNull();
  });
  it('the owner\u2019s own row has no moves', () => {
    expect(ownerMoves(m('owner', { isSelf: true }), 'owner')).toBeNull();
  });
  it('a new person can be a manager or contributor, never an owner (use_transfer), and the read-only reason names the controls', () => {
    expect([...ADD_ROLES]).toEqual(['manager', 'contributor']);
    expect(READ_ONLY_REASON).toMatch(/Only an owner can add people, change roles or transfer ownership/);
  });
});

// Every refusal remove_organiser_member_v1 (D7), list_organiser_access_requests_v1
// and resolve_organiser_access_request_v1 (D4) can raise to a signed-in caller.
const SERVER_TEAM_CODES = [
  'authentication_required', 'organiser_id_required', 'user_id_required', 'not_authorised', 'organiser_not_found',
  'not_a_member', 'cannot_remove_owner', 'last_owner',
  'request_id_required', 'invalid_decision', 'invalid_member_role', 'request_not_found', 'request_not_open',
  'note_too_long', 'note_invalid', 'invalid_scope',
  // organiser_team_v1 / organiser_team_set_member_v1 / organiser_team_remove_member_v1 / organiser_transfer_ownership_v1
  // and the shared write gate + member helpers, read from the live bodies 2026-10-11.
  'owner_only', 'use_transfer', 'target_is_owner', 'already_owner', 'user_not_found', 'unconfirmed_email',
  'reason_required', 'reason_too_long', 'reason_invalid', 'primary_requires_owner', 'invalid_target_rule',
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

describe('S6 additions (D48, R3-11, D60)', () => {
  it('maps photo_url and added_by_display_name, tolerating their absence', () => {
    const [a, b] = parseTeam([
      { user_id: 'u1', member_role: 'manager', display_name: 'Priya Sharma', photo_url: 'https://i.example/p.jpg', added_by_display_name: 'Maya R.' },
      { user_id: 'u2', member_role: 'owner' },
    ]);
    expect(a).toMatchObject({ photoUrl: 'https://i.example/p.jpg', addedByDisplayName: 'Maya R.' });
    expect(b.photoUrl).toBeNull();
    expect(b.addedByDisplayName).toBeNull();
  });
  it('shortName: first name + last initial; one word stays', () => {
    expect(shortName('Priya Sharma')).toBe('Priya S.');
    expect(shortName('Maya  de la Rosa')).toBe('Maya R.');
    expect(shortName('Cher')).toBe('Cher');
  });
  it('only another non-owner member with an email can receive ownership', () => {
    const m = (o: Partial<TeamMember>): TeamMember => ({ userId: 'u', role: 'manager', isPrimary: false, joinedAt: null, isSelf: false, email: 'a@x.example', displayName: null, ...o });
    expect(canReceiveOwnership(m({}))).toBe(true);
    expect(canReceiveOwnership(m({ email: null }))).toBe(false);
    expect(canReceiveOwnership(m({ isSelf: true }))).toBe(false);
    expect(canReceiveOwnership(m({ role: 'owner' }))).toBe(false);
  });
});

// Organiser Round 4, boards R4Team (Team T1, grouped by role) and R4AddTeammate. Pure, client-free.
// Built on the Team dashboard model (buildTeamDash: the two team reads, the Add gate) so the R4 screen
// and the dashboard Team tab never disagree about who is on the team or whether Add works.
// Wired only to commands that exist on prod (2026-11-18): organiser_team_add_member_by_profile_v1
// (manager | contributor), list_organiser_access_requests_v1 (join requests) and the sign-up link share.
// Hidden, with no read or command behind them: the Door staff group and chip (no door seat on a team),
// "Copy door invite link" (door seats are per night), "Invited" rows (no read of sent invites),
// search by email (the search matches names only) and "Works once, lasts 7 days" (the link is the
// plain sign-up link, not a single-use invite).
import { ROLE_LABEL, TEAM_FULL_REASON, shortName, type IncomingAccessRequest, type TeamMember, type TeamRole } from '@/modules/organiser/shared/teamModel';
import type { SharedTeamRow } from '@/modules/organiser/team/teamShared';
import { ROLE_LINE, buildTeamDash, type Control, type TeamLoad } from '../dash/team/teamDashModel';

export interface R4TeamRow {
  key: string;
  name: string;
  /** "You" on the caller's own row ("Interim manager" when that is the seat). */
  end: string | null;
  /** The person's own screen; null when the viewer may not open it (contributors, roster-only names). */
  userId: string | null;
}

export interface R4TeamGroup { role: TeamRole; title: string; line: string; rows: R4TeamRow[] }

export interface R4Waiting { key: string; name: string; word: string; request: IncomingAccessRequest }

export interface R4TeamModel {
  load: TeamLoad;
  /** The orange "Add a teammate" button; null = not offered (view only). */
  add: Control | null;
  addVia: 'sheet' | 'share' | null;
  groups: R4TeamGroup[];
  waiting: R4Waiting[];
  viewOnlyNote: string | null;
  readNote: string | null;
}

export interface R4TeamInput {
  load: TeamLoad;
  viewerRole: TeamRole;
  members: readonly TeamMember[];
  listed: readonly SharedTeamRow[] | null;
  requests: readonly IncomingAccessRequest[] | null | undefined;
  interim?: boolean;
  seatKnown?: boolean;
  seatFailed?: boolean;
}

export const R4_ROLE_ORDER: readonly TeamRole[] = ['owner', 'manager', 'contributor'];

/** Board R4Team: one section per role that has someone in it, "Waiting to join (N)" under them. */
export function buildR4Team(i: R4TeamInput): R4TeamModel {
  const dash = buildTeamDash({ load: i.load, viewerRole: i.viewerRole, members: i.members, listed: i.listed, interim: i.interim, seatKnown: i.seatKnown, seatFailed: i.seatFailed, openGroups: new Set(R4_ROLE_ORDER) });
  const groups: R4TeamGroup[] = R4_ROLE_ORDER.map((role) => ({
    role,
    title: ROLE_LABEL[role],
    line: ROLE_LINE[role],
    rows: dash.people.filter((p) => p.role === role)
      .sort((a, b) => Number(b.isSelf) - Number(a.isSelf) || a.name.localeCompare(b.name, 'en-GB'))
      .map((p) => ({ key: p.key, name: p.name, end: p.isSelf ? (p.seatLabel ?? 'You') : null, userId: p.tappable ? p.userId : null })),
  })).filter((g) => g.rows.length > 0);
  const editor = i.viewerRole === 'owner' || i.viewerRole === 'manager';
  const waiting: R4Waiting[] = i.load === 'ready' && editor
    ? (i.requests ?? []).map((r) => ({ key: r.requestId, name: r.requesterEmail ?? 'Someone', word: 'Asked to join', request: r }))
    : [];
  return { load: dash.load, add: dash.add, addVia: dash.addVia, groups, waiting, viewOnlyNote: dash.viewOnlyNote, readNote: dash.readNote };
}

// ---- R4AddTeammate --------------------------------------------------------

export type R4AddRole = 'manager' | 'contributor';
/** The chips the add command takes (organiser_team_add_member_by_profile_v1: manager | contributor). */
export const R4_ADD_ROLES: readonly R4AddRole[] = ['manager', 'contributor'];

export const R4_ADD_COPY = {
  title: 'Add a teammate',
  search: 'Name',
  idle: 'Type at least two letters of their name. Only people with a dancer profile show up.',
  none: 'No one found. Send them an invite link instead.',
  searchFailed: 'We could not search just now.',
  pickFirst: 'Pick someone from the list first.',
  add: 'Add to team',
  adding: 'Adding\u2026',
  invite: 'Send an invite link instead',
  inviteLine: 'They sign up and make a dancer profile, then you find them here.',
  inviteCopied: 'Invite link copied. Send it to them; once they have a dancer profile, search for them here.',
  done: (name: string, role: R4AddRole) => `${shortName(name)} is now a ${ROLE_LABEL[role]}.`,
} as const;

/** "Add to team": off until a person is picked, off when the team is full, never twice at once. */
export function r4AddButton(s: { picked: boolean; full: boolean; pending: boolean }): { disabled: boolean; reason: string | null } {
  if (s.full) return { disabled: true, reason: TEAM_FULL_REASON };
  if (!s.picked) return { disabled: true, reason: R4_ADD_COPY.pickFirst };
  return { disabled: s.pending, reason: null };
}

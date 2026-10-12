// Pure, client-free view model for the organiser's team page (Lever 2 W6,
// mockup 05-B's account page for team and access requests; 04-C's team tab as
// its own small page). Inputs are organiser_home_v1's organisers[].team rows
// (admin D7, 20261109140000) and list_organiser_access_requests_v1's
// 'incoming' rows (admin D4, 20261108220000). Only an owner or manager ever
// receives either, so nothing here decides who may READ; it decides which
// button each row shows and mirrors the server's refusal rules so the screen
// does not offer what remove_organiser_member_v1 would refuse.

export type TeamRole = 'owner' | 'manager' | 'contributor';

export interface TeamMember {
  userId: string;
  role: TeamRole;
  isPrimary: boolean;
  /** When the person joined (a real instant, not local-as-Z). */
  joinedAt: string | null;
  isSelf: boolean;
  email: string | null;
  displayName: string | null;
}

const str = (v: unknown): string | null => (typeof v === 'string' && v !== '' ? v : null);

/** Team rows -> members. Unknown roles and shapeless rows are dropped. */
export function parseTeam(raw: unknown): TeamMember[] {
  if (!Array.isArray(raw)) return [];
  const members: TeamMember[] = [];
  for (const row of raw as Record<string, unknown>[]) {
    if (!row || typeof row !== 'object') continue;
    const role = row.member_role;
    if ((role !== 'owner' && role !== 'manager' && role !== 'contributor') || typeof row.user_id !== 'string') continue;
    members.push({
      userId: row.user_id,
      role,
      isPrimary: row.is_primary === true,
      joinedAt: str(row.joined_at),
      isSelf: row.is_self === true || row.is_me === true,
      email: str(row.email),
      displayName: str(row.display_name),
    });
  }
  return members;
}

/** The name a teammate recognises: the sign-up name, else the email, else a placeholder. */
export const memberLabel = (m: TeamMember): string => m.displayName ?? m.email ?? 'A team member';

export const ROLE_LABEL: Record<TeamRole, string> = { owner: 'Owner', manager: 'Manager', contributor: 'Contributor' };

export const ownerCount = (team: TeamMember[]) => team.filter((m) => m.role === 'owner').length;

export interface MemberAction {
  /** Leave is the caller removing themself; remove is an owner removing a manager. */
  kind: 'leave' | 'remove';
  enabled: boolean;
  /** Why the button is disabled, in the organiser's words; null when enabled. */
  note: string | null;
}

/** The sole owner's reason for no Leave, said once for the row and for the server refusal (last_owner). */
export const LAST_OWNER_NOTE = 'You are the only owner, so you cannot leave. To step down, tap Make owner on a teammate’s row, or contact the Bachata Calendar team.';

/**
 * The one action a row may offer the viewer, mirroring remove_organiser_member_v1:
 * an owner removes a manager or leaves (unless they are the last owner:
 * last_owner); a manager only leaves (naming anyone else: not_authorised);
 * an owner never removes another owner in v1 (cannot_remove_owner). Null
 * means no button at all.
 */
export function memberAction(member: TeamMember, viewerRole: TeamRole, team: TeamMember[]): MemberAction | null {
  if (member.isSelf) {
    if (member.role === 'owner' && ownerCount(team) <= 1) {
      return { kind: 'leave', enabled: false, note: LAST_OWNER_NOTE };
    }
    return { kind: 'leave', enabled: true, note: null };
  }
  if (viewerRole !== 'owner') return null;
  if (member.role === 'owner') {
    return { kind: 'remove', enabled: false, note: 'Another owner can leave, but cannot be removed here. Ask the Bachata Calendar team.' };
  }
  return { kind: 'remove', enabled: true, note: null };
}

// ---- access requests (D4) --------------------------------------------------------

export interface IncomingAccessRequest {
  requestId: string;
  userId: string;
  /** Shown on purpose: the one identity an owner can recognise (the requester chose to send it). */
  requesterEmail: string | null;
  message: string | null;
  createdAt: string;
}

/** list_organiser_access_requests_v1('incoming') rows for ONE organiser → the page's model. */
export function parseIncomingRequests(raw: unknown): IncomingAccessRequest[] {
  if (!Array.isArray(raw)) return [];
  const out: IncomingAccessRequest[] = [];
  for (const row of raw as Record<string, unknown>[]) {
    if (!row || typeof row.request_id !== 'string') continue;
    out.push({
      requestId: row.request_id,
      userId: typeof row.user_id === 'string' ? row.user_id : '',
      requesterEmail: str(row.requester_email),
      message: str(row.message),
      createdAt: typeof row.created_at === 'string' ? row.created_at : '',
    });
  }
  return out;
}

export interface MemberRemoval {
  userId: string;
  memberRole: string | null;
  selfRemoved: boolean;
  removedRows: number;
}

/** remove_organiser_member_v1's answer → what the page needs (did I just leave?). */
export function parseRemoval(raw: unknown, fallbackUserId: string): MemberRemoval {
  const row = (raw ?? {}) as Record<string, unknown>;
  return {
    userId: typeof row.user_id === 'string' ? row.user_id : fallbackUserId,
    memberRole: str(row.member_role),
    selfRemoved: row.self_removed === true,
    removedRows: typeof row.removed_rows === 'number' ? row.removed_rows : 0,
  };
}

/** The London calendar year of an instant. */
export const londonYear = (d: Date) => new Intl.DateTimeFormat('en-GB', { timeZone: 'Europe/London', year: 'numeric' }).format(d);

/**
 * "Sat 3 Oct" for a real instant (created_at, joined_at), on the London
 * calendar, with the year when it is not this year ("Mon 3 Nov 2025"). These
 * are timestamptz, not local-as-Z, so the zone conversion is the right one here.
 */
export function instantDateLabel(iso: string | null | undefined, now: Date = new Date()): string | null {
  if (!iso) return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  const year = londonYear(d) === londonYear(now) ? '' : ` ${londonYear(d)}`;
  return `${d.toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short', timeZone: 'Europe/London' })}${year}`;
}

/** What an owner can do to one other member, from the owner-only team RPCs. */
export interface OwnerMoves {
  /** The role "Change role" would set (manager <-> contributor); null when the role cannot change. */
  changeTo: 'manager' | 'contributor' | null;
  canTransfer: boolean;
  /** Why the moves are missing or disabled, in the organiser's words; null when all are on. */
  note: string | null;
}

/**
 * The extra moves a row may offer: change role and transfer ownership, both owner-only
 * (organiser_team_set_member_v1, organiser_transfer_ownership_v1). Owners cannot be
 * changed by another owner (target_is_owner); you cannot transfer to yourself.
 * Null: no extra control at all (a non-owner viewer, or the viewer's own row).
 */
export function ownerMoves(member: TeamMember, viewerRole: TeamRole): OwnerMoves | null {
  if (viewerRole !== 'owner' || member.isSelf) return null;
  if (member.role === 'owner') {
    return { changeTo: null, canTransfer: false, note: 'Another owner’s role cannot be changed here. They can transfer ownership, or ask the Bachata Calendar team.' };
  }
  return { changeTo: member.role === 'manager' ? 'contributor' : 'manager', canTransfer: true, note: null };
}

/** Shown to a viewer who is not an owner, so the missing controls have a stated reason. */
export const READ_ONLY_REASON = 'Only an owner can add people, change roles or transfer ownership. You can see who is on the team' + ' and leave it.';

/** The roles an owner can give a new person (a second owner comes by transfer). */
export const ADD_ROLES: readonly ('manager' | 'contributor')[] = ['manager', 'contributor'];

/**
 * Who gets the organiser page's team picker (search a person, add them): an
 * owner, or a Bachata Calendar admin, who must also give a reason. The ONE copy
 * of this rule, mirroring organiser_team_search_people_v1 (owner or admin, else
 * not_authorised) and _organiser_team_write_gate_p5 (manager or contributor:
 * owner_only; admin without a reason: reason_required). Null: no picker at all.
 * `myRole` is organiser_team_v1's my_role, where an owner row wins over admin.
 */
export function teamPickerAccess(myRole: TeamRole | 'admin' | null | undefined): 'owner' | 'admin' | null {
  return myRole === 'owner' || myRole === 'admin' ? myRole : null;
}

/** organiser_team_v1 -> the viewer's role and the members. */
export function parseTeamRead(raw: unknown): { myRole: TeamRole | 'admin' | null; members: TeamMember[] } {
  const row = (raw ?? {}) as Record<string, unknown>;
  const r = row.my_role;
  const myRole = r === 'owner' || r === 'manager' || r === 'contributor' || r === 'admin' ? r : null;
  return { myRole, members: parseTeam(row.members) };
}

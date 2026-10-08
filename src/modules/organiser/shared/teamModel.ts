// Pure, client-free view model for the organiser's team page (Lever 2 W6,
// mockup 05-B's account page for team and access requests; 04-C's team tab as
// its own small page). Inputs are organiser_home_v1's organisers[].team rows
// (admin D7, 20261109140000) and list_organiser_access_requests_v1's
// 'incoming' rows (admin D4, 20261108220000). Only an owner or manager ever
// receives either, so nothing here decides who may READ; it decides which
// button each row shows and mirrors the server's refusal rules so the screen
// does not offer what remove_organiser_member_v1 would refuse.

export type TeamRole = 'owner' | 'manager';

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

/** organisers[].team → members. Unknown roles and shapeless rows are dropped (D-8: owner and manager only). */
export function parseTeam(raw: unknown): TeamMember[] {
  if (!Array.isArray(raw)) return [];
  const members: TeamMember[] = [];
  for (const row of raw as Record<string, unknown>[]) {
    if (!row || typeof row !== 'object') continue;
    const role = row.member_role;
    if ((role !== 'owner' && role !== 'manager') || typeof row.user_id !== 'string') continue;
    members.push({
      userId: row.user_id,
      role,
      isPrimary: row.is_primary === true,
      joinedAt: str(row.joined_at),
      isSelf: row.is_self === true,
      email: str(row.email),
      displayName: str(row.display_name),
    });
  }
  return members;
}

/** The name a teammate recognises: the sign-up name, else the email, else a placeholder. */
export const memberLabel = (m: TeamMember): string => m.displayName ?? m.email ?? 'A team member';

export const ROLE_LABEL: Record<TeamRole, string> = { owner: 'Owner', manager: 'Manager' };

export const ownerCount = (team: TeamMember[]) => team.filter((m) => m.role === 'owner').length;

export interface MemberAction {
  /** Leave is the caller removing themself; remove is an owner removing a manager. */
  kind: 'leave' | 'remove';
  enabled: boolean;
  /** Why the button is disabled, in the organiser's words; null when enabled. */
  note: string | null;
}

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
      return { kind: 'leave', enabled: false, note: 'You are the only owner, so you cannot leave. Ask the Bachata Calendar team to add another owner first.' };
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

/**
 * "Sat 3 Oct" for a real instant (created_at, joined_at), on the London
 * calendar. These are timestamptz, not local-as-Z, so the zone conversion is
 * the right one here.
 */
export function instantDateLabel(iso: string | null | undefined): string | null {
  if (!iso) return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  return d.toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short', timeZone: 'Europe/London' });
}

/**
 * How a person gets added (plan 5.1 step 7: "by email; they must have signed in
 * once"). The server has no add-by-email RPC: adding is granting a request
 * (resolve_organiser_access_request_v1), so the page explains the ask.
 */
export const howToAddManager = (organiserName: string) =>
  `To add a manager, ask them to sign in to Bachata Calendar, search for ${organiserName} on their Home tab and tap Ask to join. Their request shows here and you add them as a manager.`;

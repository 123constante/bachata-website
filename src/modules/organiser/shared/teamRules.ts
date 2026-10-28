import { INVITE_REQUIRED_COPY } from './selfServeErrors';
import { ADD_ROLE_REASON, TEAM_CAP, TEAM_FULL_REASON, type TeamMember, type TeamRole } from './teamModel';

/**
 * What the Team screens may OFFER, as ONE mapping read from the live RPC bodies (prod, 2026-10-28):
 *  - add (organiser_team_add_member_by_profile_v1): owner or manager, under TEAM_CAP;
 *  - decline (resolve_organiser_access_request_v1): owner only;
 *  - change role (organiser_team_set_member_v1) and hand over (organiser_transfer_ownership_v1): owner only;
 *  - remove (remove_organiser_member_v1): owner, and the target must hold an owner/manager row (a
 *    contributor answers not_a_member) and never be an owner;
 *  - leave (the same RPC on yourself): a manager only (a contributor gets not_authorised; an owner
 *    leaves through More, which explains last_owner). The UI also refuses the LAST owner/manager:
 *    the RPC guards owners only, so the sole manager of an ownerless page (39 of 51 prod pages)
 *    would orphan it. That server guard belongs to the admin repo.
 * A refusal always says why; when only the Bachata Calendar team can do it, it offers Message us,
 * and it never names an owner the page does not have.
 */
export interface Gate {
  ok: boolean;
  reason: string | null;
  /** Show the Message us link after the reason. */
  messageUs: boolean;
}

const OK: Gate = { ok: true, reason: null, messageUs: false };
const no = (reason: string, messageUs = false): Gate => ({ ok: false, reason, messageUs });

export const MESSAGE_US = 'Message us';
/** The no-page copy for You, Team and the page editor (one string, with the Message us link). */
export const NO_PAGE = { title: 'You don\u2019t run a page yet', body: INVITE_REQUIRED_COPY } as const;

export const NO_OWNER_REASON = (what: string) => `This page has no owner yet, so only the Bachata Calendar team can ${what}.`;
export const TEAM_REASONS = {
  decline: 'Only the owner can decline a request. You can add them as a Manager.',
  declineWhat: 'decline a request',
  roles: 'Only the owner changes roles or removes people',
  rolesWhat: 'change roles or remove people',
  handover: 'Only the owner can hand the page over.',
  handoverWhat: 'hand this page over',
  removeContributor: 'Contributors are taken off by the Bachata Calendar team for now.',
  leaveContributor: 'Contributors leave through the Bachata Calendar team for now.',
  leaveLast: 'You are the only one running this page, so leaving would leave it with nobody. To stop running it, tell the Bachata Calendar team.',
} as const;

export const hasOwner = (team: readonly TeamMember[]) => team.some((m) => m.role === 'owner');
const ownerOnly = (viewerRole: TeamRole | null, team: readonly TeamMember[], withOwner: string, what: string): Gate =>
  viewerRole === 'owner' ? OK : hasOwner(team) ? no(withOwner) : no(NO_OWNER_REASON(what), true);

export function canAdd(viewerRole: TeamRole | null, team: readonly TeamMember[]): Gate {
  if (viewerRole !== 'owner' && viewerRole !== 'manager') return no(ADD_ROLE_REASON);
  return team.length >= TEAM_CAP ? no(TEAM_FULL_REASON) : OK;
}
/** `full`: the join card's Add as Manager is disabled too, so the reason must not point at it (R2-4). */
export const canDecline = (viewerRole: TeamRole | null, team: readonly TeamMember[], full = false) =>
  ownerOnly(viewerRole, team, full ? DECLINE_WHEN_FULL : TEAM_REASONS.decline, TEAM_REASONS.declineWhat);
export const canHandOver = (viewerRole: TeamRole | null, team: readonly TeamMember[]) =>
  ownerOnly(viewerRole, team, TEAM_REASONS.handover, TEAM_REASONS.handoverWhat);
/** Change role / remove on someone else, when the viewer is not the owner: ONE reason line on Person. */
export const canManagePeople = (viewerRole: TeamRole | null, team: readonly TeamMember[]) =>
  ownerOnly(viewerRole, team, TEAM_REASONS.roles, TEAM_REASONS.rolesWhat);

/** Remove someone else. Null = no control (yourself, or an owner). */
export function canRemove(viewerRole: TeamRole | null, team: readonly TeamMember[], target: TeamMember): Gate | null {
  if (target.isSelf || target.role === 'owner') return null;
  const manage = canManagePeople(viewerRole, team);
  if (!manage.ok) return manage;
  return target.role === 'manager' ? OK : no(TEAM_REASONS.removeContributor, true);
}

/** Leave, for yourself. Null = no control here (an owner leaves through More, which explains why not). */
export function canLeave(team: readonly TeamMember[]): Gate | null {
  const me = team.find((m) => m.isSelf);
  if (!me || me.role === 'owner') return null;
  if (me.role === 'contributor') return no(TEAM_REASONS.leaveContributor, true);
  const othersRunning = team.some((m) => !m.isSelf && (m.role === 'owner' || m.role === 'manager'));
  return othersRunning ? OK : no(TEAM_REASONS.leaveLast, true);
}

/** The decline reason when the team is full: Add as Manager is disabled then, so it is not offered. */
export const DECLINE_WHEN_FULL = 'Only the owner can decline a request.';
/** More's Leave for a non-owner when the team read failed: the RPC would not stop an orphaned page. */
export const LEAVE_UNCHECKED = 'We could not check who else runs this page, so Leave is off for now. Try again later.';

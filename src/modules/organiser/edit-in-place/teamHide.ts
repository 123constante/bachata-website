// Who may hide or show a person on the organiser's PUBLIC Team (J7). ONE pure
// rule shared by the Team sheet and its matrix test; it mirrors
// set_organiser_team_member_hidden_v1 exactly (admin #1259, F5/F6):
// - a seat OWNER may act on anyone on the team, incl. themself and other owners;
// - a seat MANAGER may act on listed people and managers, NEVER an owner
//   (the RPC refuses `owner_protected`, hide AND show);
// - anyone may act on THEMSELF (the RPC's self arm);
// - a platform admin without a seat is refused (`not_allowed`): no control;
// - contributors, strangers, signed-out: no control.
// A target with no dancer persona has no public presence: no control.
export type TeamSeat = 'owner' | 'manager' | 'contributor' | null;

export interface HideCaller {
  /** The caller's seat on THIS organiser (entity_members), null = none. */
  callerSeat: TeamSeat;
  /** The caller's dancer profile id, null = no persona or signed out. */
  callerPersonId: string | null;
}

export interface HideTarget {
  /** The target's dancer profile id; null = an account with no persona. */
  personId: string | null;
  /** The target holds an OWNER seat on this organiser. */
  isOwner: boolean;
}

export function canSetHidden({ callerSeat, callerPersonId, target }: HideCaller & { target: HideTarget }): boolean {
  if (!target.personId) return false;
  if (callerPersonId !== null && callerPersonId === target.personId) return true;
  if (callerSeat === 'owner') return true;
  if (callerSeat === 'manager') return !target.isOwner;
  return false;
}

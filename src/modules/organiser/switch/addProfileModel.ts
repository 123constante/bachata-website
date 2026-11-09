// Slice 1c (organiser area v2): the ONE missing-roles model for the switcher's
// "Add a profile" card. The card, its Not now / Undo logic and the tests all
// read this file; nothing else keeps a copy of the order, the benefit lines or
// where each row goes.
//
// Data source (read on prod 2026-11-09, my_roles_v1 body): dancer = a dancer
// profile linked to the account (_dancer_profile_id_for_account_v1); organiser =
// entity_members owner/manager on a non-archived, non-rejected organiser page;
// teacher / DJ = person_roles 'teaching' / 'djing' active on that dancer profile.
import { APP_WELCOME_PATH } from '@/lib/accountRouting';
import { AREA_HREF, isAreaShown } from '@/modules/areas/home/areaStatus';
import type { RoleRow } from '@/modules/areas/home/rolesApi';
import { L } from '@/modules/organiser/p3/model/labels';
import type { ProfileProgress } from '@/modules/organiser/shared/profileProgress';

export type AddRole = 'organiser' | 'teacher' | 'dj' | 'dancer';

/** The card's order (look B): organiser first, dancer last. */
export const ADD_ORDER: readonly AddRole[] = ['organiser', 'teacher', 'dj', 'dancer'];

export const ADD_LABEL: Record<AddRole, string> = { organiser: 'Organiser', teacher: 'Teacher', dj: 'DJ', dancer: 'Dancer' };

/** One benefit line per role. Organiser, teacher and DJ are the owner's words; dancer is the design record's proposal. */
export const ADD_BENEFIT: Record<AddRole, string> = {
  organiser: 'Get paid for tickets',
  teacher: 'Be found by students',
  dj: 'Get booked as a DJ',
  dancer: 'Keep your nights in one place',
};

export const ADD_PROFILE_HEADING = 'Add a profile';
export const NOT_NOW_LABEL = 'Not now';
/** The toast words are P3 copy (L.addProfile): the card renders only on the P3 surface. */
export const HIDDEN_TOAST = L.addProfile.hidden;
export const HIDDEN_TOAST_SESSION = L.addProfile.hiddenSession;
export const UNDO_LABEL = L.addProfile.undo;

export interface HeldInputs {
  /** my_roles_v1 rows. */
  rows: readonly RoleRow[] | undefined;
  /** The wizard's step list: a teacher / DJ chosen at sign-up and not yet saved counts as added (isAreaShown, the one rule). */
  progress?: Pick<ProfileProgress, 'steps'>;
  /** organiser_home_v1 pages the person holds. */
  organiserPages?: number;
  /** An organiser claim still waiting for an answer: counts as held (the claim screen owns that state, P5). */
  pendingOrganiserClaim?: boolean;
}

/**
 * Which of the four roles the person already holds. Dancer counts only once its profile is finished (P6: an
 * unfinished dancer is offered the dancer setup, never a second profile).
 */
export function heldRolesOf({ rows, progress, organiserPages = 0, pendingOrganiserClaim = false }: HeldInputs): Set<AddRole> {
  const row = (r: AddRole) => rows?.find((x) => x.role === r);
  const held = new Set<AddRole>();
  const dancer = row('dancer');
  if (dancer?.active && dancer.complete) held.add('dancer');
  if (row('organiser')?.active || organiserPages > 0 || pendingOrganiserClaim) held.add('organiser');
  for (const r of ['teacher', 'dj'] as const) if (isAreaShown(r, row(r), progress)) held.add(r);
  return held;
}

/** The ordered list of roles the person lacks. Empty = no card at all. */
export function missingRoles(held: Iterable<AddRole>): AddRole[] {
  const h = new Set(held);
  return ADD_ORDER.filter((r) => !h.has(r));
}

/**
 * Where a row's tap goes: the EXISTING entry for that role, never a new form. Organiser = the surface's add-a-page
 * flow; teacher / DJ = their area page, whose not-added card asks the wizard's "Do you...?" step; dancer = the
 * dancer setup.
 */
export function addProfileTarget(role: AddRole, addPage: string): string {
  if (role === 'organiser') return addPage;
  if (role === 'dancer') return APP_WELCOME_PATH;
  return AREA_HREF[role];
}

/** Per person, per browser. A per-viewer convenience only; nothing on the server reads it. */
export const addProfileHiddenKey = (userId: string) => `bc.addProfile.hidden.${userId}`;

/** Storage can throw or be empty: either way the card shows. */
export function readAddProfileHidden(userId: string | undefined): boolean {
  if (!userId) return false;
  try {
    return window.localStorage.getItem(addProfileHiddenKey(userId)) === '1';
  } catch {
    return false;
  }
}

/** Returns whether the choice was stored (false = this visit only). */
export function writeAddProfileHidden(userId: string | undefined, hidden: boolean): boolean {
  if (!userId) return false;
  try {
    if (hidden) window.localStorage.setItem(addProfileHiddenKey(userId), '1');
    else window.localStorage.removeItem(addProfileHiddenKey(userId));
    return true;
  } catch {
    return false;
  }
}

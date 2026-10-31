// The ONE status mapping for a person's areas: the Your areas rows
// (YourAreasPage) and the Switch profile entries (SwitcherAreas) read it, so the
// same role reads the same words in both. Inputs are the server's own answers:
// my_roles_v1 (held, complete) and my_profile_progress_v1 (the wizard's steps
// and declined list, the same query Home's profile ring reads). The open count
// is worded by requiredLeftText, the one "N left" wording Home and the wizard
// use. Nothing here keeps a field list of its own.
import { AREA_PATHS } from '@/lib/areaPaths';
import { FINISH_PROFILE_PATH } from '@/lib/profileCompletion';
import { APP_HOME_PATH } from '@/lib/accountRouting';
import { flags } from '@/lib/featureFlags';
import { organiserAreaHome } from '@/lib/organiserAreaHome';
import type { StatusTone } from '@/modules/organiser/ui';
import { requiredLeftText, type ProfileProgress } from '@/modules/organiser/shared/profileProgress';
import { ROLE_NAME } from '../shared/fieldRegistry';
import { AREA_ROLES, type AreaRole, type RoleRow } from './rolesApi';

export const YOUR_AREAS_LABEL = 'Your areas';

export const AREA_NAME: Record<AreaRole, string> = {
  dancer: 'Dancer',
  organiser: 'Organiser',
  teacher: ROLE_NAME.teacher,
  dj: ROLE_NAME.dj,
};

/** Where each area opens. The organiser area also takes a new organiser's request (the same way in Options uses). */
export const AREA_HREF: Record<AreaRole, string> = {
  dancer: APP_HOME_PATH,
  organiser: organiserAreaHome(flags), // F-01: P3 while live
  teacher: AREA_PATHS.teacher,
  dj: AREA_PATHS.dj,
};

export type AreaStatusKind = 'complete' | 'to-finish' | 'not-held' | 'declined';
export interface AreaStatus { kind: AreaStatusKind; words: string }

/** The status tag's tone: green for Complete, amber for unfinished, quiet for not added / said no. */
export const AREA_TONE: Record<AreaStatusKind, StatusTone> = { complete: 'live', 'to-finish': 'draft', 'not-held': 'neutral', declined: 'neutral' };

export const COMPLETE_WORDS = 'Complete';
export const NOT_HELD_WORDS = 'Not added';
export const DECLINED_WORDS = 'You said no';
/** Held, not complete, and the step count is not known (progress did not load). */
export const UNFINISHED_WORDS = 'Not finished';
/** The open-answers count: requiredLeftText itself, so it reads as it does on Home and in the wizard. */
export const toFinishWords = requiredLeftText;

/**
 * Steps left in one area, from the wizard's own step list. Required steps first:
 * while any is open, only those count (they are what "finish" means there);
 * an area with no required steps (teacher, DJ) counts its open optional ones.
 */
export function stepsLeft(progress: Pick<ProfileProgress, 'steps'> | undefined, role: AreaRole): number | null {
  if (!progress) return null;
  const open = progress.steps.filter((s) => s.area === role && !s.done);
  const required = open.filter((s) => s.required).length;
  return required > 0 ? required : open.length;
}

/**
 * Whether an area counts as added, for Your areas AND the switcher (the one rule).
 * Held (my_roles_v1 active), or a teacher / DJ chosen at sign-up and not yet
 * saved: my_roles_v1 marks only a saved role active, while the wizard already
 * lists that role's steps from the intent (the server leaves out a declined
 * role's steps), so the wizard's own list is the signal (B1).
 */
export function isAreaShown(role: AreaRole, row: RoleRow | undefined, progress: Pick<ProfileProgress, 'steps'> | undefined): boolean {
  if (row?.active) return true;
  return (role === 'teacher' || role === 'dj') && !!progress?.steps.some((s) => s.area === role);
}

export function areaStatus(role: AreaRole, row: RoleRow | undefined, progress: Pick<ProfileProgress, 'steps' | 'declined'> | undefined): AreaStatus {
  if (!isAreaShown(role, row, progress)) {
    const declined = (role === 'teacher' || role === 'dj') && !!progress?.declined.includes(role);
    return declined ? { kind: 'declined', words: DECLINED_WORDS } : { kind: 'not-held', words: NOT_HELD_WORDS };
  }
  if (row?.active && row.complete) return { kind: 'complete', words: COMPLETE_WORDS };
  const n = stepsLeft(progress, role);
  return { kind: 'to-finish', words: n ? toFinishWords(n) : UNFINISHED_WORDS };
}

export type AreaAction =
  | { kind: 'open'; label: string; to: string }
  | { kind: 'add-link'; label: string; to: string }
  | { kind: 'ask'; label: string; role: 'teacher' | 'dj' };

export const OPEN_LABEL = 'Open';
export const ADD_LABEL = 'Add';

/** One action per row. A role not held: teacher / DJ ask the wizard's "Do you...?" step; dancer finishes the profile; organiser asks to organise. */
export function areaAction(role: AreaRole, status: AreaStatus): AreaAction {
  if (status.kind === 'complete' || status.kind === 'to-finish') return { kind: 'open', label: OPEN_LABEL, to: AREA_HREF[role] };
  if (role === 'teacher' || role === 'dj') return { kind: 'ask', label: ADD_LABEL, role };
  return { kind: 'add-link', label: ADD_LABEL, to: role === 'dancer' ? FINISH_PROFILE_PATH : AREA_HREF.organiser };
}

export const OPEN_OR_ADD_WORDS = 'Open or add a role';

/**
 * Account home's "Your areas" row words (D112): `<Role>: <status words>` for the FIRST unfinished area in
 * Your areas order (a held area that is not complete), read from areaStatus; "Open or add a role" when none is.
 */
export function accountAreasWords(
  rows: readonly RoleRow[] | undefined,
  progress: Pick<ProfileProgress, 'steps' | 'declined'> | undefined,
): string {
  for (const role of AREA_ROLES) {
    const status = areaStatus(role, rows?.find((r) => r.role === role), progress);
    if (status.kind === 'to-finish') return `${AREA_NAME[role]}: ${status.words}`;
  }
  return OPEN_OR_ADD_WORDS;
}

export const OPEN_YOUR_AREAS_WORDS = 'Open Your areas';

/**
 * The Account row's sublabel with the queries' state (review S4): nothing while a query is loading, a neutral
 * "Open Your areas" when my_roles_v1 failed, and the D112 words once both have settled. A failed progress read gives
 * the same words Your areas shows without it. Never "Open or add a role" before the data says no area is unfinished.
 */
export function accountAreasRowWords(
  roles: { status: 'pending' | 'error' | 'success'; data?: readonly RoleRow[] },
  progress: { status: 'pending' | 'error' | 'success'; data?: Pick<ProfileProgress, 'steps' | 'declined'> },
): string | undefined {
  if (roles.status === 'error') return OPEN_YOUR_AREAS_WORDS;
  if (roles.status === 'pending' || progress.status === 'pending') return undefined;
  return accountAreasWords(roles.data, progress.data);
}

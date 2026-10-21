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
import { requiredLeftText, type ProfileProgress } from '@/modules/organiser/shared/profileProgress';
import { ROLE_NAME } from '../shared/fieldRegistry';
import type { AreaRole, RoleRow } from './rolesApi';

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
  organiser: '/account/o',
  teacher: AREA_PATHS.teacher,
  dj: AREA_PATHS.dj,
};

export type AreaStatusKind = 'complete' | 'to-finish' | 'not-held' | 'declined';
export interface AreaStatus { kind: AreaStatusKind; words: string }

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

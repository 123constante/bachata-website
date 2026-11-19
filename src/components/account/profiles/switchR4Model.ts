import type { RoleIntent } from '@/modules/areas/home/rolesApi';

/**
 * Dashboard switch, Round-4 everywhere (flag dashboardSwitchR4, docs/briefs/dashboard-switch-build.md).
 * The pure rules, one copy for the sheet and the Switch page.
 */

/** The roles that have no dashboard yet: a grey "Coming soon" row, never a link. */
export const COMING_SOON_ROLES = ['teacher', 'dj'] as const;
export type ComingSoonRole = (typeof COMING_SOON_ROLES)[number];
export const COMING_SOON_LABEL = 'Coming soon';
export const COMING_SOON_NAME: Record<ComingSoonRole, string> = { teacher: 'Teacher', dj: 'DJ' };

/**
 * Picked at onboarding: the role is in the sign-up answer (my_role_intent_v1 roles) and was not
 * later declined. Holding the role (my_roles_v1 active) does NOT count: owner, 2026-11-19 -- a
 * person who merely holds it sees no row. (my_profile_progress_v1 steps are NOT this signal: the
 * server lists a teacher / DJ step for a held role too.)
 */
export function pickedAtOnboarding(role: ComingSoonRole, intent: RoleIntent | undefined): boolean {
  return !!intent && intent.roles.includes(role) && !intent.declined.includes(role);
}

/** The Coming soon rows to show, in a fixed order. */
export function comingSoonRoles(intent: RoleIntent | undefined): ComingSoonRole[] {
  return COMING_SOON_ROLES.filter((r) => pickedAtOnboarding(r, intent));
}

/** The top-right button: "Switch" even with ONE profile (the sheet then holds it and + Add a profile). */
export const SWITCH_WORD = 'Switch';
export const SWITCH_TITLE = 'Switch profile';

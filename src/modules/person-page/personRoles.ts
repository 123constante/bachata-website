// Pure rules for /people/:id: which roles a person has, tab order, URL hashes
// and the links between the person page and the old role pages. No I/O here so
// the table-driven tests can cover every combination. The role vocabulary itself
// (order, labels, the teacher-visibility rule) is the ONE copy in
// src/lib/searchEntities.ts, shared with search (review F1+F2).
import { ROLE_LABEL, ROLE_ORDER, visibleRoles, type PersonRole } from '@/lib/searchEntities';

export { ROLE_LABEL, ROLE_ORDER, visibleRoles, type PersonRole };

export const TAB_HASH: Record<PersonRole, string> = { teacher: 'teaching', dj: 'dj', dancer: 'dancing' };
export const TAB_LABEL: Record<PersonRole, string> = { teacher: 'Teaching', dj: 'DJ', dancer: 'Dancing' };
export const ROLE_PAGE_BASE: Record<PersonRole, string> = { teacher: '/teachers', dj: '/djs', dancer: '/dancers' };

export type RoleSignals = {
  /** get_public_teacher_detail_v1 returned a row (read only while the teacher pages are open). */
  isTeacher: boolean;
  /** get_public_dj_v1 returned a profile. */
  isDj: boolean;
  /** The dancer_profiles row is public (not deactivated). Every person has one. */
  hasDancerRow: boolean;
  /** The row carries dancer-specific content (years, styles, partner role, achievements). */
  hasDancerContent: boolean;
  /**
   * get_public_person_roles_v1: the person's active public roles. null/absent = the
   * function is not on prod yet, so the four inferred signals above decide.
   */
  publicRoles?: readonly PersonRole[] | null;
  /** flags.teacherDetail. Closed = no Teaching tab and no Teacher chip (the old page is locked). Default open. */
  teacherPagesOpen?: boolean;
};

/**
 * With `publicRoles` (the database's answer) the roles are exact, filtered by
 * `visibleRoles` like the search row. Without it (TEMPORARY, until
 * get_public_person_roles_v1 is on prod) 'dancer' is inferred: dancer content, or
 * no other VISIBLE role. "Visible" on purpose: 27 of 34 dancing+teaching personas
 * on prod have an empty dancer section, and while the teacher pages are closed
 * their search row says "Dancer"; counting the hidden teacher role here would
 * 404 them. A teacher-only person never reaches /people from search (their row
 * keeps /teachers/:id, see personSearchRow). See docs/handover/person-page-web.md.
 */
export function derivePersonRoles(s: RoleSignals): PersonRole[] {
  const open = s.teacherPagesOpen ?? true;
  if (s.publicRoles) return visibleRoles(s.publicRoles, open);
  if (!s.hasDancerRow && !s.isTeacher && !s.isDj) return [];
  const others = visibleRoles([...(s.isTeacher ? ['teacher'] : []), ...(s.isDj ? ['dj'] : [])], open);
  const dancer = s.hasDancerRow && (s.hasDancerContent || others.length === 0);
  return dancer ? [...others, 'dancer'] : others;
}

/** The strongest role: teacher, else dj, else dancer. */
export const strongestRole = (roles: readonly PersonRole[]): PersonRole | null => roles[0] ?? null;

/** The tab a URL hash opens; an unknown or absent hash (or a role the person lacks) opens the first tab. */
export function roleFromHash(hash: string, roles: readonly PersonRole[]): PersonRole {
  const key = hash.replace(/^#/, '').toLowerCase();
  const hit = ROLE_ORDER.find((r) => TAB_HASH[r] === key && roles.includes(r));
  return hit ?? roles[0];
}

export const rolePagePath = (role: PersonRole, slugOrId: string) => `${ROLE_PAGE_BASE[role]}/${slugOrId}`;

export const peoplePath = (slugOrId: string, role?: PersonRole) =>
  `/people/${slugOrId}${role ? `#${TAB_HASH[role]}` : ''}`;

/** "Also: DJ . Dancer" targets for a role page: every OTHER role, in tab order. */
export const otherRoles = (roles: readonly PersonRole[], current: PersonRole): PersonRole[] =>
  roles.filter((r) => r !== current);

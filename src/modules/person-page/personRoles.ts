// Pure rules for /people/:id: which roles a person has, tab order, URL hashes
// and the links between the person page and the old role pages. No I/O here so
// the table-driven tests can cover every combination.

export type PersonRole = 'teacher' | 'dj' | 'dancer';

/** Tab order, and the order of the role chips. */
export const ROLE_ORDER: readonly PersonRole[] = ['teacher', 'dj', 'dancer'];

export const TAB_HASH: Record<PersonRole, string> = { teacher: 'teaching', dj: 'dj', dancer: 'dancing' };
export const TAB_LABEL: Record<PersonRole, string> = { teacher: 'Teaching', dj: 'DJ', dancer: 'Dancing' };
export const CHIP_LABEL: Record<PersonRole, string> = { teacher: 'Teacher', dj: 'DJ', dancer: 'Dancer' };
export const ROLE_PAGE_BASE: Record<PersonRole, string> = { teacher: '/teachers', dj: '/djs', dancer: '/dancers' };

export type RoleSignals = {
  /** get_public_teacher_detail_v1 returned a row AND the teacher pages are open (flags.teacherDetail). */
  isTeacher: boolean;
  /** get_public_dj_v1 returned a profile. */
  isDj: boolean;
  /** The dancer_profiles row is public (not deactivated). Every person has one. */
  hasDancerRow: boolean;
  /** The row carries dancer-specific content (years, styles, partner role, achievements). */
  hasDancerContent: boolean;
};

/**
 * person_roles is not readable by the public (RLS, no policy), so 'dancer' is
 * inferred: dancer content, or a person with no other public role. This never
 * shows Dancing to a teacher-only or DJ-only person; it can miss Dancing for a
 * dancer who is also teacher/DJ and has filled in no dancer content. An exact
 * answer needs a public roles RPC (admin repo); see docs/handover/person-page-web.md.
 */
export function derivePersonRoles(s: RoleSignals): PersonRole[] {
  if (!s.hasDancerRow && !s.isTeacher && !s.isDj) return [];
  const roles: PersonRole[] = [];
  if (s.isTeacher) roles.push('teacher');
  if (s.isDj) roles.push('dj');
  if (s.hasDancerRow && (s.hasDancerContent || (!s.isTeacher && !s.isDj))) roles.push('dancer');
  return roles;
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

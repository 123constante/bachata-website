// The role tabs above the photo, as data (people arc S1). Pure, so the matrix tests
// cover every role combination without rendering.
import { ROLE_LABEL, ROLE_ORDER, rolePagePath, type PersonRole } from '../personRoles';

export type RoleTab = { role: PersonRole; label: string; href: string; current: boolean };

/**
 * ALL the person's roles in the order Teacher, DJ, Dancer, each a link to its role page
 * (/teachers|/djs|/dancers/<slug>), the current one marked. A one-role person (or no
 * slug) gets no tab row: null. `roles` are the visible ones (derivePersonRoles).
 */
export function roleTabs(roles: readonly PersonRole[], current: PersonRole, slug: string | null | undefined): RoleTab[] | null {
  const have = new Set(roles);
  const ordered = ROLE_ORDER.filter((r) => have.has(r));
  if (ordered.length < 2 || !slug) return null;
  return ordered.map((role) => ({ role, label: ROLE_LABEL[role], href: rolePagePath(role, slug), current: role === current }));
}

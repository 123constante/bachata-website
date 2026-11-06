import { flags } from '@/lib/featureFlags';
import { hrefForRole, linkRoleFor, type PersonBadge } from '@/modules/person-page/badges';
import type { PersonRole } from '@/lib/searchEntities';
import type { TeamPerson } from './organiserTeam';

/**
 * Team circle link, restored from main's TeamCircle (organiser page fix round 1):
 * the people-badges mapping picks the page (DJ, dancer, or teacher while teacher
 * pages are open) and the profile view is typed by it. While the badges read
 * loads or after it failed, a person with a dancer page keeps that link (typed
 * dancer); once it answered with no row, there is no link.
 */
export type BadgesState = 'loading' | 'error' | 'ready';

/** The page and profile type a team circle opens (main's TeamCircle rule), or null. */
export function teamPersonLink(p: TeamPerson, badge: PersonBadge | undefined, badgesState: BadgesState): { href: string; personId: string; profileType: PersonRole } | null {
  const opts = { teacherPagesOpen: flags.teacherDetail };
  const linkId = badge?.id ?? (badgesState !== 'ready' && p.href ? p.personId : null);
  const role = badge ? linkRoleFor(badge, opts) : linkId ? 'dancer' : null;
  const href = linkId && role ? hrefForRole(role, linkId, opts) : null;
  return href && linkId && role ? { href, personId: linkId, profileType: role } : null;
}

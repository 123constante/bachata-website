// /dancers list model: only people with the Dancer role; other roles shown as labels.
import { hrefForRole, roleTagsFor, type PersonBadge, type RoleTag } from '@/modules/person-page/badges';

export function dancerTags(badge: PersonBadge, teacherPagesOpen: boolean): RoleTag[] {
  return roleTagsFor(badge, { teacherPagesOpen, exclude: 'dancer' });
}

export function onlyDancers<T extends { id: string }>(rows: readonly T[], badges: Map<string, PersonBadge>): T[] {
  return rows.filter((r) => badges.get(r.id)?.roles.includes('dancer'));
}

/** Every tile on /dancers is a dancer, so it links to the dancer page. */
export const dancerHref = (id: string, teacherPagesOpen: boolean) => hrefForRole('dancer', id, { teacherPagesOpen });

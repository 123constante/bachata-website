// Pure model for the face wall (/djs and /dancers behind flags.peopleWall). No second copy of
// the role vocabulary, its order, the names or the links: all of it comes from badges.ts
// (roleTagsFor / nameFor / hrefForRole / linkRoleFor) and the existing list models.
import { djTile, type DjListRow } from '@/components/dj/djListModel';
import { dancerHref } from '@/components/dancers/dancerListModel';
import { linkFor, linkRoleFor, roleTagsFor, type PersonBadge, type RoleTag } from '@/modules/person-page/badges';
import type { PersonRole } from '@/lib/searchEntities';
import { isRealDateKey, londonTodayKey, weekdayOfKey } from '@/lib/londonDate';
import { flags } from '@/lib/featureFlags';
import { hrefFor } from '@/lib/searchEntities';

export type WallList = 'djs' | 'dancers';
export type WallFilter = 'all' | PersonRole;

export type WallPerson = {
  id: string;
  name: string;
  photo: string | null;
  flagCode: unknown;
  href: string | null;
  tags: RoleTag[];
  /** The role whose accent colours the tile (linkRoleFor, else the list's own role). */
  lead: PersonRole;
  /** "Fri 23", only for a DJ with an upcoming gig. */
  dateLabel: string | null;
  profileType: 'dj' | 'dancer';
};

const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'] as const;

/** "Fri 23" from a calendar key (UTC-noon anchored in londonDate, so it is the same in every timezone). */
export function wallDateLabel(raw: string | null | undefined, today: string = londonTodayKey()): string | null {
  const key = typeof raw === 'string' ? raw.slice(0, 10) : '';
  if (!key || !isRealDateKey(key) || key < today) return null;
  return `${DAYS[weekdayOfKey(key)]} ${Number(key.slice(8, 10))}`;
}

/** First + last initial, "?" when there is no name at all. */
export function initialsOf(name: string): string {
  const w = name.split(/\s+/).filter(Boolean);
  return ((w[0]?.[0] ?? '?') + (w.length > 1 ? w[w.length - 1][0] : '')).toUpperCase();
}

export const firstPhoto = (p: string | string[] | null | undefined): string | null => {
  const v = Array.isArray(p) ? p[0] : p;
  return typeof v === 'string' && v.trim() ? v : null;
};

/**
 * flags.personHub: a tile that has a page opens the person hub (/people/<id>) instead of the lead
 * role page. A tile with no page stays unlinked either way, so the hub is never a dead end.
 */
export const tileHref = (id: string, rolePage: string | null): string | null =>
  rolePage && flags.personHub ? hrefFor('person', id) : rolePage;

export type DjWallRow = DjListRow & {
  photo_url?: string | string[] | null;
  nationality_code?: string | null;
};

// The DJ chip already says DJ, so the name never repeats the word: "DJ El Rugido" reads "El Rugido".
export const bareStage = (n: string): string => n.replace(/^dj\s+/i, '').trim() || n;

/** Every row of list_public_djs_v1 is a DJ (djTile assumes the role when the badge row is missing). */
export function djWallPerson(row: DjWallRow, resolvedName: string, badge: PersonBadge | undefined, teacherPagesOpen: boolean): WallPerson {
  const t = djTile(row, resolvedName, badge, teacherPagesOpen);
  const opts = { teacherPagesOpen };
  const asBadge: PersonBadge = {
    id: row.id, roles: t.tags.map((x) => x.role), djName: row.dj_name ?? null,
    djHasUpcoming: row.has_upcoming_gig === true, nextGigDate: row.next_gig_date ?? null,
  };
  return {
    id: row.id,
    name: bareStage(t.name),
    photo: firstPhoto(row.photo_url),
    flagCode: row.nationality_code,
    href: tileHref(row.id, t.href),
    tags: t.tags,
    lead: linkRoleFor(asBadge, opts) ?? 'dj',
    dateLabel: row.has_upcoming_gig === true ? wallDateLabel(row.next_gig_date) : null,
    profileType: 'dj',
  };
}

/** Every row on /dancers is a dancer; the other roles come from the badges read (none when it failed). */
export function dancerWallPerson(
  row: { id: string; avatar_url: string | null },
  resolvedName: string,
  flagCode: unknown,
  badge: PersonBadge | undefined,
  teacherPagesOpen: boolean,
): WallPerson {
  const opts = { teacherPagesOpen };
  return {
    id: row.id,
    name: resolvedName,
    photo: firstPhoto(row.avatar_url),
    flagCode,
    href: tileHref(row.id, dancerHref(row.id, teacherPagesOpen) ?? linkFor(badge, opts)),
    tags: badge ? roleTagsFor(badge, opts) : [],
    lead: linkRoleFor(badge, opts) ?? 'dancer',
    dateLabel: badge && badge.roles.includes('dj') ? wallDateLabel(badge.nextGigDate) : null,
    profileType: 'dancer',
  };
}

export const hasRole = (p: WallPerson, role: PersonRole) => p.tags.some((t) => t.role === role);

export function filterWall(people: readonly WallPerson[], filter: WallFilter): WallPerson[] {
  return filter === 'all' ? [...people] : people.filter((p) => hasRole(p, filter));
}

// /djs list model: upcoming gigs first (next_gig_date ascending), then the rest in the
// RPC's own order. Labels, link and name come ONLY from the people-badges mapping.
import { hrefForRole, nameFor, roleTagsFor, type PersonBadge, type RoleTag } from '@/modules/person-page/badges';

export type DjListRow = {
  id: string;
  dj_name: string | null;
  display_name: string | null;
  first_name?: string | null;
  surname?: string | null;
  has_upcoming_gig?: boolean | null;
  next_gig_date?: string | null;
};

export type DjTileModel<T extends DjListRow> = {
  row: T;
  name: string;
  playingSoon: boolean;
  tags: RoleTag[];
  href: string;
};

export function sortDjsUpcomingFirst<T extends DjListRow>(rows: readonly T[]): T[] {
  const soon = (r: T) => r.has_upcoming_gig === true;
  const first = rows.filter(soon).sort((a, b) => (a.next_gig_date ?? '9999').localeCompare(b.next_gig_date ?? '9999'));
  return [...first, ...rows.filter((r) => !soon(r))];
}

/** Every row of list_public_djs_v1 is a DJ, so the DJ role is assumed when the badge row is missing. */
export function djTile<T extends DjListRow>(
  row: T,
  resolvedName: string,
  badge: PersonBadge | undefined,
  teacherPagesOpen: boolean,
): DjTileModel<T> {
  const b: PersonBadge = {
    id: row.id,
    roles: badge && badge.roles.includes('dj') ? badge.roles : ['dj', ...(badge?.roles ?? [])],
    djName: badge?.djName ?? row.dj_name ?? null,
    djHasUpcoming: row.has_upcoming_gig === true,
    nextGigDate: row.next_gig_date ?? null,
  };
  return {
    row,
    // stage name leads; resolvedName is the renderPublicName fallback (UUID-safe)
    name: nameFor('dj', { name: resolvedName, djName: row.dj_name }),
    playingSoon: row.has_upcoming_gig === true,
    tags: roleTagsFor(b, { teacherPagesOpen }),
    href: hrefForRole('dj', row.id, { teacherPagesOpen }),
  };
}

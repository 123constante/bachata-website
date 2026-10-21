// ONE answer for a search_public_v7 person row (W1 review M1), shared by the /search page's
// PersonRow and the header overlay (searchRpc mapPersonV7): the search read's roles, the stage
// name from the people-badges read when there is one, then the badges mapping's tags (Teacher
// shown plain while the teacher pages are closed) and link (DJ page, else dancer page, else
// teacher page while open, else none).
//
// Its own module on purpose: searchRpc reaches it with `await import()`. Importing badges.ts
// there directly would make badges.ts a dynamic entry, and rollup then hoists its Supabase
// import into that chunk, adding a vendor-supabase puller to /event (puller ratchet).
import { orderedRoles } from '@/lib/searchEntities';
import { linkFor, roleTagsFor, type BadgeOpts, type PersonBadge, type RoleTag } from '@/modules/person-page/badges';

export function searchPersonView(
  id: string,
  roles: readonly string[] | null | undefined,
  badge: PersonBadge | undefined,
  opts: BadgeOpts,
): { tags: RoleTag[]; href: string | null } {
  const merged: PersonBadge = {
    id, roles: orderedRoles(roles), djName: badge?.djName ?? null,
    djHasUpcoming: badge?.djHasUpcoming ?? false, nextGigDate: badge?.nextGigDate ?? null,
  };
  return { tags: roleTagsFor(merged, { ...opts, withStageName: true }), href: linkFor(merged, opts) };
}

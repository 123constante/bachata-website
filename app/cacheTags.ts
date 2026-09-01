// The cache-tag taxonomy — one invalidation contract (admin ADR-015).
//
// Every Vercel-Cache-Tag a route stamps on its SSR response (via
// detailLoader.taggedData) and every tag a content write purges (via
// app/routes/api.revalidate.tsx) MUST be produced here. `cacheTags.test.ts`
// enforces the contract: no purge that hits nothing, no stamped page left
// un-purgeable (except a documented STAMP_ONLY allowlist), and entity-type
// parity between the DB webhook and the purge switch.
//
// Why this exists: tags used to be string literals scattered across the route
// files and api.revalidate, so the stamp side and purge side drifted silently
// (e.g. every detail page stamps a `<collection>` tag that nothing purges). A
// single typed source + a conformance test turns "did we miss a surface?" into
// a checked invariant instead of a production discovery.

// ── Entity types the Supabase revalidation webhook can emit ──────────────────
// Mirrors _emit_cache_revalidation_v1's entityType values (admin repo:
// apply_aggregate_write_p5 / admin_save_person_v1 / admin_save_venue_v2).
export const REVALIDATABLE_ENTITY_TYPES = [
  "event",
  "festival",
  "dancer",
  "dj",
  "teacher",
  "venue",
] as const;
export type EntityType = (typeof REVALIDATABLE_ENTITY_TYPES)[number];

export function isEntityType(v: unknown): v is EntityType {
  return typeof v === "string" && (REVALIDATABLE_ENTITY_TYPES as readonly string[]).includes(v);
}

// ── Per-entity page tags (one cached page per id) ────────────────────────────
export const eventTag = (id: string) => `event-${id}`;
export const festivalTag = (id: string) => `festival-${id}`;
export const dancerTag = (id: string) => `dancer-${id}`;
export const djTag = (id: string) => `dj-${id}`;
export const teacherTag = (id: string) => `teacher-${id}`;
export const venueTag = (id: string) => `venue-${id}`;
export const organiserTag = (id: string) => `organiser-${id}`;

const ENTITY_TAG: Record<EntityType, (id: string) => string> = {
  event: eventTag,
  festival: festivalTag,
  dancer: dancerTag,
  dj: djTag,
  teacher: teacherTag,
  venue: venueTag,
};
export const entityTag = (t: EntityType, id: string) => ENTITY_TAG[t](id);

// ── Listing / feed tags (one page, many entities) ────────────────────────────
export const HOME_FEED = "home-feed"; // /city/:slug — the map + events feed
export const FESTIVALS_LIST = "festivals-list"; // /festivals
// The 9 event-bearing SEO landing pages (/london-bachata-guide,
// /learn-bachata-london, /bachata-london-{weekday}). ONE tag for the set:
// they all dehydrate the same London calendar-events window, so any event or
// festival write invalidates all of them together.
export const SEO_LANDING = "seo-landing";
export const cityTag = (slug: string) => `city-${slug}`; // future per-city precision

// ── Collection tags (legacy; stamped by detail routes, see STAMP_ONLY) ───────
// Historically each detail route stamps `<entity-id>,<collection>`. No SSR
// listing page currently reads these collections and nothing purges them, so
// they are vestigial (documented in STAMP_ONLY). Kept as constants so the stamp
// helpers reproduce today's behavior exactly; a later increment can drop them.
export const EVENTS = "events";
export const FESTIVALS = "festivals";
export const DANCERS = "dancers";
export const DJS = "djs";
export const TEACHERS = "teachers";
export const VENUES = "venues";
// Organisers are NOT a REVALIDATABLE_ENTITY_TYPE and must not become one on the
// strength of this constant: the admin's _emit_cache_revalidation_v1 has no
// 'organiser' entity type, so a purge mapping here would be a lie that the
// conformance test below would then certify as healthy. The tag exists so
// /organisers/:id stamps a real, purgeable name the day an emit lands; until
// then the route ships edgeTtlBoundSeconds: 0 (see app/routes/organiser.tsx),
// which is what actually keeps an un-purgeable page from going stale.
export const ORGANISERS = "organisers";

// ── STAMP side: the exact Vercel-Cache-Tag string each route puts on its
// response. Centralized so route files can't drift from the taxonomy. ─────────
export const stampEvent = (id: string) => [eventTag(id), EVENTS].join(",");
export const stampFestival = (id: string) =>
  [festivalTag(id), eventTag(id), FESTIVALS, EVENTS].join(",");
export const stampDancer = (id: string) => [dancerTag(id), DANCERS].join(",");
export const stampDj = (id: string) => [djTag(id), DJS].join(",");
export const stampTeacher = (id: string) => [teacherTag(id), TEACHERS].join(",");
export const stampVenue = (id: string) => [venueTag(id), VENUES].join(",");
export const stampOrganiser = (id: string) => [organiserTag(id), ORGANISERS].join(",");
export const stampHome = (citySlug: string) => [HOME_FEED, cityTag(citySlug)].join(",");
export const stampFestivalsList = () => FESTIVALS_LIST;
export const stampSeoLanding = () => SEO_LANDING;

// Every distinct tag a route stamps, in tag-kind form (concrete ids replaced by
// the placeholder below). The conformance test cross-checks this against the
// purge side. Feature-flag-locked routes (teachers/venue-entity) also stamp the
// bare collection tag; both forms are covered by the collection kinds here.
export const STAMP_PLACEHOLDER_ID = "ID";
export const STAMP_PLACEHOLDER_SLUG = "SLUG";

export const ALL_ROUTE_STAMPS: string[] = [
  stampEvent(STAMP_PLACEHOLDER_ID),
  stampFestival(STAMP_PLACEHOLDER_ID),
  stampDancer(STAMP_PLACEHOLDER_ID),
  stampDj(STAMP_PLACEHOLDER_ID),
  stampTeacher(STAMP_PLACEHOLDER_ID),
  stampVenue(STAMP_PLACEHOLDER_ID),
  stampOrganiser(STAMP_PLACEHOLDER_ID),
  stampHome(STAMP_PLACEHOLDER_SLUG),
  stampFestivalsList(),
  stampSeoLanding(),
];

// Tag-kinds stamped by a route but intentionally NOT purged by the per-entity
// webhook. Documented dead weight (collection tags with no SSR listing reader)
// plus city-<slug> (reserved for future per-city precision; the active purger
// for the home page is HOME_FEED). Anything stamped-but-unpurged that is NOT
// here fails the conformance test.
export const STAMP_ONLY_KINDS: string[] = [
  // organiser-<id> + organisers: stamped by /organisers/:id, purged by nothing,
  // because there is no 'organiser' emit on the DB side to purge them WITH. That
  // is the whole reason the route pins its edge TTL to zero rather than relying
  // on the 25-hour default this allowlist otherwise waves through. Delete both
  // entries -- and the pin -- in the same change that adds the emit.
  organiserTag(STAMP_PLACEHOLDER_ID),
  ORGANISERS,
  EVENTS,
  FESTIVALS,
  DANCERS,
  DJS,
  TEACHERS,
  VENUES,
  cityTag(STAMP_PLACEHOLDER_SLUG),
];

// ── PURGE side: the tags a content write invalidates ─────────────────────────
// A festival edit hits its /festival/:id + its /event/:id twin; event/festival
// writes also purge the listing/home pages via the DEDICATED HOME_FEED /
// FESTIVALS_LIST tags — NOT the shared EVENTS tag every event page stamps (that
// would invalidate every event detail page on one edit).
export function purgeTagsFor(t: EntityType, id: string): string[] {
  switch (t) {
    case "festival":
      return [festivalTag(id), eventTag(id), FESTIVALS_LIST, HOME_FEED, SEO_LANDING];
    case "event":
      return [eventTag(id), HOME_FEED, SEO_LANDING];
    case "dancer":
      return [dancerTag(id)];
    case "dj":
      return [djTag(id)];
    case "teacher":
      return [teacherTag(id)];
    case "venue":
      return [venueTag(id)];
  }
}

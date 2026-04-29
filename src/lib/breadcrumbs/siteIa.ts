/**
 * Site information architecture — single source of truth for breadcrumbs.
 *
 * Adding a new page means adding ONE entry to SITE_IA below. The
 * buildBreadcrumbs() function walks the parent chain at runtime; no other
 * file needs to know about the new page.
 *
 * Conventions
 * -----------
 * - Listings + nested listings have `path` (clickable) and optionally `parent`.
 * - Entity-bearing detail routes set `entity: true` — the final crumb's label
 *   is supplied at the call site via ctx.entityName.
 * - Flow routes (edit / create) have `parent` but no `path` (current page).
 * - `__event_parent__` is a sentinel parent for `event.detail` that the
 *   builder dispatches dynamically based on event type (party → parties,
 *   class/workshop → classes, festival/congress → festivals).
 */

interface IaNode {
  /** Visible label for this crumb. For entity routes this is the placeholder
   *  shown during loading / error; the real entity name is supplied at runtime. */
  readonly label: string;
  /** Parent route id. Use the sentinel '__event_parent__' for routes whose
   *  parent depends on event type. Top-level routes have no parent. */
  readonly parent?: string;
  /** Clickable href for this route. Listings have path, detail/flow routes
   *  resolve their path from entityId via detailPath() (if provided). */
  readonly path?: string;
  /** True if this route's final crumb is an entity name (e.g. event title,
   *  dancer name) supplied via ctx.entityName at the call site. */
  readonly entity?: true;
  /** When this entity route appears as an INTERMEDIATE crumb in another chain
   *  (e.g. event.detail inside event.edit), the builder uses this to make it
   *  clickable. Returns the URL given the entityId. */
  readonly detailPath?: (entityId: string) => string;
}

export const SITE_IA = {
  // -------- Top-level listings ------------------------------------------------
  parties:          { label: 'Parties',           path: '/parties' },
  classes:          { label: 'Classes',           path: '/classes' },
  experience:       { label: 'Experience',        path: '/experience' },
  venues:           { label: 'Venues',            path: '/venues' },
  dancers:          { label: 'Dancers',           path: '/dancers' },
  videographers:    { label: 'Videographers',     path: '/videographers' },
  practicePartners: { label: 'Practice Partners', path: '/practice-partners' },
  vendors:          { label: 'Vendors',           path: '/vendors' },
  choreography:     { label: 'Choreography',      path: '/choreography' },
  cities:           { label: 'Cities',            path: '/cities' },
  discounts:        { label: 'Discounts',         path: '/discounts' },
  allProfiles:      { label: 'All Profiles',      path: '/all-profiles' },
  profile:          { label: 'Profile',           path: '/profile' },

  // -------- Nested listings ---------------------------------------------------
  djs:        { label: 'DJs',        path: '/djs',        parent: 'parties' },
  organisers: { label: 'Organisers', path: '/organisers', parent: 'parties' },
  teachers:   { label: 'Teachers',   path: '/teachers',   parent: 'classes' },
  festivals:  { label: 'Festivals',  path: '/festivals',  parent: 'experience' },
  // /tonight is a parties-themed quick filter — sits under Parties.
  tonight:    { label: 'Tonight',    path: '/tonight',    parent: 'parties' },

  // -------- Entity-bearing detail routes --------------------------------------
  // entityName is supplied at the call site. The placeholder label is what
  // shows when entityName is empty AND we're not in an isLoading state.
  'venue.detail':     { label: 'Venue',     parent: 'venues',     entity: true,
                        detailPath: (id: string) => `/venue-entity/${id}` },
  'dancer.detail':    { label: 'Dancer',    parent: 'dancers',    entity: true,
                        detailPath: (id: string) => `/dancers/${id}` },
  'dj.detail':        { label: 'DJ',        parent: 'djs',        entity: true,
                        detailPath: (id: string) => `/djs/${id}` },
  'organiser.detail': { label: 'Organiser', parent: 'organisers', entity: true,
                        detailPath: (id: string) => `/organisers/${id}` },
  'teacher.detail':   { label: 'Teacher',   parent: 'teachers',   entity: true,
                        detailPath: (id: string) => `/teachers/${id}` },
  'vendor.detail':    { label: 'Vendor',    parent: 'vendors',    entity: true,
                        detailPath: (id: string) => `/vendors/${id}` },
  'festival.detail':  { label: 'Festival',  parent: 'festivals',  entity: true,
                        detailPath: (id: string) => `/festival/${id}` },
  // event.detail's parent is computed from eventType. The sentinel
  // '__event_parent__' tells the builder to dispatch via resolveEventParent().
  'event.detail':     { label: 'Event',     parent: '__event_parent__', entity: true,
                        detailPath: (id: string) => `/event/${id}` },

  // -------- Flow routes (edit / create) ---------------------------------------
  'profile.edit':              { label: 'Edit',                        parent: 'profile' },
  'profile.vendorDashboard':   { label: 'Vendor dashboard',            parent: 'profile' },
  'profile.createEvent':       { label: 'Create event',                parent: 'profile' },
  'profile.createDancer':      { label: 'Create dancer profile',       parent: 'profile' },
  'profile.createTeacher':     { label: 'Create teacher profile',      parent: 'profile' },
  'profile.createDj':          { label: 'Create DJ profile',           parent: 'profile' },
  'profile.createOrganiser':   { label: 'Create organiser profile',    parent: 'profile' },
  'profile.createVideographer':{ label: 'Create videographer profile', parent: 'profile' },
  'profile.createVendor':      { label: 'Create vendor profile',       parent: 'profile' },
  // event.edit's parent is event.detail, which itself dispatches via
  // resolveEventParent(eventType). The full chain becomes:
  //   parties|classes|festivals  >  [event name]  >  Edit
  'event.edit':                { label: 'Edit',                        parent: 'event.detail' },
} as const satisfies Record<string, IaNode>;

export type RouteId = keyof typeof SITE_IA;

/**
 * Routes that REQUIRE entityName at the call site (TS-enforced).
 * Auto-derived from the SITE_IA `entity: true` flag plus the special-case
 * event.edit which inherits from event.detail.
 */
export type EntityRouteId = {
  [K in RouteId]: typeof SITE_IA[K] extends { entity: true } ? K : never;
}[RouteId] | 'event.edit';

/** Routes whose parent dispatch depends on event type. */
export type EventRouteId = 'event.detail' | 'event.edit';

/** Sentinel parent string used by event.detail. */
export const EVENT_PARENT_SENTINEL = '__event_parent__' as const;

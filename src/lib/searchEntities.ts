import {
  Calendar, MapPin, Building2, GraduationCap, Music, User, ShoppingBag, Globe,
  type LucideIcon,
} from 'lucide-react';

// Single source of truth for the 8 federated-search entity kinds
// (search_public_v5). Replaces the duplicated kind -> icon/label/href maps in
// searchRpc.ts and HeaderSearch.tsx. Vendors link by id (/vendors/:id); cities
// by slug (/city/:slug). Keep this in sync with the RPC's entity_type whitelist.
export type SearchKind =
  | 'event' | 'venue' | 'organiser' | 'teacher' | 'dj' | 'dancer' | 'person' | 'vendor' | 'city';

export const KIND_ICON: Record<SearchKind, LucideIcon> = {
  event: Calendar, venue: MapPin, organiser: Building2, teacher: GraduationCap,
  dj: Music, dancer: User, person: User, vendor: ShoppingBag, city: Globe,
};

export const KIND_LABEL: Record<SearchKind, string> = {
  event: 'Event', venue: 'Venue', organiser: 'Organiser', teacher: 'Teacher',
  dj: 'DJ', dancer: 'Dancer', person: 'Person', vendor: 'Vendor', city: 'City',
};

export const KIND_LABEL_PLURAL: Record<SearchKind, string> = {
  event: 'Events', venue: 'Venues', organiser: 'Organisers', teacher: 'Teachers',
  dj: 'DJs', dancer: 'Dancers', person: 'People', vendor: 'Vendors', city: 'Cities',
};

// People kinds render with round avatars; everything else a square thumb/glyph.
export const CIRCLE_KINDS: SearchKind[] = ['organiser', 'teacher', 'dj', 'dancer', 'person'];

// Route for a result row. Cities resolve by slug (id is unused for them);
// every other kind by id. Festival events are special-cased to /festival/:id at
// the call site (event_type-driven), not here.
export function hrefFor(kind: SearchKind, id: string, slug?: string | null): string {
  switch (kind) {
    case 'venue':     return `/venue-entity/${id}`;
    case 'organiser': return `/organisers/${id}`;
    case 'teacher':   return `/teachers/${id}`;
    case 'dj':        return `/djs/${id}`;
    case 'dancer':    return `/dancers/${id}`;
    case 'person':    return `/people/${id}`;
    case 'vendor':    return `/vendors/${id}`;
    case 'city':      return `/city/${slug ?? id}`;
    default:          return `/event/${id}`;
  }
}

// search_public_v7 people helpers: ONE mapping for the role line, the screen-reader
// label and the telemetry kind, shared by the header omnibox, the overlay and the
// /search page. Lives here (not its own module): a new file is a new first-load
// chunk on every route (chunk ratchet).
export type PersonRole = 'teacher' | 'dj' | 'dancer';

export const ROLE_ORDER: PersonRole[] = ['teacher', 'dj', 'dancer'];
const ROLE_LABEL: Record<PersonRole, string> = { teacher: 'Teacher', dj: 'DJ', dancer: 'Dancer' };

/** Known roles only, in the fixed order Teacher, DJ, Dancer, de-duplicated. */
export function orderedRoles(roles: readonly string[] | null | undefined): PersonRole[] {
  const have = new Set(roles ?? []);
  return ROLE_ORDER.filter((r) => have.has(r));
}

/** "Teacher · DJ · Dancer" (middle dot), or '' when there is no role. */
export function roleLine(roles: readonly string[] | null | undefined): string {
  return orderedRoles(roles).map((r) => ROLE_LABEL[r]).join(' · ');
}

/** "Carlos Mendez, Teacher, DJ, Dancer" for aria-label. */
export function personAriaLabel(name: string, roles: readonly string[] | null | undefined): string {
  const labels = orderedRoles(roles).map((r) => ROLE_LABEL[r]);
  return labels.length ? `${name}, ${labels.join(', ')}` : name;
}

/** Old entity kind logged to record_search_result_click_v1 (no new entity_type). */
export function telemetryKindFor(primary: string | null | undefined, roles?: readonly string[] | null): PersonRole {
  if (primary === 'teacher' || primary === 'dj' || primary === 'dancer') return primary;
  return orderedRoles(roles)[0] ?? 'dancer';
}

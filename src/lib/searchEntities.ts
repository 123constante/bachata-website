import {
  Calendar, MapPin, Building2, GraduationCap, Music, User, ShoppingBag, Globe,
  type LucideIcon,
} from 'lucide-react';

// Single source of truth for the 8 federated-search entity kinds
// (search_public_v5). Replaces the duplicated kind -> icon/label/href maps in
// searchRpc.ts and HeaderSearch.tsx. Vendors link by id (/vendors/:id); cities
// by slug (/city/:slug). Keep this in sync with the RPC's entity_type whitelist.
export type SearchKind =
  | 'event' | 'venue' | 'organiser' | 'teacher' | 'dj' | 'dancer' | 'vendor' | 'city';

export const KIND_ICON: Record<SearchKind, LucideIcon> = {
  event: Calendar, venue: MapPin, organiser: Building2, teacher: GraduationCap,
  dj: Music, dancer: User, vendor: ShoppingBag, city: Globe,
};

export const KIND_LABEL: Record<SearchKind, string> = {
  event: 'Event', venue: 'Venue', organiser: 'Organiser', teacher: 'Teacher',
  dj: 'DJ', dancer: 'Dancer', vendor: 'Vendor', city: 'City',
};

export const KIND_LABEL_PLURAL: Record<SearchKind, string> = {
  event: 'Events', venue: 'Venues', organiser: 'Organisers', teacher: 'Teachers',
  dj: 'DJs', dancer: 'Dancers', vendor: 'Vendors', city: 'Cities',
};

// People kinds render with round avatars; everything else a square thumb/glyph.
export const CIRCLE_KINDS: SearchKind[] = ['organiser', 'teacher', 'dj', 'dancer'];

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
    case 'vendor':    return `/vendors/${id}`;
    case 'city':      return `/city/${slug ?? id}`;
    default:          return `/event/${id}`;
  }
}

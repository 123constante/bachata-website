/**
 * buildSeoForRoute - per-route title/description/canonical builder.
 *
 * Mirrors the buildBreadcrumbs() call shape. Same RouteId values from
 * siteIa.ts; entity routes require ctx.entityName.
 *
 * Copy style: keyword-led (bachata + city + intent), British English,
 * descriptions ~150-160 chars where possible.
 */

import { SITE_ORIGIN, type SeoInput } from './useSeo';

const CITY_DEFAULT = 'London';

export interface SeoContext {
  entityName?: string | null;
  entitySlug?: string | null;
  cityDisplay?: string | null;
  ogImage?: string | null;
  isLoading?: boolean;
  canonicalPath?: string;
}

const city = (ctx: SeoContext) => ctx.cityDisplay || CITY_DEFAULT;
const abs = (path: string) => `${SITE_ORIGIN}${path.startsWith('/') ? path : `/${path}`}`;

interface Spec {
  title: (ctx: SeoContext) => string;
  description: (ctx: SeoContext) => string;
  path: (ctx: SeoContext) => string;
  ogType?: 'website' | 'article';
}

const SPECS: Record<string, Spec> = {
  home: {
    title: (c) => city(c) === 'London' ? 'Bachata London - Events, Classes & Parties Calendar' : `Bachata in ${city(c)} - Classes, Socials & Festivals`,
    description: (c) => `Every bachata class, social and festival in ${city(c)}, updated daily. The complete calendar for ${city(c)}'s bachata scene.`,
    path: () => '/',
  },
  parties: {
    title: (c) => `Bachata Socials & Parties in ${city(c)}`,
    description: (c) => `Every regular bachata social and party in ${city(c)}. Browse by night, find your local, see who's playing.`,
    path: () => '/parties',
  },
  classes: {
    title: (c) => `Bachata Classes in ${city(c)}`,
    description: (c) => `Bachata classes for every level in ${city(c)}. Beginners' courses, drop-ins, workshops and intensives from the city's teachers.`,
    path: () => '/classes',
  },
  tonight: {
    title: (c) => `Bachata Tonight in ${city(c)}`,
    description: (c) => `What's on tonight for bachata dancers in ${city(c)}. Socials, classes and workshops happening right now.`,
    path: () => '/tonight',
  },
  festivals: {
    title: () => `Bachata Festivals & Congresses`,
    description: (c) => `Upcoming bachata festivals and congresses in ${city(c)} and beyond. Weekend intensives, internationals and travel-worthy events.`,
    path: () => '/festivals',
  },
  venues: {
    title: (c) => `Bachata Venues in ${city(c)}`,
    description: (c) => `Every bachata venue in ${city(c)} - dance floors, addresses, opening nights and what's on at each.`,
    path: () => '/venues',
  },
  teachers: {
    title: (c) => `Bachata Teachers in ${city(c)}`,
    description: (c) => `Bachata teachers in ${city(c)} - find an instructor, browse their classes, learn their style.`,
    path: () => '/teachers',
  },
  djs: {
    title: (c) => `Bachata DJs in ${city(c)}`,
    description: (c) => `Bachata DJs playing socials and parties in ${city(c)}. Who's on the decks and where to hear them.`,
    path: () => '/djs',
  },
  organisers: {
    title: (c) => `Bachata Organisers in ${city(c)}`,
    description: (c) => `Promoters, schools and collectives running bachata events in ${city(c)}. See their next dates.`,
    path: () => '/organisers',
  },
  dancers: {
    title: (c) => `Bachata Dancers in ${city(c)}`,
    description: (c) => `Bachata dancers in ${city(c)} - profiles, social presence, who's on the floor.`,
    path: () => '/dancers',
  },
  discounts: {
    title: () => `Bachata Discounts & Offers`,
    description: (c) => `Discount codes, early-bird tickets and member offers for bachata events in ${city(c)}.`,
    path: () => '/discounts',
  },
  practicePartners: {
    title: (c) => `Bachata Practice Partners in ${city(c)}`,
    description: (c) => `Find a bachata practice partner in ${city(c)} - between classes, between socials, between levels.`,
    path: () => '/practice-partners',
  },
  videographers: {
    title: () => `Bachata Videographers`,
    description: () => `Bachata videographers and content creators - book a shoot, see their work.`,
    path: () => '/videographers',
  },
  vendors: {
    title: () => `Bachata Vendors`,
    description: () => `Vendors serving the bachata community - shoes, clothing, accessories, services.`,
    path: () => '/vendors',
  },
  choreography: {
    title: (c) => `Bachata Choreography in ${city(c)}`,
    description: (c) => `Bachata choreography teams, performances and choreographers in ${city(c)}.`,
    path: () => '/choreography',
  },
  cities: {
    title: () => `Cities`,
    description: () => `Bachata Calendar coverage by city - pick yours.`,
    path: () => '/cities',
  },
  search: {
    title: () => `Search`,
    description: (c) => `Search Bachata Calendar - events, venues, teachers, organisers and DJs across ${city(c)}.`,
    path: () => '/search',
  },

  'event.detail': {
    title: (c) => `${c.entityName ?? 'Event'} - Bachata in ${city(c)}`,
    description: (c) => `${c.entityName ?? 'Bachata event'} in ${city(c)}. Dates, venue, line-up and how to attend.`,
    path: (c) => `/event/${c.entitySlug ?? ''}`,
    ogType: 'article',
  },
  'venue.detail': {
    title: (c) => `${c.entityName ?? 'Venue'} - Bachata in ${city(c)}`,
    description: (c) => `${c.entityName ?? 'Bachata venue'} in ${city(c)} - what's on, who plays, address and details.`,
    path: (c) => `/venue-entity/${c.entitySlug ?? ''}`,
  },
  'organiser.detail': {
    title: (c) => `${c.entityName ?? 'Organiser'} - Bachata Organiser, ${city(c)}`,
    description: (c) => `${c.entityName ?? 'This organiser'} runs bachata events in ${city(c)}. Upcoming dates and how to book.`,
    path: (c) => `/organisers/${c.entitySlug ?? ''}`,
  },
  'teacher.detail': {
    title: (c) => `${c.entityName ?? 'Teacher'} - Bachata Teacher, ${city(c)}`,
    description: (c) => `${c.entityName ?? 'This teacher'} teaches bachata in ${city(c)}. Classes, schedule and styles.`,
    path: (c) => `/teachers/${c.entitySlug ?? ''}`,
  },
  'dj.detail': {
    title: (c) => `${c.entityName ?? 'DJ'} - Bachata DJ, ${city(c)}`,
    description: (c) => `${c.entityName ?? 'This DJ'} plays bachata in ${city(c)}. Upcoming sets and where to hear them.`,
    path: (c) => `/djs/${c.entitySlug ?? ''}`,
  },
  'dancer.detail': {
    title: (c) => `${c.entityName ?? 'Dancer'} - Bachata Dancer, ${city(c)}`,
    description: (c) => `${c.entityName ?? 'This dancer'} - profile on Bachata Calendar ${city(c)}.`,
    path: (c) => `/dancers/${c.entitySlug ?? ''}`,
  },
  'festival.detail': {
    title: (c) => `${c.entityName ?? 'Festival'} - Bachata Festival`,
    description: (c) => `${c.entityName ?? 'This festival'} - dates, line-up, location and tickets.`,
    path: (c) => `/festival/${c.entitySlug ?? ''}`,
    ogType: 'article',
  },
  'vendor.detail': {
    title: (c) => `${c.entityName ?? 'Vendor'} - Bachata Vendor`,
    description: (c) => `${c.entityName ?? 'This vendor'} - serving the bachata community.`,
    path: (c) => `/vendors/${c.entitySlug ?? ''}`,
  },
};

export function buildSeoForRoute(routeId: string, ctx: SeoContext = {}): SeoInput {
  const spec = SPECS[routeId];
  if (!spec) {
    return {
      title: 'Bachata Calendar',
      description: `Classes, socials and festivals for ${city(ctx)}'s bachata dance community.`,
      canonical: SITE_ORIGIN,
    };
  }
  // noindex a detail route whenever there is no resolved entity — covers BOTH the
  // still-loading state AND the settled "not found" state (isLoading === false,
  // entityName == null). Keeps not-found pages out of the index: a hollow /
  // not-found page never emits a readiness signal for crawlers to snapshot.
  const noindex = (!!ctx.isLoading || !ctx.entityName) && routeId.endsWith('.detail');
  return {
    title: spec.title(ctx),
    description: spec.description(ctx),
    canonical: ctx.canonicalPath ? abs(ctx.canonicalPath) : abs(spec.path(ctx)),
    ogImage: ctx.ogImage ?? undefined,
    ogType: spec.ogType ?? 'website',
    noindex,
  };
}

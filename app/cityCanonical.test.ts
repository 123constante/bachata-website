import { describe, it, expect } from 'vitest';
import {
  CLEAN_LISTINGS,
  CITY_SELF_CANONICAL,
  cityCanonicalPath,
  citySelfCanonicalListing,
  citySubpageSeo,
  __cityDisplayFromSlugTwin,
} from './cityCanonical';
import { buildSeoForRoute } from '../src/lib/seo/buildSeoForRoute';
import { cityDisplayFromSlug } from '../src/lib/cityDisplayName';

// middleware.ts is the only caller and cannot itself be imported by a spec
// (@vercel/edge), so these assertions ARE the gate on the city canonical rule.
// Before app/cityCanonical.ts existed the rule lived inline in that file and
// had no coverage at all -- which is how /city/:slug/map shipped telling every
// search crawler its canonical was the homepage.

const seg = (path: string) => path.split('/').filter(Boolean);

describe('cityCanonicalPath', () => {
  it('canonicalises a self-canonical subpage to ITSELF, carrying the slug', () => {
    expect(cityCanonicalPath(seg('/city/london-gb/map'))).toBe('/city/london-gb/map');
    // Not London-specific: the slug is echoed, never defaulted.
    expect(cityCanonicalPath(seg('/city/new-york-us/map'))).toBe('/city/new-york-us/map');
  });

  it('agrees with the canonical the PAGE declares client-side', () => {
    // src/pages/CityMap.tsx passes canonicalPath `/city/${citySlug}/map` to
    // useSeo. A bot and a browser must not be told different canonicals for the
    // same URL -- that disagreement was the defect.
    const slug = 'london-gb';
    expect(cityCanonicalPath(seg(`/city/${slug}/map`))).toBe(`/city/${slug}/map`);
  });

  it('leaves the bare city on the homepage canonical', () => {
    expect(cityCanonicalPath(seg('/city/london-gb'))).toBe('/');
  });

  it('still consolidates city-prefixed clean listings onto the clean route', () => {
    expect(cityCanonicalPath(seg('/city/london-gb/parties'))).toBe('/parties');
    expect(cityCanonicalPath(seg('/city/london-gb/venues'))).toBe('/venues');
    expect(cityCanonicalPath(seg('/city/london-gb/search'))).toBe('/search');
  });

  it('keeps /city/:slug/calendar on the homepage canonical', () => {
    // It renders <Index/>, i.e. the homepage with the Calendar tab open, so '/'
    // is correct for it. It is in NEITHER set, and this pins that it stays out.
    expect(CITY_SELF_CANONICAL.has('calendar')).toBe(false);
    expect(CLEAN_LISTINGS.has('calendar')).toBe(false);
    expect(cityCanonicalPath(seg('/city/london-gb/calendar'))).toBe('/');
  });

  it('does not mint an alias for a deeper path that is not a route', () => {
    // /city/london-gb/map/anything 404s in the browser. Canonicalising it onto
    // the real map page would hand a crawler an indexable alias for a dead URL.
    expect(cityCanonicalPath(seg('/city/london-gb/map/anything'))).toBe('/');
    expect(citySelfCanonicalListing(seg('/city/london-gb/map/anything'))).toBeNull();
  });

  it('leaves an unknown subpath on the pre-existing fallback', () => {
    // Bot-facing soft-404 -- known, deliberately unchanged here, queued in
    // queued-city-subpath-soft-404.md.
    expect(cityCanonicalPath(seg('/city/london-gb/not-a-route'))).toBe('/');
  });
});

describe('the two sets', () => {
  it('are disjoint', () => {
    // cityCanonicalPath() resolves self-canonical BEFORE clean-listing
    // consolidation. A slug in both sets would make that ordering silently
    // load-bearing, so the disjointness the comment claims is asserted.
    const both = [...CITY_SELF_CANONICAL].filter((s) => CLEAN_LISTINGS.has(s));
    expect(both).toEqual([]);
  });

  it('gives every self-canonical listing its own copy, and no one else any', () => {
    expect(CITY_SELF_CANONICAL.size).toBeGreaterThan(0);
    for (const listing of CITY_SELF_CANONICAL) {
      const s = citySubpageSeo(listing, 'london-gb');
      expect(s, `${listing} is self-canonical but has no OG copy`).not.toBeNull();
      expect(s!.title.length).toBeGreaterThan(0);
      expect(s!.description.length).toBeGreaterThan(0);
    }
    expect(citySubpageSeo('parties', 'london-gb')).toBeNull();
    expect(citySubpageSeo(null, 'london-gb')).toBeNull();
  });

  it('answers null for an Object.prototype key, not a prototype member', () => {
    // The lookup was a plain object literal, so `['constructor']` returned a
    // truthy function and invoking it yielded an object with an undefined
    // title -- i.e. an empty <title> driven by a URL segment. A Map has no
    // such keys. Unreachable through citySelfCanonicalListing's Set gate,
    // which is precisely why it needs its own case.
    for (const key of ['constructor', '__proto__', 'toString', 'hasOwnProperty', 'valueOf']) {
      expect(citySubpageSeo(key, 'london-gb'), `${key} must not resolve`).toBeNull();
      expect(CITY_SELF_CANONICAL.has(key), `${key} must not be self-canonical`).toBe(false);
      expect(cityCanonicalPath(['city', 'london-gb', key])).toBe('/');
    }
  });

  it('falls back to the city card when no name can be derived', () => {
    expect(citySubpageSeo('map', null)).toBeNull();
    expect(citySubpageSeo('map', '')).toBeNull();
  });
});

// WHAT THIS BLOCK PROVES, AND WHAT IT DOES NOT.
//
// PROVES: the two runtime copies of the map page's TEMPLATE STRINGS agree, fed
// the one input they actually share in production (the slug). That is the
// drift this can catch -- someone editing buildSeoForRoute's city.map spec, or
// the table in app/cityCanonical.ts, and not the other.
//
// DOES NOT PROVE: that the two sides EMIT the same string. They do not, today.
// useSeo runs withSuffix() over both document.title and og:title, so the SPA
// says "... | Bachata Calendar" where the edge emits the bare title, and the
// edge truncates to 90/160 where the SPA does not. Asserting the emitted
// output is a different spec against a different seam, and it is queued
// (queued-city-map-title-output-parity.md) rather than claimed here. An
// earlier version of this comment implied the stronger property; review round
// 2 disproved it by reading, which is the whole reason the scope is now
// written down instead of assumed.
describe('citySubpageSeo copy is pinned to buildSeoForRoute', () => {
  // The Edge bundle cannot import src/lib/seo (that is what app/cityCanonical.ts
  // exists for), so the strings are duplicated at RUNTIME and can only be held
  // together at TEST time. Both sides are driven from THE SAME SLUG, which is
  // the only input they actually share in production: the edge derives the
  // display name from the slug, and src/pages/CityMap.tsx passes
  // cityDisplayFromSlug(slug) to buildSeoForRoute. Feeding the two sides a
  // ready-made city NAME instead pinned the templates while staying green
  // through a real divergence -- the edge used to read cities.name.
  it.each(['london-gb', 'new-york-us', 'stoke-on-trent-gb'])('matches for %s', (slug) => {
    const edge = citySubpageSeo('map', slug);
    const app = buildSeoForRoute('city.map', { cityDisplay: cityDisplayFromSlug(slug) });
    expect(edge).not.toBeNull();
    expect(edge!.title).toBe(app.title);
    expect(edge!.description).toBe(app.description);
  });

  it('derives the display name identically to src/lib/cityDisplayName', () => {
    // The twin is a copy, so it can drift. This is the only thing stopping it.
    for (const slug of [
      'london-gb', 'new-york-us', 'stoke-on-trent-gb', 'paris-fr',
      'rio-de-janeiro-br', 'madrid', 'a-b', '', 'x-gb',
    ]) {
      expect(__cityDisplayFromSlugTwin(slug), `twin drifted on "${slug}"`)
        .toBe(cityDisplayFromSlug(slug));
    }
    expect(__cityDisplayFromSlugTwin(null)).toBe(cityDisplayFromSlug(null));
    expect(__cityDisplayFromSlugTwin(undefined)).toBe(cityDisplayFromSlug(undefined));
  });

  it('is not vacuous -- the strings are real copy, not empty on both sides', () => {
    // Guards the shape where both sides degrade to '' and the equality above
    // passes while saying nothing.
    const edge = citySubpageSeo('map', 'london-gb')!;
    expect(edge.title).toBe('Bachata Map of London');
    expect(edge.description).toContain('Every bachata venue in London on one map');
    expect(edge.description.length).toBeLessThanOrEqual(160);
  });
});

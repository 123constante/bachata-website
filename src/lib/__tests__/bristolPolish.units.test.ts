/**
 * Bristol polish (docs/briefs/bristol-polish.md): the pure mappings every
 * screen shares -- page city, list cut, map centre, festivals elsewhere and
 * the "Tell us" form copy per caller. Table-driven over London / Bristol /
 * a city with no display name (null slug) and 0 / 1 / many rows.
 */
import { describe, expect, it } from 'vitest';
import { cityHasNoRows, resolvePageCity, rowsForCity } from '@/lib/pageCity';
import { cityBounds, cityCentre } from '@/lib/cityCentre';
import { normalizeInstagramHandle } from '@/lib/instagramHandle';
import { buildSeoForRoute } from '@/lib/seo/buildSeoForRoute';
import { isOffCityFestival, partitionRemote } from '@/modules/home-map/mapListDerivations';
import type { MapEvent } from '@/modules/home-map/mapTypes';
import { listingFormCopy, listingSourceUrl, normalizeListingLink } from '@/components/listingRequestCopy';

describe('resolvePageCity', () => {
  it.each([
    { slug: 'london-gb', name: 'London', isLondon: true },
    { slug: 'london', name: 'London', isLondon: true },
    { slug: 'LONDON-GB', name: 'London', isLondon: true },
    { slug: 'bristol-gb', name: 'Bristol', isLondon: false },
    { slug: 'new-york-us', name: 'New York', isLondon: false },
    { slug: null, name: 'London', isLondon: true },
    { slug: '', name: 'London', isLondon: true },
  ])('$slug -> $name', ({ slug, name, isLondon }) => {
    const c = resolvePageCity(slug);
    expect(c.name).toBe(name);
    expect(c.isLondon).toBe(isLondon);
  });
});

describe('SEO titles name the page city (all seven routes)', () => {
  const ROUTES = ['parties', 'classes', 'tonight', 'venues', 'organisers', 'dancers', 'djs'] as const;
  const CITIES = [
    { slug: 'london-gb', name: 'London' },
    { slug: 'bristol-gb', name: 'Bristol' },
    { slug: null, name: 'London' },
  ];
  it.each(ROUTES.flatMap((route) => CITIES.map((c) => ({ route, ...c }))))('$route x $slug', ({ route, slug, name }) => {
    const seo = buildSeoForRoute(route, { cityDisplay: resolvePageCity(slug).name });
    expect(seo.title).toContain(name);
    if (name !== 'London') expect(seo.title).not.toContain('London');
  });
});

describe('rowsForCity / cityHasNoRows', () => {
  const row = (city: string | null) => ({ city_name: city });
  const london = resolvePageCity('london-gb');
  const bristol = resolvePageCity('bristol-gb');
  const many = [row('London'), row('London'), row('Budapest'), row(null)];

  it('London: the list is returned untouched (same reference, off-city rows kept)', () => {
    expect(rowsForCity(many, london)).toBe(many);
    expect(rowsForCity([], london)).toEqual([]);
  });
  it.each([
    { label: '0 rows', rows: [], shown: 0, none: true },
    { label: '1 Bristol row', rows: [row('Bristol')], shown: 1, none: false },
    { label: '1 Bristol row, odd case and space', rows: [row(' bristol ')], shown: 1, none: false },
    { label: 'many elsewhere', rows: many, shown: 0, none: true },
    { label: 'many incl. 1 Bristol', rows: [...many, row('Bristol')], shown: 1, none: false },
  ])('Bristol, $label', ({ rows, shown, none }) => {
    expect(rowsForCity(rows, bristol)).toHaveLength(shown);
    expect(cityHasNoRows(rows, bristol, (r) => r.city_name)).toBe(none);
    expect(cityHasNoRows(rows, london, (r) => r.city_name)).toBe(false);
  });
});

describe('map centre for a city with no pins', () => {
  it.each([
    { slug: 'london-gb', centre: [51.5085, -0.128] },
    { slug: 'bristol-gb', centre: [51.4545, -2.5879] },
    { slug: null, centre: [51.5085, -0.128] },
    { slug: 'nowhere-xx', centre: [51.5085, -0.128] },
  ])('$slug', ({ slug, centre }) => {
    expect(cityCentre(slug)).toEqual(centre);
    const [[s, w], [n, e]] = cityBounds(slug);
    expect(s).toBeLessThan(centre[0]);
    expect(n).toBeGreaterThan(centre[0]);
    expect(w).toBeLessThan(centre[1]);
    expect(e).toBeGreaterThan(centre[1]);
  });
  it('London keeps the old Greater London drag box exactly', () => {
    expect(cityBounds('london-gb')).toEqual([[51.25, -0.55], [51.72, 0.34]]);
  });
});

describe('festivals elsewhere', () => {
  const ev = (o: Partial<MapEvent>): MapEvent => ({
    occurrence_id: 'o', event_id: 'e', name: 'T', cover_image_url: null, venue_name: 'V', area: null,
    city_slug: 'london-gb', lat: 51.5, lng: -0.1, instance_date: '2026-11-01', start_time: null, end_time: null,
    type: 'standard', has_party: true, has_class: false, class_start: null, class_end: null, party_start: null,
    party_end: null, created_at: null, updated_at: null, freshness_kind: null, is_cancelled: false,
    cancellation_reason_label: null, ...o,
  } as MapEvent);
  const londonFest = ev({ occurrence_id: 'f-lon', type: 'festival', city_slug: 'london-gb' });
  const budapestFest = ev({ occurrence_id: 'f-bud', type: 'festival', city_slug: 'budapest-hu' });
  const bristolFest = ev({ occurrence_id: 'f-bri', type: 'festival', city_slug: 'bristol-gb' });
  const bristolSocial = ev({ occurrence_id: 's-bri', city_slug: 'bristol-gb' });
  const remote = ev({ occurrence_id: 'remote-x', type: 'festival', city_slug: 'madrid-es' });

  it.each([
    { page: 'bristol-gb', row: londonFest, off: true },
    { page: 'bristol-gb', row: budapestFest, off: true },
    { page: 'bristol-gb', row: bristolFest, off: false },
    { page: 'bristol-gb', row: bristolSocial, off: false },
    { page: 'bristol-gb', row: ev({ type: 'festival', city_slug: null }), off: false },
    { page: 'london-gb', row: budapestFest, off: false },
    { page: null, row: budapestFest, off: false },
  ])('page $page, row $row.occurrence_id -> off-city $off', ({ page, row, off }) => {
    expect(isOffCityFestival(row, page)).toBe(off);
  });

  it('Bristol: London and Budapest festivals leave "What\'s on" for the elsewhere group; nothing is lost', () => {
    const all = [bristolSocial, londonFest, budapestFest, remote];
    const { local, remote: away } = partitionRemote(all, 'bristol-gb');
    expect(local.map((e) => e.occurrence_id)).toEqual(['s-bri']);
    expect(away.map((e) => e.occurrence_id)).toEqual(['f-lon', 'f-bud', 'remote-x']);
  });
  it('London: unchanged (only remote- rows leave the stream)', () => {
    const all = [londonFest, budapestFest, remote];
    expect(partitionRemote(all, 'london-gb')).toEqual(partitionRemote(all));
    expect(partitionRemote(all, 'london-gb').local).toHaveLength(2);
  });
});

describe('"Tell us" form: every caller x every wording', () => {
  // Every opener of ListingRequestForm in the app (git grep ListingRequestForm).
  const CALLERS = [
    { caller: 'ComingSoonGate (teachers/organisers/venue gates)', variant: 'event' as const },
    { caller: 'EmptyCityNote (home, Tonight, Venues, Organisers, Dancers, DJs, search)', variant: 'event' as const },
    { caller: 'Teachers.tsx empty-city "Tell us"', variant: 'teacher' as const },
  ];
  const WORDING = ['linkLabel', 'hint', 'missing', 'invalidLink', 'success'] as const;
  it.each(CALLERS.flatMap((c) => WORDING.map((w) => ({ ...c, w }))))('$caller: $w', ({ variant, w }) => {
    const text = listingFormCopy(variant, 'Bristol')[w];
    if (variant === 'teacher') {
      expect(text.toLowerCase()).not.toContain('event');
    } else {
      expect(text).toBe(listingFormCopy('event')[w]);
    }
  });
  it('teacher heading names the city; event has none', () => {
    expect(listingFormCopy('teacher', 'Bristol').heading).toBe('Know a teacher in Bristol?');
    expect(listingFormCopy('teacher', null).heading).toBe('Know a teacher?');
    expect(listingFormCopy('event', 'Bristol').heading).toBeNull();
    expect(listingFormCopy('teacher').linkLabel).toBe('Their profile or Instagram link');
    expect(listingFormCopy('event').linkLabel).toBe('Event link');
  });
  it('no entity text leaks into copy (raw &mdash; etc.)', () => {
    for (const v of ['event', 'teacher'] as const) {
      for (const t of Object.values(listingFormCopy(v, 'Bristol'))) expect(t ?? '').not.toMatch(/&[a-z]+;/);
    }
  });
});

describe('normalizeListingLink', () => {
  it.each([
    { variant: 'event', raw: 'https://fb.me/e/1', out: 'https://fb.me/e/1' },
    { variant: 'event', raw: '@maria', out: null },
    { variant: 'event', raw: 'www.site.com', out: null },
    { variant: 'event', raw: '  ', out: null },
    { variant: 'teacher', raw: 'https://instagram.com/maria', out: 'https://instagram.com/maria' },
    { variant: 'teacher', raw: '@Maria.Dance', out: 'https://instagram.com/maria.dance' },
    { variant: 'teacher', raw: 'maria_dance', out: 'https://instagram.com/maria_dance' },
    { variant: 'teacher', raw: 'instagram.com/maria_dance/', out: 'https://instagram.com/maria_dance' },
    { variant: 'teacher', raw: 'www.instagram.com/maria?igsh=1', out: 'https://instagram.com/maria' },
    { variant: 'teacher', raw: 'mariadance.co.uk', out: 'https://mariadance.co.uk' },
    { variant: 'teacher', raw: 'linktr.ee/maria', out: 'https://linktr.ee/maria' },
    { variant: 'teacher', raw: 'instagram.com', out: null },
    { variant: 'teacher', raw: '@', out: null },
    { variant: 'teacher', raw: 'maria dance', out: null },
    { variant: 'teacher', raw: '@bad!name', out: null },
  ] as const)('$variant: "$raw" -> $out', ({ variant, raw, out }) => {
    const got = normalizeListingLink(variant, raw, normalizeInstagramHandle);
    expect(got).toBe(out);
    // The RPC only takes ^https?:// -- anything we send must pass it.
    if (got) expect(got).toMatch(/^https?:\/\//);
  });
});

describe('listingSourceUrl: the receiver can tell the city', () => {
  it.each([
    { path: '/djs', search: '', slug: 'bristol-gb', out: '/djs?city=bristol-gb' },
    { path: '/search', search: '?q=zouk', slug: 'bristol-gb', out: '/search?q=zouk&city=bristol-gb' },
    { path: '/city/bristol-gb/venues', search: '', slug: 'bristol-gb', out: '/city/bristol-gb/venues' },
    { path: '/djs', search: '', slug: null, out: '/djs' },
    { path: '/teachers/abc', search: '?x=1', slug: undefined, out: '/teachers/abc?x=1' },
  ])('$path$search + $slug -> $out', ({ path, search, slug, out }) => {
    expect(listingSourceUrl(path, search, slug)).toBe(out);
  });
});

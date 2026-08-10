// @vitest-environment node
/**
 * /api/og/card must MARK every response that is not the card the URL asked for.
 *
 * The defect this closes (queued finding 1a): a failing event_view_p5 makes
 * fetchEventCardData return null and the loader serves an INLINE 200 generic
 * branded card -- no redirect, valid JPEG, correct size -- so the OG guard's
 * redirect rule stayed silent while every event share carried a blank card.
 *
 * WHY THIS FILE EXISTS ALONGSIDE THE CANARY. check-og-images.mjs --self-test
 * proves the pure RULE in both directions, but the rule reads a header the
 * guard never produces; nothing in it can fail if the loader stops emitting
 * one. That half is here: the loader is driven for real (only its data
 * sources are mocked) and the header is read off an actual Response.
 *
 * The mocks are the I/O, never the subject: buildFallbackCard/buildImageCard
 * are stubbed because sharp + font materialisation need a network and a
 * filesystem, but the branch that DECIDES which of them runs, and with which
 * marker, is the real loader code.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { readFileSync } from 'node:fs';

const COVER = 'https://cdn.example.com/flyer.jpg';
const STATIC_FALLBACK = 'https://www.bachatacalendar.co.uk/og-image.jpg';

// Mutable per-case behaviour for the mocked data layer. vi.hoisted because the
// factory below is hoisted above this file's body.
const io = vi.hoisted(() => ({
  resolveId: null as null | string,
  cardData: null as null | Record<string, unknown>,
  imageBytes: null as null | Buffer,
  throwOnResolve: false,
}));

vi.mock('../app/lib/ogCardRender', () => ({
  buildFallbackCard: async () => Buffer.from('branded-fallback-jpeg'),
  buildImageCard: async () => Buffer.from('cover-jpeg'),
  fetchImageBytes: async () => io.imageBytes,
  fetchEventCardData: async () => io.cardData,
  fetchFestivalCardData: async () => io.cardData,
  resolveOgEventId: async (param: string) => {
    if (io.throwOnResolve) throw new Error('boom');
    return io.resolveId === null ? null : io.resolveId || param;
  },
}));

// STATIC import, not `await import`. vi.mock is hoisted above imports by
// vitest's transform, so the dynamic form bought nothing -- and top-level
// await defers everything after it, including the `beforeEach` below, out of
// the collection context. That made the whole file collect ZERO tests with
// "TypeError: Cannot read properties of undefined (reading 'on')".
// INTERMITTENTLY: it passed 19/19 on repeated runs and failed on another,
// which is the worst shape of all -- a spec that reds CI at random and proves
// nothing when it does not.
import { loader } from '../app/routes/api.og.card';

const HEADER = 'x-og-fallback';
const LONG_CACHE = /s-maxage=31536000/;
const FAST_CACHE = 'public, max-age=300';
const SLOW_CACHE = 'public, max-age=3600';
const BASE = 'https://www.bachatacalendar.co.uk/api/og/card';

// Every reason this file has watched the REAL loader emit. Collected from
// responses, not from the type union -- a union is erased at runtime, so
// parsing it would certify a reason whose emitting branch had been deleted.
// The cross-file assertion at the bottom consumes this.
const emitted = new Set<string>();

async function get(query: string): Promise<Response> {
  const request = new Request(`${BASE}?${query}`);
  // The loader only reads `request`; the rest of LoaderArgs is unused here.
  const res = await loader({ request } as unknown as Parameters<typeof loader>[0]);
  const marker = res.headers.get(HEADER);
  if (marker) emitted.add(marker);
  return res;
}

beforeEach(() => {
  io.resolveId = 'evt-1';
  io.cardData = { title: 'Bachata Night', dateLine: 'Friday 7 August 2026', venueLine: 'at Pulse', coverUrl: COVER };
  io.imageBytes = Buffer.from('flyer-bytes');
  io.throwOnResolve = false;
});

describe('healthy responses carry no marker', () => {
  // The discriminator for the whole file. Without a case that stays UNMARKED,
  // every assertion below would also pass against a loader that marked every
  // response, which would red the OG guard on the entire site.
  it('a card built from a real cover is unmarked, ETagged and cached for a year', async () => {
    const res = await get('kind=event&id=evt-1&v=abc');
    expect(res.status).toBe(200);
    expect(res.headers.get(HEADER)).toBeNull();
    expect(res.headers.get('etag')).toBeTruthy();
    expect(res.headers.get('cache-control')).toMatch(LONG_CACHE);
  });

  // kind=image is the og:image of every teacher/dancer/dj/venue page. A
  // regression that marked its success path would red the guard for all of
  // them, and no event-shaped case above would notice.
  it('a kind=image passthrough is unmarked and cached for a year', async () => {
    const res = await get('kind=image&src=https%3A%2F%2Fx.example%2Fa.jpg');
    expect(res.status).toBe(200);
    expect(res.headers.get(HEADER)).toBeNull();
    expect(res.headers.get('cache-control')).toMatch(LONG_CACHE);
  });
});

describe('inline degrades are marked', () => {
  it('THE 1a CASE: no card data serves an inline 200 marked card-data-unavailable', async () => {
    io.cardData = null;
    const res = await get('kind=event&id=evt-1&v=abc');
    // Inline, not a redirect -- exactly why the redirect rule missed it.
    expect(res.status).toBe(200);
    expect(res.headers.get('content-type')).toBe('image/jpeg');
    expect(res.headers.get(HEADER)).toBe('card-data-unavailable');
  });

  it('a festival with no card data is marked the same way as an event', async () => {
    io.cardData = null;
    const res = await get('kind=festival&id=fest-1&v=abc');
    expect(res.headers.get(HEADER)).toBe('card-data-unavailable');
  });

  it('a cover that will not fetch marks cover-unfetchable', async () => {
    io.imageBytes = null;
    const res = await get('kind=event&id=evt-1&v=abc');
    expect(res.status).toBe(200);
    expect(res.headers.get(HEADER)).toBe('cover-unfetchable');
  });

  // No PAGE emits a card URL for a flyer-less entity (resolveOgCardImage
  // returns the static image when there is no cover token), so reaching this
  // branch through a real og:image means the page and the endpoint disagree
  // about the cover -- a promised flyer served as title-only text.
  it('no cover at render time marks cover-absent, distinctly from unfetchable', async () => {
    io.cardData = { title: 'Bachata Night', dateLine: null, venueLine: null, coverUrl: null };
    const res = await get('kind=event&id=evt-1&v=abc');
    expect(res.status).toBe(200);
    expect(res.headers.get(HEADER)).toBe('cover-absent');
  });
});

describe('a degrade is never allowed to become permanent', () => {
  // The short cache is only half the promise. The ETag is a pure function of
  // the query params, so a degraded card and the healthy card it replaced
  // validate IDENTICALLY: a stored degraded validator would be answered 304
  // forever and the 300s below would buy nothing.
  it('a degraded response carries NO ETag, so no 304 can revalidate it', async () => {
    io.cardData = null;
    const res = await get('kind=event&id=evt-1&v=abc');
    expect(res.headers.get('etag')).toBeNull();
  });

  it('a generic card (transient RPC death) self-heals in 5 minutes', async () => {
    io.cardData = null;
    const res = await get('kind=event&id=evt-1&v=abc');
    expect(res.headers.get('cache-control')).not.toMatch(LONG_CACHE);
    expect(res.headers.get('cache-control')).toBe(FAST_CACHE);
  });

  // A dead flyer URL cannot self-heal without a cover change, and a cover
  // change already busts this cache via v=. At 300s it would cost a 5s fetch
  // timeout plus a full sharp re-render ~288 times a day to rebuild a
  // byte-identical card.
  it.each(['cover-unfetchable', 'cover-absent'])('a %s card takes the 1h tier, not 300s', async (reason) => {
    if (reason === 'cover-unfetchable') io.imageBytes = null;
    else io.cardData = { title: 'X', dateLine: null, venueLine: null, coverUrl: null };
    const res = await get('kind=event&id=evt-1&v=abc');
    expect(res.headers.get(HEADER)).toBe(reason);
    expect(res.headers.get('cache-control')).toBe(SLOW_CACHE);
  });

  it('a 304 short-circuit is not a degrade', async () => {
    const first = await get('kind=event&id=evt-1&v=abc');
    const etag = first.headers.get('etag') as string;
    const res = await loader({
      request: new Request(`${BASE}?kind=event&id=evt-1&v=abc`, { headers: { 'if-none-match': etag } }),
    } as unknown as Parameters<typeof loader>[0]);
    expect(res.status).toBe(304);
    expect(res.headers.get(HEADER)).toBeNull();
  });
});

describe('redirect degrades name their reason and still redirect', () => {
  it.each([
    ['missing-id', 'kind=event&v=abc', () => {}],
    ['unresolvable-id', 'kind=event&id=ghost&v=abc', () => { io.resolveId = null; }],
    ['image-missing-src', 'kind=image', () => {}],
    ['image-source-unfetchable', 'kind=image&src=https%3A%2F%2Fx.example%2Fa.jpg', () => { io.imageBytes = null; }],
    ['render-error', 'kind=event&id=evt-1&v=abc', () => { io.throwOnResolve = true; }],
  ])('%s', async (reason, query, arrange) => {
    arrange();
    const res = await get(query);
    expect(res.status).toBe(302);
    expect(res.headers.get(HEADER)).toBe(reason);
    // Asserted here because a 302 with no Location is a preview that goes
    // nowhere, and the marker assertion alone would stay green through it.
    expect(res.headers.get('location')).toBe(STATIC_FALLBACK);
    expect(res.headers.get('cache-control')).toBe(FAST_CACHE);
  });
});

/**
 * The wire between the two files, which neither side can prove alone.
 *
 * The loader writes a header; the guard reads one; the canary constructs its
 * own response objects and so proves the PREDICATE without ever touching
 * either. Both of these mutations were measured passing the canary 16/16 and
 * an earlier 13-case revision of this spec, before these assertions existed:
 *   - headImage returning `fallbackReason: undefined` (guard reads no header)
 *   - `if (false && degradedCard)` in checkPage (verdict computed, discarded)
 * Both were then re-run against THIS file, at 19 cases, and now red it.
 *
 * What follows is a structural tripwire, and its limit is stated rather than
 * papered over: it proves the read and the push EXIST in the source, not that
 * main() executes them. That last link is owned by the live run's printed
 * receipt (the same residual as finding 10b for check-seo). A tripwire that
 * turns a silent blinding into a loud test failure is worth having even
 * though it cannot prove execution.
 */
describe('the guard is wired to the header the loader writes', () => {
  const read = (rel: string) => readFileSync(new URL(rel, import.meta.url), 'utf8');
  const guard = read('../scripts/check-og-images.mjs');
  const route = read('../app/routes/api.og.card.tsx');

  it('both files name the same header', () => {
    const declared = route.match(/const FALLBACK_HEADER = "([^"]+)"/);
    expect(declared, 'FALLBACK_HEADER not found in the route').not.toBeNull();
    const consumed = guard.match(/fallbackReason: r\.headers\.get\('([^']+)'\)/);
    expect(consumed, 'headImage does not read a header into fallbackReason').not.toBeNull();
    expect((consumed as RegExpMatchArray)[1]).toBe((declared as RegExpMatchArray)[1].toLowerCase());
  });

  it('checkPage pushes the fallback verdict into failures', () => {
    expect(guard).toMatch(/const degradedCard = cardFallbackFailure\(img\);\s*\r?\n\s*if \(degradedCard\) failures\.push\(degradedCard\);/);
  });

  /**
   * Anti-drift on the vocabulary. If a forgiven reason stops being one the
   * loader can EMIT -- a rename, or a deleted branch -- the forgiveness
   * silently applies to nothing, and the row leaving the set would read as
   * "fixed" rather than "went blind". Checked against reasons this file
   * watched real responses carry, never against the type union: the union is
   * erased at runtime and would still contain a string whose only emitting
   * branch had been deleted.
   */
  it('every reason the guard forgives is one the loader was seen to emit', () => {
    const setLiteral = guard.match(/FALLBACK_STILL_A_REAL_CARD = new Set\(\[([^\]]*)\]\)/);
    expect(setLiteral, 'FALLBACK_STILL_A_REAL_CARD literal not found').not.toBeNull();
    const forgiven = [...(setLiteral as RegExpMatchArray)[1].matchAll(/'([^']+)'/g)].map((m) => m[1]);
    expect(forgiven.length).toBeGreaterThan(0);

    // Guards the guard: if the cases above stopped driving the loader, this
    // assertion would pass vacuously against an empty set. NOT an equality --
    // `emitted` is a side effect of every earlier case, so an exact count
    // fails under -t, .only or an early bail, claiming vocabulary drift when
    // nothing drifted, and reds on a legitimate 9th reason whose addition has
    // nothing to do with the FORGIVENESS set this case is about.
    expect(emitted.size).toBeGreaterThanOrEqual(8);
    expect(emitted).toContain('card-data-unavailable');
    for (const f of forgiven) expect(emitted).toContain(f);
  });
});

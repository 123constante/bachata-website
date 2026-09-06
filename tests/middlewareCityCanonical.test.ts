import { describe, it, expect, afterEach, beforeAll, beforeEach, vi } from 'vitest';

/**
 * READ-PATH gate for the city canonical rule.
 *
 * app/cityCanonical.test.ts proves the RULE. This proves middleware.ts actually
 * CALLS it -- that the self-canonical listing reaches fetchCityMeta and that
 * cityCanonicalPath's answer reaches the emitted <link rel="canonical">. A rule
 * can be perfectly correct and never wired to the response; that gap is exactly
 * how /city/:slug/map shipped with the SPA and the edge declaring different
 * canonicals for the same URL.
 *
 * middleware.ts is imported DYNAMICALLY (in beforeAll, not at top level) because
 * its SUPABASE_* consts are read at module evaluation: a static import would
 * capture the empty defaults and every case would fall out at the `if
 * (!SUPABASE_URL ...) return next()` guard while still looking like a pass.
 */

type Mw = (request: Request) => Promise<Response>;
let middleware: Mw;

const CITY_ROW = {
  name: 'London',
  description: 'The London bachata scene, all in one place.',
  hero_image_url: 'https://cdn.example/london.jpg',
};

beforeAll(async () => {
  process.env.SUPABASE_URL = 'https://stub.supabase.co';
  process.env.SUPABASE_ANON_KEY = 'stub-anon-key';
  process.env.SITE_URL = 'https://www.bachatacalendar.co.uk';
  middleware = (await import('../middleware')).default as Mw;
  // 60s, and the number is MEASURED, not padded. On a cold Vite cache
  // (`rm -rf node_modules/.vite`) transforming middleware.ts and its
  // @vercel/edge chain costs ~24s, and this hook then dies on vitest's 10s
  // default with "Hook timed out in 10000ms" -- the whole file scoring zero
  // while the suite still reports the OTHER files' tests as passed. Sampled
  // 1-in-4 warm before the raise, and 1-in-1 cold. The budget buys a one-off
  // module transform; every assertion below is pure and runs in single-digit
  // milliseconds, so this cannot mask a slow test.
}, 60_000);

beforeEach(() => {
  // Every outbound call is stubbed. If the stub is ever bypassed the request
  // goes to stub.supabase.co, supabaseFetch swallows the failure and returns
  // null, and the assertions below fail on a next() instead of a card -- so a
  // leak is loud rather than a silent live call.
  vi.stubGlobal(
    'fetch',
    vi.fn(async () => new Response(JSON.stringify([CITY_ROW]), { status: 200 })),
  );
});

afterEach(() => {
  // vitest isolates test FILES, so this is hygiene rather than a fix for an
  // observed leak -- but a global fetch stub left standing is the one thing in
  // this file that could ever be blamed for a sibling spec's timeout, and
  // ruling that out cheaply is worth four lines.
  vi.unstubAllGlobals();
});

const GOOGLEBOT = 'Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)';
const WHATSAPP = 'WhatsApp/2.23.20.0';

async function get(
  path: string,
  ua: string,
): Promise<{ status: number; next: string | null; body: string }> {
  const res = await middleware(
    new Request(`https://www.bachatacalendar.co.uk${path}`, { headers: { 'user-agent': ua } }),
  );
  // `next` is what actually distinguishes a pass-through. next() returns a 200
  // with a ZERO-LENGTH body (probed), so asserting only "no canonical in the
  // body" passes by ABSENCE -- it would hold just as well for an empty error
  // response. The header is the positive fact.
  return { status: res.status, next: res.headers.get('x-middleware-next'), body: await res.text() };
}

const canonicalOf = (html: string): string | null => {
  const m = html.match(/<link rel="canonical" href="([^"]*)" \/>/);
  return m ? m[1] : null;
};
const titleOf = (html: string): string | null => {
  const m = html.match(/<title>([^<]*)<\/title>/);
  return m ? m[1] : null;
};

describe('/city/:slug/map is served as ITSELF', () => {
  it('emits a self canonical to a search bot, not the homepage', async () => {
    const { body } = await get('/city/london-gb/map', GOOGLEBOT);
    expect(canonicalOf(body)).toBe('https://www.bachatacalendar.co.uk/city/london-gb/map');
  });

  it('emits the MAP card, not the city card', async () => {
    const { body } = await get('/city/london-gb/map', GOOGLEBOT);
    expect(titleOf(body)).toBe('Bachata Map of London');
    // The city's own DB description describes the homepage; the map page must
    // not be indexed under it.
    expect(body).not.toContain(CITY_ROW.description);
    expect(body).toContain('on one map');
  });

  it('gives a social bot the same corrected card', async () => {
    // A shared /city/:slug/map link should preview as the map, not the city.
    const { body } = await get('/city/london-gb/map', WHATSAPP);
    expect(titleOf(body)).toBe('Bachata Map of London');
    expect(canonicalOf(body)).toBe('https://www.bachatacalendar.co.uk/city/london-gb/map');
  });

  it('echoes the real slug rather than defaulting to London', async () => {
    const { body } = await get('/city/new-york-us/map', GOOGLEBOT);
    expect(canonicalOf(body)).toBe('https://www.bachatacalendar.co.uk/city/new-york-us/map');
  });

  it('titles the card from the SLUG, not from the DB row', async () => {
    // The stub returns name: 'London' for EVERY slug on purpose. If the edge
    // ever goes back to reading cities.name, this URL is titled "Bachata Map of
    // London" and this case reds -- which is the divergence from
    // src/pages/CityMap.tsx (cityDisplayFromSlug) that the copy-pinning spec
    // alone could not see, because it fed both sides the same ready-made name.
    const { body } = await get('/city/new-york-us/map', GOOGLEBOT);
    expect(titleOf(body)).toBe('Bachata Map of New York');
    expect(body).toContain('Every bachata venue in New York on one map');
  });
});

describe('the rest of the city rule is unchanged', () => {
  it('still consolidates a city-prefixed clean listing onto the clean route', async () => {
    const { body } = await get('/city/london-gb/parties', GOOGLEBOT);
    expect(canonicalOf(body)).toBe('https://www.bachatacalendar.co.uk/parties');
    expect(titleOf(body)).toBe('Bachata in London');
  });

  it('still sends a search bot on a bare city through to the real page', async () => {
    const { next, body, status } = await get('/city/london-gb', GOOGLEBOT);
    expect(next).toBe('1');
    expect(status).toBe(200);
    expect(body).toHaveLength(0);
  });

  it('does NOT pass a self-canonical subpage through', async () => {
    // The inverse of the case above, and the one that would catch a
    // pass-through added for search bots without the decision being taken:
    // /city/:slug/map is deliberately still served the edge card, because
    // next() here yields a ZERO-BYTE document (routes/catchall.tsx renders
    // null on the server), not the SSR'd page. See
    // queued-city-map-ssr-route.md for the fix that changes this.
    const { next, body } = await get('/city/london-gb/map', GOOGLEBOT);
    expect(next).toBeNull();
    expect(body.length).toBeGreaterThan(0);
  });

  it('still gives a social bot the city card on a bare city', async () => {
    const { body } = await get('/city/london-gb', WHATSAPP);
    expect(titleOf(body)).toBe('Bachata in London');
    expect(canonicalOf(body)).toBe('https://www.bachatacalendar.co.uk/');
  });

  it('still puts an unknown city subpath on the homepage canonical', async () => {
    // The bot-facing soft-404 this leaves open is queued, not fixed here.
    const { body } = await get('/city/london-gb/not-a-route', GOOGLEBOT);
    expect(canonicalOf(body)).toBe('https://www.bachatacalendar.co.uk/');
  });

  it('does not treat a deeper path as the map page', async () => {
    const { body } = await get('/city/london-gb/map/anything', GOOGLEBOT);
    expect(canonicalOf(body)).toBe('https://www.bachatacalendar.co.uk/');
    expect(titleOf(body)).toBe('Bachata in London');
  });
});

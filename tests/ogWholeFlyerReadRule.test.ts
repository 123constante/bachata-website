/**
 * Acceptance matrix 1 of docs/briefs/whole-flyer-og-b1.md: the D4 c READ RULE,
 * mode x baked-key shape, on the real code path (resolveOgCardImageSized, the
 * function event.tsx calls and resolveOgCardImage wraps). Each mode is a fresh
 * module graph with OG_WHOLE_FLYER_MODE / OG_WHOLE_FLYER_EVENT_IDS stubbed, so
 * the parse-once-at-load policy is exercised exactly as on Vercel.
 *
 * The declared size must equal the pixels of the URL it points at in EVERY
 * cell: for each emitted LIVE URL the test renders it through the real
 * /api/og/card loader (real sharp) and decodes the bytes. A baked URL's size is
 * the size written in its key -- read with no fetch (the measure stub records
 * that it was never called).
 */
import { describe, it, expect, vi, beforeAll } from 'vitest';
import sharp from 'sharp';

const io = vi.hoisted(() => ({
  baked: null as null | string,
  flyer: null as null | Buffer,
}));

vi.mock('@/integrations/supabase/getSupabase', () => ({
  getSupabase: async () => ({ rpc: async () => ({ data: io.baked, error: null }) }),
}));
vi.mock('@/integrations/supabase/client', () => ({ supabase: {} }));
vi.mock('@/lib/seo/resolvePublicEventRef', () => ({ resolvePublicEventRef: async () => null }));
vi.mock('@/modules/event-page/useFestivalDetailQuery', () => ({ fetchFestivalDetail: async () => null }));
vi.mock('../app/lib/ogCardRender', async (importOriginal) => {
  const real = await importOriginal<typeof import('../app/lib/ogCardRender')>();
  return {
    ...real,
    resolveOgEventId: async (p: string) => p,
    fetchEventCardData: async () => ({
      title: 'Night', dateLine: 'Friday', venueLine: 'at Hall',
      coverUrl: 'https://media.bachatacalendar.co.uk/events/covers/flyer.jpg', eventType: 'party',
    }),
    fetchFestivalCardData: async () => null,
    fetchImageBytes: async () => io.flyer,
  };
});

const ID = '01173937-0000-4000-8000-46b1f42d630c';
const OTHER = '9a0b6c1d-0000-4000-8000-000000000001';
const MEDIA = `https://media.bachatacalendar.co.uk/events/og/event/${ID}-default-0123456789abcdef`;
const R2 = `https://pub-07f606224cac4f2596903c44df723644.r2.dev/events/og/event/${ID}-default-0123456789abcdef`;

type KeyCase = { name: string; url: string | null; kind: 'legacy' | 'wf1' | 'other' | 'none'; size?: [number, number] };
const KEYS: KeyCase[] = [
  { name: 'plain legacy -<16hex>.jpg (media host)', url: `${MEDIA}.jpg`, kind: 'legacy' },
  { name: 'legacy with facts -<16hex>-<12hex>.jpg', url: `${MEDIA}-0123456789ab.jpg`, kind: 'legacy' },
  { name: 'plain legacy on r2.dev', url: `${R2}.jpg`, kind: 'legacy' },
  { name: 'legacy with a query string', url: `${MEDIA}.jpg?v=2`, kind: 'legacy' },
  { name: 'wf1 -wf1-960x1200.jpg', url: `${MEDIA}-wf1-960x1200.jpg`, kind: 'wf1', size: [960, 1200] },
  { name: 'wf1 on r2.dev with a query string', url: `${R2}-wf1-960x604.jpg?x=1`, kind: 'wf1', size: [960, 604] },
  { name: 'future wf2 key', url: `${MEDIA}-wf2-960x1200.jpg`, kind: 'other' },
  { name: 'wf1 key with an out-of-range size', url: `${MEDIA}-wf1-960x2000.jpg`, kind: 'other' },
  { name: 'malformed / unknown shape', url: `https://media.bachatacalendar.co.uk/events/og/event/${ID}.jpg`, kind: 'other' },
  { name: 'facts AND wf segments together', url: `${MEDIA}-0123456789ab-wf1-960x1200.jpg`, kind: 'other' },
  { name: 'no baked row at all', url: null, kind: 'none' },
];

type ModeCase = { name: string; mode: string; ids: string; wholeFlyer: boolean };
const MODES: ModeCase[] = [
  { name: 'off', mode: 'off', ids: ID, wholeFlyer: false },
  { name: 'test', mode: 'test', ids: ID, wholeFlyer: false },
  { name: 'allowlist, entity listed', mode: 'allowlist', ids: ` ${ID.toUpperCase()} ,${OTHER}`, wholeFlyer: true },
  { name: 'allowlist, entity NOT listed', mode: 'allowlist', ids: OTHER, wholeFlyer: false },
  { name: 'on', mode: 'on', ids: '', wholeFlyer: true },
];

async function flyer(w: number, h: number): Promise<Buffer> {
  return sharp({ create: { width: w, height: h, channels: 3, background: { r: 200, g: 40, b: 90 } } }).jpeg().toBuffer();
}

async function load(mode: ModeCase) {
  vi.resetModules();
  vi.stubEnv('OG_WHOLE_FLYER_MODE', mode.mode);
  vi.stubEnv('OG_WHOLE_FLYER_EVENT_IDS', mode.ids);
  const dl = await import('../app/detailLoader');
  const route = await import('../app/routes/api.og.card');
  const render = await import('../app/lib/ogCardRender');
  vi.unstubAllEnvs();
  return { dl, route, render };
}

async function decodedSizeOf(route: { loader: (a: never) => Promise<Response> }, url: string): Promise<[number, number]> {
  const res = await route.loader({ request: new Request(url) } as never);
  expect(res.status).toBe(200);
  expect(res.headers.get('X-OG-Fallback')).toBeNull();
  const meta = await sharp(Buffer.from(await res.arrayBuffer())).metadata();
  return [meta.width as number, meta.height as number];
}

const REQUEST = new Request('https://www.bachatacalendar.co.uk/event/night');

beforeAll(async () => {
  io.flyer = await flyer(750, 1000); // tall: measures to 960x1200
});

describe.each(MODES)('read rule, mode $name', (mode) => {
  it.each(KEYS)('key: $name', async (key) => {
    const { dl, route, render } = await load(mode);
    io.baked = key.url;
    let measured = 0;
    const measureWholeFlyer = async () => {
      measured += 1;
      return render.wholeFlyerCanvasFor(io.flyer as Buffer);
    };
    const out = await dl.resolveOgCardImageSized({
      entityType: 'event', entityId: ID, coverUrl: 'https://media.bachatacalendar.co.uk/events/covers/flyer.jpg',
      request: REQUEST, fallbackImage: 'https://www.bachatacalendar.co.uk/og-image.jpg', measureWholeFlyer,
    });

    if (!mode.wholeFlyer) {
      // LEGACY mode: legacy keys accepted at 1200x630; everything else -> live l-less 1200x630.
      expect(out.legacyFallback).toBe(false);
      expect(measured).toBe(0);
      expect([out.width, out.height]).toEqual([1200, 630]);
      if (key.kind === 'legacy') {
        expect(out.url).toBe(key.url);
      } else {
        expect(out.url).toMatch(/\/api\/og\/card\?/);
        expect(out.url).not.toMatch(/[?&](l|s)=/);
        expect(await decodedSizeOf(route, out.url)).toEqual([out.width, out.height]);
      }
      return;
    }
    // WHOLE-FLYER mode.
    if (key.kind === 'wf1') {
      // Accepted; the size comes from the key, with NO fetch.
      expect(out.url).toBe(key.url);
      expect([out.width, out.height]).toEqual(key.size);
      expect(measured).toBe(0);
      expect(out.layout).toBe('wf1');
      return;
    }
    // Legacy, wf2, malformed, none -> live l=wf1&s=<measured>.
    expect(measured).toBe(1);
    expect(out.legacyFallback).toBe(false);
    expect(out.url).toMatch(/\/api\/og\/card\?.*[?&]l=wf1&s=960x1200$/);
    expect([out.width, out.height]).toEqual([960, 1200]);
    expect(await decodedSizeOf(route, out.url)).toEqual([out.width, out.height]);
  });

  it('measure miss (no size) -> l-less legacy URL at 1200x630 plus the fallback flag', async () => {
    const { dl, route } = await load(mode);
    io.baked = `${MEDIA}.jpg`;
    const out = await dl.resolveOgCardImageSized({
      entityType: 'event', entityId: ID, coverUrl: 'https://media.bachatacalendar.co.uk/events/covers/flyer.jpg',
      request: REQUEST, fallbackImage: 'x', measureWholeFlyer: async () => null,
    });
    if (!mode.wholeFlyer) {
      expect(out.url).toBe(`${MEDIA}.jpg`);
      expect(out.legacyFallback).toBe(false);
      return;
    }
    expect(out.legacyFallback).toBe(true);
    expect(out.url).not.toMatch(/[?&](l|s)=/);
    expect([out.width, out.height]).toEqual([1200, 630]);
    expect(await decodedSizeOf(route, out.url)).toEqual([1200, 630]);
  });

  it('measure over the budget -> the same legacy fallback, never a wait past the budget', async () => {
    const { dl } = await load(mode);
    io.baked = null;
    const t0 = Date.now();
    const out = await dl.resolveOgCardImageSized({
      entityType: 'event', entityId: ID, coverUrl: 'https://media.bachatacalendar.co.uk/events/covers/flyer.jpg',
      request: REQUEST, fallbackImage: 'x', measureBudgetMs: 50,
      measureWholeFlyer: () => new Promise(() => { /* hangs */ }),
    });
    expect(Date.now() - t0).toBeLessThan(1000);
    expect(out.legacyFallback).toBe(mode.wholeFlyer);
    expect([out.width, out.height]).toEqual([1200, 630]);
  });

  it('festival is always legacy whatever the mode (out of B1)', async () => {
    const { dl } = await load(mode);
    io.baked = `${MEDIA}-wf1-960x1200.jpg`;
    const out = await dl.resolveOgCardImageSized({
      entityType: 'festival', entityId: ID, coverUrl: 'https://x/c.jpg', request: REQUEST, fallbackImage: 'x',
      measureWholeFlyer: async () => ({ width: 960, height: 1200 }),
    });
    expect(out.url).not.toMatch(/[?&]l=/);
    expect([out.width, out.height]).toEqual([1200, 630]);
  });
});

describe('ogLayoutFor parse rules (D3)', () => {
  it.each([
    ['On', ID, 'legacy'], ['ON', ID, 'legacy'], [' on ', ID, 'wf1'], ['allowlist', '', 'legacy'],
    ['allowlist', 'not-a-uuid', 'legacy'], ['test', ID, 'legacy'], ['', ID, 'legacy'], ['bogus', ID, 'legacy'],
  ])('mode %j ids %j -> %s for the event', async (m, ids, want) => {
    const { dl } = await load({ name: 'x', mode: m, ids, wholeFlyer: false });
    void dl;
    const layout = await import('../app/lib/ogLayout');
    expect(layout.ogLayoutFor('event', ID)).toBe(want);
  });
});

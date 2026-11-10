// @vitest-environment node
/**
 * resolveOgTallPreview: the og:image URL + size /event?ogtest=tall declares.
 * The size must match the bytes /api/og/card?layout=tall will render, so it is
 * computed from the same flyer (fetchEventCardData's coverUrl) with the same
 * function (tallCardSizeFor, real sharp). Any miss returns null so the page
 * keeps its normal og:image.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import sharp from 'sharp';

vi.mock('@/integrations/supabase/client', () => ({ supabase: {} }));
vi.mock('@/lib/seo/resolvePublicEventRef', () => ({ resolvePublicEventRef: async () => null }));
vi.mock('@/modules/event-page/useFestivalDetailQuery', () => ({ fetchFestivalDetail: async () => null }));

const io = vi.hoisted(() => ({
  card: null as null | { coverUrl: string | null },
  bytes: null as null | Buffer,
  throws: false,
}));
vi.mock('../app/lib/ogCardRender', async (importOriginal) => {
  const real = await importOriginal<typeof import('../app/lib/ogCardRender')>();
  return {
    ...real,
    fetchEventCardData: async () => {
      if (io.throws) throw new Error('rpc down');
      return io.card ? { title: 't', dateLine: null, venueLine: null, eventType: null, ...io.card } : null;
    },
    fetchImageBytes: async () => io.bytes,
  };
});

const ID = 'c81746db-945b-47af-bdca-501886e105e0';
const OCC = '11111111-2222-3333-4444-555555555555';
const req = new Request('https://www.bachatacalendar.co.uk/event/sensual-wednesday?ogtest=tall');
const img = (w: number, h: number) =>
  sharp({ create: { width: w, height: h, channels: 3, background: { r: 9, g: 9, b: 9 } } }).jpeg().toBuffer();

async function run(coverUrl: string | null = 'https://media.bachatacalendar.co.uk/events/x/flyer.webp?w=1') {
  const { resolveOgTallPreview } = await import('../app/lib/ogTallPreview.server');
  return resolveOgTallPreview({ eventId: ID, occId: OCC, coverUrl, request: req });
}

describe('resolveOgTallPreview', () => {
  beforeEach(() => {
    io.card = { coverUrl: 'https://media.bachatacalendar.co.uk/events/x/flyer.webp' };
    io.bytes = null;
    io.throws = false;
  });

  it.each([
    [1080, 1350, 960, 1200],
    [1080, 1920, 960, 1200],
    [1080, 1080, 960, 960],
    [1600, 900, 1200, 630],
  ])('%ix%i flyer -> layout=tall URL declared %ix%i', async (w, h, cw, ch) => {
    io.bytes = await img(w, h);
    const out = await run();
    expect(out).not.toBeNull();
    const u = new URL(out!.url);
    expect(u.origin + u.pathname).toBe('https://www.bachatacalendar.co.uk/api/og/card');
    expect(Object.fromEntries(u.searchParams)).toEqual({ kind: 'event', id: ID, occ: OCC, v: 'flyer.webp', layout: 'tall' });
    expect([out!.width, out!.height]).toEqual([cw, ch]);
  });

  it.each([
    ['no page cover (no v token)', () => {}, null],
    ['card data has no cover', () => { io.card = { coverUrl: null }; }, undefined],
    ['card data unavailable', () => { io.card = null; }, undefined],
    ['flyer unfetchable', () => { io.bytes = null; }, undefined],
    ['card data throws', () => { io.throws = true; }, undefined],
  ] as const)('%s -> null (page keeps normal og:image)', async (_n, setup, cover) => {
    io.bytes = await img(1080, 1350);
    setup();
    expect(await run(cover === null ? null : undefined)).toBeNull();
  });
});

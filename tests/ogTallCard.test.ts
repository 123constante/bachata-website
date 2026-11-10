// @vitest-environment node
/**
 * TEST-ONLY tall OG card (docs/briefs/og-tall-card-test.md), driven end to end
 * through the real /api/og/card loader with REAL sharp. Only the data layer
 * (event resolve, card data, flyer fetch) is stubbed.
 *
 * Every flyer shape the brief names, with and without layout=tall:
 *   - card size (960 wide, ratio max(r, 0.8); r >= 1.3 keeps 1200x630)
 *   - JPEG, <= 300 KB
 *   - the WHOLE flyer is on the card: the flyer carries a 10% magenta frame
 *     around a white middle, and the four corners just inside the expected
 *     fit:inside box must read full-bright magenta. A crop would put white
 *     (or the darkened backdrop) there instead.
 *   - X-OG-Fallback marker identical to the layout-less request (no flyer,
 *     unfetchable flyer)
 *
 * Red on main: layout=tall was ignored, so every portrait shape came back
 * 1200x630 and the size rows failed.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import sharp from 'sharp';

vi.mock('@/integrations/supabase/client', () => ({ supabase: {} }));
vi.mock('@/lib/seo/resolvePublicEventRef', () => ({ resolvePublicEventRef: async () => null }));
vi.mock('@/modules/event-page/useFestivalDetailQuery', () => ({ fetchFestivalDetail: async () => null }));

const io = vi.hoisted(() => ({
  coverUrl: null as null | string,
  bytes: null as null | Buffer,
}));

vi.mock('../app/lib/ogCardRender', async (importOriginal) => {
  const real = await importOriginal<typeof import('../app/lib/ogCardRender')>();
  return {
    ...real,
    resolveOgEventId: async (p: string) => p,
    fetchEventCardData: async () => ({
      title: 'Sensual Wednesday',
      dateLine: 'Wednesday 5 November',
      venueLine: 'The Dance Studio',
      coverUrl: io.coverUrl,
      eventType: 'party',
    }),
    fetchFestivalCardData: async () => null,
    fetchImageBytes: async () => io.bytes,
  };
});

const MAGENTA = { r: 255, g: 0, b: 255 };

async function flyer(w: number, h: number, format: 'jpeg' | 'webp' = 'jpeg'): Promise<Buffer> {
  const inset = Math.max(1, Math.round(Math.min(w, h) * 0.1));
  const middle = await sharp({
    create: { width: w - inset * 2, height: h - inset * 2, channels: 3, background: { r: 255, g: 255, b: 255 } },
  }).png().toBuffer();
  const img = sharp({ create: { width: w, height: h, channels: 3, background: MAGENTA } })
    .composite([{ input: middle, left: inset, top: inset }]);
  return format === 'webp' ? img.webp({ quality: 90 }).toBuffer() : img.jpeg({ quality: 92 }).toBuffer();
}

type Shape = {
  name: string;
  w: number;
  h: number;
  format?: 'jpeg' | 'webp';
  card: [number, number];
};

// Expected card for layout=tall. Wide shapes (r >= 1.3) keep the normal card.
const SHAPES: Shape[] = [
  { name: 'portrait 4:5', w: 1080, h: 1350, card: [960, 1200] },
  { name: 'tall 9:16', w: 1080, h: 1920, card: [960, 1200] },
  { name: 'square', w: 1080, h: 1080, card: [960, 960] },
  { name: 'landscape 16:9', w: 1600, h: 900, card: [1200, 630] },
  { name: 'wide 3:1', w: 1800, h: 600, card: [1200, 630] },
  { name: 'tiny 2:3', w: 40, h: 60, card: [960, 1200] },
  { name: 'WebP source 4:5', w: 1080, h: 1350, format: 'webp', card: [960, 1200] },
];

async function get(qs: string): Promise<Response> {
  const { loader } = await import('../app/routes/api.og.card');
  return loader({ request: new Request(`https://www.bachatacalendar.co.uk/api/og/card?${qs}`) } as never);
}

/** fit:inside box of a w x h flyer on a W x H canvas, centred. */
function containBox(w: number, h: number, W: number, H: number) {
  const s = Math.min(W / w, H / h);
  const bw = Math.round(w * s);
  const bh = Math.round(h * s);
  const left = Math.floor((W - bw) / 2);
  const top = Math.floor((H - bh) / 2);
  return { left, top, right: left + bw - 1, bottom: top + bh - 1 };
}

async function expectWholeFlyer(buf: Buffer, s: Shape, W: number, H: number) {
  const { data, info } = await sharp(buf).removeAlpha().raw().toBuffer({ resolveWithObject: true });
  const px = (x: number, y: number) => {
    const i = (y * info.width + x) * info.channels;
    return { r: data[i], g: data[i + 1], b: data[i + 2] };
  };
  const box = containBox(s.w, s.h, W, H);
  const d = 3; // inside the box, clear of JPEG ringing at the very edge
  const corners = [
    [box.left + d, box.top + d],
    [box.right - d, box.top + d],
    [box.left + d, box.bottom - d],
    [box.right - d, box.bottom - d],
  ];
  for (const [x, y] of corners) {
    const p = px(x, y);
    expect(p.r, `${s.name} corner ${x},${y} red`).toBeGreaterThan(200);
    expect(p.g, `${s.name} corner ${x},${y} green`).toBeLessThan(70);
    expect(p.b, `${s.name} corner ${x},${y} blue`).toBeGreaterThan(200);
  }
  // And the middle is the flyer's white, not frame: the frame is not stretched.
  const mid = px(Math.round((box.left + box.right) / 2), Math.round((box.top + box.bottom) / 2));
  expect(mid.g, `${s.name} middle`).toBeGreaterThan(200);
}

describe('/api/og/card layout=tall: every flyer shape', () => {
  beforeEach(() => {
    io.coverUrl = 'https://media.bachatacalendar.co.uk/events/x/flyer.jpg';
    io.bytes = null;
  });

  it.each(SHAPES)('$name -> $card, JPEG <= 300 KB, whole flyer, unmarked', async (s) => {
    io.bytes = await flyer(s.w, s.h, s.format);
    const res = await get('kind=event&id=e1&v=flyer.jpg&layout=tall');
    expect(res.status).toBe(200);
    expect(res.headers.get('Content-Type')).toBe('image/jpeg');
    expect(res.headers.get('X-OG-Fallback')).toBeNull();
    // Test-only card: short cache, no year-long CDN entry (renderer may be tuned).
    expect(res.headers.get('Cache-Control')).toBe('public, max-age=3600');
    expect(res.headers.get('Vercel-CDN-Cache-Control')).toBeNull();
    const buf = Buffer.from(await res.arrayBuffer());
    expect(buf.length).toBeLessThanOrEqual(300 * 1024);
    const meta = await sharp(buf).metadata();
    expect(meta.format).toBe('jpeg');
    expect([meta.width, meta.height]).toEqual(s.card);
    await expectWholeFlyer(buf, s, s.card[0], s.card[1]);

    // The size the /event meta declares comes from the same function.
    const { tallCardSizeFor } = await import('../app/lib/ogCardRender');
    expect(await tallCardSizeFor(io.bytes)).toEqual({ width: s.card[0], height: s.card[1] });
  }, 30_000);

  it.each(SHAPES)('$name without layout -> unchanged 1200x630 card', async (s) => {
    io.bytes = await flyer(s.w, s.h, s.format);
    const res = await get('kind=event&id=e1&v=flyer.jpg');
    const meta = await sharp(Buffer.from(await res.arrayBuffer())).metadata();
    expect([meta.width, meta.height]).toEqual([1200, 630]);
    expect(res.headers.get('X-OG-Fallback')).toBeNull();
    expect(res.headers.get('Vercel-CDN-Cache-Control')).not.toBeNull();
  }, 30_000);

  it.each([
    ['no flyer', null, 'cover-absent'],
    ['unfetchable flyer', 'https://media.bachatacalendar.co.uk/dead.jpg', 'cover-unfetchable'],
  ] as const)('%s -> same fallback card and marker as without layout', async (_n, cover, reason) => {
    io.coverUrl = cover;
    io.bytes = null;
    const tall = await get('kind=event&id=e1&v=flyer.jpg&layout=tall');
    const plain = await get('kind=event&id=e1&v=flyer.jpg');
    for (const res of [tall, plain]) {
      expect(res.status).toBe(200);
      expect(res.headers.get('X-OG-Fallback')).toBe(reason);
      const meta = await sharp(Buffer.from(await res.arrayBuffer())).metadata();
      expect([meta.width, meta.height]).toEqual([1200, 630]);
    }
    expect(tall.headers.get('Cache-Control')).toBe(plain.headers.get('Cache-Control'));
  }, 30_000);

  it('etag: layout=tall gets its own; any other value (or kind) is ignored', async () => {
    io.bytes = await flyer(1080, 1350);
    const etag = async (qs: string) => (await get(qs)).headers.get('ETag');
    const plain = await etag('kind=event&id=e1&v=flyer.jpg');
    const tall = await etag('kind=event&id=e1&v=flyer.jpg&layout=tall');
    expect(plain).toBeTruthy();
    expect(tall).toBeTruthy();
    expect(tall).not.toBe(plain);
    expect(await etag('kind=event&id=e1&v=flyer.jpg&layout=wide')).toBe(plain);
    // A tall etag 304s only against the tall URL.
    const { loader } = await import('../app/routes/api.og.card');
    const cond = (qs: string) =>
      loader({
        request: new Request(`https://www.bachatacalendar.co.uk/api/og/card?${qs}`, {
          headers: { 'if-none-match': tall as string },
        }),
      } as never);
    expect((await cond('kind=event&id=e1&v=flyer.jpg&layout=tall')).status).toBe(304);
    expect((await cond('kind=event&id=e1&v=flyer.jpg')).status).toBe(200);
  }, 30_000);

  it('plain etag is byte-identical to the pre-change hash', async () => {
    // Pinned from main before this change: sha1("event:e1:::flyer.jpg"), 24 chars.
    const { createHash } = await import('node:crypto');
    const expected = `"${createHash('sha1').update('event:e1:::flyer.jpg').digest('base64url').slice(0, 24)}"`;
    io.bytes = await flyer(1080, 1350);
    expect((await get('kind=event&id=e1&v=flyer.jpg')).headers.get('ETag')).toBe(expected);
  }, 30_000);
});

describe('tallCardSize', () => {
  it.each([
    [1080, 1350, { width: 960, height: 1200 }],
    [1080, 1920, { width: 960, height: 1200 }],
    [1000, 1000, { width: 960, height: 960 }],
    [1200, 1000, { width: 960, height: 800 }],
    [1290, 1000, { width: 960, height: 744 }],
    [1300, 1000, null],
    [1600, 900, null],
    [0, 100, null],
  ])('%i x %i -> %o', async (w, h, want) => {
    const { tallCardSize } = await import('../app/lib/ogCardRender');
    expect(tallCardSize(w, h)).toEqual(want);
  });

  it('a noisy 9:16 flyer still fits the 300 KB budget (quality steps down)', async () => {
    const { buildTallCard } = await import('../app/lib/ogCardRender');
    const w = 1080, h = 1920;
    const noise = Buffer.alloc(w * h * 3);
    let seed = 7;
    for (let i = 0; i < noise.length; i++) { seed = (seed * 1103515245 + 12345) & 0x7fffffff; noise[i] = seed & 0xff; }
    const src = await sharp(noise, { raw: { width: w, height: h, channels: 3 } }).jpeg({ quality: 90 }).toBuffer();
    const out = await buildTallCard(src, { title: 't', dateLine: null, venueLine: null, coverUrl: 'x', eventType: null });
    const meta = await sharp(out).metadata();
    expect([meta.width, meta.height]).toEqual([960, 1200]);
    // Pure noise is the worst case a flyer can be (measured ~218 KB).
    expect(out.length).toBeLessThanOrEqual(300 * 1024);
  }, 30_000);
});

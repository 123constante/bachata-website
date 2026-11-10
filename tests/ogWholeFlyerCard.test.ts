/**
 * Acceptance matrix 2 of docs/briefs/whole-flyer-og-b1.md: the flyer shapes
 * F1 to F8 and F15 to F18 of docs/design/whatsapp-whole-flyer.CONTRACT.md,
 * every one a REAL sharp render through the real /api/og/card route (only the
 * RPC and the cover fetch are stubbed; no real flyer is fetched).
 *
 * For each shape: decoded size == the D1 canvas rule == the s= in the URL;
 * JPEG; <= 300 KB; the whole flyer is on the canvas (a magenta frame drawn
 * round each synthetic flyer is found at all four edges of where fit:inside
 * puts it); the middle of the flyer is the flyer's own white (nothing drawn
 * over it -- no text). Plus: the pure-noise worst case, a cover whose ratio
 * changed after the size was declared, two etags/two sizes for l-less vs
 * l=wf1, and the five preview samples written to a temp dir.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import sharp from 'sharp';
import { mkdirSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

vi.mock('@/integrations/supabase/client', () => ({ supabase: {} }));
vi.mock('@/lib/seo/resolvePublicEventRef', () => ({ resolvePublicEventRef: async () => null }));
vi.mock('@/modules/event-page/useFestivalDetailQuery', () => ({ fetchFestivalDetail: async () => null }));

const io = vi.hoisted(() => ({
  coverUrl: 'https://media.bachatacalendar.co.uk/events/covers/flyer.jpg' as null | string,
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
      venueLine: 'at The Dance Studio',
      coverUrl: io.coverUrl,
      eventType: 'party',
    }),
    fetchFestivalCardData: async () => null,
    fetchImageBytes: async () => io.bytes,
  };
});

import { loader } from '../app/routes/api.og.card';
import { buildWholeFlyerCard, wholeFlyerCanvasFor, TALL_CARD_MAX_BYTES } from '../app/lib/ogCardRender';
import { wholeFlyerCanvas } from '../app/lib/ogLayout';

const ID = 'c81746db-945b-47af-bdca-501886e105e0';
const BASE = `https://www.bachatacalendar.co.uk/api/og/card?kind=event&id=${ID}&v=flyer.jpg`;
const MAGENTA = { r: 255, g: 0, b: 255 };

type Fmt = 'jpeg' | 'webp' | 'png-alpha' | 'gif-animated' | 'cmyk' | 'png16' | 'exif6';

/** A white flyer with a magenta frame (10% of the short side). */
async function flyer(w: number, h: number, fmt: Fmt = 'jpeg'): Promise<Buffer> {
  const inset = Math.max(2, Math.round(Math.min(w, h) * 0.1));
  const white = await sharp({ create: { width: w - inset * 2, height: h - inset * 2, channels: 3, background: { r: 255, g: 255, b: 255 } } }).png().toBuffer();
  const base = sharp({ create: { width: w, height: h, channels: 3, background: MAGENTA } }).composite([{ input: white, left: inset, top: inset }]);
  switch (fmt) {
    case 'webp': return base.webp({ quality: 90 }).toBuffer();
    case 'png-alpha': {
      // Opaque frame + white middle, fully transparent outer 0 px: alpha on
      // the WHOLE image at 255 except a transparent 1-px-wide corner region,
      // so the file really carries an alpha channel.
      const rgba = await base.ensureAlpha().raw().toBuffer({ resolveWithObject: true });
      for (let i = 0; i < 4; i++) rgba.data[i * 4 + 3] = 0;
      return sharp(rgba.data, { raw: rgba.info }).png().toBuffer();
    }
    case 'gif-animated': {
      const first = await base.png().toBuffer();
      const second = await sharp({ create: { width: w, height: h, channels: 3, background: { r: 0, g: 255, b: 0 } } }).png().toBuffer();
      return sharp([first, second], { join: { animated: true } }).gif().toBuffer();
    }
    case 'cmyk': return base.toColourspace('cmyk').jpeg({ quality: 92 }).toBuffer();
    case 'png16': return base.toColourspace('rgb16').png().toBuffer();
    case 'exif6': {
      // Stored w x h, displays rotated 90 degrees: the canvas must follow the
      // DISPLAY size (h x w), as the render applies .rotate().
      return base.jpeg({ quality: 92 }).withMetadata({ orientation: 6 }).toBuffer();
    }
    default: return base.jpeg({ quality: 92 }).toBuffer();
  }
}

async function noise(w: number, h: number): Promise<Buffer> {
  const raw = Buffer.alloc(w * h * 3);
  let x = 12345;
  for (let i = 0; i < raw.length; i++) { x = (x * 1103515245 + 12345) & 0x7fffffff; raw[i] = x >> 16; }
  return sharp(raw, { raw: { width: w, height: h, channels: 3 } }).jpeg({ quality: 95 }).toBuffer();
}

async function get(url: string, headers: Record<string, string> = {}): Promise<Response> {
  return loader({ request: new Request(url, { headers }) } as never);
}

function wfUrl(w: number, h: number): string {
  return `${BASE}&l=wf1&s=${w}x${h}`;
}

async function pixel(buf: Buffer, x: number, y: number): Promise<[number, number, number]> {
  const { data, info } = await sharp(buf).removeAlpha().raw().toBuffer({ resolveWithObject: true });
  const i = (Math.round(y) * info.width + Math.round(x)) * info.channels;
  return [data[i], data[i + 1], data[i + 2]];
}
// b > 120, not > 190: a CMYK source cannot hold sRGB magenta, and its ICC
// round trip lands near (226, 55, 137). The darkened backdrop (x0.6) can never
// reach r > 190, so this still tells the flyer from the blur.
const isMagenta = ([r, g, b]: number[]) => r > 190 && g < 90 && b > 120;
const isWhite = ([r, g, b]: number[]) => r > 225 && g > 225 && b > 225;

/** The four flyer edges lie inside the canvas: the magenta frame is found just
 *  inside each edge of the fit:inside rectangle, and the middle is white. */
async function assertWholeFlyerPresent(card: Buffer, W: number, H: number, dispW: number, dispH: number) {
  const scale = Math.min(W / dispW, H / dispH);
  const fw = dispW * scale;
  const fh = dispH * scale;
  const left = (W - fw) / 2;
  const top = (H - fh) / 2;
  const band = Math.min(fw, fh) * 0.05; // half the 10% frame
  const cx = W / 2;
  const cy = H / 2;
  expect(isMagenta(await pixel(card, left + band, cy)), 'left edge').toBe(true);
  expect(isMagenta(await pixel(card, left + fw - band, cy)), 'right edge').toBe(true);
  expect(isMagenta(await pixel(card, cx, top + band)), 'top edge').toBe(true);
  expect(isMagenta(await pixel(card, cx, top + fh - band)), 'bottom edge').toBe(true);
  expect(isWhite(await pixel(card, cx, cy)), 'flyer middle untouched (no text over it)').toBe(true);
}

type Shape = { code: string; name: string; w: number; h: number; fmt?: Fmt; disp?: [number, number]; canvas: [number, number] };

const SHAPES: Shape[] = [
  { code: 'F1', name: 'very tall 0.56', w: 560, h: 1000, canvas: [960, 1200] },
  { code: 'F2', name: 'tall 0.75', w: 750, h: 1000, canvas: [960, 1200] },
  { code: 'F3', name: 'portrait 0.9', w: 900, h: 1000, canvas: [960, 1067] },
  { code: 'F4', name: 'square 1.0', w: 1000, h: 1000, canvas: [960, 960] },
  { code: 'F4', name: 'landscape 1.2', w: 1200, h: 1000, canvas: [960, 800] },
  { code: 'F5', name: 'wide 1.59', w: 1590, h: 1000, canvas: [960, 604] },
  { code: 'F5', name: 'wide 1.82', w: 1820, h: 1000, canvas: [960, 527] },
  { code: 'F6', name: 'ultra wide 2.28', w: 2280, h: 1000, canvas: [960, 503] },
  { code: 'F6', name: 'ultra wide 3.14', w: 3140, h: 1000, canvas: [960, 503] },
  { code: 'F7', name: 'tiny, short side 373', w: 373, h: 500, canvas: [960, 1200] },
  { code: 'F8', name: 'huge, long side 4500', w: 3000, h: 4500, canvas: [960, 1200] },
  { code: 'F15', name: 'PNG with transparency', w: 800, h: 1000, fmt: 'png-alpha', canvas: [960, 1200] },
  { code: 'F16', name: 'animated GIF (first frame)', w: 900, h: 900, fmt: 'gif-animated', canvas: [960, 960] },
  { code: 'F17', name: 'CMYK JPEG', w: 1000, h: 800, fmt: 'cmyk', canvas: [960, 768] },
  { code: 'F17', name: '16-bit PNG', w: 800, h: 1000, fmt: 'png16', canvas: [960, 1200] },
  { code: 'F18', name: 'EXIF-rotated (orientation 6)', w: 1000, h: 600, fmt: 'exif6', disp: [600, 1000], canvas: [960, 1200] },
  { code: '-', name: 'WebP source', w: 1080, h: 1350, fmt: 'webp', canvas: [960, 1200] },
];

beforeEach(() => {
  io.coverUrl = 'https://media.bachatacalendar.co.uk/events/covers/flyer.jpg';
  io.bytes = null;
});

describe('whole-flyer card: every flyer shape, real sharp render through /api/og/card', () => {
  it.each(SHAPES)('$code $name -> $canvas', async (s) => {
    io.bytes = await flyer(s.w, s.h, s.fmt);
    const [W, H] = s.canvas;
    // The canvas rule, measured the way the page measures (display size).
    expect(await wholeFlyerCanvasFor(io.bytes)).toEqual({ width: W, height: H });
    const [dw, dh] = s.disp ?? [s.w, s.h];
    expect(wholeFlyerCanvas(dw, dh)).toEqual({ width: W, height: H });

    const t0 = Date.now();
    const res = await get(wfUrl(W, H));
    const ms = Date.now() - t0;
    expect(res.status).toBe(200);
    expect(res.headers.get('X-OG-Fallback')).toBeNull();
    expect(res.headers.get('X-OG-Layout')).toBe('wf1');
    expect(res.headers.get('Content-Type')).toBe('image/jpeg');
    expect(res.headers.get('Cache-Control')).toBe('public, max-age=3600');
    expect(res.headers.get('Vercel-CDN-Cache-Control')).toBeNull();
    const buf = Buffer.from(await res.arrayBuffer());
    const meta = await sharp(buf).metadata();
    expect(meta.format).toBe('jpeg');
    expect([meta.width, meta.height]).toEqual([W, H]);
    expect(buf.length).toBeLessThanOrEqual(TALL_CARD_MAX_BYTES);
    await assertWholeFlyerPresent(buf, W, H, dw, dh);
    if (s.code === 'F8') expect(ms, 'huge flyer renders inside the 2500 ms page budget').toBeLessThan(2500);
  });

  it('F16 animated: only the FIRST frame is drawn (magenta frame, never the green second frame)', async () => {
    io.bytes = await flyer(900, 900, 'gif-animated');
    const buf = Buffer.from(await (await get(wfUrl(960, 960))).arrayBuffer());
    const [r, g, b] = await pixel(buf, 480, 480);
    expect(isWhite([r, g, b])).toBe(true);
  });
});

describe('size ceiling (D6): pure-noise 1536x1920 worst case', () => {
  it('reaches a rung that fits, or the SAME-SIZE card marked over-budget -- never a 1200x630 swap', async () => {
    io.bytes = await noise(1536, 1920);
    const card = await buildWholeFlyerCard(io.bytes, { width: 960, height: 1200 });
    const meta = await sharp(card.buf).metadata();
    expect([meta.width, meta.height]).toEqual([960, 1200]);
    expect(card.overBudget).toBe(card.buf.length > TALL_CARD_MAX_BYTES);

    const res = await get(wfUrl(960, 1200));
    const buf = Buffer.from(await res.arrayBuffer());
    const rm = await sharp(buf).metadata();
    expect([rm.width, rm.height]).toEqual([960, 1200]);
    if (buf.length > TALL_CARD_MAX_BYTES) expect(res.headers.get('X-OG-Fallback')).toBe('over-budget');
    else expect(res.headers.get('X-OG-Fallback')).toBeNull();
  });

  it('the q58 rung is load-bearing: noise that does not fit at q66 still fits', async () => {
    // Measured by the contract (D6): 960x1200 noise is ~267 KB at q66 and
    // ~217 KB at q58; a 1536x1920 source downscaled is smoother than that,
    // so this pins only that the ladder ends inside the budget.
    io.bytes = await noise(1536, 1920);
    const card = await buildWholeFlyerCard(io.bytes, { width: 960, height: 1200 });
    expect(card.overBudget).toBe(false);
    expect(card.buf.length).toBeLessThanOrEqual(TALL_CARD_MAX_BYTES);
  });
});

describe('identity by URL (D4 b, b2)', () => {
  it('an l=wf1 URL whose cover has since changed ratio still returns exactly s', async () => {
    io.bytes = await flyer(1820, 1000); // now wide; the URL was declared for a 4:5 flyer
    const res = await get(wfUrl(960, 1200));
    const meta = await sharp(Buffer.from(await res.arrayBuffer())).metadata();
    expect([meta.width, meta.height]).toEqual([960, 1200]);
    expect(res.headers.get('X-OG-Fallback')).toBeNull();
  });

  it('same entity, l absent vs l=wf1: two etags and two sizes', async () => {
    io.bytes = await flyer(750, 1000);
    const legacy = await get(BASE);
    const wf = await get(wfUrl(960, 1200));
    expect(legacy.headers.get('ETag')).toBeTruthy();
    expect(wf.headers.get('ETag')).toBeTruthy();
    expect(legacy.headers.get('ETag')).not.toBe(wf.headers.get('ETag'));
    const lm = await sharp(Buffer.from(await legacy.arrayBuffer())).metadata();
    const wm = await sharp(Buffer.from(await wf.arrayBuffer())).metadata();
    expect([lm.width, lm.height]).toEqual([1200, 630]);
    expect([wm.width, wm.height]).toEqual([960, 1200]);
    // l-less carries no new header (mode off stays byte-identical, r3 R3).
    expect(legacy.headers.get('X-OG-Layout')).toBeNull();
    // s is in the etag too.
    const wf2 = await get(wfUrl(960, 960));
    expect(wf2.headers.get('ETag')).not.toBe(wf.headers.get('ETag'));
  });

  it('l=wf1 with a valid etag answers 304 without any render', async () => {
    io.bytes = await flyer(750, 1000);
    const first = await get(wfUrl(960, 1200));
    const etag = first.headers.get('ETag') as string;
    io.bytes = null; // a render would now be degraded; the 304 must not reach it
    const again = await get(wfUrl(960, 1200), { 'if-none-match': etag });
    expect(again.status).toBe(304);
  });

  it.each(['960x1201', '960x502', '1200x630', '960x', 'abc', ''])('s=%s outside D1 -> legacy-fallback path, marked, short cache', async (s) => {
    io.bytes = await flyer(750, 1000);
    const res = await get(`${BASE}&l=wf1&s=${s}`);
    expect(res.status).toBe(200);
    expect(res.headers.get('X-OG-Layout')).toBe('legacy-fallback');
    expect(res.headers.get('X-OG-Fallback')).toBe('wf-size-invalid');
    expect(res.headers.get('ETag')).toBeNull();
    expect(res.headers.get('Cache-Control')).toBe('public, max-age=300');
    const meta = await sharp(Buffer.from(await res.arrayBuffer())).metadata();
    expect([meta.width, meta.height]).toEqual([1200, 630]);
  });

  it('every degraded 200 under l=wf1 is drawn at the URL canvas and keeps its marker', async () => {
    io.bytes = null; // cover-unfetchable
    const res = await get(wfUrl(960, 604));
    expect(res.status).toBe(200);
    expect(res.headers.get('X-OG-Fallback')).toBe('cover-unfetchable');
    expect(res.headers.get('X-OG-Layout')).toBe('wf1');
    let meta = await sharp(Buffer.from(await res.arrayBuffer())).metadata();
    expect([meta.width, meta.height]).toEqual([960, 604]);

    io.coverUrl = null; // cover-absent
    const res2 = await get(wfUrl(960, 1200));
    expect(res2.headers.get('X-OG-Fallback')).toBe('cover-absent');
    meta = await sharp(Buffer.from(await res2.arrayBuffer())).metadata();
    expect([meta.width, meta.height]).toEqual([960, 1200]);
  });

  it('festival with l=wf1 is the unchanged legacy card (festivals out of B1)', async () => {
    const res = await get(`https://www.bachatacalendar.co.uk/api/og/card?kind=festival&id=${ID}&v=x&l=wf1&s=960x1200`);
    expect(res.headers.get('X-OG-Layout')).toBeNull();
  });
});

describe('five preview samples for the lead (written to a temp dir)', () => {
  it('very tall 0.56, tall 0.75, square 1.0, wide 1.78, ultra wide 3.14', async () => {
    const dir = join(tmpdir(), 'og-whole-flyer-samples');
    mkdirSync(dir, { recursive: true });
    const samples: [string, number, number][] = [
      ['very-tall-0.56', 560, 1000], ['tall-0.75', 750, 1000], ['square-1.0', 1000, 1000],
      ['wide-1.78', 1780, 1000], ['ultra-wide-3.14', 3140, 1000],
    ];
    const lines: string[] = [];
    for (const [name, w, h] of samples) {
      const src = await flyer(w, h);
      const canvas = await wholeFlyerCanvasFor(src);
      const card = await buildWholeFlyerCard(src, canvas!);
      const meta = await sharp(card.buf).metadata();
      writeFileSync(join(dir, `${name}.jpg`), card.buf);
      lines.push(`${name}: ${card.buf.length} bytes, decoded ${meta.width}x${meta.height}`);
      expect(card.overBudget).toBe(false);
    }
    console.log(`[og-wf-samples] ${dir}\n${lines.join('\n')}`);
  });
});

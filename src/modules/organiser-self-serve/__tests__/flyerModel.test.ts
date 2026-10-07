/**
 * The organiser flyer pipeline (flyerModel): checks before upload, the
 * signature sniff (SVG/HTML dressed as an image is refused), the canvas
 * re-encode (canvas mocked: node has none), the storage path, and the exact
 * series.upsert the save sends. The storage path rule is pinned against the
 * admin policy's own regex (migration 20261109600000).
 */
import { describe, expect, it, vi } from 'vitest';
import {
  FLYER_BUCKET,
  FLYER_BUCKET_LIMIT_BYTES,
  FLYER_MAX_EDGE,
  FLYER_MAX_INPUT_BYTES,
  FLYER_MIN_EDGE,
  FLYER_TARGET_BYTES,
  FlyerError,
  checkFlyerBytes,
  checkFlyerFile,
  fitWithin,
  flyerCoverCommand,
  flyerObjectPath,
  isOwnFlyerUrl,
  randomFlyerToken,
  reencodeFlyer,
  sniffImageBytes,
  type FlyerCanvas,
  type ReencodeDeps,
} from '../flyerModel';
import { flyerUploadProblem } from '../flyerUploadApi';
import { OWNER_UPSERT_KEYS } from '../seriesCommands';

vi.mock('@/integrations/supabase/client', () => ({ supabase: {} }));

const SID = '0f8fad5b-d9cb-469f-a165-70867728950e';
// Lifted verbatim from the admin storage policy organiser_flyers_insert_own_series.
const ADMIN_POLICY_PATH_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\/[0-9a-f]{32}\.(jpg|png|webp)$/;

const bytes = (...b: number[]) => new Uint8Array(b);
const text = (s: string) => new TextEncoder().encode(s);
const JPEG = bytes(0xff, 0xd8, 0xff, 0xe0, 0, 0x10, 0x4a, 0x46, 0x49, 0x46);
const PNG = bytes(0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 0x0d);
const WEBP = new Uint8Array([...text('RIFF'), 0x24, 0, 0, 0, ...text('WEBPVP8 ')]);

describe('checkFlyerFile (type and size, before anything is read)', () => {
  it('admits JPEG, PNG and WebP up to 10 MB', () => {
    for (const type of ['image/jpeg', 'image/png', 'image/webp']) {
      expect(checkFlyerFile({ type, size: 1 })).toBeNull();
      expect(checkFlyerFile({ type, size: FLYER_MAX_INPUT_BYTES })).toBeNull();
    }
  });
  it('refuses other types, including SVG, GIF, HEIC and HTML', () => {
    for (const type of ['image/svg+xml', 'image/gif', 'image/heic', 'text/html', 'application/pdf']) {
      expect(checkFlyerFile({ type, size: 100 })).toBe('type');
    }
  });
  it('refuses a file over 10 MB and an empty file', () => {
    expect(checkFlyerFile({ type: 'image/jpeg', size: FLYER_MAX_INPUT_BYTES + 1 })).toBe('too_big');
    expect(checkFlyerFile({ type: 'image/png', size: 0 })).toBe('empty');
  });
  it('leaves a file with no reported type to the signature check', () => {
    expect(checkFlyerFile({ type: '', size: 100 })).toBeNull();
  });
});

describe('sniffImageBytes / checkFlyerBytes (what the bytes really are)', () => {
  it('recognises the three signatures', () => {
    expect(sniffImageBytes(JPEG)).toBe('image/jpeg');
    expect(sniffImageBytes(PNG)).toBe('image/png');
    expect(sniffImageBytes(WEBP)).toBe('image/webp');
  });
  it('calls SVG and HTML markup what it is, however it is dressed', () => {
    for (const s of ['<svg xmlns="http://www.w3.org/2000/svg"><script>alert(1)</script></svg>',
      '<?xml version="1.0"?><svg/>', '<!DOCTYPE html><html><body>x</body></html>', '  \n\t<html>', '<script>x</script>']) {
      expect(sniffImageBytes(text(s))).toBe('markup');
    }
    expect(sniffImageBytes(new Uint8Array([0xef, 0xbb, 0xbf, ...text('<svg/>')]))).toBe('markup');
    expect(sniffImageBytes(new Uint8Array([0xff, 0xfe, 0x3c, 0x00, 0x73, 0x00]))).toBe('markup');
  });
  it('knows nothing else', () => {
    expect(sniffImageBytes(text('GIF89a....'))).toBeNull();
    expect(sniffImageBytes(text('%PDF-1.7'))).toBeNull();
    expect(sniffImageBytes(text('RIFF....AVI '))).toBeNull();
    expect(sniffImageBytes(new Uint8Array())).toBeNull();
  });
  it('refuses an SVG or HTML file named and typed as an image', async () => {
    const svg = new File(['<svg xmlns="http://www.w3.org/2000/svg" onload="alert(1)"/>'], 'flyer.png', { type: 'image/png' });
    const html = new File(['<html><script>alert(1)</script></html>'], 'flyer.jpg', { type: 'image/jpeg' });
    expect(checkFlyerFile(svg)).toBeNull(); // the name and type lie...
    expect(await checkFlyerBytes(svg)).toBe('not_image'); // ...the bytes do not
    expect(await checkFlyerBytes(html)).toBe('not_image');
    expect(await checkFlyerBytes(new Blob([JPEG]))).toBeNull();
    expect(await checkFlyerBytes(new Blob([WEBP]))).toBeNull();
  });
});

describe('fitWithin', () => {
  it('scales the long edge down to the limit and never up', () => {
    expect(fitWithin(4000, 3000, 1600)).toEqual({ width: 1600, height: 1200 });
    expect(fitWithin(1080, 1920, 1600)).toEqual({ width: 900, height: 1600 });
    expect(fitWithin(800, 600, 1600)).toEqual({ width: 800, height: 600 });
  });
});

// ---- the re-encode, with a mocked canvas ------------------------------------------------

interface FakeCanvasLog { sizes: Array<[number, number]>; encodes: Array<{ type: string; quality: number; w: number }>; fills: number; draws: number }

/** A canvas whose output size is a function of (type, quality, width); webp support is switchable. */
function fakeDeps(opts: {
  width?: number; height?: number; webp?: boolean; decodeFails?: boolean;
  sizeOf?: (type: string, quality: number, w: number) => number;
}): { deps: ReencodeDeps; log: FakeCanvasLog; closed: () => boolean } {
  const log: FakeCanvasLog = { sizes: [], encodes: [], fills: 0, draws: 0 };
  let closed = false;
  const sizeOf = opts.sizeOf ?? (() => 500_000);
  const deps: ReencodeDeps = {
    decode: async () => {
      if (opts.decodeFails) throw new Error('decode failed');
      return { width: opts.width ?? 4000, height: opts.height ?? 3000, image: {} as CanvasImageSource, close: () => { closed = true; } };
    },
    createCanvas: (w, h) => {
      log.sizes.push([w, h]);
      const canvas: FlyerCanvas = {
        width: w,
        height: h,
        getContext: () => ({
          fillStyle: '',
          fillRect: () => { log.fills++; },
          clearRect: () => {},
          drawImage: () => { log.draws++; },
        }),
        toBlob: (cb, type = 'image/png', quality = 0.92) => {
          const outType = type === 'image/webp' && opts.webp === false ? 'image/png' : type;
          log.encodes.push({ type: outType, quality, w: canvas.width });
          cb(new Blob([new Uint8Array(sizeOf(outType, quality, canvas.width))], { type: outType }));
        },
      };
      return canvas;
    },
  };
  return { deps, log, closed: () => closed };
}

// The input carries EXIF-like bytes; nothing of it may reach the output.
const INPUT = new Blob([JPEG, text('Exif\0\0GPS 51.5N 0.12W Canon EOS')], { type: 'image/jpeg' });

describe('reencodeFlyer', () => {
  it('always redraws onto a fresh canvas: WebP, long edge 1600, under the target', async () => {
    const { deps, log, closed } = fakeDeps({});
    const out = await reencodeFlyer(INPUT, deps);
    expect(out).toMatchObject({ mime: 'image/webp', ext: 'webp', width: FLYER_MAX_EDGE, height: 1200 });
    expect(out.blob.size).toBeLessThanOrEqual(FLYER_TARGET_BYTES);
    expect(log.draws).toBeGreaterThan(0);
    // Metadata stripped: the output is the canvas's pixels, not the input's bytes.
    const outText = new TextDecoder().decode(new Uint8Array(await out.blob.arrayBuffer()));
    expect(outText).not.toContain('Exif');
    expect(outText).not.toContain('GPS');
    expect(closed()).toBe(true);
  });

  it('re-encodes a small picture too (never passes the original through)', async () => {
    const { deps, log } = fakeDeps({ width: 600, height: 900, sizeOf: () => 20_000 });
    const out = await reencodeFlyer(new Blob([JPEG], { type: 'image/jpeg' }), deps);
    expect(log.encodes).toHaveLength(1);
    expect(out).toMatchObject({ width: 600, height: 900, mime: 'image/webp' });
  });

  it('falls back to JPEG on white when the browser cannot write WebP', async () => {
    const { deps, log } = fakeDeps({ webp: false });
    const out = await reencodeFlyer(INPUT, deps);
    expect(out).toMatchObject({ mime: 'image/jpeg', ext: 'jpg' });
    expect(out.blob.type).toBe('image/jpeg');
    expect(log.fills).toBeGreaterThan(0);
  });

  it('steps the quality down until the file is about 1 MB', async () => {
    const { deps, log } = fakeDeps({ sizeOf: (_t, q) => Math.round(q * 1_500_000) });
    const out = await reencodeFlyer(INPUT, deps);
    expect(out.blob.size).toBeLessThanOrEqual(FLYER_TARGET_BYTES);
    expect(log.encodes.map((e) => e.quality)).toEqual([0.85, 0.78, 0.7, 0.62]);
  });

  it('shrinks the picture when quality alone is not enough, never below the minimum edge', async () => {
    const { deps, log } = fakeDeps({ sizeOf: (_t, _q, w) => w * 900 });
    const out = await reencodeFlyer(INPUT, deps);
    expect(out.blob.size).toBeLessThanOrEqual(FLYER_TARGET_BYTES);
    expect(Math.max(out.width, out.height)).toBeLessThan(FLYER_MAX_EDGE);
    expect(Math.min(...log.sizes.map(([w, h]) => Math.max(w, h)))).toBeGreaterThanOrEqual(FLYER_MIN_EDGE);
  });

  it('keeps the smallest result under the 2 MB bucket limit when it cannot reach 1 MB', async () => {
    const { deps } = fakeDeps({ sizeOf: () => 1_500_000 });
    const out = await reencodeFlyer(INPUT, deps);
    expect(out.blob.size).toBeLessThanOrEqual(FLYER_BUCKET_LIMIT_BYTES);
  });

  it('refuses a picture it cannot get under 2 MB', async () => {
    const { deps } = fakeDeps({ sizeOf: () => FLYER_BUCKET_LIMIT_BYTES + 1 });
    await expect(reencodeFlyer(INPUT, deps)).rejects.toMatchObject({ problem: 'too_detailed' });
  });

  it('refuses anything the browser cannot decode as an image', async () => {
    const { deps } = fakeDeps({ decodeFails: true });
    const err = await reencodeFlyer(new Blob([text('<svg/>')], { type: 'image/png' }), deps).catch((e) => e);
    expect(err).toBeInstanceOf(FlyerError);
    expect(err.problem).toBe('not_image');
  });

  it('refuses a zero-size decode', async () => {
    const { deps } = fakeDeps({ width: 0, height: 0 });
    await expect(reencodeFlyer(INPUT, deps)).rejects.toMatchObject({ problem: 'not_image' });
  });
});

// ---- the path and the save ---------------------------------------------------------------

describe('flyerObjectPath (never a user filename)', () => {
  it('is <series_id>/<32 hex>.<ext>, the shape the admin storage policy admits', () => {
    for (const ext of ['webp', 'jpg', 'png'] as const) {
      const p = flyerObjectPath(SID, ext);
      expect(p).toMatch(ADMIN_POLICY_PATH_RE);
      expect(p.startsWith(`${SID}/`)).toBe(true);
    }
    expect(flyerObjectPath(SID.toUpperCase(), 'webp')).toMatch(ADMIN_POLICY_PATH_RE);
  });
  it('uses a fresh random token each time', () => {
    const tokens = new Set(Array.from({ length: 50 }, () => randomFlyerToken()));
    expect(tokens.size).toBe(50);
    for (const t of tokens) expect(t).toMatch(/^[0-9a-f]{32}$/);
  });
  it('refuses a series id that is not a uuid and a token that is not 32 hex', () => {
    expect(() => flyerObjectPath('../etc', 'webp')).toThrow();
    expect(() => flyerObjectPath(`${SID}/x`, 'webp')).toThrow();
    expect(() => flyerObjectPath(SID, 'webp', 'my flyer')).toThrow();
    expect(() => flyerObjectPath(SID, 'webp', 'A'.repeat(32))).toThrow();
  });
  it('the bucket is organiser-flyers', () => {
    expect(FLYER_BUCKET).toBe('organiser-flyers');
  });
});

describe('isOwnFlyerUrl', () => {
  const own = `https://abc.supabase.co/storage/v1/object/public/organiser-flyers/${SID}/${'a'.repeat(32)}.webp`;
  it('knows a flyer uploaded for this series', () => {
    expect(isOwnFlyerUrl(own, SID)).toBe(true);
  });
  it('treats anything else as a pasted link', () => {
    expect(isOwnFlyerUrl('https://pub-07f606224cac4f2596903c44df723644.r2.dev/events/a.jpg', SID)).toBe(false);
    expect(isOwnFlyerUrl(own.replace(SID, '11111111-1111-4111-8111-111111111111'), SID)).toBe(false);
    expect(isOwnFlyerUrl(own.replace('https:', 'http:'), SID)).toBe(false);
    expect(isOwnFlyerUrl(`${own}/../x.webp`, SID)).toBe(false);
    expect(isOwnFlyerUrl(null, SID)).toBe(false);
    expect(isOwnFlyerUrl('not a url', SID)).toBe(false);
  });
});

describe('flyerCoverCommand (the payload sent to the existing owner command)', () => {
  it('is series.upsert with the name and the new cover, nothing else', () => {
    const url = `https://abc.supabase.co/storage/v1/object/public/organiser-flyers/${SID}/${'b'.repeat(32)}.webp`;
    const cmd = flyerCoverCommand('  Thursday Bachata  ', url);
    expect(cmd).toEqual({ kind: 'series.upsert', payload: { name: 'Thursday Bachata', default_cover_image_url: url } });
    for (const key of Object.keys(cmd.payload)) expect(OWNER_UPSERT_KEYS as readonly string[]).toContain(key);
  });
});

describe('flyerUploadProblem (Storage refusals in plain words)', () => {
  it('maps the policy refusal, the bucket limits and everything else', () => {
    expect(flyerUploadProblem({ statusCode: '403', message: 'new row violates row-level security policy' })).toBe('permission');
    expect(flyerUploadProblem({ status: 400, message: 'new row violates row-level security policy for table "objects"' })).toBe('permission');
    expect(flyerUploadProblem({ statusCode: '413', message: 'The object exceeded the maximum allowed size' })).toBe('too_big');
    expect(flyerUploadProblem({ statusCode: '415', message: 'mime type image/svg+xml is not supported' })).toBe('type');
    expect(flyerUploadProblem(new Error('Failed to fetch'))).toBe('upload');
    expect(flyerUploadProblem(null)).toBe('upload');
  });
});

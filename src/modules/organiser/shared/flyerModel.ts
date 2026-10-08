// The organiser's series flyer (cover picture): checks, re-encode and the
// storage path. Pure apart from the browser defaults for decode and canvas,
// which are injectable so the unit spec can drive the pipeline in node.
//
// CONTRACT with admin migration 20261109600000_organiser_flyer_storage_policy_v1.sql:
//   bucket      organiser-flyers (public read)
//   path        <series_id>/<32 lowercase hex>.<jpg|png|webp>
//   public URL  <VITE_SUPABASE_URL>/storage/v1/object/public/organiser-flyers/<path>
//   limits      2 MB per object; image/jpeg, image/png, image/webp only
//   who         owner or manager of the series (storage policy
//               organiser_flyers_insert_own_series); no update, no delete
// The URL is then saved as default_cover_image_url through the existing owner
// series.upsert command (series_command_p5). There is no second save path.

import { upsertCommand, type OwnerCommand } from './seriesCommands';

export const FLYER_BUCKET = 'organiser-flyers';
export const FLYER_MIME_TYPES = ['image/jpeg', 'image/png', 'image/webp'] as const;
export type FlyerMime = (typeof FLYER_MIME_TYPES)[number];
/** The file picker filter. On iPhone this also turns a HEIC photo into a JPEG. */
export const FLYER_ACCEPT = FLYER_MIME_TYPES.join(',');

/** The largest file an organiser may pick. */
export const FLYER_MAX_INPUT_BYTES = 10 * 1024 * 1024;
/** What the re-encode aims for. */
export const FLYER_TARGET_BYTES = 1024 * 1024;
/** The bucket's own limit: never send more than this. */
export const FLYER_BUCKET_LIMIT_BYTES = 2 * 1024 * 1024;
/** The long edge after resizing. */
export const FLYER_MAX_EDGE = 1600;
/** The re-encode never shrinks the long edge below this to hit the target. */
export const FLYER_MIN_EDGE = 800;
export const FLYER_QUALITIES = [0.85, 0.78, 0.7, 0.62, 0.55, 0.48] as const;

export type FlyerProblem = 'type' | 'too_big' | 'empty' | 'not_image' | 'too_detailed' | 'upload' | 'permission';

/** Plain copy for each problem, shown under the picker. */
export const FLYER_PROBLEM_COPY: Record<FlyerProblem, string> = {
  type: 'That file type is not supported. Choose a JPEG, PNG or WebP picture.',
  too_big: 'That picture is too big. Choose one under 10 MB.',
  empty: 'That file is empty. Choose another picture.',
  not_image: 'We could not read that file as a picture. Choose a JPEG, PNG or WebP picture.',
  too_detailed: 'We could not make that picture small enough. Try a simpler or smaller picture.',
  upload: 'The picture did not upload. Check your connection and try again.',
  permission: 'You can only change the picture for events you own or manage.',
};

// ---- checks before anything is read or sent -------------------------------------------

/** Type and size, from what the browser says about the file. null = fine so far. */
export function checkFlyerFile(file: { type: string; size: number }): FlyerProblem | null {
  // Some pickers report no type at all; the signature check below decides those.
  if (file.type && !(FLYER_MIME_TYPES as readonly string[]).includes(file.type)) return 'type';
  if (file.size <= 0) return 'empty';
  if (file.size > FLYER_MAX_INPUT_BYTES) return 'too_big';
  return null;
}

export type SniffResult = FlyerMime | 'markup' | null;

/**
 * What the first bytes say the file is. A file whose name and type claim
 * "image" but whose bytes start with markup (SVG, HTML) is 'markup'; anything
 * that is not a JPEG, PNG or WebP signature is null.
 */
export function sniffImageBytes(bytes: Uint8Array): SniffResult {
  const at = (i: number) => bytes[i];
  const ascii = (from: number, text: string) => [...text].every((c, i) => at(from + i) === c.charCodeAt(0));
  if (bytes.length >= 3 && at(0) === 0xff && at(1) === 0xd8 && at(2) === 0xff) return 'image/jpeg';
  if (bytes.length >= 8 && [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a].every((b, i) => at(i) === b)) return 'image/png';
  if (bytes.length >= 12 && ascii(0, 'RIFF') && ascii(8, 'WEBP')) return 'image/webp';
  // Markup: skip a UTF-8 or UTF-16 byte order mark, NULs and whitespace, then look for '<'.
  let i = 0;
  if (at(0) === 0xef && at(1) === 0xbb && at(2) === 0xbf) i = 3;
  else if ((at(0) === 0xff && at(1) === 0xfe) || (at(0) === 0xfe && at(1) === 0xff)) i = 2;
  while (i < bytes.length && (at(i) === 0x00 || at(i) === 0x20 || at(i) === 0x09 || at(i) === 0x0a || at(i) === 0x0d)) i++;
  if (at(i) === 0x3c) return 'markup';
  return null;
}

/** The signature check: only real JPEG, PNG or WebP bytes get as far as decoding. */
export async function checkFlyerBytes(file: Blob): Promise<FlyerProblem | null> {
  const head = new Uint8Array(await file.slice(0, 64).arrayBuffer());
  const kind = sniffImageBytes(head);
  return kind && kind !== 'markup' ? null : 'not_image';
}

// ---- re-encode -------------------------------------------------------------------------

/** Scale (w, h) so the long edge is at most `max`; never upscales; whole pixels. */
export function fitWithin(width: number, height: number, max: number): { width: number; height: number } {
  const scale = Math.min(1, max / Math.max(width, height));
  return { width: Math.max(1, Math.round(width * scale)), height: Math.max(1, Math.round(height * scale)) };
}

export interface DecodedImage {
  width: number;
  height: number;
  image: CanvasImageSource;
  close?: () => void;
}

export interface FlyerCanvas {
  width: number;
  height: number;
  getContext(type: '2d'): Pick<CanvasRenderingContext2D, 'drawImage' | 'fillRect' | 'clearRect'> & { fillStyle: string | CanvasGradient | CanvasPattern } | null;
  toBlob(callback: (blob: Blob | null) => void, type?: string, quality?: number): void;
}

export interface ReencodeDeps {
  decode: (file: Blob) => Promise<DecodedImage>;
  createCanvas: (width: number, height: number) => FlyerCanvas;
}

export interface EncodedFlyer {
  blob: Blob;
  mime: 'image/webp' | 'image/jpeg';
  ext: 'webp' | 'jpg';
  width: number;
  height: number;
}

export class FlyerError extends Error {
  constructor(public readonly problem: FlyerProblem) {
    super(problem);
    this.name = 'FlyerError';
  }
}

/** Browser decode: createImageBitmap (honours EXIF rotation), else an <img>. */
async function browserDecode(file: Blob): Promise<DecodedImage> {
  if (typeof createImageBitmap === 'function') {
    const bitmap = await createImageBitmap(file, { imageOrientation: 'from-image' });
    return { width: bitmap.width, height: bitmap.height, image: bitmap, close: () => bitmap.close() };
  }
  const url = URL.createObjectURL(file);
  try {
    const img = new Image();
    img.decoding = 'async';
    img.src = url;
    await img.decode();
    return { width: img.naturalWidth, height: img.naturalHeight, image: img };
  } finally {
    URL.revokeObjectURL(url);
  }
}

export const browserReencodeDeps: ReencodeDeps = {
  decode: browserDecode,
  createCanvas: (width, height) => {
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    return canvas as unknown as FlyerCanvas;
  },
};

const toBlob = (canvas: FlyerCanvas, type: string, quality: number) =>
  new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, type, quality));

/**
 * Draw the picture onto a fresh canvas and encode it again, ALWAYS: nothing of
 * the original file (EXIF, GPS, comments, other metadata) survives, because
 * only pixels are drawn. WebP where the browser can write it, else JPEG on a
 * white background. Steps the quality down, then the size, until the file is
 * about 1 MB; refuses if it cannot get under the bucket's 2 MB.
 */
export async function reencodeFlyer(file: Blob, deps: ReencodeDeps = browserReencodeDeps): Promise<EncodedFlyer> {
  let decoded: DecodedImage;
  try {
    decoded = await deps.decode(file);
  } catch {
    throw new FlyerError('not_image');
  }
  try {
    if (!(decoded.width > 0 && decoded.height > 0)) throw new FlyerError('not_image');
    let mime: EncodedFlyer['mime'] = 'image/webp';
    let best: EncodedFlyer | null = null;
    for (let edge = FLYER_MAX_EDGE; ; edge = Math.round(edge * 0.8)) {
      const size = fitWithin(decoded.width, decoded.height, Math.max(edge, FLYER_MIN_EDGE));
      const canvas = deps.createCanvas(size.width, size.height);
      canvas.width = size.width;
      canvas.height = size.height;
      const ctx = canvas.getContext('2d');
      if (!ctx) throw new FlyerError('not_image');
      const paint = () => {
        ctx.clearRect(0, 0, size.width, size.height);
        // JPEG has no transparency: a see-through PNG goes on white, not black.
        if (mime === 'image/jpeg') {
          ctx.fillStyle = '#ffffff';
          ctx.fillRect(0, 0, size.width, size.height);
        }
        ctx.drawImage(decoded.image, 0, 0, size.width, size.height);
      };
      paint();
      for (const quality of FLYER_QUALITIES) {
        let blob = await toBlob(canvas, mime, quality);
        // A browser that cannot write WebP hands back PNG (or nothing): use JPEG from here on.
        if (mime === 'image/webp' && blob?.type !== 'image/webp') {
          mime = 'image/jpeg';
          paint();
          blob = await toBlob(canvas, mime, quality);
        }
        if (!blob || blob.type !== mime) throw new FlyerError('not_image');
        const encoded: EncodedFlyer = { blob, mime, ext: mime === 'image/webp' ? 'webp' : 'jpg', ...size };
        if (blob.size <= FLYER_BUCKET_LIMIT_BYTES && (!best || blob.size < best.blob.size)) best = encoded;
        if (blob.size <= FLYER_TARGET_BYTES) return encoded;
      }
      if (edge <= FLYER_MIN_EDGE) break;
    }
    if (best) return best;
    throw new FlyerError('too_detailed');
  } finally {
    decoded.close?.();
  }
}

// ---- where it goes ---------------------------------------------------------------------

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
const TOKEN_RE = /^[0-9a-f]{32}$/;

/** 32 random lowercase hex characters. Never derived from the file's name. */
export function randomFlyerToken(): string {
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
}

/** <series_id>/<token>.<ext>: the only shape the storage policy admits. */
export function flyerObjectPath(seriesId: string, ext: 'webp' | 'jpg' | 'png', token: string = randomFlyerToken()): string {
  const id = seriesId.toLowerCase();
  if (!UUID_RE.test(id)) throw new Error('flyerObjectPath: series id is not a uuid');
  if (!TOKEN_RE.test(token)) throw new Error('flyerObjectPath: token is not 32 hex characters');
  return `${id}/${token}.${ext}`;
}

/** True when the cover is a flyer uploaded here for this series (not a pasted link). */
export function isOwnFlyerUrl(url: string | null | undefined, seriesId: string): boolean {
  if (!url) return false;
  try {
    const u = new URL(url);
    const prefix = `/storage/v1/object/public/${FLYER_BUCKET}/${seriesId.toLowerCase()}/`;
    return u.protocol === 'https:' && u.pathname.startsWith(prefix) && /^[0-9a-f]{32}\.(webp|jpg|png)$/.test(u.pathname.slice(prefix.length));
  } catch {
    return false;
  }
}

/**
 * The save: series.upsert with `name` (the handler needs it on every upsert)
 * and the new cover, nothing else, so no other field can move.
 */
export function flyerCoverCommand(seriesName: string, publicUrl: string): OwnerCommand {
  return upsertCommand({ name: seriesName.trim(), default_cover_image_url: publicUrl });
}

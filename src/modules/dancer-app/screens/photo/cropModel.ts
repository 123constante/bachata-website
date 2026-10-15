/**
 * Pure maths for the square photo crop (no DOM). The view is expressed in the
 * ORIENTED image (after EXIF rotation): a centre point in source pixels and a
 * zoom >= 1, where 1 = the largest square that fits. renderCrop() draws that
 * square into any canvas-like context with ONE transform, so the production
 * path and the tests (a raster fake of the 2D context) run the same code.
 */

export const OUTPUT_SIZE = 1024;
export const OUTPUT_QUALITY = 0.86;
export const MIN_SOURCE_EDGE = 256;
export const MAX_ZOOM = 4;

export type Orientation = 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8;
export type View = { cx: number; cy: number; zoom: number };
export type Matrix = [number, number, number, number, number, number];

/** Orientation 5-8 swap width and height. */
export const swapsAxes = (o: Orientation): boolean => o >= 5;

export const orientedSize = (w: number, h: number, o: Orientation): { w: number; h: number } =>
  swapsAxes(o) ? { w: h, h: w } : { w, h };

/** The side (in oriented source px) of the square the view shows. */
export const cropSide = (w: number, h: number, zoom: number): number => Math.min(w, h) / zoom;

/** Keep the zoom in range and the square inside the image. */
export const clampView = (w: number, h: number, view: View): View => {
  const zoom = Math.min(MAX_ZOOM, Math.max(1, Number.isFinite(view.zoom) ? view.zoom : 1));
  const half = cropSide(w, h, zoom) / 2;
  const cx = Math.min(w - half, Math.max(half, Number.isFinite(view.cx) ? view.cx : w / 2));
  const cy = Math.min(h - half, Math.max(half, Number.isFinite(view.cy) ? view.cy : h / 2));
  return { cx, cy, zoom };
};

export const initialView = (w: number, h: number): View => clampView(w, h, { cx: w / 2, cy: h / 2, zoom: 1 });

/** The square in oriented source px. */
export const cropRect = (w: number, h: number, view: View): { sx: number; sy: number; side: number } => {
  const v = clampView(w, h, view);
  const side = cropSide(w, h, v.zoom);
  return { sx: v.cx - side / 2, sy: v.cy - side / 2, side };
};

/** Drag by (dx, dy) screen px inside a box of boxPx: the image follows the finger. */
export const panView = (w: number, h: number, view: View, dx: number, dy: number, boxPx: number): View => {
  const side = cropSide(w, h, view.zoom);
  const k = side / boxPx;
  return clampView(w, h, { ...view, cx: view.cx - dx * k, cy: view.cy - dy * k });
};

/** Zoom keeping the point under (px, py) (box px, default centre) where it is. */
export const zoomView = (w: number, h: number, view: View, zoom: number, boxPx: number, px = boxPx / 2, py = boxPx / 2): View => {
  const before = cropRect(w, h, view);
  const wx = before.sx + (px / boxPx) * before.side;
  const wy = before.sy + (py / boxPx) * before.side;
  const next = Math.min(MAX_ZOOM, Math.max(1, zoom));
  const side = cropSide(w, h, next);
  return clampView(w, h, { zoom: next, cx: wx - (px / boxPx - 0.5) * side, cy: wy - (py / boxPx - 0.5) * side });
};

/**
 * Canvas transform [a b c d e f] taking RAW image pixels to ORIENTED pixels for an
 * EXIF orientation (w, h = the raw image size).
 */
export const orientationMatrix = (o: Orientation, w: number, h: number): Matrix => {
  switch (o) {
    case 2: return [-1, 0, 0, 1, w, 0];
    case 3: return [-1, 0, 0, -1, w, h];
    case 4: return [1, 0, 0, -1, 0, h];
    case 5: return [0, 1, 1, 0, 0, 0];
    case 6: return [0, 1, -1, 0, h, 0];
    case 7: return [0, -1, -1, 0, h, w];
    case 8: return [0, -1, 1, 0, 0, w];
    default: return [1, 0, 0, 1, 0, 0];
  }
};

const mul = (m: Matrix, n: Matrix): Matrix => [
  m[0] * n[0] + m[2] * n[1],
  m[1] * n[0] + m[3] * n[1],
  m[0] * n[2] + m[2] * n[3],
  m[1] * n[2] + m[3] * n[3],
  m[0] * n[4] + m[2] * n[5] + m[4],
  m[1] * n[4] + m[3] * n[5] + m[5],
];

export type Ctx2D = {
  setTransform(a: number, b: number, c: number, d: number, e: number, f: number): void;
  drawImage(image: never, dx: number, dy: number): void;
  fillStyle?: unknown;
  fillRect?(x: number, y: number, w: number, h: number): void;
};

/**
 * Draw the view's square into a ctx whose canvas is out x out. `rawW`/`rawH` are the
 * size of `source` as drawn; `orientation` is what STILL has to be applied (1 when
 * the decoder already rotated the bitmap).
 */
export const renderCrop = (
  ctx: Ctx2D,
  source: unknown,
  rawW: number,
  rawH: number,
  orientation: Orientation,
  view: View,
  out: number,
): void => {
  const { w, h } = orientedSize(rawW, rawH, orientation);
  const { sx, sy, side } = cropRect(w, h, view);
  const k = out / side;
  const m = mul([k, 0, 0, k, -sx * k, -sy * k], orientationMatrix(orientation, rawW, rawH));
  ctx.setTransform(...m);
  ctx.drawImage(source as never, 0, 0);
};

/* ---------- EXIF / JPEG header reading (no decoder needed) ---------- */

/** EXIF orientation of a JPEG (1 when absent, not a JPEG, or malformed). */
export const readOrientation = (buf: ArrayBuffer): Orientation => {
  const v = new DataView(buf);
  const len = v.byteLength;
  if (len < 4 || v.getUint16(0) !== 0xffd8) return 1;
  let p = 2;
  while (p + 4 <= len) {
    if (v.getUint8(p) !== 0xff) return 1;
    const marker = v.getUint8(p + 1);
    if (marker === 0xda || marker === 0xd9) return 1;
    const size = v.getUint16(p + 2);
    if (marker === 0xe1 && p + 10 <= len && v.getUint32(p + 4) === 0x45786966) {
      const t = p + 10;
      if (t + 8 > len) return 1;
      const little = v.getUint16(t) === 0x4949;
      let ifd = t + v.getUint32(t + 4, little);
      if (ifd + 2 > len) return 1;
      const n = v.getUint16(ifd, little);
      ifd += 2;
      for (let i = 0; i < n && ifd + 12 <= len; i += 1, ifd += 12) {
        if (v.getUint16(ifd, little) === 0x0112) {
          const o = v.getUint16(ifd + 8, little);
          return o >= 1 && o <= 8 ? (o as Orientation) : 1;
        }
      }
      return 1;
    }
    p += 2 + size;
  }
  return 1;
};

/** Pixel size stored in a JPEG's SOF header (null when not found). */
export const readJpegSize = (buf: ArrayBuffer): { w: number; h: number } | null => {
  const v = new DataView(buf);
  const len = v.byteLength;
  if (len < 4 || v.getUint16(0) !== 0xffd8) return null;
  let p = 2;
  while (p + 4 <= len) {
    if (v.getUint8(p) !== 0xff) return null;
    const marker = v.getUint8(p + 1);
    if (marker >= 0xc0 && marker <= 0xcf && marker !== 0xc4 && marker !== 0xc8 && marker !== 0xcc) {
      if (p + 9 > len) return null;
      return { h: v.getUint16(p + 5), w: v.getUint16(p + 7) };
    }
    p += 2 + v.getUint16(p + 2);
  }
  return null;
};

/**
 * Does the decoded bitmap still need our rotation? A decoder that honoured
 * `imageOrientation: 'from-image'` already swapped the axes for 5-8, so a bitmap
 * whose size equals the stored (raw) size means it did not. Flip-only orientations
 * (2-4) cannot be told apart by size; they are trusted to be applied.
 */
export const orientationToApply = (
  exif: Orientation,
  bitmap: { w: number; h: number },
  raw: { w: number; h: number } | null,
): Orientation => {
  if (exif === 1 || !swapsAxes(exif) || !raw || raw.w === raw.h) return 1;
  return bitmap.w === raw.w && bitmap.h === raw.h ? exif : 1;
};

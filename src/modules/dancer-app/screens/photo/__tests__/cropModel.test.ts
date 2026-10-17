import { describe, expect, it } from 'vitest';
import {
  clampView,
  cropRect,
  initialView,
  orientationToApply,
  panView,
  readJpegSize,
  readOrientation,
  renderCrop,
  zoomView,
  type Orientation,
} from '../cropModel';
import { makeRaster, rasterCtx } from './rasterCtx';
import { jpegWithOrientation } from './jpegFixture';

// Quadrants of a square raw image: 1 = top-left, 2 = top-right, 3 = bottom-left, 4 = bottom-right.
const quad = (s: number) => makeRaster(s, s, (x, y) => (y < s / 2 ? (x < s / 2 ? 1 : 2) : x < s / 2 ? 3 : 4));
const corners = (px: number[], n: number) => [px[0], px[n - 1], px[n * (n - 1)], px[n * n - 1]];

describe('renderCrop: EXIF orientation x pixel corners (TL, TR, BL, BR of the output)', () => {
  // What a person sees when the phone says "orientation N": the raw quadrants land here.
  const cases: Array<[Orientation, number[]]> = [
    [1, [1, 2, 3, 4]],
    [2, [2, 1, 4, 3]],
    [3, [4, 3, 2, 1]],
    [4, [3, 4, 1, 2]],
    [5, [1, 3, 2, 4]],
    [6, [3, 1, 4, 2]],
    [7, [4, 2, 3, 1]],
    [8, [2, 4, 1, 3]],
  ];
  it.each(cases)('orientation %i', (o, expected) => {
    const raw = quad(8);
    const { ctx, result } = rasterCtx(8);
    renderCrop(ctx, raw, 8, 8, o, initialView(8, 8), 8);
    expect(corners(result(), 8)).toEqual(expected);
  });

  it('a portrait phone photo (raw landscape, orientation 6) is cropped square from the ROTATED image', () => {
    // raw 8x4: left half = 1, right half = 2. Rotated 90 CW it is 4x8: top half = 1, bottom = 2.
    const raw = makeRaster(8, 4, (x) => (x < 4 ? 1 : 2));
    const { ctx, result } = rasterCtx(4);
    renderCrop(ctx, raw, 8, 4, 6, { cx: 2, cy: 2, zoom: 1 }, 4); // top square of the rotated image
    expect(new Set(result())).toEqual(new Set([1]));
    const low = rasterCtx(4);
    renderCrop(low.ctx, raw, 8, 4, 6, { cx: 2, cy: 6, zoom: 1 }, 4); // bottom square
    expect(new Set(low.result())).toEqual(new Set([2]));
  });
});

describe('view maths', () => {
  const W = 800;
  const H = 600;
  it('starts centred on the largest square', () => {
    expect(cropRect(W, H, initialView(W, H))).toEqual({ sx: 100, sy: 0, side: 600 });
  });
  it('never lets the square leave the image or zoom out of range', () => {
    expect(cropRect(W, H, { cx: -50, cy: 9999, zoom: 1 })).toEqual({ sx: 0, sy: 0, side: 600 });
    expect(clampView(W, H, { cx: 400, cy: 300, zoom: 99 }).zoom).toBe(4);
    expect(clampView(W, H, { cx: 400, cy: 300, zoom: 0.2 }).zoom).toBe(1);
    expect(clampView(W, H, { cx: NaN, cy: NaN, zoom: NaN })).toEqual({ cx: 400, cy: 300, zoom: 1 });
  });
  it('dragging right moves the window left (the image follows the finger)', () => {
    const z = zoomView(W, H, initialView(W, H), 2, 300);
    const moved = panView(W, H, z, 30, 0, 300);
    expect(moved.cx).toBeLessThan(z.cx);
  });
  it('zooming keeps the point under the pointer fixed', () => {
    const v = initialView(W, H);
    const before = cropRect(W, H, v);
    const px = 75;
    const wx = before.sx + (px / 300) * before.side;
    const z = zoomView(W, H, v, 2, 300, px, 150);
    const after = cropRect(W, H, z);
    expect(after.sx + (px / 300) * after.side).toBeCloseTo(wx, 5);
  });
});

describe('JPEG header reading', () => {
  it.each([1, 2, 3, 4, 5, 6, 7, 8])('reads orientation %i', (o) => {
    expect(readOrientation(jpegWithOrientation(o, 40, 30))).toBe(o);
  });
  it('reads the stored size', () => {
    expect(readJpegSize(jpegWithOrientation(6, 4000, 3000))).toEqual({ w: 4000, h: 3000 });
  });
  it.each([
    ['empty', new ArrayBuffer(0)],
    ['not a jpeg', new Uint8Array([1, 2, 3, 4, 5, 6]).buffer],
    ['truncated', jpegWithOrientation(6, 4, 4).slice(0, 14)],
  ])('%s -> orientation 1, no throw', (_n, buf) => {
    expect(readOrientation(buf)).toBe(1);
  });
});

describe('orientationToApply (decoder already rotated?)', () => {
  it.each([
    ['decoder rotated (sizes swapped)', 6, { w: 3000, h: 4000 }, { w: 4000, h: 3000 }, 1],
    ['decoder ignored the option', 6, { w: 4000, h: 3000 }, { w: 4000, h: 3000 }, 6],
    ['no exif', 1, { w: 4000, h: 3000 }, { w: 4000, h: 3000 }, 1],
    ['unknown raw size: trust the decoder', 6, { w: 4000, h: 3000 }, null, 1],
    ['flip-only is trusted', 2, { w: 4000, h: 3000 }, { w: 4000, h: 3000 }, 1],
  ] as const)('%s', (_n, exif, bitmap, raw, want) => {
    expect(orientationToApply(exif as Orientation, bitmap, raw)).toBe(want);
  });
});

import { describe, expect, it } from 'vitest';
import jsQR from 'jsqr';
import { qrModules } from '../qr';
import { parseCode } from '@/modules/organiser/p3/door/model';

/** Rasterise the module grid (4-module quiet zone, 6 px per module) to RGBA, like a phone screen. */
function raster(grid: boolean[][], scale = 6, quiet = 4) {
  const n = (grid.length + quiet * 2) * scale;
  const px = new Uint8ClampedArray(n * n * 4).fill(255);
  grid.forEach((row, r) => row.forEach((dark, c) => {
    if (!dark) return;
    for (let y = 0; y < scale; y++) for (let x = 0; x < scale; x++) {
      const i = (((r + quiet) * scale + y) * n + (c + quiet) * scale + x) * 4;
      px[i] = px[i + 1] = px[i + 2] = 0;
    }
  }));
  return { px, n };
}

describe('door QR round trip (jsqr = the door scanner, parseCode = the door parser)', () => {
  it.each([
    'a'.repeat(64),
    '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef',
    'f00dbabe'.repeat(8),
  ])('%s decodes back to the same token', (token) => {
    const { px, n } = raster(qrModules(token));
    const read = jsQR(px, n, n);
    expect(read?.data).toBe(token);
    expect(parseCode(read!.data)).toBe(token);
  });
});

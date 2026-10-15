import type { Ctx2D } from '../cropModel';

/** A raster stand-in for a canvas 2D context: setTransform + drawImage with nearest sampling. */
export type Raster = { w: number; h: number; px: number[] };

export const makeRaster = (w: number, h: number, colour: (x: number, y: number) => number): Raster => ({
  w,
  h,
  px: Array.from({ length: w * h }, (_, i) => colour(i % w, Math.floor(i / w))),
});

export const rasterCtx = (out: number): { ctx: Ctx2D; result: () => number[] } => {
  const px = new Array<number>(out * out).fill(-1);
  let m: [number, number, number, number, number, number] = [1, 0, 0, 1, 0, 0];
  const ctx: Ctx2D = {
    setTransform: (a, b, c, d, e, f) => {
      m = [a, b, c, d, e, f];
    },
    drawImage: (image) => {
      const src = image as unknown as Raster;
      const [a, b, c, d, e, f] = m;
      const det = a * d - b * c;
      for (let oy = 0; oy < out; oy += 1) {
        for (let ox = 0; ox < out; ox += 1) {
          const x = ox + 0.5 - e;
          const y = oy + 0.5 - f;
          const sx = Math.floor((d * x - c * y) / det);
          const sy = Math.floor((-b * x + a * y) / det);
          if (sx >= 0 && sy >= 0 && sx < src.w && sy < src.h) px[oy * out + ox] = src.px[sy * src.w + sx];
        }
      }
    },
  };
  return { ctx, result: () => px };
};

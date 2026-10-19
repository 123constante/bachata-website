import { describe, expect, it } from 'vitest';
import { LANDSCAPE_MIN_RATIO, frameFor, frameStyle } from '@/lib/videoFrame';

describe('frameFor', () => {
  it('threshold constant', () => expect(LANDSCAPE_MIN_RATIO).toBe(1.6));
  it.each([[640, 360], [848, 474], [848, 478]])('%ix%i is landscape', (w, h) => {
    expect(frameFor(w, h).landscape).toBe(true);
    expect(frameStyle(frameFor(w, h))).toBeUndefined();
  });
  it.each([[480, 848], [720, 1280], [1000, 1000], [640, 480]])('%ix%i is adaptive', (w, h) => {
    const f = frameFor(w, h);
    expect(f.landscape).toBe(false);
    expect(f.ratio).toBeCloseTo(w / h);
    const s = frameStyle(f)!;
    expect(s.aspectRatio).toBe(`${w / h}`);
    expect(s.width).toBe(`min(100%, calc(75svh * ${w / h}))`);
    expect(s.marginInline).toBe('auto');
  });
  it('boundary 1.59 / 1.6 / 1.61', () => {
    expect(frameFor(159, 100).landscape).toBe(false);
    expect(frameFor(160, 100).landscape).toBe(true);
    expect(frameFor(161, 100).landscape).toBe(true);
  });
  it.each([[0, 0], [NaN, 10], [undefined, undefined], [Infinity, 10], [-5, 10], [10, 0]])(
    'bad %s x %s falls back to landscape 16/9',
    (w, h) => {
      const f = frameFor(w as number, h as number);
      expect(f.landscape).toBe(true);
      expect(f.ratio).toBeCloseTo(16 / 9);
    },
  );
});

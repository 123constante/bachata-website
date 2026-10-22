/**
 * D121 colour layer (theme/dancer-color.css): scoped to the dancer app, its tokens are the prototype's v2 values,
 * and every pair of the prototype's contrast table is recomputed here (>= 4.5:1), the way the prototype handover
 * computed it (alpha-blended over the real backgrounds, with the dark scrim layered under white text).
 */
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { DANCER_TOKENS, contrastRatio } from '@/modules/dancer-app/theme/tokens';

const css = readFileSync(path.resolve(__dirname, '../../src/modules/dancer-app/theme/dancer-color.css'), 'utf8').replace(/\/\*[\s\S]*?\*\//g, '');

const rgb = (hex: string): [number, number, number] => [0, 2, 4].map((i) => parseInt(hex.replace('#', '').slice(i, i + 2), 16)) as [number, number, number];
const toHex = (c: number[]) => `#${c.map((v) => Math.round(v).toString(16).padStart(2, '0')).join('')}`;
/** Colour `fg` at `alpha` over opaque `bg`. */
const over = (fg: string, alpha: number, bg: string) => toHex(rgb(fg).map((v, i) => v * alpha + rgb(bg)[i] * (1 - alpha)));

const token = (name: string): string => css.match(new RegExp(`${name}:\\s*([^;]+);`))?.[1].trim() ?? '';
const SCRIM = { colour: '#120820', alpha: 0.4 };
const CARD = DANCER_TOKENS['--da-surface'];
const CARD2 = DANCER_TOKENS['--da-surface-2'];

describe('dancer-color.css', () => {
  it('every rule is scoped to [data-profile="dancer"] (keyframes and the motion query aside)', () => {
    const body = css.replace(/@keyframes[^{]+\{[\s\S]*?\}\s*\}/g, '').replace(/@media[^{]+\{|\}\s*$/g, '');
    const sels = [...body.matchAll(/([^{}]+)\{[^{}]*\}/g)].flatMap((m) => m[1].split(',').map((s) => s.trim())).filter(Boolean);
    expect(sels.length).toBeGreaterThan(20);
    for (const s of sels) expect(s.startsWith('[data-profile="dancer"]'), s).toBe(true);
  });
  it('carries the prototype v2 tokens', () => {
    expect(token('--da-sun')).toBe('linear-gradient(120deg, #f0703a 0%, #e8487f 52%, #8a4dff 100%)');
    expect(token('--da-sun-scrim')).toBe('linear-gradient(rgba(18, 8, 30, 0.4), rgba(18, 8, 30, 0.4))');
    for (const [n, v] of [['rose', '#ff9cc0'], ['violet', '#c9adff'], ['teal', '#4fe0cf'], ['gold', '#ffcf66']]) {
      expect(token(`--da-${n}`)).toBe(v);
      expect(token(`--da-${n}-soft`)).toBe(`rgba(${rgb(v).join(', ')}, 0.14)`);
    }
  });
  it('confetti is hidden under reduced motion', () => {
    expect(css).toMatch(/@media \(prefers-reduced-motion: reduce\)\s*\{\s*\[data-profile="dancer"\] \.da-confetti \{ display: none; \}/);
  });
});

describe('contrast of the colour layer (>= 4.5:1)', () => {
  const stops = ['#f0703a', '#e8487f', '#8a4dff', '#13877d', '#5b3fd6'];
  it.each(stops)('white on %s under the scrim', (stop) => {
    expect(contrastRatio('#ffffff', over(SCRIM.colour, SCRIM.alpha, stop))).toBeGreaterThanOrEqual(4.5);
  });
  it('white at 85% on the lightest stop under the scrim (worst small text)', () => {
    const bg = over(SCRIM.colour, SCRIM.alpha, '#f0703a');
    expect(contrastRatio(over('#ffffff', 0.85, bg), bg)).toBeGreaterThanOrEqual(4.5);
  });
  it.each([['--da-gradient-from', '#f0703a'], ['--da-gradient-mid', '#e8487f'], ['--da-gradient-to', '#8a4dff']])('%s is its stop with the scrim already applied (within 1 per channel)', (name, stop) => {
    const want = rgb(over(SCRIM.colour, SCRIM.alpha, stop));
    const got = rgb(DANCER_TOKENS[name as keyof typeof DANCER_TOKENS]);
    got.forEach((c, k) => expect(Math.abs(c - want[k])).toBeLessThanOrEqual(1));
  });
  it.each([['teal', '#4fe0cf'], ['gold', '#ffcf66'], ['violet', '#c9adff'], ['rose', '#ff9cc0']])('%s on its soft fill over card and card-2', (_n, hex) => {
    for (const ground of [CARD, CARD2]) {
      const fill = over(hex, 0.14, ground);
      expect(contrastRatio(hex, fill), `${hex} on ${ground}`).toBeGreaterThanOrEqual(4.5);
      expect(contrastRatio(DANCER_TOKENS['--da-text'], fill)).toBeGreaterThanOrEqual(4.5);
    }
  });
  it('ink on the inverted white hero button', () => {
    expect(contrastRatio('#1d0a03', '#ffffff')).toBeGreaterThanOrEqual(4.5);
  });
  it('mute on the wrapper glow and text on card-2 (the % inside the ring)', () => {
    for (const glow of ['#8a4dff', '#f0703a']) {
      expect(contrastRatio(DANCER_TOKENS['--da-text-muted'], over(glow, 0.14, DANCER_TOKENS['--da-bg']))).toBeGreaterThanOrEqual(4.5);
    }
    expect(contrastRatio(DANCER_TOKENS['--da-text'], CARD2)).toBeGreaterThanOrEqual(4.5);
  });
  it('the toast: teal on its dark fill', () => {
    expect(contrastRatio('#4fe0cf', '#1f3a3a')).toBeGreaterThanOrEqual(4.5);
  });
});

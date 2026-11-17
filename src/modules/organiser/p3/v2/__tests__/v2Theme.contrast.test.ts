import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

/*
 * Organiser shell V2 look: v2.css over p3.css, light and dark. Every text pair the shell paints
 * is COMPUTED from the files and must reach 4.5:1; the ONE accent must pass on white. Px only.
 */
const read = (...p: string[]) => readFileSync(join(__dirname, '..', ...p), 'utf8').replace(/\r\n/g, '\n');
const p3 = read('..', 'theme', 'p3.css');
const v2 = read('v2.css');

function block(css: string, selector: string, from = 0): Record<string, string> {
  const at = css.indexOf(`${selector} {`, from);
  expect(at, selector).toBeGreaterThanOrEqual(0);
  const body = css.slice(css.indexOf('{', at) + 1, css.indexOf('}', at));
  const out: Record<string, string> = {};
  for (const m of body.matchAll(/(--[\w-]+):\s*([^;]+);/g)) out[m[1]] = m[2].trim();
  return out;
}
const darkAt = v2.indexOf('@media (prefers-color-scheme: dark)');
const light = { ...block(p3, '.p3-theme'), ...block(v2, '.p3-theme.v2-look') };
const dark = { ...block(p3, '.p3-theme:not([data-theme="light"])'), ...block(v2, '.p3-theme.v2-look', darkAt) };

type Rgb = [number, number, number];
const hex = (T: Record<string, string>, t: string): Rgb => {
  const m = /^#([0-9a-f]{6})$/i.exec(T[t] ?? '');
  expect(m, `${t} = ${T[t]}`).not.toBeNull();
  return [0, 2, 4].map((i) => parseInt(m![1].slice(i, i + 2), 16)) as Rgb;
};
const lum = ([r, g, b]: Rgb) => {
  const f = (v: number) => { const s = v / 255; return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4; };
  return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b);
};
const ratio = (a: Rgb, b: Rgb) => { const [x, y] = [lum(a), lum(b)].sort((p, q) => q - p); return (x + 0.05) / (y + 0.05); };

const PAIRS: [string, string][] = [
  ['--fg', '--bg'], ['--fg', '--card'], ['--fg', '--card2'], ['--fg', '--sheet'],
  ['--mut', '--bg'], ['--mut', '--card'], ['--mut', '--card2'],
  ['--gold-fg', '--bg'], ['--gold-fg', '--card'], ['--gold-fg', '--tab'], ['--btnfg', '--btn'],
];

describe('V2 look tokens', () => {
  it('the ground is white in light', () => expect(light['--bg']).toBe('#ffffff'));
  it('ONE accent: gold, gold-fg and btn are the same colour, in each set', () => {
    for (const T of [light, dark]) expect(new Set([T['--gold'], T['--gold-fg'], T['--btn']]).size).toBe(1);
  });
  it.each(PAIRS)('light %s on %s >= 4.5:1', (fg, bg) => expect(ratio(hex(light, fg), hex(light, bg))).toBeGreaterThanOrEqual(4.5));
  it.each(PAIRS)('dark %s on %s >= 4.5:1', (fg, bg) => expect(ratio(hex(dark, fg), hex(dark, bg))).toBeGreaterThanOrEqual(4.5));
  it('every rule is scoped to the organiser area (no :root, html or body)', () => {
    const selectors = [...v2.replace(/\/\*[\s\S]*?\*\//g, '').matchAll(/([^{}]+)\{/g)].map((m) => m[1].trim()).filter((s) => !s.startsWith('@media'));
    expect(selectors.length).toBeGreaterThan(0);
    for (const s of selectors) for (const part of s.split(',')) expect(part.trim(), part).toMatch(/^\.p3-theme\.v2-look\b/);
  });
  it('sizes are px, never rem or em', () => expect(v2).not.toMatch(/\d(rem|em)\b/));
});

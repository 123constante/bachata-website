// @vitest-environment node
/**
 * Placeholder contrast in the organiser surfaces (owner finding: edit-in-place
 * sheet placeholders too faint). Parses theme.css and sheetStyles.ts so the
 * numbers cannot drift from the code. The sheets portal into document.body,
 * OUTSIDE .org-theme, so --ph never reaches them unless the sheet inputs carry
 * the .org-eip-input class, whose rule falls back to a literal colour.
 */
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const css = readFileSync('src/modules/organiser/theme.css', 'utf8');
const sheetSrc = readFileSync('src/modules/organiser/edit-in-place/sheetStyles.ts', 'utf8');

const token = (name: string): string => {
  const m = css.match(new RegExp(`--${name}:\\s*(#[0-9a-fA-F]{6})`));
  if (!m) throw new Error(`token --${name} not found`);
  return m[1];
};
type RGB = [number, number, number];
const rgb = (h: string): RGB => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16)) as RGB;
const mix = (fg: RGB, bg: RGB, a: number): RGB => fg.map((v, i) => v * a + bg[i] * (1 - a)) as RGB;
const lum = (c: RGB): number => {
  const [r, g, b] = c.map((v) => { const s = v / 255; return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4; });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
};
const ratio = (a: RGB, b: RGB): number => {
  const [x, y] = [lum(a), lum(b)];
  return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05);
};

// The sheet frame colour and the inputStyle tint, read from sheetStyles.ts.
const sheetBg = rgb(sheetSrc.match(/background: '(#[0-9A-Fa-f]{6})', color: CREAM, borderRadius: '16px/)![1]);
const cream = rgb(sheetSrc.match(/const CREAM = '(#[0-9A-Fa-f]{6})'/)![1]);
const tint = Number(sheetSrc.match(/background: 'rgba\(246,241,234,([0-9.]+)\)', color: CREAM/)![1]);

const eipRule = css.match(/\.org-eip-input::placeholder\s*\{([^}]*)\}/);
const eipFallback = eipRule?.[1].match(/var\(--ph,\s*(#[0-9a-fA-F]{6})\)/)?.[1];

const ph = rgb(token('ph'));
const pairs: Array<[string, RGB, RGB]> = [
  ['--ph on --bg', ph, rgb(token('bg'))],
  ['--ph on --card', ph, rgb(token('card'))],
  ['--ph on --card2 (Field.tsx inputs)', ph, rgb(token('card2'))],
  ['--ph on --sheet', ph, rgb(token('sheet'))],
  ['--ph on edit-in-place input (sheet + tint)', ph, mix(cream, sheetBg, tint)],
  ['--ph on edit-in-place read-only contact input (sheet + 0.03 tint)', ph, mix(cream, sheetBg, 0.03)],
];

describe('placeholder contrast', () => {
  it.each(pairs)('%s is at least 4.5:1', (_n, fg, bg) => {
    expect(ratio(fg, bg)).toBeGreaterThanOrEqual(4.5);
  });

  it('stays visibly lighter-weight than typed text (--fg)', () => {
    expect(ratio(rgb(token('fg')), rgb(token('card2')))).toBeGreaterThan(ratio(ph, rgb(token('card2'))) + 2);
  });

  it('the edit-in-place sheets (outside .org-theme) get the placeholder colour via .org-eip-input', () => {
    expect(eipRule, '.org-eip-input::placeholder rule missing').not.toBeNull();
    expect(eipFallback, 'rule must fall back to a literal colour').toBeDefined();
    expect(eipFallback!.toLowerCase()).toBe(token('ph').toLowerCase());
  });
});

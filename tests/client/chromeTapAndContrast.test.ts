/**
 * New-dancer journey audit (2026-10-16):
 *  M13 the white event title on the pink no-cover surface passes WCAG AA (4.5:1);
 *  L8  the header search pill and the home rail tabs give a 44px tap area in px.
 * Source-level checks: jsdom has no layout, and the classes are the contract.
 */
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { PINK_FALLBACK_SURFACE } from '@/modules/event-page/bento/BentoGrid';

const luminance = (hex: string) => {
  const [r, g, b] = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255).map((c) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4));
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
};
const contrastOnWhite = (hex: string) => 1.05 / (luminance(hex) + 0.05);

describe('M13: pink no-cover surface', () => {
  it('white title on it is at least 4.5:1', () => {
    expect(contrastOnWhite(PINK_FALLBACK_SURFACE)).toBeGreaterThanOrEqual(4.5);
  });
});

describe('L8: 44px tap areas', () => {
  it.each([
    ['src/components/search/HeaderSearch.tsx', /'ml-2 h-\[44px\] min-w-0/],
    ['src/modules/home-map/cards/controls.tsx', /role="tab"[\s\S]*before:-inset-y-\[10px\]/],
  ])('%s', (file, pattern) => {
    expect(readFileSync(file, 'utf8')).toMatch(pattern);
  });
});

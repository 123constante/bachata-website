// @vitest-environment node
/**
 * /festivals confetti -- the ConfettiParticle glyph array in FestivalHub.tsx.
 *
 * Shipped broken: the 10 emoji had been through a cp1252 round-trip that also
 * DROPPED their lead bytes (F0 9F, and 8E on some), leaving lone fragments such
 * as U+2030 and U+00A5 U+00B3. scripts/check-mojibake.mjs could not see it: it
 * matches a lead char (U+00C2/U+00C3/U+00E2) followed by a continuation char,
 * and none of the lead chars survived. This test pins the array instead: every
 * entry must be exactly one emoji, written as \u{...} escapes so the source
 * carries no raw non-ASCII for the mount to mangle again.
 */
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const src = readFileSync('src/pages/FestivalHub.tsx', 'utf8');
const match = src.match(/\{\[([^\]]*)\]\[Math\.floor\(Math\.random\(\) \* 10\)\]\}/);

describe('FestivalHub confetti glyphs', () => {
  it('the ConfettiParticle array is found', () => {
    expect(match).not.toBeNull();
  });

  const raw = match ? match[1] : '';

  it('the source line is pure ASCII (escapes, not raw emoji)', () => {
    expect([...raw].every((c) => c.charCodeAt(0) < 0x80)).toBe(true);
  });

  const glyphs: string[] = match ? (new Function(`return [${raw}]`)() as string[]) : [];

  it('holds exactly 10 entries, matching the * 10 index', () => {
    expect(glyphs).toHaveLength(10);
  });

  it.each(glyphs.map((g, i) => [i, g]))('entry %i is a single real emoji', (_i, g) => {
    expect(/^\p{Extended_Pictographic}$/u.test(g as string)).toBe(true);
    // No cp1252 high-range fragment (U+0080-U+00FF, or the U+2000s/U+0150s it maps to).
    expect(/[\u0080-\u00ff\u0152\u0153\u0160\u0161\u0178\u017d\u017e\u0192\u02c6\u02dc\u2013-\u203a\u20ac\u2122]/.test(g as string)).toBe(false);
  });
});

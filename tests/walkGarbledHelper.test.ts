import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import { GARBLED_RE, findGarbled } from './e2e/helpers/garbled';

// Mojibake is built from \u escapes here on purpose: this file must itself pass scripts/check-mojibake.mjs.
const MOJIBAKE_SAMPLES = ['\u00e2\u20ac\u201d', '\u00e2\u20ac\u2122', '\u00c3\u00a9', '\u00c3\u00b1', '&mdash;', '&hellip;', '&rsquo;', '&amp;', '&nbsp;', '\ufffd'];
const CLEAN_SAMPLES = ['Caf\u00e9 \u2014 it\u2019s fine', 'Friday 8 Oct \u2026 Ritmo', 'plain ascii text', ''];

describe('walk-spec garbled-text helper', () => {
  it.each(MOJIBAKE_SAMPLES)('flags %j', (s) => expect(findGarbled(`before ${s} after`)).not.toEqual([]));
  it.each(CLEAN_SAMPLES)('does not flag clean text %j', (s) => expect(findGarbled(s)).toEqual([]));
  it('is stateless across calls (no /g lastIndex trap)', () => {
    for (let i = 0; i < 3; i++) expect(findGarbled('x &mdash; y')).toHaveLength(1);
    expect(GARBLED_RE.lastIndex).toBe(0);
  });
  it('the helper source is pure ASCII: escape syntax only, never literal mojibake', () => {
    expect(fs.readFileSync('tests/e2e/helpers/garbled.ts', 'utf8')).toMatch(/^[\x00-\x7f]*$/);
  });
});

// Guard: a walk spec must use the shared helper, not its own inline copy of the pattern.
const INLINE_ALLOWLIST: string[] = [];
const INLINE = /u00c3[^\n]*u20ac|&\((?:mdash|hellip)/;
describe('walk specs share one garbled-text pattern', () => {
  const specs = fs.readdirSync('tests/e2e').filter((f) => /^walk-.*\.spec\.ts$/.test(f));
  it('there are walk specs to guard', () => expect(specs.length).toBeGreaterThan(0));
  it.each(specs)('%s has no inline copy unless allowlisted', (f) => {
    const inline = INLINE.test(fs.readFileSync(`tests/e2e/${f}`, 'utf8'));
    expect(inline && !INLINE_ALLOWLIST.includes(f), `${f}: import findGarbled from './helpers/garbled' instead of an inline regex`).toBe(false);
  });
});

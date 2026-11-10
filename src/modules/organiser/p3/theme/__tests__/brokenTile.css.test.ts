import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

// A broken date picture is a small tile with a 44px remove button pinned top-right. The note must
// start BELOW that button, or the button hides words of it (seen at 390x844: "did" lost).
const css = readFileSync(resolve(__dirname, '../p3.css'), 'utf8');
const rule = (sel: string) => css.split('\n').find((l) => l.startsWith(sel)) ?? '';

describe('broken picture tile keeps its note clear of the remove button', () => {
  it('reserves at least the 44px tap zone above the note and lets the tile grow', () => {
    const r = rule('.p3-theme .p3-photo .p3-image-broken');
    const m = r.match(/padding:\s*(\d+)px/);
    expect(m, r).not.toBeNull();
    expect(Number(m![1])).toBeGreaterThanOrEqual(40);
    expect(r).toMatch(/height:\s*auto/);
    expect(rule('.p3-theme .p3-photo:has(> .p3-image-broken)')).toMatch(/aspect-ratio:\s*auto/);
  });
});

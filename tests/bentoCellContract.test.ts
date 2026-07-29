import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

/**
 * --bento-cell is a cross-file invariant held together by comments alone, and
 * getting it wrong is SILENT: the container-query tier keeps working on every
 * modern engine, so a broken fallback only shows up on iOS Safari < 16 -- a
 * cohort nobody tests on, on a ~95% mobile site.
 *
 * It has already been shipped wrong once. A fallback derived from the page
 * shell (`max-w-2xl px-3 sm:px-4` in EventPageScreen, which does not render the
 * bento at all) instead of the real wrapper handed a tablet a 155.5px cell
 * against a true 99px -- the cover block's min-height became 478px rather than
 * 309px, ~170px of dead tile under the artwork.
 *
 * So: derive every number from source and assert the CSS agrees.
 *
 *   grid inline size = min(wrapperMaxW, 100vw) - 2 * wrapperPadding
 *   cell             = (grid inline size - (GRID_COLS - 1) * GAP_PX) / GRID_COLS
 */

const root = resolve(__dirname, '..');
const read = (p: string) => readFileSync(resolve(root, p), 'utf8');

const bentoPage = read('src/modules/event-page/bento/BentoPage.tsx');
const bentoGrid = read('src/modules/event-page/bento/BentoGrid.tsx');
const css = read('src/index.css');

// Tailwind spacing scale: px-N is N * 0.25rem, and this project's rem is 16px.
const TW_SPACING_PX = 4;

const wrapper = bentoPage.match(/className="mx-auto w-full max-w-\[(\d+)px\] px-(\d+)/);
const maxW = Number(wrapper?.[1]);
const padPx = Number(wrapper?.[2]) * TW_SPACING_PX;

const cols = Number(bentoGrid.match(/const GRID_COLS = (\d+);/)?.[1]);
const gap = Number(bentoGrid.match(/const GAP_PX = (\d+);/)?.[1]);

// Total inter-column gutter, which every tier subtracts.
const gutters = () => (cols - 1) * gap;

const RE_CQ = /--bento-cell:\s*calc\(\(100cqw - (\d+)px\) \/ (\d+)\)/;
const RE_VW = /--bento-cell:\s*calc\(\(100vw - (\d+)px\) \/ (\d+)\)/;
const RE_CAP = /@media \(min-width:\s*(\d+)px\)\s*\{\s*:root\s*\{\s*--bento-cell:\s*([\d.]+)px/;

describe('--bento-cell fallback tracks the real bento container', () => {
  it('finds the bento wrapper in BentoPage.tsx', () => {
    expect(
      wrapper,
      'BentoPage.tsx no longer has an `mx-auto w-full max-w-[Npx] px-N` wrapper. ' +
        'If the bento container moved or changed shape, the --bento-cell fallback ' +
        'in src/index.css must be re-derived from the new one -- see the comment ' +
        'block above --bento-cell.',
    ).not.toBeNull();
    expect(bentoPage).toMatch(/<BentoGrid\b/);
  });

  it('reads GRID_COLS and GAP_PX from BentoGrid.tsx', () => {
    expect(Number.isFinite(cols)).toBe(true);
    expect(Number.isFinite(gap)).toBe(true);
  });

  it('the container-query tier subtracts exactly (GRID_COLS - 1) * GAP_PX', () => {
    // 100cqw resolves against the grid element itself, so padding is already
    // excluded -- only the gutters come off.
    const m = css.match(RE_CQ);
    expect(m, 'the @supports container-query --bento-cell rule is missing or reshaped').not.toBeNull();
    expect(Number(m?.[1])).toBe(gutters());
    expect(Number(m?.[2])).toBe(cols);
  });

  it('the viewport fallback subtracts the wrapper padding AND the gutters', () => {
    const m = css.match(RE_VW);
    expect(m, 'the base viewport --bento-cell fallback is missing or reshaped').not.toBeNull();
    expect(
      Number(m?.[1]),
      `expected ${2 * padPx}px of padding + ${gutters()}px of gutters`,
    ).toBe(2 * padPx + gutters());
    expect(Number(m?.[2])).toBe(cols);
  });

  it('the fallback freezes at the wrapper max-width, with the right cell', () => {
    const m = css.match(RE_CAP);
    expect(m, 'the --bento-cell max-width breakpoint is missing or reshaped').not.toBeNull();
    // Below the breakpoint the cell tracks the viewport; at and above it the
    // wrapper stops growing, so the cell must be constant.
    expect(Number(m?.[1]), 'breakpoint must equal the wrapper max-width').toBe(maxW);
    const expected = (maxW - 2 * padPx - gutters()) / cols;
    expect(
      Number(m?.[2]),
      `cell at the cap = (${maxW} - ${2 * padPx} - ${gutters()}) / ${cols}`,
    ).toBe(expected);
  });

  it('the two fallback tiers agree at the breakpoint (no discontinuity)', () => {
    const base = css.match(RE_VW);
    const capped = css.match(RE_CAP);
    const atBreakpoint = (maxW - Number(base?.[1])) / Number(base?.[2]);
    expect(atBreakpoint).toBe(Number(capped?.[2]));
  });

  it('the container-query tier still wins over the fallback', () => {
    // Custom properties resolve by source order at equal specificity, so the
    // @supports block must come LAST or every modern engine silently drops to
    // the approximation.
    const supportsAt = css.indexOf('@supports (container-type: inline-size)');
    const mediaAt = css.search(/@media \(min-width:\s*\d+px\)\s*\{\s*:root\s*\{\s*--bento-cell/);
    expect(supportsAt).toBeGreaterThan(-1);
    expect(mediaAt).toBeGreaterThan(-1);
    expect(
      supportsAt,
      'the @supports container-query tier must appear AFTER the fallback media rule',
    ).toBeGreaterThan(mediaAt);
  });

  it('the historical 95px note still matches the real container at 412px', () => {
    // Both files cite 95px as the value the retired JS measurement produced at a
    // 412px viewport. That is load-bearing evidence for the derivation -- if it
    // stops rounding to 95, the container shape changed and the comments lie.
    const cellAt412 = (Math.min(maxW, 412) - 2 * padPx - gutters()) / cols;
    expect(Math.round(cellAt412)).toBe(95);
  });
});

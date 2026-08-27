import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

/**
 * TIMETABLE_ROW_PX (TypeScript) and `--tl-rowh` (the inlined stylesheet) are the
 * SAME NUMBER declared twice, in one file, ~1,200 lines apart -- and until this
 * test they were held together by a comment.
 *
 * Getting it wrong is SILENT. `--tl-rowh` sets the real height of an hour row;
 * TIMETABLE_ROW_PX is what `rosterCapacity()` divides to decide how many artist
 * names a card can hold. The card deliberately carries no `overflow:hidden`
 * (that would kill the sticky label) and sits at `z-index:3`, so a card whose
 * roster outgrows it paints straight over the session BELOW it rather than
 * clipping. Shrink `--tl-rowh` alone and rosters overflow their cards; grow it
 * alone and every card under-fills. Nothing fails, nothing looks broken in a
 * screenshot of a short day, and no existing gate reads either value.
 *
 * This is the same coupling shape as `--bento-cell`, which CLAUDE.md records as
 * "guarded by tests/bentoCellContract.test.ts". That one was shipped wrong once,
 * from a plausible-looking derivation, and cost ~170px of dead tile on tablets.
 * So: read both numbers out of source and assert they agree.
 */

const root = resolve(__dirname, '..');
const src = readFileSync(resolve(root, 'src/pages/FestivalDetail.tsx'), 'utf8');

const cssMatch = src.match(/--tl-rowh:\s*(\d+)px/);
const tsMatch = src.match(/const TIMETABLE_ROW_PX = (\d+);/);

describe('TIMETABLE_ROW_PX tracks the --tl-rowh CSS token', () => {
  // BOTH EDGES PINNED. A test that only compared the two numbers would pass
  // vacuously the day either construct is renamed away -- two failed matches
  // and nothing to compare is exactly the "unknown recorded as agreement"
  // failure. Assert each anchor is REACHABLE before asserting they agree.
  it('finds the --tl-rowh token in the inlined stylesheet', () => {
    expect(
      cssMatch,
      'CINEMATIC_CSS no longer declares `--tl-rowh:<N>px` on .program-wrap. If the ' +
        'hour-row height moved to another token, re-point this test AND ' +
        'rosterCapacity() -- the roster budget is computed against it.',
    ).not.toBeNull();
  });

  it('finds the TIMETABLE_ROW_PX constant', () => {
    expect(
      tsMatch,
      'FestivalDetail.tsx no longer declares `const TIMETABLE_ROW_PX = <N>;`. ' +
        'rosterCapacity() needs a row height in pixels to bound the artist list.',
    ).not.toBeNull();
  });

  it('the two agree', () => {
    const css = Number(cssMatch?.[1]);
    const ts = Number(tsMatch?.[1]);
    expect(Number.isFinite(css) && Number.isFinite(ts)).toBe(true);
    expect(
      ts,
      `--tl-rowh is ${css}px but TIMETABLE_ROW_PX is ${ts}. rosterCapacity() would ` +
        `budget artist names against a row height the grid does not use: too few ` +
        `and cards under-fill, too many and the roster paints over the session below ` +
        `(the card cannot clip -- overflow:hidden disables its sticky label).`,
    ).toBe(css);
  });
});

import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

// @ts-expect-error -- .mjs guard script, no type declarations (same as the
// other script-under-test specs in this directory).
import { isEntryPoint } from '../scripts/lib/entry-point.mjs';
// @ts-expect-error -- as above.
import { selfTest } from '../scripts/prove-entry-point-dispatch.mjs';

/**
 * isEntryPoint decides whether the CLI scripts in this repo run at all --
 * including ship-gate.mjs, pre-ship.mjs, the review-stamp writer and both
 * session hooks. (No count here: scripts/prove-entry-point-dispatch.mjs's
 * TARGETS is the instrument, and a number copied into prose drifts off it.)
 * Before this spec its only proof was `prove-entry-point-dispatch.mjs
 * --self-test`, which nothing was obliged to run, so an edit to the predicate
 * could have disarmed every one of them with nothing going red.
 *
 * The full sweep (junction arms, spawned processes) stays out of the unit gate
 * -- it needs link-creation rights and takes seconds. The canary does not: it
 * is in-process, offline, and its one link-dependent case skips rather than
 * fails where links are unavailable. Same shape as tests/reworkShare.test.ts,
 * which drives that script's selfTest in-process for the same reason.
 */
describe('entry-point predicate', () => {
  it('passes its own self-test in-process', async () => {
    const code = await selfTest();
    expect(code).toBe(0);
  });

  // Not a duplicate of the canary: this pins the two directions the REST of the
  // repo depends on, so a future refactor of the canary cannot quietly drop
  // them. Importing this spec is itself the negative case -- if isEntryPoint
  // were true on import, the CLI tails of both imported modules would have
  // fired and taken the test runner's exit code with them.
  // fileURLToPath, NOT a hand-stripped pathname. The first version wrote
  // `url.pathname.replace(/^\//, '')`, which is right on Windows
  // (/C:/dev/... -> C:/dev/...) and WRONG everywhere else: on Linux
  // /home/runner/... becomes home/runner/..., a RELATIVE path that resolves
  // against cwd and does not exist, so the predicate correctly returned false
  // and the test failed. Caught by CI's Linux runner, not by any local run --
  // the same Windows-only-assumption class the sibling PR hit in its own
  // canary cases.
  it('is true for its own module path and false for another file', () => {
    const self = fileURLToPath(new URL('../scripts/lib/entry-point.mjs', import.meta.url));
    const other = fileURLToPath(new URL('../scripts/ship-gate.mjs', import.meta.url));
    const selfUrl = new URL('../scripts/lib/entry-point.mjs', import.meta.url).href;
    expect(isEntryPoint(selfUrl, { argv: ['node', self] })).toBe(true);
    expect(isEntryPoint(selfUrl, { argv: ['node', other] })).toBe(false);
  });
});

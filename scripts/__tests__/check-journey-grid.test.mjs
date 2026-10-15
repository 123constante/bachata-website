// Run with: node --test scripts/__tests__/check-journey-grid.test.mjs
// (vitest's include globs do not cover scripts/, so this uses node:test.)
import test from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { checkGrid, extractTitles, selfTest } from '../check-journey-grid.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const SCRIPT = path.join(HERE, '..', 'check-journey-grid.mjs');
const FULL = path.join(HERE, 'fixtures', 'journey-grid', 'full');
const EMPTY = path.join(HERE, 'fixtures', 'journey-grid', 'does-not-exist');

test('full-coverage fixture exits 0 through the CLI', () => {
  const r = spawnSync(process.execPath, [SCRIPT, '--root', FULL], { encoding: 'utf8' });
  assert.equal(r.status, 0, r.stderr);
});

test('missing grid exits 1 with a clear message, not 0', () => {
  const r = spawnSync(process.execPath, [SCRIPT, '--root', EMPTY], { encoding: 'utf8' });
  assert.equal(r.status, 1);
  assert.match(r.stderr, /journey-grid\.json not found/);
});

test('--skip-if-absent prints a SKIP and exits 0; JOURNEY_GRID_REQUIRED=1 makes it fail', () => {
  const skip = spawnSync(process.execPath, [SCRIPT, '--root', EMPTY, '--skip-if-absent'], { encoding: 'utf8' });
  assert.equal(skip.status, 0);
  assert.match(skip.stdout, /SKIP:/);
  const hard = spawnSync(process.execPath, [SCRIPT, '--root', EMPTY, '--skip-if-absent'], {
    encoding: 'utf8',
    env: { ...process.env, JOURNEY_GRID_REQUIRED: '1' },
  });
  assert.equal(hard.status, 1);
});

test('the built-in self-test (every failing case) is green', () => {
  const r = selfTest();
  assert.equal(r.exit, 0, r.lines.join('\n'));
});

test('checkGrid on the full fixture reports no gaps', () => {
  const r = checkGrid({ root: FULL });
  assert.equal(r.exit, 0);
  assert.deepEqual(r.gaps, []);
});

test('extractTitles expands template titles from the for table and reads escapes', () => {
  const src = "for (const [a, b] of [['x', 'y'], ['p', 'q']]) {\n  test(`${a}: ${b}`, () => {});\n}\ntest('it\\'s ok', () => {});";
  const t = extractTitles(src);
  assert.ok(t.has('x: y') && t.has('p: q') && t.has("it's ok"));
});

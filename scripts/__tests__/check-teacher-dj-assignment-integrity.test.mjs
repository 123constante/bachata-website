// Run with: node --test scripts/__tests__/check-teacher-dj-assignment-integrity.test.mjs
// (vitest's include globs do not cover scripts/, so this uses node:test.)
import test from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  judge,
  runCase,
  selfTest,
  SELF_TEST_CASES,
  BASELINE_CUTOFF_UTC,
  BASELINE_TEACHERS_DEFICIT,
  BASELINE_DJS_DEFICIT,
} from '../check-teacher-dj-assignment-integrity.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const SCRIPT = path.join(HERE, '..', 'check-teacher-dj-assignment-integrity.mjs');

// Prod shape read 2026-11-04 (read-only): teachers 94 assigned / 34 unassigned,
// 104 roles created on/before 2026-07-24; DJs 33 / 10, 29.
const LIVE = {
  status: 'drift',
  active_teachers_assigned: 94,
  active_teachers_unassigned: 34,
  active_djs_assigned: 33,
  active_djs_unassigned: 10,
};
const PRE = { teachers: 104, djs: 29 };

test('cutoff reuses the 2026-07-24 re-baseline date (inclusive)', () => {
  assert.equal(BASELINE_CUTOFF_UTC, '2026-07-25T00:00:00Z');
});

test('baselines equal the live deficits, so main is green today', () => {
  assert.equal(BASELINE_TEACHERS_DEFICIT, PRE.teachers - LIVE.active_teachers_assigned);
  assert.equal(BASELINE_DJS_DEFICIT, PRE.djs - LIVE.active_djs_assigned);
  assert.equal(judge(LIVE, PRE).exit, 0);
});

test('roster growth after the cutoff (no line-up) warns, never fails', () => {
  for (let n = 1; n <= 20; n++) {
    const v = judge({ ...LIVE, active_teachers_unassigned: 34 + n, active_djs_unassigned: 10 + n }, PRE);
    assert.equal(v.exit, 0);
    assert.equal(v.level, 'warn');
    assert.match(v.message, /^WARN: /);
  }
});

test('MUTANT: a pre-baseline person losing their last line-up goes red', () => {
  const t = judge({ ...LIVE, active_teachers_assigned: 93, active_teachers_unassigned: 35 }, PRE);
  assert.equal(t.exit, 1);
  assert.match(t.message, /^FAIL: .*teachers 104-93=11/);
  const d = judge({ ...LIVE, active_djs_assigned: 32, active_djs_unassigned: 11 }, PRE);
  assert.equal(d.exit, 1);
  assert.match(d.message, /^FAIL: .*DJs 29-32=-3/);
});

test('MUTANT: raising the pre-baseline count (an old unassigned role re-activated) goes red', () => {
  const v = judge({ ...LIVE, active_teachers_unassigned: 35 }, { ...PRE, teachers: 105 });
  assert.equal(v.exit, 1);
});

test('the old 34/10 ceiling no longer gates: 40/15 unassigned with no lost assignment is green', () => {
  const v = judge({ ...LIVE, active_teachers_unassigned: 40, active_djs_unassigned: 15 }, PRE);
  assert.equal(v.exit, 0);
});

test('every self-test case pins its branch through main()', async () => {
  for (const c of SELF_TEST_CASES) {
    const r = await runCase(c);
    assert.equal(r.exit, c.exit, c.name);
    assert.ok(r.lines.some((l) => c.re.test(l)), `${c.name}: ${r.lines.join(' | ')}`);
  }
});

test('the built-in self-test is green in-process', async () => {
  assert.equal(await selfTest(), true);
});

test('--self-test through the CLI exits 0; an unknown flag exits 2', () => {
  const ok = spawnSync(process.execPath, [SCRIPT, '--self-test'], { encoding: 'utf8' });
  assert.equal(ok.status, 0, ok.stderr);
  assert.match(ok.stdout, /PASS self-test/);
  const bad = spawnSync(process.execPath, [SCRIPT, '--nope'], { encoding: 'utf8' });
  assert.equal(bad.status, 2);
});

test('a deficit below baseline prints a RATCHET line; at baseline it does not', () => {
  assert.doesNotMatch(judge(LIVE, PRE).message, /RATCHET/);
  const v = judge({ ...LIVE, active_djs_assigned: 34, active_djs_unassigned: 9 }, PRE);
  assert.equal(v.exit, 0);
  assert.match(v.message, /RATCHET: lower BASELINE_DJS_DEFICIT -4 -> -5/);
});

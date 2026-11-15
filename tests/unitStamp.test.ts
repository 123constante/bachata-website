import { describe, it, expect } from 'vitest';
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { canWriteStamp, decideUnitStamp, formatStamp, STAMP_MAX_AGE_MS } from '../scripts/lib/unit-stamp.mjs';

const TREE = 'a'.repeat(40);
const OTHER = 'b'.repeat(40);
const NOW = 1_800_000_000_000;

describe('decideUnitStamp', () => {
  it('fresh stamp on the same tree skips, reporting minutes', () => {
    expect(decideUnitStamp(formatStamp(TREE, NOW - 5 * 60_000), TREE, NOW)).toEqual({ skip: true, minutes: 5 });
  });
  it('a different tree runs', () => {
    expect(decideUnitStamp(formatStamp(OTHER, NOW - 1000), TREE, NOW).skip).toBe(false);
  });
  it('a stale stamp runs (exactly 60 min and older)', () => {
    expect(decideUnitStamp(formatStamp(TREE, NOW - STAMP_MAX_AGE_MS), TREE, NOW).skip).toBe(false);
    expect(decideUnitStamp(formatStamp(TREE, NOW - STAMP_MAX_AGE_MS + 1), TREE, NOW).skip).toBe(true);
  });
  it('a missing stamp runs', () => {
    expect(decideUnitStamp(undefined as unknown as string, TREE, NOW).skip).toBe(false);
    expect(decideUnitStamp('', TREE, NOW).skip).toBe(false);
  });
  it('garbled stamps run', () => {
    for (const bad of ['not json', '{}', 'null', '[]', '{"tree":1,"at":2}', `{"tree":"${TREE}","at":"x"}`, `{"tree":"${TREE}"}`]) {
      expect(decideUnitStamp(bad, TREE, NOW).skip).toBe(false);
    }
  });
  it('a stamp from the future runs', () => {
    expect(decideUnitStamp(formatStamp(TREE, NOW + 60_000), TREE, NOW).skip).toBe(false);
  });
  it('a malformed current tree runs', () => {
    expect(decideUnitStamp(formatStamp('x', NOW), 'x', NOW).skip).toBe(false);
  });
  // Non-vacuity: the tree comparison is what separates skip from run. A stamp that
  // differs by one character must not skip; if the comparison were dropped this fails.
  it('non-vacuity: one differing character in the tree sha does not skip', () => {
    const near = TREE.slice(0, 39) + 'b';
    expect(decideUnitStamp(formatStamp(near, NOW), TREE, NOW).skip).toBe(false);
    expect(decideUnitStamp(formatStamp(TREE, NOW), TREE, NOW).skip).toBe(true);
  });
});

describe('non-finite now', () => {
  it('NaN / Infinity nowMs runs', () => {
    expect(decideUnitStamp(formatStamp(TREE, NOW), TREE, NaN).skip).toBe(false);
    expect(decideUnitStamp(formatStamp(TREE, NOW), TREE, Infinity).skip).toBe(false);
  });
});

describe('canWriteStamp', () => {
  const clean = { tree: TREE, clean: true };
  it('writes only when clean and the tree did not move', () => {
    expect(canWriteStamp(clean, clean)).toBe(true);
    expect(canWriteStamp(clean, { tree: OTHER, clean: true })).toBe(false);
    expect(canWriteStamp(clean, { tree: TREE, clean: false })).toBe(false);
    expect(canWriteStamp({ tree: TREE, clean: false }, clean)).toBe(false);
    expect(canWriteStamp(null as never, clean)).toBe(false);
  });
});

describe('unit-stamp CLI', () => {
  it('`write` writes no stamp and prints run', () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'unit-stamp-'));
    const g = (...a: string[]) => execFileSync('git', a, { cwd: dir, stdio: 'ignore' });
    g('init', '-q');
    fs.writeFileSync(path.join(dir, 'f'), 'x');
    g('add', 'f');
    g('-c', 'user.name=t', '-c', 'user.email=t@t', 'commit', '-qm', 'c');
    const script = path.resolve(__dirname, '../scripts/unit-stamp.mjs');
    let out = '';
    let code = 0;
    try {
      out = execFileSync('node', [script, 'write'], { cwd: dir, encoding: 'utf8' });
    } catch (e) {
      code = (e as { status?: number }).status ?? 1;
    }
    expect(fs.existsSync(path.join(dir, '.git', 'preship-unit-stamp'))).toBe(false);
    expect(code !== 0 || out.trim() === 'run').toBe(true);
    fs.rmSync(dir, { recursive: true, force: true });
  });
});

import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import {
  assertTargetsCover,
  checkTargetsCoverage,
} from '../scripts/prove-entry-point-dispatch.mjs';
import { entryPointCoverageResult } from '../scripts/pre-ship.mjs';

/**
 * The TARGETS-coverage check, run locally by pre-ship (and so, through this
 * suite, by pre-push's unit gate) instead of only in architecture-guard.yml.
 * Fake trees use a file name that is in TARGETS (check-mojibake.mjs) and one
 * that never will be (zz-probe.mjs).
 */
const DISPATCH = "if (isEntryPoint(import.meta.url)) main();\n";
const IMPORT_ONLY = "import { isEntryPoint } from './lib/entry-point.mjs';\nexport const x = isEntryPoint;\n";

const LISTED = [{ rel: 'scripts/check-mojibake.mjs' }];
const cover = (root: string) => checkTargetsCoverage(root, assertTargetsCover, LISTED);

const roots: string[] = [];
function tree(files: Record<string, string>): string {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'ep-cover-'));
  roots.push(root);
  for (const [rel, body] of Object.entries(files)) {
    fs.mkdirSync(path.dirname(path.join(root, rel)), { recursive: true });
    fs.writeFileSync(path.join(root, rel), body);
  }
  return root;
}
afterEach(() => {
  for (const r of roots.splice(0)) fs.rmSync(r, { recursive: true, force: true });
});

describe('assertTargetsCover / checkTargetsCoverage', () => {
  it('a listed dispatching file is green', () => {
    const root = tree({ 'scripts/check-mojibake.mjs': DISPATCH });
    expect(assertTargetsCover(root)).toEqual([]);
    expect(cover(root).code).toBe(0);
  });

  it('an unlisted dispatching file is red, named, with the fix', () => {
    const root = tree({
      'scripts/check-mojibake.mjs': DISPATCH,
      'scripts/zz-probe.mjs': DISPATCH,
      'scripts/sub/zz-deep.mjs': DISPATCH,
    });
    expect(assertTargetsCover(root).sort()).toEqual(['scripts/sub/zz-deep.mjs', 'scripts/zz-probe.mjs']);
    const r = cover(root);
    expect(r.code).toBe(1);
    const text = r.lines.join('\n');
    expect(text).toContain('scripts/zz-probe.mjs');
    expect(text).toContain('scripts/sub/zz-deep.mjs');
    expect(text).toContain('add it to TARGETS in scripts/prove-entry-point-dispatch.mjs');
  });

  it('a file that only imports the helper is green', () => {
    const root = tree({ 'scripts/check-mojibake.mjs': DISPATCH, 'scripts/zz-probe.mjs': IMPORT_ONLY });
    expect(cover(root).code).toBe(0);
  });

  it('a missing scripts/ is "cannot run" (2), never a silent green', () => {
    const root = tree({ 'README.md': 'x' });
    expect(assertTargetsCover(root)).toEqual([]); // the walker alone WOULD be green
    const r = cover(root);
    expect(r.code).toBe(2);
    expect(r.lines.join('\n')).toContain('cannot run');
  });

  it('a listed target that no longer exists is "cannot run" (2), naming it', () => {
    const root = tree({ 'scripts/other.mjs': '' });
    const r = cover(root);
    expect(r.code).toBe(2);
    expect(r.lines.join('\n')).toContain('scripts/check-mojibake.mjs');
  });

  it('a read error during the walk is "cannot run" (2)', () => {
    const root = tree({ 'scripts/check-mojibake.mjs': DISPATCH });
    const r = checkTargetsCoverage(
      root,
      () => {
        throw Object.assign(new Error('EACCES: permission denied'), { code: 'EACCES' });
      },
      LISTED,
    );
    expect(r.code).toBe(2);
    expect(r.lines.join('\n')).toContain('EACCES');
  });

  it('the real tree is covered (the same red pre-push would meet)', () => {
    const r = checkTargetsCoverage();
    expect(r.lines).toEqual([expect.stringContaining('every scripts/**/*.mjs')]);
    expect(r.code).toBe(0);
  });
});

describe('pre-ship entryPointCoverageResult', () => {
  const run = async (code: number, lines: string[]) => {
    const logged: string[] = [];
    const res = await entryPointCoverageResult(() => ({ code, lines }), (l: string) => logged.push(l));
    return { res, logged };
  };

  it('0 is a PASS row', async () => {
    const { res, logged } = await run(0, ['ok']);
    expect(res).toMatchObject({ id: 'prove:entry-point:coverage', ok: true });
    expect(logged).toEqual(['PASS prove:entry-point:coverage']);
  });

  it('1 is a FAIL row that prints the named files', async () => {
    const { res, logged } = await run(1, ['head', '  scripts/zz-probe.mjs  -- add it to TARGETS in scripts/prove-entry-point-dispatch.mjs']);
    expect(res.ok).toBe(false);
    expect(logged.join('\n')).toContain('scripts/zz-probe.mjs');
  });

  it('2 (cannot run) is a FAIL row, not a pass', async () => {
    expect((await run(2, ['cannot run'])).res.ok).toBe(false);
  });

  it('a throwing check is a FAIL row, not a crash', async () => {
    const logged: string[] = [];
    const res = await entryPointCoverageResult(
      () => {
        throw new Error('boom');
      },
      (l: string) => logged.push(l),
    );
    expect(res.ok).toBe(false);
    expect(logged.join('\n')).toContain('boom');
  });

  it('the default (dynamic import of the real proof) passes on this tree', async () => {
    const logged: string[] = [];
    const res = await entryPointCoverageResult(undefined, (l: string) => logged.push(l));
    expect(logged).toEqual(['PASS prove:entry-point:coverage']);
    expect(res.ok).toBe(true);
  });
});

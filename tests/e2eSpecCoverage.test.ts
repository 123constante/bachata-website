/**
 * scripts/check-e2e-spec-coverage.mjs -- table-driven rules, plus the LIVE
 * tree. The last block is how the guard reaches CI: unit-tests.yml runs the
 * vitest suite on every pull_request, so a spec added to tests/e2e/ without
 * being listed in a CI e2e list (or allow-listed in MANUAL) turns that job red.
 */
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterAll, describe, expect, it } from 'vitest';
import { findSpecs, listedSpecs, main, runCheck } from '../scripts/check-e2e-spec-coverage.mjs';

const SCRIPTS = {
  'test:e2e': 'playwright test tests/e2e/a.spec.ts tests/e2e/sub/b.spec.ts --project=chromium',
  'test:e2e:p3': 'playwright test tests/e2e/c.spec.ts --project=chromium',
};
const WORKFLOWS = {
  '.github/workflows/e2e-smoke.yml': '      - name: smoke\n        run: npm run test:e2e\n      - name: p3\n        run: npm run test:e2e:p3\n',
};
const MANUAL = { 'tests/e2e/m.spec.ts': { reason: 'walk', run: 'npx playwright test tests/e2e/m.spec.ts' } };
const SPECS = ['tests/e2e/a.spec.ts', 'tests/e2e/c.spec.ts', 'tests/e2e/m.spec.ts', 'tests/e2e/sub/b.spec.ts'];

type Over = Partial<{ scripts: Record<string, string>; workflows: Record<string, string>; specs: string[]; manual: Record<string, { reason: string; run: string }> }>;
const check = (o: Over = {}) =>
  runCheck({ scripts: o.scripts ?? SCRIPTS, workflows: o.workflows ?? WORKFLOWS, specs: o.specs ?? SPECS, manual: o.manual ?? MANUAL });

describe('runCheck', () => {
  it.each([
    ['listed specs + allow-listed spec pass', {}, 0, 'OK'],
    ['listed spec in a subfolder passes', { specs: ['tests/e2e/a.spec.ts', 'tests/e2e/c.spec.ts', 'tests/e2e/sub/b.spec.ts'], manual: {} }, 0, 'OK'],
    ['unlisted spec fails, named', { specs: [...SPECS, 'tests/e2e/foo.spec.ts'] }, 1, 'tests/e2e/foo.spec.ts runs in NO CI e2e list'],
    ['the failure says how to fix it', { specs: [...SPECS, 'tests/e2e/foo.spec.ts'] }, 1, 'allow-list it in MANUAL'],
    ['stale allow-list entry fails', { specs: SPECS.filter((s) => !s.endsWith('/m.spec.ts')) }, 1, 'tests/e2e/m.spec.ts names a file that does not exist'],
    ['listed AND allow-listed fails', { manual: { ...MANUAL, 'tests/e2e/a.spec.ts': { reason: 'x', run: 'y' } } }, 1, 'AND in MANUAL'],
    ['allow-list entry with no reason fails', { manual: { 'tests/e2e/m.spec.ts': { reason: ' ', run: 'x' } } }, 1, 'needs both a reason and a run command'],
    ['CI list naming a missing file fails', { specs: SPECS.filter((s) => !s.endsWith('/c.spec.ts')) }, 1, 'which does not exist'],
    ['a list the workflow no longer runs fails', { workflows: { '.github/workflows/e2e-smoke.yml': 'run: npm run test:e2e\n' } }, 1, 'no longer runs `npm run test:e2e:p3`'],
    ['missing CI list script cannot measure (2)', { scripts: { 'test:e2e': SCRIPTS['test:e2e'] } }, 2, 'no "test:e2e:p3" script'],
    ['zero specs cannot measure (2), never green', { specs: [] }, 2, 'ZERO'],
  ] as const)('%s', (_n, over, code, text) => {
    const r = check(over as Over);
    expect(r.code).toBe(code);
    expect(r.lines.join('\n')).toContain(text);
  });

  it('listedSpecs keeps only tests/e2e spec tokens', () => {
    expect(listedSpecs('playwright test tests/e2e/a.spec.ts --project=chromium tests/other/x.spec.ts')).toEqual(['tests/e2e/a.spec.ts']);
  });
});

describe('findSpecs on a real directory', () => {
  const root = mkdtempSync(path.join(tmpdir(), 'e2e-cov-'));
  afterAll(() => rmSync(root, { recursive: true, force: true }));
  const put = (rel: string) => {
    mkdirSync(path.dirname(path.join(root, rel)), { recursive: true });
    writeFileSync(path.join(root, rel), '// x\n');
  };
  ['tests/e2e/a.spec.ts', 'tests/e2e/sub/b.spec.ts', 'tests/e2e/helpers/h.spec.ts', 'tests/e2e/helpers/mock.ts', 'tests/e2e/live/pages.spec.ts', 'tests/e2e/sub/live/x.spec.ts', 'tests/e2e/util.ts'].forEach(put);

  it('recurses into subfolders (helpers/ included: playwright would collect a spec there), ignores live/ at any depth and non-specs', () => {
    expect(findSpecs(root)).toEqual(['tests/e2e/a.spec.ts', 'tests/e2e/helpers/h.spec.ts', 'tests/e2e/sub/b.spec.ts']);
  });
});

describe('main() exit codes', () => {
  it('self-test passes (0)', async () => {
    expect(await main(['--self-test'])).toBe(0);
  });
  it('unreadable package.json is 2, not a pass', async () => {
    const log: string[] = [];
    const code = await main([], { readFile: () => { throw new Error('ENOENT package.json'); }, log: (l: string) => log.push(l) });
    expect(code).toBe(2);
    expect(log.join('\n')).toContain('CANNOT MEASURE');
  });
});

describe('the live tree', () => {
  it('every tests/e2e spec is in a CI e2e list or allow-listed with a reason (exit 0)', async () => {
    const log: string[] = [];
    const code = await main([], { log: (l: string) => log.push(l) });
    // On failure the message names each unlisted file and both remedies.
    expect(log.join('\n'), log.join('\n')).toContain('e2e spec coverage OK');
    expect(code).toBe(0);
  });
});

// @vitest-environment node
// scripts/deploy-trial-decide.mjs -- the deploy-or-skip decision of
// .github/workflows/deploy-production-trial.yml. It must use the ONE build-path
// rule (BUILD_PATHS in scripts/vercel-ignore-build.sh via buildRule.mjs), never
// a second list, and every "don't know" must DEPLOY.
import { describe, it, expect } from 'vitest';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, writeFileSync, mkdirSync, rmSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { decide, changedPaths, main, DEPLOY_REF } from '../scripts/deploy-trial-decide.mjs';

const MAIN = DEPLOY_REF;

const TABLE: Array<[string, string, string[] | null, boolean]> = [
  ['docs-only', MAIN, ['docs/ops/x.md', 'CLAUDE.md'], false],
  ['code', MAIN, ['src/main.tsx'], true],
  ['mixed docs + code', MAIN, ['docs/a.md', 'app/root.tsx'], true],
  ['workflow-only', MAIN, ['.github/workflows/deploy-production-trial.yml'], false],
  ['scripts + tests only', MAIN, ['scripts/check-mojibake.mjs', 'tests/a.test.ts'], false],
  ['the ignore rule itself', MAIN, ['scripts/vercel-ignore-build.sh'], true],
  ['package.json', MAIN, ['package.json'], true],
  ['empty diff', MAIN, [], false],
  ['unknown paths (fail-safe)', MAIN, null, true],
  ['brief/ branch, code', 'refs/heads/brief/vercel-actions-deploy-trial-1', ['src/main.tsx'], false],
  ['claude/ branch, code', 'refs/heads/claude/vercel-actions-deploy-trial-1', ['src/main.tsx'], false],
  ['brief docs path on main', MAIN, ['docs/briefs/vercel-actions-deploy-trial-1.md'], false],
];

describe('decide', () => {
  it.each(TABLE)('%s', (_name, ref, paths, want) => {
    expect(decide({ ref, paths }).deploy).toBe(want);
  });

  it('reads the ignore script literal, not a copy (a new spec there changes the answer)', () => {
    expect(decide({ ref: MAIN, paths: ['newdir/x.ts'] }).deploy).toBe(false);
    expect(decide({ ref: MAIN, paths: ['newdir/x.ts'], specs: ['newdir'] }).deploy).toBe(true);
  });

  it('has no second path list in its source', () => {
    const src = readFileSync(join(__dirname, '..', 'scripts', 'deploy-trial-decide.mjs'), 'utf8');
    expect(src).toMatch(/from '\.\/lib\/buildRule\.mjs'/);
    expect(src).not.toMatch(/['"]src\/?['"]|['"]public\/?['"]/);
  });
});

describe('changedPaths fail-safe', () => {
  it.each([[''], ['0000000000000000000000000000000000000000']])('no base %j -> unknown', (base) => {
    expect(changedPaths(base, 'abc').paths).toBeNull();
  });
  it('unresolvable sha -> unknown', () => {
    const run = () => { throw new Error('fatal: bad revision'); };
    expect(changedPaths('abc', 'def', run).paths).toBeNull();
  });
  it('base == head -> unknown (redeploy)', () => {
    expect(changedPaths('abc', 'abc', () => '').paths).toBeNull();
  });
});

describe('main (real git, exit codes and $GITHUB_OUTPUT)', () => {
  const dir = mkdtempSync(join(tmpdir(), 'deploy-trial-'));
  const g = (...a: string[]) => execFileSync('git', a, { cwd: dir, encoding: 'utf8' }).trim();
  const put = (p: string) => { mkdirSync(dirname(join(dir, p)), { recursive: true }); writeFileSync(join(dir, p), String(Math.random())); };
  g('init', '-q'); g('config', 'user.email', 't@t'); g('config', 'user.name', 't');
  put('README.md'); g('add', '.'); g('commit', '-qm', 'base');
  const base = g('rev-parse', 'HEAD');
  put('docs/a.md'); g('add', '.'); g('commit', '-qm', 'docs');
  const docs = g('rev-parse', 'HEAD');
  put('src/x.ts'); g('add', '.'); g('commit', '-qm', 'code');
  const code = g('rev-parse', 'HEAD');

  const run = (args: string[]) => {
    const lines: string[] = [];
    const outFile = join(dir, 'gh-output');
    writeFileSync(outFile, '');
    const rc = main(args, { out: (l: string) => lines.push(l), env: { GITHUB_OUTPUT: outFile }, cwd: dir });
    return { rc, lines, file: readFileSync(outFile, 'utf8') };
  };

  it('docs-only push -> deploy=false, exit 0', () => {
    const r = run(['--ref', MAIN, '--base', base, '--head', docs]);
    expect(r.rc).toBe(0);
    expect(r.file).toMatch(/^deploy=false$/m);
  });
  it('code push (docs+code range) -> deploy=true, exit 0', () => {
    const r = run(['--ref', MAIN, '--base', base, '--head', code]);
    expect(r.rc).toBe(0);
    expect(r.file).toMatch(/^deploy=true$/m);
  });
  it('all-zero before -> deploy=true (fail-safe)', () => {
    const r = run(['--ref', MAIN, '--base', '0'.repeat(40), '--head', docs]);
    expect(r.file).toMatch(/^deploy=true$/m);
  });
  it('missing args -> exit 2', () => {
    expect(run(['--ref', MAIN]).rc).toBe(2);
    expect(run(['--survey', 'x']).rc).toBe(2);
  });
  it('survey counts skips', () => {
    const r = run(['--survey', '2']);
    expect(r.rc).toBe(0);
    expect(r.lines.at(-1)).toMatch(/^survey: 1 of 2 commit/);
    rmSync(dir, { recursive: true, force: true });
  });
});

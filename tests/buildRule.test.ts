// @vitest-environment node
// scripts/lib/buildRule.mjs -- the JS reader of the ONE build-path rule. Its
// matcher must agree with what scripts/vercel-ignore-build.sh actually asks git
// (`git diff -- $BUILD_PATHS`), so this runs REAL git over a table of paths and
// compares, path by path, with the shell script's own list.
import { describe, it, expect, afterAll } from 'vitest';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { parseBuildPaths, readBuildPaths, pathspecMatches, touchesBuildPaths, IGNORE_SCRIPT } from '../scripts/lib/buildRule.mjs';

const PATHS: Array<[string, boolean]> = [
  ['src/main.tsx', true],
  ['src/modules/event-page/CLAUDE.md', true],
  ['app/root.tsx', true],
  ['api/embed/index.ts', true],
  ['public/robots.txt', true],
  ['index.html', true],
  ['package.json', true],
  ['package-lock.json', true],
  ['vite.config.ts', true],
  ['vite.chunks.ts', true],
  ['tsconfig.app.json', true],
  ['tsconfig.json', true],
  ['tailwind.config.ts', true],
  ['postcss.config.js', true],
  ['.env.production', true],
  ['vercel.json', true],
  ['.vercelignore', true],
  ['.gitattributes', true],
  ['bin/install-hooks.cjs', true],
  ['scripts/vercel-ignore-build.sh', true],
  ['react-router.config.ts', true],
  ['docs/a.md', false],
  ['README.md', false],
  ['CLAUDE.md', false],
  ['tests/a.test.ts', false],
  ['e2e/x.spec.ts', false],
  ['.github/workflows/ci.yml', false],
  ['scripts/check-x.mjs', false],
  ['scripts/lib/buildRule.mjs', false],
  ['bin/other.cjs', false],
  ['srcx/a.ts', false],
  ['docs/src/a.ts', false],
  ['perf-budgets.json', false],
  ['vitest.config.ts', false],
];

const roots: string[] = [];
afterAll(() => roots.forEach((r) => rmSync(r, { recursive: true, force: true })));
const GIT_ENV = {
  PATH: process.env.PATH ?? '/usr/bin:/bin', HOME: tmpdir(), GIT_CONFIG_NOSYSTEM: '1', GIT_CONFIG_GLOBAL: '/dev/null',
  GIT_AUTHOR_NAME: 't', GIT_AUTHOR_EMAIL: 't@example.invalid', GIT_COMMITTER_NAME: 't', GIT_COMMITTER_EMAIL: 't@example.invalid',
};
const git = (cwd: string, ...a: string[]) =>
  execFileSync('git', ['-c', 'commit.gpgsign=false', '-c', 'core.autocrlf=false', ...a], { cwd, env: GIT_ENV, encoding: 'utf8' }).trim();

describe('buildRule: one list, read from the ignore script', () => {
  it('reads BUILD_PATHS from scripts/vercel-ignore-build.sh (no second copy)', () => {
    const specs = readBuildPaths();
    expect(specs).toContain('src');
    expect(specs).toContain('package-lock.json');
    expect(specs).toEqual(parseBuildPaths(readFileSync(IGNORE_SCRIPT, 'utf8')));
  });

  it('the ignore script assigns BUILD_PATHS exactly once (a later append would hide paths from the probe)', () => {
    const sh = readFileSync(IGNORE_SCRIPT, 'utf8');
    expect(sh.match(/^\s*(export\s+)?BUILD_PATHS[+]?=/gm)).toHaveLength(1);
    expect(sh.match(/\$\{?BUILD_PATHS\b/g)).toHaveLength(1);
  });

  it('every spec in the list is one the matcher supports (no throw)', () => {
    expect(() => touchesBuildPaths(['x'], readBuildPaths())).not.toThrow();
  });

  it('an unsupported bracket form THROWS (doubt), never a silent mismatch', () => {
    for (const spec of ['a[]b]c', 'a[!]b]c', 'a[\\]]c', 'a[b']) expect(() => pathspecMatches(spec, 'abc')).toThrow(/unsupported bracket/);
  });

  it('THROWS when the literal is missing or empty (callers treat that as doubt)', () => {
    expect(() => parseBuildPaths('#!/bin/sh\necho hi\n')).toThrow(/no BUILD_PATHS/);
    expect(() => parseBuildPaths("BUILD_PATHS=''\n")).toThrow(/no BUILD_PATHS/);
  });

  it('agrees with real `git diff -- $BUILD_PATHS` on every path in the table', () => {
    const specs = readBuildPaths();
    const cwd = mkdtempSync(join(tmpdir(), 'brule-'));
    roots.push(cwd);
    git(cwd, 'init', '-q', '-b', 'main');
    git(cwd, 'commit', '-q', '--allow-empty', '-m', 'base');
    for (const [p] of PATHS) {
      mkdirSync(dirname(join(cwd, p)), { recursive: true });
      writeFileSync(join(cwd, p), 'x\n');
    }
    git(cwd, 'add', '-A');
    git(cwd, 'commit', '-q', '-m', 'all');
    const byGit = new Set(git(cwd, 'diff', '--name-only', '--no-renames', 'HEAD~1', 'HEAD', '--', ...specs).split('\n').filter(Boolean));
    for (const [p, want] of PATHS) {
      expect({ p, git: byGit.has(p) }).toEqual({ p, git: want });
      expect({ p, js: touchesBuildPaths([p], specs) }).toEqual({ p, js: want });
    }
  });
});

describe('buildRule: pathspec semantics', () => {
  it.each([
    ['src', 'src', true],
    ['src', 'src/a/b.ts', true],
    ['src', 'srcx/a.ts', false],
    ['vite.config.*', 'vite.config.ts', true],
    ['vite.config.*', 'vite.config.d/x.ts', true],
    ['tsconfig*.json', 'tsconfig.node.json', true],
    ['.env*', '.env', true],
    ['.env*', 'x/.env', false],
    ['package*.json', 'package-lock.json', true],
    ['a?c', 'abc', true],
    ['a[bx]c', 'axc', true],
    ['a[!b]c', 'abc', false],
  ])('%s vs %s -> %s', (spec, path, want) => {
    expect(pathspecMatches(spec, path)).toBe(want);
  });

  it('touchesBuildPaths: empty diff touches nothing; any one build path is enough', () => {
    expect(touchesBuildPaths([], ['src'])).toBe(false);
    expect(touchesBuildPaths(['docs/a.md', 'src/x.ts'], ['src'])).toBe(true);
  });
});

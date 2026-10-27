/**
 * prePushRemoteUnitGate.test.ts -- step 1 of .githooks/pre-push on the side laptop.
 *
 * The SHIPPED hook runs as a child process in a throwaway repo. HOME points at a
 * temp dir that may hold a STUB `.claude/bin/remote-test.mjs` (exits a chosen
 * code, records its argv), and PATH starts with a shim `npm` (records that the
 * local suite ran, exits a chosen code). Every push targets a feature branch, so
 * step 2 defers and the hook's exit code is step 1's verdict.
 *
 * Red first (2026-10-23): against the hook before this change the helper rows
 * failed (helper never called, local always ran). Mutant: treating helper exit 3
 * as a pass turned the "exit 3 + local red" row red here, then was rolled back.
 */
import { describe, it, expect, afterAll } from 'vitest';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync, chmodSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { delimiter, join } from 'node:path';
import { REPO_ROOT, runProcess } from './helpers/integrityGuard';

const HOOK = join(REPO_ROOT, '.githooks', 'pre-push');
const UNIT_CMD = ['npm', 'run', 'test:unit:offline', '--', '--reporter=dot'];

const roots: string[] = [];
afterAll(() => {
  for (const root of roots) rmSync(root, { recursive: true, force: true });
});

function git(cwd: string, ...args: string[]): string {
  const result = runProcess(
    'git',
    [
      '-c', 'core.autocrlf=false',
      '-c', 'commit.gpgsign=false',
      '-c', 'core.hooksPath=',
      '-c', 'user.email=canary@example.invalid',
      '-c', 'user.name=canary',
      '-c', 'init.defaultBranch=main',
      ...args,
    ],
    { cwd },
  );
  if (result.status !== 0) throw new Error(`git ${args.join(' ')} failed: ${result.stderr}`);
  return result.stdout.trim();
}

type Row = {
  name: string;
  helper: number | 'absent';
  /** exit codes by call number (the last repeats); overrides `helper` for the stub */
  helperSeq?: number[];
  remoteTest?: string;
  refs: 1 | 2;
  local: 'green' | 'red' | null;
  expectExit: 0 | 1;
  expectHelper: boolean;
  expectLocal: boolean;
  expectLine: RegExp;
};

const ROWS: Row[] = [
  { name: 'helper green -> allowed, local not run', helper: 0, refs: 1, local: null, expectExit: 0, expectHelper: true, expectLocal: false, expectLine: /unit gate on the side laptop \([0-9a-f]{8}\)/ },
  { name: 'helper red -> refused', helper: 1, refs: 1, local: null, expectExit: 1, expectHelper: true, expectLocal: false, expectLine: /unit gate on the side laptop/ },
  { name: 'helper 3 + local green -> local ran, allowed', helper: 3, refs: 1, local: 'green', expectExit: 0, expectHelper: true, expectLocal: true, expectLine: /unit gate here \(laptop off\/unreachable\)/ },
  { name: 'helper 3 + local red -> local ran, refused', helper: 3, refs: 1, local: 'red', expectExit: 1, expectHelper: true, expectLocal: true, expectLine: /unit gate here \(laptop off\/unreachable\)/ },
  { name: 'helper 3 then 0 -> retried, allowed, local not run', helper: 3, helperSeq: [3, 0], refs: 1, local: null, expectExit: 0, expectHelper: true, expectLocal: false, expectLine: /unit gate on the side laptop/ },
  { name: 'helper 3, 3, 0 -> third try passes, local not run', helper: 3, helperSeq: [3, 3, 0], refs: 1, local: null, expectExit: 0, expectHelper: true, expectLocal: false, expectLine: /unit gate on the side laptop/ },
  { name: 'helper 3 then 1 -> retried, refused on the real failure', helper: 3, helperSeq: [3, 1], refs: 1, local: null, expectExit: 1, expectHelper: true, expectLocal: false, expectLine: /unit gate on the side laptop/ },
  { name: 'helper absent -> local ran, allowed', helper: 'absent', refs: 1, local: 'green', expectExit: 0, expectHelper: false, expectLocal: true, expectLine: /unit gate here \(helper not installed\)/ },
  { name: 'REMOTE_TEST=off -> helper not called, local ran', helper: 0, remoteTest: 'off', refs: 1, local: 'green', expectExit: 0, expectHelper: false, expectLocal: true, expectLine: /unit gate here \(REMOTE_TEST=off\)/ },
  { name: 'two different shas -> helper not called, local ran', helper: 0, refs: 2, local: 'green', expectExit: 0, expectHelper: false, expectLocal: true, expectLine: /unit gate here \(several refs\)/ },
];

function runRow(row: Row) {
  const root = mkdtempSync(join(tmpdir(), 'prepush-remote-'));
  roots.push(root);
  const repo = join(root, 'repo');
  const home = join(root, 'home');
  const shims = join(root, 'shims');
  mkdirSync(repo);
  mkdirSync(home);
  mkdirSync(shims);

  git(repo, 'init', '-q');
  writeFileSync(join(repo, 'a.txt'), 'one\n');
  git(repo, 'add', '.');
  git(repo, 'commit', '-q', '-m', 'one');
  writeFileSync(join(repo, 'a.txt'), 'two\n');
  git(repo, 'commit', '-q', '-am', 'two');
  const head = git(repo, 'rev-parse', 'HEAD');
  const prev = git(repo, 'rev-parse', 'HEAD~1');

  const helperLog = join(root, 'helper-argv.json');
  const localLog = join(root, 'local-ran.txt');
  if (row.helper !== 'absent') {
    mkdirSync(join(home, '.claude', 'bin'), { recursive: true });
    writeFileSync(
      join(home, '.claude', 'bin', 'remote-test.mjs'),
      `import { writeFileSync } from 'node:fs';\n` +
        `writeFileSync(${JSON.stringify(helperLog)}, JSON.stringify(process.argv.slice(2)));\n` +
        `import { readFileSync } from 'node:fs';\n` +
        `const seq = ${JSON.stringify(row.helperSeq ?? [row.helper])};\n` +
        `let n = 0; try { n = Number(readFileSync(${JSON.stringify(helperLog + '.n')}, 'utf8')); } catch {}\n` +
        `writeFileSync(${JSON.stringify(helperLog + '.n')}, String(n + 1));\n` +
        `process.exit(seq[Math.min(n, seq.length - 1)]);\n`,
    );
  }
  const npmShim = join(shims, 'npm');
  writeFileSync(
    npmShim,
    `#!/bin/sh\necho "$*" >> '${localLog.replace(/\\/g, '/')}'\nexit ${row.local === 'red' ? 1 : 0}\n`,
  );
  chmodSync(npmShim, 0o755);

  const lines = [`refs/heads/feat ${head} refs/heads/feat ${'0'.repeat(40)}`];
  if (row.refs === 2) lines.push(`refs/heads/old ${prev} refs/heads/old ${'0'.repeat(40)}`);

  const env: NodeJS.ProcessEnv = {
    ...process.env,
    HOME: home,
    PATH: shims + delimiter + (process.env.PATH ?? ''),
    SHIP_GATE_ALLOW_UNSCOPED_REF: row.refs === 2 ? '1' : '',
  };
  delete env.REMOTE_TEST;
  env.PREPUSH_RETRY_SLEEP = '0';
  if (row.remoteTest !== undefined) env.REMOTE_TEST = row.remoteTest;

  const result = runProcess('sh', [HOOK, 'origin', 'https://example.invalid/r.git'], {
    cwd: repo,
    env,
    input: lines.join('\n') + '\n',
  });
  return {
    result,
    head,
    helperCalls: existsSync(helperLog + '.n') ? Number(readFileSync(helperLog + '.n', 'utf8')) : 0,
    helperArgv: existsSync(helperLog) ? (JSON.parse(readFileSync(helperLog, 'utf8')) as string[]) : null,
    localRan: existsSync(localLog) ? readFileSync(localLog, 'utf8') : null,
  };
}

describe('pre-push step 1: unit gate on the side laptop', () => {
  for (const row of ROWS) {
    it(row.name, () => {
      const { result, head, helperArgv, helperCalls, localRan } = runRow(row);
      const out = result.stdout + result.stderr;
      expect(result.status, out).toBe(row.expectExit);
      expect(out).toMatch(row.expectLine);
      // a helper that keeps answering 3 is asked 3 times before the local run; a sequence stops at its first non-3
      if (row.helperSeq) expect(helperCalls).toBe(Math.min(row.helperSeq.findIndex((c) => c !== 3) + 1, 3));
      else if (row.helper === 3) expect(helperCalls).toBe(3);
      if (row.expectHelper) {
        expect(helperArgv).toEqual(['website', head, '--', ...UNIT_CMD]);
      } else {
        expect(helperArgv).toBeNull();
      }
      if (row.expectLocal) {
        expect(localRan?.trim()).toBe(UNIT_CMD.slice(1).join(' '));
      } else {
        expect(localRan).toBeNull();
      }
    });
  }
});

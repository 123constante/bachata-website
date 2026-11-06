// Brief worker-commit-helper (2026-11-05): the ONE commit path for workers and reviewers.
// main(argv, deps) is driven against a fake git (table-driven refusals, exit codes, the exact
// argv handed to git) and once against a real throwaway repo. Doc: docs/automation-foundations.md.
import { describe, it, expect } from 'vitest';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { main, buildMessage, buildCommitArgv, parseArgs } from '../scripts/worker-commit.mjs';

type Call = string[];
type FakeOpts = {
  branch?: string;
  porcelain?: string;
  staged?: string[];
  commitStatus?: number;
  headStatus?: number;
  addStatus?: number;
  files?: Record<string, string>;
};

function fake(o: FakeOpts = {}) {
  const calls: Call[] = [];
  const written: Record<string, string> = {};
  const removed: string[] = [];
  const out: string[] = [];
  const err: string[] = [];
  const staged = [...(o.staged ?? [])];
  const git = (args: string[]) => {
    calls.push(args);
    const [cmd] = args;
    if (cmd === 'rev-parse' && args[1] === '--abbrev-ref') return { status: 0, stdout: `${o.branch ?? 'claude/x'}\n`, stderr: '' };
    if (cmd === 'rev-parse' && args[1] === 'HEAD') return o.headStatus ? { status: o.headStatus, stdout: '', stderr: 'index.lock' } : { status: 0, stdout: `${'c'.repeat(40)}\n`, stderr: '' };
    if (cmd === 'status') return { status: 0, stdout: (o.porcelain ?? '').replace(/\n/g, '\0'), stderr: '' };
    if (cmd === 'add') {
      if (o.addStatus) return { status: o.addStatus, stdout: '', stderr: 'add failed' };
      const sep = args.indexOf('--');
      for (const f of args.slice(sep + 1)) if (!staged.includes(f)) staged.push(f);
      return { status: 0, stdout: '', stderr: '' };
    }
    if (cmd === 'diff' && args.includes('--cached')) {
      const sep = args.indexOf('--');
      const spec = sep < 0 ? null : args.slice(sep + 1);
      return { status: 0, stdout: staged.filter((s) => !spec || spec.includes(s)).map((s) => `${s}\0`).join(''), stderr: '' };
    }
    if (cmd === 'commit') return { status: o.commitStatus ?? 0, stdout: '', stderr: o.commitStatus ? 'hook said no' : '' };
    return { status: 0, stdout: '', stderr: '' };
  };
  const deps = {
    git,
    readFile: (p: string) => {
      if (o.files && p in o.files) return o.files[p];
      throw new Error(`ENOENT ${p}`);
    },
    writeTemp: (text: string) => {
      const p = `/tmp/fake-msg-${Object.keys(written).length}`;
      written[p] = text;
      return p;
    },
    removeTemp: (p: string) => removed.push(p),
    out: (l: string) => out.push(l),
    err: (l: string) => err.push(l),
  };
  return { deps, calls, written, removed, out, err, get staged() { return staged; } };
}

const commitCalls = (calls: Call[]) => calls.filter((c) => c[0] === 'commit');
const MARK = 'dt_0123456789ab';

describe('worker-commit: refusals (exit 1, nothing committed)', () => {
  const cases: Array<{ name: string; argv: string[]; opts?: FakeOpts; reason: RegExp }> = [
    { name: 'branch main', argv: ['--subject', 's', '--files', 'a'], opts: { branch: 'main' }, reason: /branch/ },
    { name: 'detached HEAD', argv: ['--subject', 's', '--files', 'a'], opts: { branch: 'HEAD' }, reason: /branch/ },
    { name: 'branch feature/x', argv: ['--subject', 's', '--files', 'a'], opts: { branch: 'feature/x' }, reason: /branch/ },
    { name: 'branch "claude" with no slash part', argv: ['--subject', 's', '--files', 'a'], opts: { branch: 'claude/' }, reason: /branch/ },
    { name: 'no subject', argv: ['--files', 'a'], reason: /subject/ },
    { name: 'empty subject', argv: ['--subject', '', '--files', 'a'], reason: /subject/ },
    { name: 'blank subject', argv: ['--subject', '   ', '--files', 'a'], reason: /subject/ },
    { name: 'multi-line subject (LF)', argv: ['--subject', 'one\ntwo', '--files', 'a'], reason: /one line/ },
    { name: 'multi-line subject (CR)', argv: ['--subject', 'one\rtwo', '--files', 'a'], reason: /one line/ },
    { name: 'subject already carries a done marker', argv: ['--subject', 'x [worker-done dt_0123456789ab]', '--files', 'a'], reason: /marker/ },
    { name: 'marker wrong prefix', argv: ['--subject', 's', '--marker', 'xx_0123456789ab', '--files', 'a'], reason: /marker/ },
    { name: 'marker too short', argv: ['--subject', 's', '--marker', 'dt_0123456789a', '--files', 'a'], reason: /marker/ },
    { name: 'marker uppercase hex', argv: ['--subject', 's', '--marker', 'dt_0123456789AB', '--files', 'a'], reason: /marker/ },
    { name: 'marker trailing junk', argv: ['--subject', 's', '--marker', 'dt_0123456789abc', '--files', 'a'], reason: /marker/ },
    { name: 'unknown flag', argv: ['--subject', 's', '--no-verify'], reason: /unknown/ },
    { name: 'flag missing its value', argv: ['--subject'], reason: /value/ },
    { name: 'flag value is another flag', argv: ['--subject', '--all'], reason: /value/ },
    { name: '--self-test mixed with a commit', argv: ['--subject', 's', '--files', 'a', '--self-test'], reason: /self-test/ },
    { name: '--files and --all together', argv: ['--subject', 's', '--files', 'a', '--all'], reason: /--all/ },
    { name: 'empty --files', argv: ['--subject', 's', '--files', ' , '], reason: /--files/ },
    { name: 'dirty tree, no --files, no --all', argv: ['--subject', 's'], opts: { porcelain: ' M src/a.ts\n?? new.txt\n' }, reason: /unstaged/ },
    { name: 'nothing staged', argv: ['--subject', 's'], opts: { porcelain: '' }, reason: /nothing staged/ },
    { name: 'other paths already staged outside --files', argv: ['--subject', 's', '--files', 'a'], opts: { staged: ['b'] }, reason: /outside --files/ },
    { name: 'unreadable --body-file', argv: ['--subject', 's', '--files', 'a', '--body-file', 'nope.md'], reason: /body-file/ },
    { name: 'unreadable --trailer-file', argv: ['--subject', 's', '--files', 'a', '--trailer-file', 'nope.txt'], reason: /trailer-file/ },
  ];
  for (const c of cases) {
    it(c.name, () => {
      const f = fake(c.opts);
      const code = main(c.argv, f.deps);
      expect(code).toBe(1);
      expect(f.err.join('\n')).toMatch(c.reason);
      expect(commitCalls(f.calls)).toHaveLength(0);
    });
  }

  it('the dirty-tree refusal lists every unstaged path', () => {
    const f = fake({ porcelain: ' M src/a.ts\n?? new.txt\nM  staged.ts\n' });
    expect(main(['--subject', 's'], f.deps)).toBe(1);
    const e = f.err.join('\n');
    expect(e).toContain('src/a.ts');
    expect(e).toContain('new.txt');
    expect(e).not.toMatch(/^\s*staged\.ts/m);
  });

  it('a staged-outside-files refusal leaves the index untouched (no git add ran)', () => {
    const f = fake({ staged: ['b'] });
    expect(main(['--subject', 's', '--files', 'a'], f.deps)).toBe(1);
    expect(f.calls.filter((c) => c[0] === 'add')).toHaveLength(0);
    expect(f.staged).toEqual(['b']);
  });

  it('a rename in the dirty list shows the NEW path only (porcelain -z "RM new\\0old")', () => {
    const f = fake({ porcelain: 'RM new.ts\nold.ts\n' });
    expect(main(['--subject', 's'], f.deps)).toBe(1);
    const e = f.err.join('\n');
    expect(e).toContain('new.ts');
    expect(e).not.toContain('old.ts');
  });

  it('a refused branch stages nothing', () => {
    const f = fake({ branch: 'main' });
    main(['--subject', 's', '--files', 'a'], f.deps);
    expect(f.calls.filter((c) => c[0] === 'add')).toHaveLength(0);
  });
});

describe('worker-commit: accepted branches and the commit itself (exit 0)', () => {
  for (const branch of ['claude/worker-commit-helper', 'brief/x', 'review/review-1370-r1']) {
    it(`commits on ${branch}`, () => {
      const f = fake({ branch });
      expect(main(['--subject', 's', '--files', 'a'], f.deps)).toBe(0);
      expect(commitCalls(f.calls)).toHaveLength(1);
    });
  }

  it('stages only --files, commits with -F <tempfile>, prints the head sha, removes the temp file', () => {
    const f = fake({ files: { 'body.md': 'Body line.\n', 'trailers.txt': 'Co-Authored-By: X <x@y>\n' } });
    const code = main(['--subject', 'feat: thing', '--files', 'a.ts, b.md', '--marker', MARK, '--body-file', 'body.md', '--trailer-file', 'trailers.txt'], f.deps);
    expect(code).toBe(0);
    expect(f.calls.find((c) => c[0] === 'add')).toEqual(['add', '--', 'a.ts', 'b.md']);
    const commit = commitCalls(f.calls)[0];
    expect(commit).toEqual(['commit', '-F', '/tmp/fake-msg-0']);
    expect(f.written['/tmp/fake-msg-0']).toBe(`feat: thing [worker-done ${MARK}]\n\nBody line.\n\nCo-Authored-By: X <x@y>\n`);
    expect(f.out).toEqual(['c'.repeat(40)]);
    expect(f.removed).toEqual(['/tmp/fake-msg-0']);
  });

  it('--all stages everything with add -A', () => {
    // add -A in the fake stages nothing; pre-stage so the commit has content.
    const g = fake({ porcelain: ' M src/a.ts\n', staged: ['src/a.ts'] });
    expect(main(['--subject', 's', '--all'], g.deps)).toBe(0);
    expect(g.calls.find((c) => c[0] === 'add')).toEqual(['add', '-A']);
  });

  it('no --files and only staged changes: commits what is staged, adds nothing', () => {
    const f = fake({ porcelain: 'M  staged.ts\n', staged: ['staged.ts'] });
    expect(main(['--subject', 's'], f.deps)).toBe(0);
    expect(f.calls.filter((c) => c[0] === 'add')).toHaveLength(0);
  });
});

describe('worker-commit: git failures (exit 2)', () => {
  it('rev-parse HEAD failing AFTER the commit is still exit 0 (the commit exists), with a warning', () => {
    const f = fake({ headStatus: 128 });
    expect(main(['--subject', 's', '--files', 'a'], f.deps)).toBe(0);
    expect(commitCalls(f.calls)).toHaveLength(1);
    expect(f.err.join('\n')).toMatch(/committed, but rev-parse HEAD failed/);
  });
  it('git add fails', () => {
    const f = fake({ addStatus: 128 });
    expect(main(['--subject', 's', '--files', 'a'], f.deps)).toBe(2);
    expect(commitCalls(f.calls)).toHaveLength(0);
  });
  it('git commit fails (e.g. a hook refuses): exit 2, temp file still removed, no sha printed', () => {
    const f = fake({ commitStatus: 1 });
    expect(main(['--subject', 's', '--files', 'a'], f.deps)).toBe(2);
    expect(f.removed).toHaveLength(1);
    expect(f.out).toHaveLength(0);
    expect(f.err.join('\n')).toMatch(/hook said no/);
  });
});

describe('worker-commit: never pushes, never -m, never --no-verify, never -c identity', () => {
  const FORBIDDEN = ['push', '-m', '--message', '--no-verify', '-n', '-c', '--author'];
  it('buildCommitArgv is exactly commit -F <file>', () => {
    expect(buildCommitArgv('/t/msg')).toEqual(['commit', '-F', '/t/msg']);
  });
  it('every git argv across a full run carries none of the forbidden tokens', () => {
    const f = fake({ files: { 'b.md': 'b' } });
    expect(main(['--subject', 's', '--files', 'a', '--marker', MARK, '--body-file', 'b.md'], f.deps)).toBe(0);
    const all = fake({ porcelain: ' M x\n', staged: ['x'] });
    expect(main(['--subject', 's', '--all'], all.deps)).toBe(0);
    for (const c of [...f.calls, ...all.calls]) {
      for (const tok of FORBIDDEN) expect(c, JSON.stringify(c)).not.toContain(tok);
      expect(c.some((a) => /^user\.(name|email)=/.test(a))).toBe(false);
    }
  });
  it('a file literally named "-m" in --files stays after the -- separator', () => {
    const f = fake();
    main(['--subject', 's', '--files', '-m'], f.deps);
    const add = f.calls.find((c) => c[0] === 'add')!;
    expect(add.indexOf('--')).toBeLessThan(add.indexOf('-m'));
  });
});

describe('worker-commit: pure helpers', () => {
  const rows: Array<[string, string | undefined, string | undefined, string | undefined, string]> = [
    ['s', undefined, undefined, undefined, 's\n'],
    ['s', MARK, undefined, undefined, `s [worker-done ${MARK}]\n`],
    ['s', undefined, 'body\n\n', undefined, 's\n\nbody\n'],
    ['s', undefined, undefined, 'T: 1\n', 's\n\nT: 1\n'],
    ['  s  ', MARK, 'b', 'T: 1', `s [worker-done ${MARK}]\n\nb\n\nT: 1\n`],
    ['s', undefined, '   \n', undefined, 's\n'],
  ];
  for (const [subject, marker, body, trailers, want] of rows) {
    it(`buildMessage(${JSON.stringify([subject, marker, body, trailers])})`, () => {
      expect(buildMessage({ subject, marker, body, trailers })).toBe(want);
    });
  }
  it('parseArgs reads --help', () => {
    expect(parseArgs(['--help']).help).toBe(true);
  });
  it('--help exits 0 without touching git', () => {
    const f = fake();
    expect(main(['--help'], f.deps)).toBe(0);
    expect(f.calls).toHaveLength(0);
  });
});

describe('worker-commit: --self-test canary', () => {
  it('exits 0', () => {
    const out = execFileSync(process.execPath, [path.resolve('scripts/worker-commit.mjs'), '--self-test'], { encoding: 'utf8' });
    expect(out).toMatch(/self-test: \d+ cases passed/);
  });
});

describe('worker-commit: real git, throwaway repo', () => {
  it('commits only --files on claude/x, message from -F, sha printed; refuses on main', () => {
    const dir = mkdtempSync(path.join(tmpdir(), 'wc-'));
    try {
      const g = (...a: string[]) => execFileSync('git', a, { cwd: dir, encoding: 'utf8' });
      g('init', '-q', '-b', 'main');
      g('config', 'user.name', 'Test');
      g('config', 'user.email', 't@example.invalid');
      g('config', 'commit.gpgsign', 'false');
      g('config', 'core.hooksPath', path.join(dir, 'no-hooks'));
      writeFileSync(path.join(dir, 'seed'), 's');
      writeFileSync(path.join(dir, '..', `${path.basename(dir)}.seedmsg`), 'seed\n');
      g('add', 'seed');
      g('commit', '-q', '-F', path.join(dir, '..', `${path.basename(dir)}.seedmsg`));
      rmSync(path.join(dir, '..', `${path.basename(dir)}.seedmsg`));
      const run = (argv: string[]) => {
        try {
          return { code: 0, out: execFileSync(process.execPath, [path.resolve('scripts/worker-commit.mjs'), ...argv], { cwd: dir, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }) };
        } catch (e: unknown) {
          const x = e as { status: number; stdout: unknown; stderr: unknown };
          return { code: x.status, out: String(x.stdout) + String(x.stderr) };
        }
      };
      writeFileSync(path.join(dir, 'a.txt'), 'a');
      writeFileSync(path.join(dir, 'b.txt'), 'b');
      expect(run(['--subject', 'nope', '--files', 'a.txt']).code).toBe(1);
      g('checkout', '-q', '-b', 'claude/x');
      const ok = run(['--subject', 'add a', '--files', 'a.txt', '--marker', MARK]);
      expect(ok.code).toBe(0);
      const head = g('rev-parse', 'HEAD').trim();
      expect(ok.out.trim()).toBe(head);
      expect(g('log', '-1', '--format=%B').trim()).toBe(`add a [worker-done ${MARK}]`);
      expect(g('show', '--name-only', '--format=', 'HEAD').trim()).toBe('a.txt');
      expect(g('status', '--porcelain')).toContain('?? b.txt');
      // b.txt is still untracked: no --files, no --all -> refused, listing it.
      const dirty = run(['--subject', 'x']);
      expect(dirty.code).toBe(1);
      expect(dirty.out).toContain('b.txt');
      // Root-relative vs typed spelling: ./b.txt and a directory pathspec, and a
      // non-ASCII name (git would quote it without -z).
      expect(run(['--subject', 'add b', '--files', './b.txt']).code).toBe(0);
      execFileSync('mkdir', ['-p', path.join(dir, 'sub')]);
      writeFileSync(path.join(dir, 'sub', 'c.txt'), 'c');
      writeFileSync(path.join(dir, 'sub', '\u00e9.txt'), 'e');
      expect(run(['--subject', 'add sub', '--files', 'sub']).code).toBe(0);
      expect(g('show', '--name-only', '--format=', '-z', 'HEAD').split('\0').filter(Boolean).sort()).toEqual(['sub/c.txt', 'sub/\u00e9.txt']);
      expect(g('status', '--porcelain')).toBe('');
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});

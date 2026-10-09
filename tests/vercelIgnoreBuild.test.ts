// scripts/vercel-ignore-build.sh -- the Vercel Ignored Build Step (exit 0 =
// SKIP, exit 1 = BUILD). Table-driven: each row builds a throwaway git repo,
// then runs BOTH the new script and the ignoreCommand it replaced, so the table
// documents what changed as well as what holds.
//
// The two rows the old command got wrong are asserted on the old command too:
//   - docs-only on main, in a checkout missing the files .vercelignore strips
//     (what Vercel builds from): the old one-arg `git diff HEAD~1` diffs the
//     WORKING TREE, sees those deletions under src/ and package-lock.json, and
//     BUILDS -- the observed "docs-only merges all reach READY" behaviour.
//   - a multi-commit push whose LAST commit is docs-only: HEAD~1 sees only the
//     tip, so the old command SKIPS a build the earlier src commit needed.
//
// Rows default to VERCEL_GIT_COMMIT_REF=main (VERCEL_ENV=production): Vercel's
// documented spelling is the bare branch name, which the old command's
// `refs/heads/main` case never matched.
import { describe, it, expect, afterAll } from 'vitest';
import { spawnSync, execFileSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync, renameSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname, resolve } from 'node:path';

const SCRIPT = resolve(__dirname, '..', 'scripts', 'vercel-ignore-build.sh');

// Verbatim from vercel.json before this change.
const OLD_IGNORE_COMMAND =
  'if git diff HEAD~1 --quiet -- src app middleware.ts package*.json vite.config.ts vercel.json .vercelignore bin/install-hooks.cjs; then case "$VERCEL_GIT_COMMIT_REF" in refs/heads/main|bot/*|dependabot/*) exit 1;; *) exit 0;; esac; fi; exit 1';

type Verdict = 'BUILD' | 'SKIP';
const verdict = (status: number | null): Verdict => (status === 0 ? 'SKIP' : 'BUILD');

const roots: string[] = [];
afterAll(() => {
  for (const r of roots) rmSync(r, { recursive: true, force: true });
});

const GIT_ENV = {
  PATH: process.env.PATH ?? '/usr/bin:/bin',
  HOME: tmpdir(),
  GIT_CONFIG_NOSYSTEM: '1',
  GIT_CONFIG_GLOBAL: '/dev/null',
  GIT_AUTHOR_NAME: 't',
  GIT_AUTHOR_EMAIL: 't@example.invalid',
  GIT_COMMITTER_NAME: 't',
  GIT_COMMITTER_EMAIL: 't@example.invalid',
};

function git(cwd: string, ...args: string[]): string {
  return execFileSync('git', ['-c', 'commit.gpgsign=false', '-c', 'core.autocrlf=false', ...args], {
    cwd,
    env: GIT_ENV,
    encoding: 'utf8',
  }).trim();
}

function newDir(): string {
  const d = mkdtempSync(join(tmpdir(), 'vib-'));
  roots.push(d);
  return d;
}

function write(cwd: string, path: string, body = `${path} ${Math.random()}\n`) {
  mkdirSync(dirname(join(cwd, path)), { recursive: true });
  writeFileSync(join(cwd, path), body);
}

function commit(cwd: string, files: string[], msg = files.join(' ')): string {
  for (const f of files) write(cwd, f);
  git(cwd, 'add', '-A');
  git(cwd, 'commit', '-q', '-m', msg);
  return git(cwd, 'rev-parse', 'HEAD');
}

/** A repo shaped like this one, with one commit holding the files that matter. */
function seedRepo(): { cwd: string; base: string } {
  const cwd = newDir();
  git(cwd, 'init', '-q', '-b', 'main');
  const base = commit(cwd, [
    'src/main.tsx',
    'src/modules/event-page/CLAUDE.md',
    'app/root.tsx',
    'package.json',
    'package-lock.json',
    'public/robots.txt',
    'docs/a.md',
    'tests/a.test.ts',
    '.github/workflows/ci.yml',
    'vercel.json',
  ], 'seed');
  return { cwd, base };
}

interface Case {
  name: string;
  setup: () => { cwd: string; previousSha: string; ref?: string };
  want: Verdict;
  /** Asserted only where the old command's outcome is the point of the row. */
  oldWas?: Verdict;
}

const cases: Case[] = [
  {
    name: 'docs-only on main',
    setup: () => {
      const { cwd, base } = seedRepo();
      commit(cwd, ['docs/b.md', 'README.md']);
      return { cwd, previousSha: base };
    },
    want: 'SKIP',
  },
  {
    name: 'docs-only on main, checkout missing .vercelignore-stripped files (as on Vercel)',
    setup: () => {
      const { cwd, base } = seedRepo();
      commit(cwd, ['docs/b.md']);
      rmSync(join(cwd, 'src/modules/event-page/CLAUDE.md'));
      rmSync(join(cwd, 'package-lock.json'));
      return { cwd, previousSha: base };
    },
    want: 'SKIP',
    oldWas: 'BUILD',
  },
  {
    name: 'docs-only on bot/* branch',
    setup: () => {
      const { cwd, base } = seedRepo();
      commit(cwd, ['docs/b.md']);
      return { cwd, previousSha: base, ref: 'bot/docs-sweep' };
    },
    want: 'SKIP',
  },
  {
    name: 'docs-only on dependabot/* branch',
    setup: () => {
      const { cwd, base } = seedRepo();
      commit(cwd, ['docs/b.md']);
      return { cwd, previousSha: base, ref: 'dependabot/npm_and_yarn/x' };
    },
    want: 'SKIP',
  },
  {
    name: 'docs-only on a PR branch (claude/*): builds, its preview jobs need a preview',
    setup: () => {
      const { cwd, base } = seedRepo();
      commit(cwd, ['docs/b.md']);
      return { cwd, previousSha: base, ref: 'claude/docs-sweep' };
    },
    want: 'BUILD',
  },
  {
    name: 'docs-only, branch unknown (VERCEL_GIT_COMMIT_REF empty)',
    setup: () => {
      const { cwd, base } = seedRepo();
      commit(cwd, ['docs/b.md']);
      return { cwd, previousSha: base, ref: '' };
    },
    want: 'BUILD',
  },
  {
    name: 'ci-only (.github/workflows)',
    setup: () => {
      const { cwd, base } = seedRepo();
      commit(cwd, ['.github/workflows/ci.yml']);
      return { cwd, previousSha: base };
    },
    want: 'SKIP',
  },
  {
    name: 'test-only (tests/ + a scripts/ guard)',
    setup: () => {
      const { cwd, base } = seedRepo();
      commit(cwd, ['tests/a.test.ts', 'scripts/check-x.mjs']);
      return { cwd, previousSha: base };
    },
    want: 'SKIP',
  },
  {
    name: 'src change',
    setup: () => {
      const { cwd, base } = seedRepo();
      commit(cwd, ['src/main.tsx']);
      return { cwd, previousSha: base };
    },
    want: 'BUILD',
  },
  {
    name: 'package.json change',
    setup: () => {
      const { cwd, base } = seedRepo();
      commit(cwd, ['package.json']);
      return { cwd, previousSha: base };
    },
    want: 'BUILD',
  },
  {
    name: 'public/ change (copied into the client build)',
    setup: () => {
      const { cwd, base } = seedRepo();
      commit(cwd, ['public/robots.txt']);
      return { cwd, previousSha: base };
    },
    want: 'BUILD',
  },
  {
    name: 'build config change (tsconfig.app.json)',
    setup: () => {
      const { cwd, base } = seedRepo();
      commit(cwd, ['tsconfig.app.json']);
      return { cwd, previousSha: base };
    },
    want: 'BUILD',
  },
  {
    name: 'multi-commit push: earlier commit src, last commit docs-only',
    setup: () => {
      const { cwd, base } = seedRepo();
      commit(cwd, ['src/main.tsx']);
      commit(cwd, ['docs/b.md']);
      return { cwd, previousSha: base };
    },
    want: 'BUILD',
    oldWas: 'SKIP',
  },
  {
    name: 'multi-commit, all docs, previous deployment several commits back',
    setup: () => {
      const { cwd, base } = seedRepo();
      commit(cwd, ['docs/b.md']);
      commit(cwd, ['tests/a.test.ts']);
      commit(cwd, ['docs/c.md']);
      return { cwd, previousSha: base };
    },
    want: 'SKIP',
  },
  {
    name: 'missing base (VERCEL_GIT_PREVIOUS_SHA empty: first deploy of a branch)',
    setup: () => {
      const { cwd } = seedRepo();
      commit(cwd, ['docs/b.md']);
      return { cwd, previousSha: '' };
    },
    want: 'BUILD',
  },
  {
    name: 'unknown base (sha not in the repo)',
    setup: () => {
      const { cwd } = seedRepo();
      commit(cwd, ['docs/b.md']);
      return { cwd, previousSha: 'deadbeefdeadbeefdeadbeefdeadbeefdeadbeef' };
    },
    want: 'BUILD',
  },
  {
    name: 'shallow clone, base beyond the clone depth',
    setup: () => {
      const { cwd: origin, base } = seedRepo();
      for (let i = 0; i < 3; i++) commit(origin, [`docs/n${i}.md`]);
      const cwd = newDir();
      git(cwd, 'clone', '-q', '--depth=2', `file://${origin}`, '.');
      return { cwd, previousSha: base };
    },
    want: 'BUILD',
  },
  {
    name: 'shallow clone, base within the clone depth, docs-only',
    setup: () => {
      const { cwd: origin } = seedRepo();
      const mid = commit(origin, ['docs/b.md']);
      commit(origin, ['docs/c.md']);
      const cwd = newDir();
      git(cwd, 'clone', '-q', '--depth=3', `file://${origin}`, '.');
      return { cwd, previousSha: mid };
    },
    want: 'SKIP',
  },
  {
    name: 'merge commit bringing in a src change',
    setup: () => {
      const { cwd, base } = seedRepo();
      git(cwd, 'checkout', '-q', '-b', 'feature');
      commit(cwd, ['src/feature.tsx']);
      commit(cwd, ['docs/feature.md']);
      git(cwd, 'checkout', '-q', 'main');
      commit(cwd, ['docs/main.md']);
      git(cwd, 'merge', '-q', '--no-ff', '-m', 'merge', 'feature');
      return { cwd, previousSha: base };
    },
    want: 'BUILD',
  },
  {
    name: 'merge commit of a docs-only branch',
    setup: () => {
      const { cwd, base } = seedRepo();
      git(cwd, 'checkout', '-q', '-b', 'feature');
      commit(cwd, ['docs/feature.md']);
      git(cwd, 'checkout', '-q', 'main');
      commit(cwd, ['docs/main.md']);
      git(cwd, 'merge', '-q', '--no-ff', '-m', 'merge', 'feature');
      return { cwd, previousSha: base };
    },
    want: 'SKIP',
  },
  {
    name: 'rename into a build path (docs/x.ts -> src/x.ts)',
    setup: () => {
      const { cwd } = seedRepo();
      const base = commit(cwd, ['docs/x.ts']);
      mkdirSync(join(cwd, 'src/lib'), { recursive: true });
      renameSync(join(cwd, 'docs/x.ts'), join(cwd, 'src/lib/x.ts'));
      git(cwd, 'add', '-A');
      git(cwd, 'commit', '-q', '-m', 'move');
      return { cwd, previousSha: base };
    },
    want: 'BUILD',
  },
  {
    name: 'rename out of a build path (src/x.ts -> docs/x.ts)',
    setup: () => {
      const { cwd } = seedRepo();
      const base = commit(cwd, ['src/x.ts']);
      renameSync(join(cwd, 'src/x.ts'), join(cwd, 'docs/x.ts'));
      git(cwd, 'add', '-A');
      git(cwd, 'commit', '-q', '-m', 'move');
      return { cwd, previousSha: base };
    },
    want: 'BUILD',
  },
  {
    name: 'the first commit of the repo',
    setup: () => {
      const cwd = newDir();
      git(cwd, 'init', '-q', '-b', 'main');
      commit(cwd, ['docs/a.md']);
      return { cwd, previousSha: '' };
    },
    want: 'BUILD',
  },
  {
    name: 'redeploy: previous deployment IS HEAD (env var change)',
    setup: () => {
      const { cwd } = seedRepo();
      const head = commit(cwd, ['docs/b.md']);
      return { cwd, previousSha: head };
    },
    want: 'BUILD',
  },
  {
    name: 'no git checkout at all',
    setup: () => ({ cwd: newDir(), previousSha: 'deadbeefdeadbeefdeadbeefdeadbeefdeadbeef' }),
    want: 'BUILD',
  },
];

function run(cmd: 'new' | 'old', cwd: string, previousSha: string, ref: string) {
  const env = {
    ...GIT_ENV,
    // Stop git looking above a temp dir for a repo (the no-checkout row).
    GIT_CEILING_DIRECTORIES: tmpdir(),
    VERCEL_GIT_PREVIOUS_SHA: previousSha,
    VERCEL_GIT_COMMIT_REF: ref,
    VERCEL_ENV: ref === 'main' ? 'production' : 'preview',
  };
  const r =
    cmd === 'new'
      ? spawnSync('sh', [SCRIPT], { cwd, env, encoding: 'utf8' })
      : spawnSync('sh', ['-c', OLD_IGNORE_COMMAND], { cwd, env, encoding: 'utf8' });
  return { verdict: verdict(r.status), out: `${r.stdout}${r.stderr}`.trim() };
}

describe('scripts/vercel-ignore-build.sh', () => {
  const rows: string[] = [];
  afterAll(() => {
    console.log(['case | new | old', ...rows].join('\n'));
  });

  for (const c of cases) {
    it(c.name, () => {
      const { cwd, previousSha, ref = 'main' } = c.setup();
      const next = run('new', cwd, previousSha, ref);
      const old = run('old', cwd, previousSha, ref);
      rows.push(`${c.name} | ${next.verdict} | ${old.verdict}`);
      expect(next.verdict, next.out).toBe(c.want);
      // Every decision names itself in the Vercel build log.
      expect(next.out).toMatch(new RegExp(`^vercel-ignore-build: ${c.want} -- `));
      if (c.oldWas) expect(old.verdict, `old command on: ${c.name}`).toBe(c.oldWas);
    });
  }
});

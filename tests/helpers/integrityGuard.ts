/**
 * integrityGuard.ts -- the shared harness for driving scripts/integrity-guard.py
 * and its consumers from vitest.
 *
 * WHY IT IS SHARED. Two specs were re-implementing this and had already drifted:
 * integrityControlBytes.test.ts's runner tolerated exit 1 and rethrew everything
 * else, which stopped being correct the moment the guard grew an exit 2 for
 * could-not-run. A second copy of a tolerance is a second thing to remember.
 */
import { execFileSync, spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import {
  chmodSync,
  copyFileSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  statSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

export const REPO_ROOT = fileURLToPath(new URL('../../', import.meta.url));
export const GUARD = join(REPO_ROOT, 'scripts', 'integrity-guard.py');

export type GuardIssue = {
  path: string;
  line: number;
  code: string;
  reason: string;
  could_not_run?: boolean;
  /** The exception class (or an equivalent tag). Grouping keys on it so
   *  an absent node and a hung one do not collapse into one line. */
  kind?: string;
};

export type GuardResult = {
  /** Files this run LOOKED AT. With a parser that could not run, that is
   *  emphatically not the same as the files it checked. */
  considered: number;
  issues: GuardIssue[];
  exit?: number;
  ok: boolean;
};

export type Run = { status: number; stdout: string; stderr: string };

const IS_WIN = process.platform === 'win32';
const PATH_SEP = IS_WIN ? ';' : ':';
// Windows resolves a bare name through PATHEXT; POSIX has only the one spelling.
const EXE_SUFFIXES = IS_WIN ? ['.exe', '.cmd', '.bat', ''] : [''];

/** PATH's key casing varies on Windows, so it is looked up rather than assumed. */
function pathKey(env: NodeJS.ProcessEnv): string {
  return Object.keys(env).find((k) => k.toUpperCase() === 'PATH') ?? 'PATH';
}

function pathDirs(env: NodeJS.ProcessEnv): string[] {
  return (env[pathKey(env)] ?? '').split(PATH_SEP).filter(Boolean);
}

/** True only for an existing regular file (or a symlink to one). */
function isFileAt(candidate: string): boolean {
  try {
    return statSync(candidate).isFile();
  } catch {
    return false;
  }
}

/**
 * Is there a FILE called `name` in `dir`?
 *
 * isFile(), not existsSync alone: EXE_SUFFIXES contains '' on every platform, so
 * a bare existsSync matches a DIRECTORY named `python3` or `git` or `node`. That
 * is not hypothetical mischief -- it would make PYTHON a directory path and
 * throw EISDIR out of every runProcess in the file, or keep a node-carrying PATH
 * entry alive and red every noNode() case with a message blaming the platform.
 */
function dirCarries(dir: string, name: string): boolean {
  return EXE_SUFFIXES.some((suffix) => isFileAt(join(dir, name + suffix)));
}

/**
 * Repo-DISCOVERY variables removed from a child's environment.
 *
 * A git hook EXPORTS git's own variables into everything it runs, and
 * .githooks/pre-push runs `npm run test:unit`. MEASURED on git 2.53.0.windows.1,
 * a pre-push hook carries GIT_DIR, GIT_EXEC_PATH, GIT_PREFIX and GIT_EDITOR,
 * and it carries GIT_DIR only when the push runs from a linked worktree. That
 * last clause is an OBSERVATION, deliberately left without a mechanism: the
 * obvious explanation -- that a worktree's .git cannot be walked up to -- is
 * FALSE, since it is a perfectly readable `gitdir:` pointer file. Do not reason
 * from it that some checkout is exempt and can skip the strip. A pre-commit
 * hook exports a different set again, including a RELATIVE GIT_INDEX_FILE.
 *
 * That worktree-only GIT_DIR is the whole defect. makeTempRepo's `git init`
 * inherited it and re-initialised the REAL repository instead of its temp
 * directory -- and `git init` against a LINKED WORKTREE's gitdir writes
 * core.bare=true into the SHARED config, so `git rev-parse --show-toplevel`
 * then fails in the main checkout and in every other worktree at once. 28 cases
 * died with "must be run in a work tree". The quiet half is worse than that
 * loud one: bin/repair-corrupt.sh's own `git rev-parse --show-toplevel` would
 * have answered about the real tree, and that script RESTORES FILES.
 *
 * Stripped at runProcess rather than at the git helper, because the subjects
 * shell out to git themselves: bin/check-integrity.sh, bin/repair-corrupt.sh
 * and the guard all call it, and a temp-repo case is meaningless if any of them
 * is answering about a different tree.
 *
 * KEEP is not a convenience list, and removing every GIT_* would be a
 * REGRESSION. The config-ISOLATION variables match the same prefix, and
 * dropping them falls the temp repo back onto the contributor's real
 * ~/.gitconfig -- the exact failure makeTempRepo's -c pins exist to prevent,
 * with a global init.templateDir or core.fsmonitor then riding in unpinned.
 * GIT_EXEC_PATH is kept because it is subcommand DISPATCH, not discovery: on a
 * relocated or portable git it is what makes `git init` resolve at all, and
 * dropping it there fails with a message about git rather than about the
 * subject -- the very shape of the incident above. That git falls back to a
 * compiled-in exec path was measured on ONE install here and does not
 * generalise, so it is not relied on. Neither kept variable can point git at
 * another repository, which is the only thing this filter exists to prevent.
 * GIT_CONFIG_PARAMETERS and the GIT_CONFIG_COUNT/KEY/VALUE trio are NOT kept:
 * those INJECT config rather than isolate it, and makeTempRepo pins its own.
 *
 * The prefix test is case-INSENSITIVE for the reason pathKey() above exists:
 * Windows resolves env lookups without regard to case while Object.keys()
 * reports the case a variable was SET with, so a `git_dir=...` exported by a
 * wrapper or shell profile would slip past a case-sensitive filter and still be
 * honoured by every git child -- the strip silently doing nothing at all.
 *
 * Caught by the pre-push gate, not by review and not by the 39-mutant battery --
 * both only ever ran the suite from a shell, where none of these variables
 * exist. That is also why this needs its own cases rather than the suite's
 * ambient green: see the two GIT_* cases in tests/integrityCouldNotRun.test.ts.
 * Before they existed, this function survived its own DELETION with every test
 * still passing.
 */
const GIT_ENV_KEEP = new Set([
  'GIT_EXEC_PATH',
  'GIT_CONFIG_GLOBAL',
  'GIT_CONFIG_SYSTEM',
  'GIT_CONFIG_NOSYSTEM',
]);

function withoutGitEnv(env: NodeJS.ProcessEnv): NodeJS.ProcessEnv {
  return Object.fromEntries(
    Object.entries(env).filter(([k]) => {
      const key = k.toUpperCase();
      return !key.startsWith('GIT_') || GIT_ENV_KEEP.has(key);
    }),
  );
}

/**
 * Run a process and normalise the result.
 *
 * spawnSync, not execFileSync, and the difference is load-bearing: execFileSync
 * RETURNS stdout and only carries stderr on the thrown error, so a subject that
 * exits 0 while writing to stderr comes back with stderr silently empty. Several
 * of the cases here are exactly that shape -- an advisory that must NOT block --
 * and they passed vacuously against nothing until this was changed.
 *
 * A non-numeric status means the spawn itself failed or the child was signalled:
 * a harness fault, not a verdict, so it throws rather than being reported as an
 * exit code the subject never produced.
 */
export function runProcess(
  exe: string,
  args: string[],
  opts: { cwd?: string; env?: NodeJS.ProcessEnv; input?: string } = {},
): Run {
  const result = spawnSync(exe, args, {
    cwd: opts.cwd ?? REPO_ROOT,
    encoding: 'utf8',
    maxBuffer: 32 * 1024 * 1024,
    input: opts.input,
    env: { ...withoutGitEnv(opts.env ?? process.env), PYTHONUTF8: '1' },
  });
  if (result.error) throw result.error;
  if (typeof result.status !== 'number') {
    throw new Error(`${exe} produced no exit status (signal ${String(result.signal)})`);
  }
  return { status: result.status, stdout: result.stdout ?? '', stderr: result.stderr ?? '' };
}

/**
 * `python3` as an absolute path where one can be found, else the bare name.
 *
 * The bare name is not a fallback of last resort on Windows: python3 there is
 * commonly a WindowsApps App Execution Alias, a zero-byte reparse point that
 * existsSync cannot see, so the scan below legitimately finds nothing while
 * CreateProcess resolves it perfectly well. Which is why envWithoutNode() PROBES
 * rather than infers -- see there.
 */
function resolveOnPath(name: string): string | null {
  for (const dir of pathDirs(process.env)) {
    for (const suffix of EXE_SUFFIXES) {
      const candidate = join(dir, name + suffix);
      // isFile, for the reason dirCarries gives: '' is a valid suffix, so
      // existsSync alone would return a DIRECTORY named python3 as the
      // interpreter and throw EISDIR out of every call in this file.
      if (isFileAt(candidate)) return candidate;
    }
  }
  return null;
}

export const PYTHON = resolveOnPath('python3') ?? 'python3';

/**
 * bash, resolved explicitly and with the WSL launcher EXCLUDED.
 *
 * On Windows a bare `bash` can resolve to %SystemRoot%/System32/bash.exe -- the
 * WSL launcher. It sees a different filesystem, so a Windows path handed to it
 * comes back as `/mnt/c/...` prefixed onto itself and every git call inside the
 * script fails with "not a git repository". Measured, not feared: a sibling
 * harness that took the bare name got exactly that, and the resulting failures
 * looked like defects in the scripts under test.
 *
 * PATH order happens to put Git's usr/bin first on this machine, so ordering
 * alone would have worked here and silently not elsewhere. The System32
 * exclusion is what makes it a rule rather than a coincidence.
 */
function resolveBash(): string {
  const system32 = join(process.env.SystemRoot ?? 'C:/Windows', 'System32').toLowerCase();
  for (const dir of pathDirs(process.env)) {
    if (dir.toLowerCase().startsWith(system32)) continue;
    for (const suffix of EXE_SUFFIXES) {
      const candidate = join(dir, 'bash' + suffix);
      if (isFileAt(candidate)) return candidate;
    }
  }
  return 'bash';
}

export const BASH = resolveBash();

/** Does `exe` actually run under this environment? Measured, not inferred. */
function canRun(exe: string, args: string[], env: NodeJS.ProcessEnv): boolean {
  try {
    execFileSync(exe, args, { env, stdio: 'ignore' });
    return true;
  } catch {
    return false;
  }
}

export type StrippedEnv = {
  env: NodeJS.ProcessEnv;
  removed: number;
  /** Measured facts about the resulting environment, not assumptions about it. */
  probes: { node: boolean; python: boolean; git: boolean };
};

/**
 * The child environment with node removed from PATH, plus the measurements that
 * say whether that actually worked.
 *
 * THE TRAP THIS AVOIDS. A previous draft stripped every PATH directory carrying
 * a node. On Homebrew (/opt/homebrew/bin) and apt-Debian (/usr/bin) that is the
 * same directory holding git and python3 -- the guard's own dependencies and the
 * harness's interpreter -- so the child died for a reason the spec did not
 * create, and every assertion would have passed against a guard that never ran.
 * The guard shells out to git for `rev-parse` and `cat-file`; without it there
 * is no run at all.
 *
 * So: directories carrying git or python3 are KEPT even when they also carry
 * node, and the outcome is then PROBED by executing all three. The probes are
 * the precondition. A caller must assert them; a green case built on an
 * unverified environment proves nothing about the handler under test.
 *
 * If node survives (it shares a directory with git), that is reported honestly
 * rather than papered over -- the seam harness still covers the handler, and a
 * silently skipped end-to-end case would read as coverage that is not there.
 */
export function envWithoutNode(): StrippedEnv {
  const key = pathKey(process.env);
  const dirs = pathDirs(process.env);
  const kept = dirs.filter(
    (dir) => !dirCarries(dir, 'node') || dirCarries(dir, 'git') || dirCarries(dir, 'python3'),
  );
  const env = { ...process.env, [key]: kept.join(PATH_SEP) };
  return {
    env,
    removed: dirs.length - kept.length,
    probes: {
      node: canRun('node', ['--version'], env),
      python: canRun(PYTHON, ['-c', 'pass'], env),
      git: canRun('git', ['--version'], env),
    },
  };
}

/** Drive the real guard and parse its --json output. */
export function runGuardJson(
  files: string[],
  opts: { env?: NodeJS.ProcessEnv; cwd?: string; extra?: string[]; selfCheck?: boolean } = {},
): Run & { parsed: GuardResult } {
  const cwd = opts.cwd ?? REPO_ROOT;
  const guard = join(cwd, 'scripts', 'integrity-guard.py');
  // --no-self-check by DEFAULT: a fixture run has no business asserting the
  // sha pin, and the working copy's pin is stale for most of this suite's life.
  // selfCheck:true opts a case back in, which is the only way to exercise the
  // seal itself.
  const seal = opts.selfCheck ? [] : ['--no-self-check'];
  const args = [guard, '--json', ...seal, ...(opts.extra ?? []), '--files', ...files];
  const result = runProcess(PYTHON, args, { cwd, env: opts.env });
  return { ...result, parsed: parseGuardJson(result) };
}

/**
 * JSON.parse the guard's stdout, or fail with what actually happened.
 *
 * A bare JSON.parse(result.stdout) turned every no-JSON exit into
 * 'Unexpected end of JSON input' -- exit 3 ('not in a git repository', 'git
 * failed'), a crash before the print, a python3 that cannot start. The status
 * and the stderr that NAME the cause were both discarded, in a harness whose
 * entire purpose is to tell 'the guard is broken' from 'your tree is broken'.
 * It could not do that on its own failure path.
 */
function parseGuardJson(result: Run): GuardResult {
  try {
    return JSON.parse(result.stdout) as GuardResult;
  } catch (err) {
    throw new Error(
      `the guard produced no parseable --json (exit ${result.status}): ` +
        `${(err as Error).message}\n--- stdout ---\n${result.stdout}\n` +
        `--- stderr ---\n${result.stderr}`,
    );
  }
}

/** Drive the real guard in HUMAN-READABLE mode. Its report goes to stderr. */
export function runGuardText(
  files: string[],
  opts: { env?: NodeJS.ProcessEnv; cwd?: string; extra?: string[] } = {},
): Run {
  const cwd = opts.cwd ?? REPO_ROOT;
  const guard = join(cwd, 'scripts', 'integrity-guard.py');
  const args = [guard, '--no-self-check', ...(opts.extra ?? []), '--files', ...files];
  return runProcess(PYTHON, args, { cwd, env: opts.env });
}

// Everything the integrity apparatus needs to run somewhere that is not this
// repo. bin/*.sh resolve their siblings relative to the repo root, so the layout
// is reproduced rather than flattened.
const TEMP_REPO_FILES = [
  'bin/check-integrity.sh',
  'bin/repair-corrupt.sh',
  'scripts/integrity-guard.py',
  'scripts/_integrity_ts_parse.cjs',
  'scripts/safe-write.py',
  '.claude/hooks/post-write-check.sh',
  // NOTE: .integrity-guard.sha256 is deliberately NOT copied. It is MINTED from
  // the guard this repo just received -- see makeTempRepo.
];

/**
 * A throwaway git repo carrying the integrity apparatus and nothing else.
 *
 * WHY: bin/repair-corrupt.sh RESTORES FILES. Driving it against the real working
 * tree would be a canary that can destroy the work it is run beside. It also
 * scans every tracked file, which is ~35s of git subprocesses here and about
 * five files there.
 *
 * The corpus deliberately holds no .ts/.tsx/.jsx: check_ts_batch returns early
 * on an empty list, so the TS phase never runs and cannot contribute a
 * could-not-run of its own to a case that is about something else.
 *
 * autocrlf is pinned off so what is committed is byte-for-byte what was written
 * -- the restore path compares HEAD against the working tree.
 */
export function makeTempRepo(files: Record<string, string>): string {
  const root = mkdtempSync(join(tmpdir(), 'integrity-canary-'));
  // commit.gpgsign and core.hooksPath are pinned for the same reason autocrlf
  // is: a temp repo must not inherit facts from the contributor's global git
  // config. A global `commit.gpgsign=true` -- ordinary on signed-commit setups
  // -- makes the commit below fail 128 and kills EVERY temp-repo case at once,
  // and a global core.hooksPath runs foreign hooks against a five-file repo.
  // Both fail with a message about git, not about the subject under test.
  const git = (...args: string[]) =>
    runProcess(
      'git',
      [
        '-c', 'core.autocrlf=false',
        '-c', 'core.safecrlf=false',
        '-c', 'commit.gpgsign=false',
        '-c', 'core.hooksPath=',
        ...args,
      ],
      { cwd: root },
    );

  const init = git('init', '-q');
  if (init.status !== 0) {
    throw new Error(`makeTempRepo: init failed (${init.status}): ${init.stderr}`);
  }
  // FAIL CLOSED where the damage actually happens. A status check alone would
  // NOT have caught the incident withoutGitEnv exists to prevent: that `git
  // init` exited 0, having cheerfully re-initialised the real repository via an
  // inherited GIT_DIR. The postcondition that separates the two outcomes is
  // whether THIS directory got a .git at all, so assert that and not the code.
  // Without it the first symptom is `commit` failing 40 lines later, with a
  // message about git rather than about the subject under test.
  if (!existsSync(join(root, '.git'))) {
    throw new Error(
      `makeTempRepo: git init exited 0 but created no .git in ${root} -- it ` +
        'initialised somewhere else, which means a repo-discovery variable ' +
        'reached the child. See withoutGitEnv.',
    );
  }
  for (const rel of TEMP_REPO_FILES) {
    const dest = join(root, rel);
    mkdirSync(dirname(dest), { recursive: true });
    copyFileSync(join(REPO_ROOT, rel), dest);
    // copyFileSync inherits the SOURCE's mode, and these scripts are mode
    // 100644 in git -- which is why .github/workflows/architecture-guard.yml
    // carries an explicit `chmod +x bin/*.sh`. Without this, the temp copy is
    // 644 on Linux, bin/repair-corrupt.sh's own `[ ! -x bin/check-integrity.sh ]`
    // guard fires, and every repair-corrupt case reds on ubuntu CI while passing
    // on Windows, where the mode bit is meaningless. unit-tests.yml has no chmod
    // step of its own, so this is the only place that can fix it.
    if (rel.endsWith('.sh')) chmodSync(dest, 0o755);
  }
  // MINT the self-seal from the guard THIS repo just received, rather than
  // copying the live .integrity-guard.sha256.
  //
  // Copying it made the canary read the LIVE subject. The pin and the guard
  // agree only while the working tree is pinned, so editing
  // scripts/integrity-guard.py without re-running bin/integrity-pin.sh -- an
  // ordinary in-progress state -- desynced the copy and red four cases, three
  // of them CONTROLs, with 'SELF-CHECK FAILED / GUARD SHA MISMATCH'. That is a
  // message about the pin, so an ordinary edit read as 'the canary is broken'.
  // Measured: 4 failed / 49 passed with the pin desynced by one byte.
  //
  // Minting keeps every seal case meaningful -- the pin still has to MATCH, and
  // a case that wants a missing or wrong pin still rm's or rewrites it -- while
  // making the temp repo self-consistent by construction.
  writeFileSync(
    join(root, '.integrity-guard.sha256'),
    `${createHash('sha256')
      .update(readFileSync(join(root, 'scripts', 'integrity-guard.py')))
      .digest('hex')}  scripts/integrity-guard.py\n`,
  );
  for (const [rel, body] of Object.entries(files)) {
    const dest = join(root, rel);
    mkdirSync(dirname(dest), { recursive: true });
    writeFileSync(dest, body);
  }
  const add = git('add', '-A');
  if (add.status !== 0) {
    throw new Error(`makeTempRepo: add failed (${add.status}): ${add.stderr}`);
  }
  const commit = git(
    '-c', 'user.email=canary@example.invalid', '-c', 'user.name=canary',
    'commit', '-q', '-m', 'canary base',
  );
  if (commit.status !== 0) {
    throw new Error(`makeTempRepo: commit failed (${commit.status}): ${commit.stderr}`);
  }
  return root;
}

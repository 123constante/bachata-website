/**
 * shipScopeTrunkCarried.test.ts -- the merge-from-main lockout, end to end.
 *
 * THE DEFECT. resolveBaseRef() scopes a ship against origin/<branch> -- "what is
 * already pushed". Merging main into the branch is not that, so every file main
 * moved lands in the narrow diff and the gate demands review receipts for them
 * under this branch's name. Measured on this repo landing #307 on top of
 * #308/#310/#311: eleven hard-tier files, push blocked, all of them already
 * merged. That trains `--no-verify`, which disables the hard tier too.
 *
 * WHY THESE CASES RUN AGAINST A REAL REPO AND NOT A FAKE. Two earlier fixes were
 * reverted at review, and the third disproof of the second one was that its eight
 * new cases never called the resolver at all -- reverting the production code to
 * its pre-change form left the suite byte-identically green. A predicate wired to
 * nothing passes every hand-composed case while the gate stays locked out exactly
 * as it was. So the subject here is the SHIPPED scripts, copied into a throwaway
 * repo with a real bare remote and driven as child processes: nothing in these
 * cases can pass unless the wiring is live.
 *
 * THE FIXTURE IS THE PRODUCTION SHAPE, and the first case asserts that premise
 * with git rather than assuming it: a NON-EMPTY narrow set, a NON-EMPTY trunk
 * set, and ZERO intersection. Neither fixture written for the reverted attempts
 * had it -- the load-bearing one passed `trunkRiskyPaths = []`, a stronger and
 * rarer premise than the scenario it was named for.
 *
 * runProcess (not execFileSync) strips repo-DISCOVERY variables from the child
 * environment. .githooks/pre-push exports GIT_DIR and runs the unit suite, and a
 * temp repo that inherits it is not a temp repo -- see tests/helpers/
 * integrityGuard.ts, where that incident is written up.
 */
import { describe, it, expect, afterAll } from 'vitest';
import {
  copyFileSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { runProcess } from './helpers/integrityGuard';
import { REPO_ROOT, shipScopeFilter } from '../scripts/lib/review-scope.mjs';

/** The apparatus under test, copied whole so REPO_ROOT resolves to the temp repo. */
const SUBJECT_FILES = [
  'scripts/lib/review-scope.mjs',
  'scripts/lib/arc-state.mjs',
  'scripts/lib/entry-point.mjs',
  'scripts/ship-gate.mjs',
  'scripts/hooks/review-stamp.mjs',
];

/* The three machine-written .claude/ files this repo ignores. Without them the
 * mint's own journal is an untracked hard-tier path, so minting a receipt would
 * put a new unreviewed file in scope and the symmetry case could never go green
 * -- a failure about the fixture wearing the costume of a failure about the gate. */
const IGNORED =
  ['/.claude/.session-lock.json', '/.claude/.review-stamp.json', '/.claude/.review-mint-log.json'].join('\n') +
  '\n';

const roots: string[] = [];
afterAll(() => {
  for (const root of roots) rmSync(root, { recursive: true, force: true });
});

/** git in `cwd`, with the contributor's global config pinned out. Throws on failure. */
function git(cwd: string, ...args: string[]): string {
  const result = runProcess(
    'git',
    [
      '-c', 'core.autocrlf=false',
      '-c', 'core.safecrlf=false',
      '-c', 'commit.gpgsign=false',
      '-c', 'core.hooksPath=',
      '-c', 'user.email=canary@example.invalid',
      '-c', 'user.name=canary',
      '-c', 'init.defaultBranch=main',
      ...args,
    ],
    { cwd },
  );
  if (result.status !== 0) {
    throw new Error(`git ${args.join(' ')} failed (${result.status}): ${result.stderr}`);
  }
  return result.stdout;
}

function write(root: string, rel: string, body: string): void {
  const dest = join(root, rel);
  mkdirSync(dirname(dest), { recursive: true });
  writeFileSync(dest, body);
}

/**
 * A work repo on `feat/x`, pushed, with its own risky commit -- and optionally
 * with a merge FROM main that moved two more risky files in.
 *
 * @returns the work tree's path
 */
function makeScenario({
  merge,
  legacy = false,
  push = true,
}: {
  merge: boolean;
  legacy?: boolean;
  push?: boolean;
}): string {
  const base = mkdtempSync(join(tmpdir(), 'shipscope-'));
  roots.push(base);
  const remote = join(base, 'origin.git');
  const work = join(base, 'work');
  mkdirSync(remote);
  mkdirSync(work);
  git(remote, 'init', '--bare', '-q');
  git(work, 'init', '-q');
  /* FAIL CLOSED AT THE POINT OF DAMAGE. `git init` exits 0 having initialised
   * somewhere else entirely when a repo-discovery variable reaches the child, so
   * the postcondition that separates the two outcomes is whether THIS directory
   * got a .git at all. */
  if (!existsSync(join(work, '.git'))) {
    throw new Error(
      `temp repo got no .git at ${work} -- git init ran somewhere else, which means a ` +
        'repo-discovery variable reached the child. See withoutGitEnv in tests/helpers.',
    );
  }
  for (const rel of SUBJECT_FILES) {
    const dest = join(work, rel);
    mkdirSync(dirname(dest), { recursive: true });
    copyFileSync(join(REPO_ROOT, rel), dest);
  }
  write(work, '.gitignore', IGNORED);
  write(work, 'src/app.ts', 'export const app = 1;\n');
  // Present from the base commit so the trunk can later MOVE it: git reports a
  // rename by its destination only, so the source has to predate the fork.
  if (legacy) write(work, 'scripts/legacy-guard.mjs', 'export const legacy = 1;\n');
  git(work, 'add', '-A');
  git(work, 'commit', '-q', '-m', 'base');
  git(work, 'remote', 'add', 'origin', remote);
  git(work, 'push', '-q', '-u', 'origin', 'main');

  git(work, 'checkout', '-q', '-b', 'feat/x');
  write(work, 'scripts/own-guard.mjs', 'export const own = 1;\n');
  git(work, 'add', '-A');
  git(work, 'commit', '-q', '-m', 'the branch does its own risky work');
  if (push) git(work, 'push', '-q', '-u', 'origin', 'feat/x');

  if (merge) {
    git(work, 'checkout', '-q', 'main');
    write(work, 'scripts/imported.mjs', 'export const imported = 1;\n');
    write(work, '.github/workflows/ci.yml', 'name: ci\n');
    if (legacy) {
      // git mv will not create the destination directory for you.
      mkdirSync(join(work, 'archive'), { recursive: true });
      git(work, 'mv', 'scripts/legacy-guard.mjs', 'archive/legacy-guard.mjs');
    }
    git(work, 'add', '-A');
    git(work, 'commit', '-q', '-m', 'the trunk moves');
    git(work, 'push', '-q', 'origin', 'main');
    git(work, 'checkout', '-q', 'feat/x');
    git(work, 'merge', '-q', '--no-ff', '-m', 'merge main', 'main');
  }
  return work;
}

/** The half of ship-gate's --json verdict these cases read. */
type Verdict = {
  scope: { hard: string[]; soft: string[] };
  deleted: { hard: string[]; soft: string[] };
  reasons: string[];
  baseRef: string;
  widened: boolean;
  trunkCarried: number;
  trunkError: string | null;
};

/** Run the SHIPPED gate in the temp repo and parse its verdict. */
function gate(work: string): { status: number; verdict: Verdict } {
  const result = runProcess(process.execPath, [join(work, 'scripts', 'ship-gate.mjs'), '--json'], {
    cwd: work,
  });
  if (!result.stdout.trim()) {
    throw new Error(`ship-gate produced no JSON (status ${result.status}): ${result.stderr}`);
  }
  return { status: result.status, verdict: JSON.parse(result.stdout) };
}

/** What git says this ship changes against `ref` -- computed INDEPENDENTLY of the subject. */
function diffAgainst(work: string, ref: string): string[] {
  const mergeBase = git(work, 'merge-base', ref, 'HEAD').trim();
  return git(work, 'diff', '--name-only', mergeBase)
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean);
}

describe('shipScopeFilter -- the pure policy half', () => {
  it('splits on membership, and an UNREADABLE trunk (null) subtracts nothing', () => {
    expect(shipScopeFilter(['a', 'b'], new Set(['b']))).toEqual({ own: ['b'], trunkCarried: ['a'] });
    // null is the "could not read the trunk" signal: the scope must stay WIDER,
    // never narrower, because a subtraction nobody can verify is a fail-open.
    expect(shipScopeFilter(['a', 'b'], null)).toEqual({ own: ['a', 'b'], trunkCarried: [] });
    expect(shipScopeFilter(['a', 'b'], ['a', 'b'])).toEqual({ own: ['a', 'b'], trunkCarried: [] });
    expect(shipScopeFilter([], new Set(['a']))).toEqual({ own: [], trunkCarried: [] });
  });
});

describe('the merge-from-main lockout, against a real repo and a real remote', () => {
  it('THE PRODUCTION SHAPE: non-empty narrow, non-empty trunk, zero intersection', () => {
    const work = makeScenario({ merge: true });

    // The premise, asserted with git rather than assumed. This is the fixture
    // neither reverted attempt had.
    const narrow = diffAgainst(work, 'origin/feat/x');
    const trunk = diffAgainst(work, 'origin/main');
    expect(narrow.length).toBeGreaterThan(0);
    expect(trunk.length).toBeGreaterThan(0);
    expect(narrow.filter((f) => trunk.includes(f))).toEqual([]);
    expect(narrow).toContain('scripts/imported.mjs');
    expect(narrow).toContain('.github/workflows/ci.yml');
    expect(trunk).toContain('scripts/own-guard.mjs');

    const { status, verdict } = gate(work);
    // Before the fix these two paths were the whole hard tier and the push was blocked.
    expect(verdict.scope.hard).toEqual([]);
    expect(verdict.scope.soft).toEqual([]);
    expect(verdict.deleted.hard).toEqual([]);
    expect(verdict.trunkCarried).toBe(narrow.length);
    expect(verdict.trunkError).toBeNull();
    // ...and the base was NOT widened: resolveShipBase/pickShipBase are untouched.
    expect(verdict.baseRef).toBe('origin/feat/x');
    expect(verdict.widened).toBe(false);
    expect(status).toBe(0);
  });

  it('BOTH EDGES IN ONE RUN: the branch own risky file is kept, the imported ones dropped', () => {
    const work = makeScenario({ merge: true });
    write(work, 'scripts/new-own.mjs', 'export const fresh = 1;\n');

    const { status, verdict } = gate(work);
    // The kept edge has to be REACHABLE, not merely asserted: a rule that
    // subtracted everything would satisfy the case above and fail here.
    expect(verdict.scope.hard).toEqual(['scripts/new-own.mjs']);
    expect(verdict.trunkCarried).toBeGreaterThan(0);
    expect(verdict.reasons.join('\n')).toContain('scripts/new-own.mjs');
    expect(verdict.reasons.join('\n')).not.toContain('scripts/imported.mjs');
    expect(status).toBe(1);
  });

  it('CONTROL: an ordinary branch that never merged the trunk is not narrowed at all', () => {
    const work = makeScenario({ merge: false });
    write(work, 'scripts/second-own.mjs', 'export const second = 1;\n');
    git(work, 'add', '-A');
    git(work, 'commit', '-q', '-m', 'more own work, not yet pushed');
    write(work, 'scripts/third-own.mjs', 'export const third = 1;\n');

    const { status, verdict } = gate(work);
    // Everything this branch carries is its own, committed or not, so the
    // subtraction must be a no-op -- this is the shape resolveBaseRef() exists for.
    expect(verdict.trunkCarried).toBe(0);
    expect(verdict.trunkError).toBeNull();
    expect(verdict.scope.hard).toEqual(['scripts/second-own.mjs', 'scripts/third-own.mjs']);
    expect(status).toBe(1);
  });

  it('FAIL-CLOSED: an unreadable trunk narrows nothing and stays a POLICY red', () => {
    const work = makeScenario({ merge: true });
    git(work, 'update-ref', '-d', 'refs/remotes/origin/main');

    const { status, verdict } = gate(work);
    // Querying the trunk on every push is new, and a throw here would reach
    // .githooks/pre-push as exit 2 -- which it treats as infra and does NOT block
    // on. So the failure is caught, named, and leaves the WIDER scope standing.
    expect(typeof verdict.trunkError).toBe('string');
    expect(verdict.trunkError.length).toBeGreaterThan(0);
    expect(verdict.trunkCarried).toBe(0);
    expect(verdict.scope.hard).toContain('scripts/imported.mjs');
    expect(verdict.scope.hard).toContain('.github/workflows/ci.yml');
    expect(status).toBe(1);
    expect(status).not.toBe(2);
  });

  it('a rename the TRUNK made demands no deletion receipt from this branch', () => {
    const work = makeScenario({ merge: true, legacy: true });

    /* REACHABILITY FIRST. deletedRiskyFiles() only reaches its rename arm when
     * git actually REPORTS a rename, and if it did not, this case would pass
     * having exercised nothing -- the shape that makes a mutant look equivalent
     * when it is really uncovered. Assert the premise before the verdict. */
    const mergeBase = git(work, 'merge-base', 'origin/feat/x', 'HEAD').trim();
    const status = git(work, 'diff', '--name-status', '-M', mergeBase);
    expect(status).toMatch(/^R\d*\tscripts\/legacy-guard\.mjs\tarchive\/legacy-guard\.mjs$/m);

    const result = gate(work);
    // Moving a guard OUT of the risky tree is the highest-risk edit there is, and
    // this branch did not make it -- the trunk did, and already carries it. Listing
    // it here would demand an attestation for someone else's merged work, which is
    // the lockout in its other costume.
    expect(result.verdict.deleted.hard).toEqual([]);
    expect(result.verdict.scope.hard).toEqual([]);
    expect(result.status).toBe(0);
  });

  it('a NEVER-PUSHED branch scopes against the trunk and is not narrowed at all', () => {
    /* The base IS the trunk here (no upstream -> resolveBaseRef returns
     * origin/main -> resolveShipBase keeps it), so shipScope() skips the
     * subtraction entirely. Pinned end to end rather than reasoned about: "the
     * two sets would come out identical anyway" is the shape of an assumption
     * that hides a blind spot, and this is the state a fresh branch is in --
     * including, at the time of writing, the worktree this fix was built in. */
    const work = makeScenario({ merge: false, push: false });

    const { status, verdict } = gate(work);
    expect(verdict.baseRef).toBe('origin/main');
    expect(verdict.widened).toBe(false);
    expect(verdict.trunkCarried).toBe(0);
    expect(verdict.trunkError).toBeNull();
    // The branch's own committed work is still fully demanded -- the subtraction
    // being a no-op must not become the subtraction being everything.
    expect(verdict.scope.hard).toEqual(['scripts/own-guard.mjs']);
    expect(status).toBe(1);
  });

  it('MINT AND GATE MOVE TOGETHER: the receipt attests exactly what the gate demands', () => {
    const work = makeScenario({ merge: true });
    write(work, 'scripts/new-own.mjs', 'export const fresh = 1;\n');
    expect(gate(work).status).toBe(1);

    const mint = runProcess(process.execPath, [join(work, 'scripts', 'hooks', 'review-stamp.mjs')], {
      cwd: work,
      input: JSON.stringify({ session_id: 'canary', tool_input: { findings: [] } }),
    });
    expect(mint.status).toBe(0);

    const stamp = JSON.parse(readFileSync(join(work, '.claude', '.review-stamp.json'), 'utf8'));
    // A mint over a WIDER scope than the gate asks about attests files nobody
    // proposed to change; a NARROWER one leaves a red with no way to clear it.
    expect(Object.keys(stamp.hashes).sort()).toEqual(['scripts/new-own.mjs']);
    expect(Object.keys(stamp.hashes)).not.toContain('scripts/imported.mjs');
    // ...and the receipt actually clears the ship it was minted for.
    expect(gate(work).status).toBe(0);
  });
});

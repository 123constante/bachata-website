/**
 * integrityCouldNotRun.test.ts -- the canary for every could-not-run arm of the
 * integrity apparatus, and for the CONSUMERS that read its verdict.
 *
 * THE DEFECT IT PINS, measured on this tree at c168333 before the fix:
 *
 *     $ PATH=<node stripped> python3 scripts/integrity-guard.py --no-ts \
 *           --files <160 tracked .js/.cjs/.mjs>
 *     integrity-guard: ok (160 files checked, 0 issues)     exit 0
 *
 * check_js_node caught FileNotFoundError and TimeoutExpired and returned None,
 * the NO-ISSUE return. So a missing or hung node reported every tracked JS file
 * as CLEAN -- and a deliberately broken fixture passed with them. check_yaml did
 * the same for a missing PyYAML, check_ts_batch for a missing helper, and the
 * helper itself for an unresolvable typescript. An unknown recorded as a pass is
 * the failure mode a guard exists to not have.
 *
 * WHY THE CONSUMERS ARE IN THIS FILE. Closing a fail-open changes what the guard
 * REPORTS, and every consumer of those reports has to move with it. An earlier
 * attempt did not, and its worst consequence was strictly worse than the
 * fail-open: a 10s `node --check` timeout made .claude/hooks/post-write-check.sh
 * cry "POST-WRITE CORRUPTION DETECTED" and instruct an agent to overwrite a
 * HEALTHY file with a from-memory reconstruction. Producer-only coverage cannot
 * see that, so it is asserted here.
 *
 * BOTH OUTPUT MODES ARE DRIVEN. An earlier canary ran every case with --json;
 * the human-readable branch was the largest block the change added and had ZERO
 * coverage, and two review mutants inverting its predicates survived with no
 * failing case at all. Text mode is driven for all three shapes: corrupt-only,
 * run-only, and MIXED.
 *
 * EVERY RED CASE HAS A GREEN CONTROL. "node absent goes red" says nothing on its
 * own -- the fixture could simply be broken. Each fixture is first run with node
 * PRESENT and asserted clean, so the difference between the two runs is
 * attributable to node's absence and to nothing else.
 */
import { execFileSync } from 'node:child_process';
import { mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import {
  BASH,
  GuardIssue,
  GuardResult,
  PYTHON,
  REPO_ROOT,
  Run,
  envWithoutNode,
  makeTempRepo,
  runGuardJson,
  runGuardText,
  runProcess,
} from './helpers/integrityGuard';

// A directory of its own, NOT the .integrity-canary that integrityControlBytes
// uses: vitest runs spec files in parallel workers and that spec's afterAll is a
// recursive rm, so sharing would let one spec delete the other's fixtures
// mid-run, intermittently, and always look like a guard defect.
const CANARY_DIR = '.integrity-canary-cnr';
mkdirSync(join(REPO_ROOT, CANARY_DIR), { recursive: true });

const TEMP_REPOS: string[] = [];
afterAll(() => {
  rmSync(join(REPO_ROOT, CANARY_DIR), { recursive: true, force: true });
  for (const dir of TEMP_REPOS) rmSync(dir, { recursive: true, force: true });
});

function tempRepo(files: Record<string, string>): string {
  const root = makeTempRepo(files);
  TEMP_REPOS.push(root);
  return root;
}

const VALID_JS = 'export const a = 1;\n';
// Unbalanced brace: node --check rejects it, and nothing else in the guard's
// per-file pipeline would (no null bytes, no control bytes, valid UTF-8).
const BROKEN_JS = 'export function broken( {\n  return 1;\n';
const BROKEN_JSON = '{ "a": 1,\n';
const VALID_TSX = 'export const a: number = 1;\n';
const BROKEN_TSX = 'export function broken(: number {\n';

/** Write fixtures under the repo root and return their repo-relative paths. */
function fixtures(files: Record<string, string>): string[] {
  return Object.entries(files).map(([name, body]) => {
    const rel = `${CANARY_DIR}/${name}`;
    writeFileSync(join(REPO_ROOT, rel), body);
    return rel;
  });
}

function expectConsidered(parsed: GuardResult, n: number) {
  // --files silently drops anything that does not resolve inside the repo root,
  // and a spec asserting over zero files passes vacuously.
  expect(parsed.considered, 'the guard looked at the wrong number of files').toBe(n);
}

const codes = (r: GuardResult) => r.issues.map((i) => i.code).sort();
const cnr = (r: GuardResult) => r.issues.filter((i) => i.could_not_run);

// Module scope, NOT beforeAll: it.skipIf is evaluated when the file is
// COLLECTED, which happens before any hook runs. A skip predicate reading a
// variable a beforeAll had not yet assigned would read undefined and quietly
// mean "do not skip" -- a skip that silently never fires is worse than no skip.
const stripped = envWithoutNode();

/**
 * The node-less child environment, with its PRECONDITIONS asserted on every use.
 *
 * These are not decoration. If nothing was removed, node was never on PATH and
 * the case proves nothing about the handler. If node still RUNS, the strip did
 * not take -- node shares a directory with git or python3, which are kept
 * deliberately (the guard shells out to git; without it there is no run at all).
 * And if python3 or git stopped running, the child died for a reason this spec
 * did not create and every assertion below would pass vacuously.
 */
function noNode(): NodeJS.ProcessEnv {
  expect(stripped.removed, 'no PATH entry carried node -- this case would be vacuous').toBeGreaterThan(0);
  expect(stripped.probes.python, 'python3 stopped resolving -- the strip took the harness with it').toBe(true);
  expect(stripped.probes.git, 'git stopped resolving -- the guard cannot run at all without it').toBe(true);
  return stripped.env;
}

/**
 * True where the end-to-end node-absent route CANNOT be built.
 *
 * envWithoutNode() keeps any PATH directory that also carries git or python3,
 * because the guard shells out to git and the harness runs on python3. On
 * Homebrew (/opt/homebrew/bin) and apt-Debian (/usr/bin) that is the same
 * directory node lives in, so node survives the strip. Windows and the GitHub
 * runners keep them apart -- node comes from the toolcache there -- so this is
 * false everywhere the suite actually gates.
 *
 * Asserting instead of skipping was the first draft, and it is the anti-pattern
 * this repo has been bitten by five times: a contributor on a Mac would see
 * twelve red cases whose message is about the harness, not the guard, and an
 * ORDINARY violation would then read as "the canary is broken". The handlers
 * themselves stay covered on every platform by the seam harness below; what is
 * skipped is the ROUTE case, and it says so out loud rather than going quiet.
 */
const NODE_STRIP_UNAVAILABLE = stripped.probes.node;
if (NODE_STRIP_UNAVAILABLE) {
  console.warn(
    '[integrityCouldNotRun] node survives the PATH strip on this platform ' +
      '(it shares a directory with git or python3), so the end-to-end ' +
      'node-absent cases are SKIPPED. The seam harness still covers every handler.',
  );
}
/** `it` for cases that need node genuinely gone from PATH. */
const itNodeless = it.skipIf(NODE_STRIP_UNAVAILABLE);

describe('integrity guard: a JS check that could not RUN', () => {
  it('the node-absent ROUTE is available on CI, so the skip can never be silent', () => {
    // NODE_STRIP_UNAVAILABLE is computed from the RUNNER'S OWN PATH layout, and
    // when true it converts 12 end-to-end cases into skips -- including "says
    // COULD NOT CHECK about a file that is genuinely broken", the sharpest case
    // in this file. vitest then reports the spec as PASSING, so the entire
    // end-to-end half can stop gating with the board green and nothing said.
    // This repo's own note applies: repeated greens are not stability, and the
    // number to read is the test COUNT.
    //
    // Skipping is the RIGHT behaviour on a Homebrew or apt-Debian box, where
    // node shares a directory with git and the strip cannot be built without
    // taking the guard's own dependencies with it. It is never right on CI,
    // where node comes from the toolcache and the two are kept apart -- so on
    // CI the skip becomes a hard failure naming exactly what changed.
    //
    // This change asserted PyYAML in BOTH workflows precisely so an environment
    // could not quietly disarm a phase. The node-strip precondition had the
    // opposite treatment until this case.
    expect(typeof NODE_STRIP_UNAVAILABLE).toBe('boolean');
    expect(stripped.probes.python, 'python3 must resolve in the stripped env').toBe(true);
    expect(stripped.probes.git, 'git must resolve in the stripped env').toBe(true);
    if (process.env.CI) {
      expect(
        NODE_STRIP_UNAVAILABLE,
        'node shares a PATH directory with git or python3 on this runner, so the ' +
          'end-to-end node-absent cases SKIPPED and silently stopped gating',
      ).toBe(false);
    }
  });

  it('CONTROL -- node present, a valid .js is clean and exits 0', () => {
    const { parsed, status } = runGuardJson(fixtures({ 'valid.js': VALID_JS }));
    expectConsidered(parsed, 1);
    expect(parsed.issues).toEqual([]);
    expect(parsed.ok).toBe(true);
    expect(status).toBe(0);
  });

  it('CONTROL -- node present, a broken .js is CORRUPTION and exits 1', () => {
    const { parsed, status } = runGuardJson(fixtures({ 'broken.js': BROKEN_JS }));
    expectConsidered(parsed, 1);
    expect(codes(parsed)).toEqual(['JS']);
    expect(parsed.issues[0].could_not_run).toBe(false);
    expect(status).toBe(1);
  });

  itNodeless('with node off PATH it reports JS-RUN and exits 2, never that the file is clean', () => {
    const { parsed, status } = runGuardJson(fixtures({ 'valid.js': VALID_JS }), { env: noNode() });
    expectConsidered(parsed, 1);
    expect(codes(parsed)).toEqual(['JS-RUN']);
    expect(parsed.ok).toBe(false);
    expect(parsed.issues[0].could_not_run).toBe(true);
    expect(parsed.issues[0].reason).toContain('FileNotFoundError');
    // 2, not 1: "I could not check this" and "this is corrupt" are different
    // facts and only one of them is about the tree.
    expect(status).toBe(2);
  });

  itNodeless('says COULD NOT CHECK about a file that is genuinely broken -- never that it is clean', () => {
    // The sharpest form of the defect. Before the fix this exact input printed
    // "ok (1 files checked, 0 issues)" and exited 0: a corrupt file, waved
    // through, by a guard that had parsed nothing.
    const { parsed, status } = runGuardJson(fixtures({ 'broken.js': BROKEN_JS }), { env: noNode() });
    expectConsidered(parsed, 1);
    expect(parsed.ok, 'a file the guard never parsed was reported as ok').toBe(false);
    expect(codes(parsed)).toEqual(['JS-RUN']);
    // NOT reported as corruption either: the guard has no evidence of that. It
    // knows only that it could not look.
    expect(codes(parsed)).not.toContain('JS');
    expect(status).toBe(2);
  });

  itNodeless('lets a real corruption outrank a could-not-run: a mixed run exits 1, not 2', () => {
    const rels = fixtures({ 'broken.json': BROKEN_JSON, 'valid.js': VALID_JS });
    const { parsed, status } = runGuardJson(rels, { env: noNode() });
    expectConsidered(parsed, 2);
    expect(codes(parsed)).toEqual(['JS-RUN', 'JSON']);
    // Both facts are reported; the headline code is the one about the tree.
    expect(status).toBe(1);
    expect(parsed.exit).toBe(1);
  });

  itNodeless('keeps a could-not-run OUT of repair-corrupt.sh reach, by carrying no path', () => {
    // bin/repair-corrupt.sh hands every path this guard reports to
    // restore_from_head, which overwrites the working file with HEAD's copy. An
    // absent or hung node says nothing about the file, so a JS-RUN naming one
    // would turn a ten-second hiccup into the silent destruction of uncommitted
    // edits. The empty path is what makes that script skip it; the file is named
    // in the reason instead, so nothing is lost from the report.
    const { parsed } = runGuardJson(fixtures({ 'valid.js': VALID_JS }), { env: noNode() });
    expect(parsed.issues[0].path).toBe('');
    expect(parsed.issues[0].reason).toContain('valid.js');
  });

  itNodeless('publishes the split in --json: a per-issue flag, and the verdict', () => {
    const rels = fixtures({ 'broken.json': BROKEN_JSON, 'valid.js': VALID_JS });
    const { parsed, status } = runGuardJson(rels, { env: noNode() });
    // The flag is what every consumer filters on; without it none can separate
    // "corrupt" from "unchecked", and the consumer in the write path acts
    // DESTRUCTIVELY on the first.
    const byCode = Object.fromEntries(parsed.issues.map((i) => [i.code, i.could_not_run]));
    expect(byCode).toEqual({ 'JS-RUN': true, JSON: false });
    // `exit` is the one thing a consumer cannot re-derive without
    // re-implementing the corruption-outranks-could-not-run precedence.
    expect(parsed.exit, 'the reported exit disagreed with the process exit').toBe(status);
  });

  itNodeless('groups a fleet of could-not-runs into ONE line per code, with an exact count', () => {
    const rels = fixtures({ 'a.js': VALID_JS, 'b.js': VALID_JS, 'c.js': VALID_JS });
    const { parsed } = runGuardJson(rels, { env: noNode() });
    expect(cnr(parsed)).toHaveLength(3);
    const text = runGuardText(rels, { env: noNode() });
    const lines = text.stderr.split(/\r?\n/).filter((l) => l.includes('[JS-RUN/'));
    expect(lines, 'one line per file buries the single fact the operator needs').toHaveLength(1);
    expect(lines[0]).toContain('3 check(s) did not run');
    // Keyed on (code, exception class), not the code alone: an absent node
    // and a hung one need different remedies, and collapsing them hides the
    // rarer of the two behind the commoner one's count.
    expect(lines[0]).toContain('[JS-RUN/FileNotFoundError]');
  });
});

describe('integrity guard: the TS sibling, whose exit code this change moved', () => {
  // check_ts_batch already returned a TS-RUN Issue for these exceptions -- it is
  // the sibling check_js_node was brought into line with. But TS-RUN used to
  // exit 1, and routing could-not-run to 2 moved it. That is a behaviour change
  // to shipped code that NOTHING covered.
  it('CONTROL -- node present, a valid .tsx is clean and exits 0', () => {
    const { parsed, status } = runGuardJson(fixtures({ 'valid.tsx': VALID_TSX }));
    expectConsidered(parsed, 1);
    expect(parsed.issues).toEqual([]);
    expect(status).toBe(0);
  });

  it('CONTROL -- node present, a broken .tsx is CORRUPTION and exits 1', () => {
    const { parsed, status } = runGuardJson(fixtures({ 'broken.tsx': BROKEN_TSX }));
    // The TypeScript compiler names its own diagnostics (TS1005, TS1138, ...),
    // so assert the SHAPE rather than pinning a code list a compiler upgrade may
    // legitimately renumber.
    expect(parsed.issues.length).toBeGreaterThan(0);
    expect(codes(parsed)).not.toContain('TS-RUN');
    expect(cnr(parsed)).toEqual([]);
    expect(status).toBe(1);
  });

  itNodeless('with node off PATH it reports TS-RUN and exits 2, carrying no path', () => {
    const { parsed, status } = runGuardJson(fixtures({ 'valid.tsx': VALID_TSX }), { env: noNode() });
    expectConsidered(parsed, 1);
    expect(codes(parsed)).toEqual(['TS-RUN']);
    expect(parsed.ok).toBe(false);
    expect(parsed.issues[0].could_not_run).toBe(true);
    expect(parsed.issues[0].path, 'a could-not-run must carry no path').toBe('');
    expect(status).toBe(2);
  });

  it('reports an unresolvable typescript as could-not-run, not as an empty verdict', () => {
    // The helper used to print [] and exit 0 when the typescript module would
    // not resolve -- the no-issue return, one layer below the guard, so the
    // guard could not tell "nothing wrong" from "nothing parsed".
    //
    // A temp repo has no node_modules, which is what makes this drivable end to
    // end. The helper is asserted DIRECTLY first: if typescript ever becomes
    // resolvable from the system temp directory, this names that rather than
    // leaving the guard assertion below to fail for an unexplained reason.
    const root = tempRepo({ 'src/a.tsx': VALID_TSX });
    const direct = runProcess('node', [join(root, 'scripts', '_integrity_ts_parse.cjs')], {
      cwd: root,
      input: '["src/a.tsx"]',
    });
    expect(direct.status, 'typescript resolved from the temp repo -- precondition gone').toBe(3);
    expect(direct.stdout, 'an empty verdict is what the guard used to read as clean').toBe('');

    const { parsed, status } = runGuardJson(['src/a.tsx'], { cwd: root });
    expect(codes(parsed)).toEqual(['TS-RUN']);
    expect(parsed.issues[0].could_not_run).toBe(true);
    expect(status).toBe(2);
  });

  it('reports a MISSING helper as could-not-run, not as an empty verdict', () => {
    // The helper is resolved from the repo root, so a temp repo without it is
    // the honest way to drive this -- deleting the real one would red every
    // other spec running in parallel.
    const root = tempRepo({ 'src/a.tsx': VALID_TSX });
    rmSync(join(root, 'scripts', '_integrity_ts_parse.cjs'));
    const { parsed, status } = runGuardJson(['src/a.tsx'], { cwd: root });
    expect(codes(parsed)).toEqual(['TS-RUN']);
    expect(parsed.issues[0].could_not_run).toBe(true);
    expect(parsed.issues[0].reason).toContain('NOT checked');
    expect(status).toBe(2);
  });

  it('maps a helper IO issue to a PATHLESS could-not-run, not a corruption finding', () => {
    // The helper reports its own unreadable-file failures as code 'IO' WITH a
    // path (scripts/_integrity_ts_parse.cjs:60, on a real readFileSync failure
    // -- the transient EBUSY/EACCES this mount produces). Left untouched, that
    // path reaches bin/repair-corrupt.sh's restore_from_head and a momentary
    // read failure overwrites the working file with HEAD's copy. It is the
    // identical hazard to check_file_basic's IO arm, on the half of the corpus
    // that arm never sees.
    //
    // Found by MUTATION, not by reading: deleting the remap left all 47 cases
    // green. Driven with a STUB helper because forcing a real EBUSY inside the
    // TS phase is not portable, and the SHAPE is what the guard must survive.
    const root = tempRepo({ 'src/a.tsx': VALID_TSX });
    writeFileSync(
      join(root, 'scripts', '_integrity_ts_parse.cjs'),
      'let raw = "";\n' +
        'process.stdin.on("data", (d) => { raw += d; });\n' +
        'process.stdin.on("end", () => {\n' +
        '  process.stdout.write(JSON.stringify([{ path: "src/a.tsx", line: 0,\n' +
        '    code: "IO", message: "unreadable: EBUSY: resource busy" }]));\n' +
        '});\n',
    );
    const { parsed, status } = runGuardJson(['src/a.tsx'], { cwd: root });
    expect(codes(parsed)).toEqual(['IO']);
    expect(parsed.issues[0].could_not_run, 'an unread file was called corruption').toBe(true);
    expect(parsed.issues[0].path, 'a could-not-run must carry no path').toBe('');
    expect(parsed.issues[0].kind).toBe('HelperIO');
    expect(parsed.issues[0].reason, 'the file must still be named somewhere').toContain('src/a.tsx');
    expect(status).toBe(2);
  });

  it('CONTROL -- a helper TS diagnostic still lands as corruption, WITH its path', () => {
    // Without this, the remap above would pass against a guard that had begun
    // stripping the path off EVERY helper issue, destroying the corruption
    // report the whole apparatus exists to produce.
    const root = tempRepo({ 'src/a.tsx': VALID_TSX });
    writeFileSync(
      join(root, 'scripts', '_integrity_ts_parse.cjs'),
      'let raw = "";\n' +
        'process.stdin.on("data", (d) => { raw += d; });\n' +
        'process.stdin.on("end", () => {\n' +
        '  process.stdout.write(JSON.stringify([{ path: "src/a.tsx", line: 7,\n' +
        '    code: "TS1005", message: "expected" }]));\n' +
        '});\n',
    );
    const { parsed, status } = runGuardJson(['src/a.tsx'], { cwd: root });
    expect(codes(parsed)).toEqual(['TS1005']);
    expect(parsed.issues[0].could_not_run).toBe(false);
    expect(parsed.issues[0].path).toBe('src/a.tsx');
    expect(status).toBe(1);
  });

  it('the helper refuses BAD INPUT with exit 3 and no stdout, never an empty verdict', () => {
    // exit 0 with no stdout makes the guard read `[]` and call the phase clean
    // -- the same no-issue return the typescript branch carried. Asserted
    // directly on the real helper: the guard always sends json.dumps(files), so
    // there is no route to this arm through it, and only a direct assertion
    // holds the contract.
    const direct = runProcess('node', [join(REPO_ROOT, 'scripts', '_integrity_ts_parse.cjs')], {
      input: 'not json at all',
    });
    expect(direct.status, 'a bad payload was accepted as an empty verdict').toBe(3);
    expect(direct.stdout).toBe('');
  });
});

describe('integrity guard: the self-seal', () => {
  // The seal is the reason this script can be trusted to report on the tree it
  // lives in. With no pin it did not run at all, and the guard returned 0 --
  // promising a seal that never happened. Same unknown-recorded-as-a-pass as
  // every parser site, one layer up.
  it('CONTROL -- with the pin present the seal passes and the run proceeds', () => {
    const root = tempRepo({ 'app.js': VALID_JS });
    const run = runProcess(PYTHON, [join(root, 'scripts', 'integrity-guard.py'), '--files', 'app.js'], {
      cwd: root,
    });
    expect(run.stdout).toContain('0 issues');
    expect(run.status).toBe(0);
  });

  it('a MISSING pin is could-not-run, not a pass', () => {
    const root = tempRepo({ 'app.js': VALID_JS });
    rmSync(join(root, '.integrity-guard.sha256'));
    const { parsed, status } = runGuardJson(['app.js'], { cwd: root, selfCheck: true });
    expect(codes(parsed)).toEqual(['SEAL-RUN']);
    expect(parsed.issues[0].could_not_run).toBe(true);
    expect(status).toBe(2);
  });

  it('an unrun seal never MASKS a corruption -- the tree still wins', () => {
    // The first draft returned 2 from self_check and aborted before a single
    // file was read, so a tree with genuinely corrupt files reported "could not
    // check" and named NONE of them. That is the exact inverse of the precedence
    // main() and bin/check-integrity.sh both state, and it silently defeated the
    // wrapper, which prints "no pin yet" and deliberately carries on.
    const root = tempRepo({ 'data.json': BROKEN_JSON });
    rmSync(join(root, '.integrity-guard.sha256'));
    const { parsed, status } = runGuardJson(['data.json'], { cwd: root, selfCheck: true });
    expect(codes(parsed)).toEqual(['JSON', 'SEAL-RUN']);
    expect(status, 'a corruption was masked by an unrun self-seal').toBe(1);
  });
});

describe('integrity guard: the guard itself raising', () => {
  it('reports an unhandled exception as COULD NOT CHECK, not as corruption', () => {
    // Python exits 1 on an unhandled exception, and 1 is the code this guard's
    // table reserves for CORRUPTION DETECTED -- so a guard that crashed used to
    // deliver a verdict about the tree, and run-lint-chain's classify(1) printed
    // FAIL rather than BROKEN.
    //
    // The raise is INJECTED into a temp-repo copy, which proves the handler. What
    // proves the ROUTE is separate and lives in the seam harness: check_js_node
    // deliberately lets an unlisted OSError propagate, and a `node` on PATH that
    // is not executable raises PermissionError. Neither half is sufficient alone.
    const root = tempRepo({ 'app.js': VALID_JS });
    const guardPath = join(root, 'scripts', 'integrity-guard.py');
    const src = readFileSync(guardPath, 'utf8');
    const anchor = 'def main() -> int:';
    expect(src, 'the injection anchor moved').toContain(anchor);
    writeFileSync(
      guardPath,
      src.replace(anchor, `${anchor}\n    raise RuntimeError('injected: the guard blew up')`),
    );
    const run = runProcess(PYTHON, [guardPath, '--no-self-check', '--files', 'app.js'], { cwd: root });
    expect(run.stderr, 'the traceback must survive -- this reclassifies, it does not hide').toContain(
      'injected: the guard blew up',
    );
    expect(run.stderr).toContain('COULD NOT CHECK');
    expect(run.status, 'a crashed guard reported corruption').toBe(2);
  });

  it('CONTROL -- the same copy without the injection is clean and exits 0', () => {
    // Otherwise the case above would pass against a temp repo that was broken
    // for some entirely different reason.
    const root = tempRepo({ 'app.js': VALID_JS });
    const run = runProcess(PYTHON, [join(root, 'scripts', 'integrity-guard.py'),
      '--no-self-check', '--files', 'app.js'], { cwd: root });
    expect(run.status).toBe(0);
  });
});

describe('integrity guard: the YAML phase, end to end', () => {
  // The seam harness drives check_yaml directly. These drive the ROUTE to it --
  // PARSE_AS_YAML and check_file_basic's dispatch -- which a seam case cannot
  // see: dropping .yml from PARSE_AS_YAML would leave every seam assertion green
  // while the guard silently stopped looking at .github/workflows/ entirely.
  //
  // They are ALSO the environment's receipt. If PyYAML is not installed wherever
  // this suite runs, these two go red naming exactly that -- rather than leaving
  // the whole YAML phase reporting could-not-run in CI for an unexplained reason.
  it('a well-formed .yml is clean', () => {
    const { parsed, status } = runGuardJson(fixtures({ 'ok.yml': 'a: 1\nb: [2, 3]\n' }));
    expectConsidered(parsed, 1);
    expect(parsed.issues, 'is PyYAML installed? a YAML-RUN here means it is not').toEqual([]);
    expect(status).toBe(0);
  });

  it('a malformed .yml is a YAML corruption finding, naming its file', () => {
    const { parsed, status } = runGuardJson(fixtures({ 'bad.yml': 'a: [1\nb: }\n' }));
    expectConsidered(parsed, 1);
    expect(codes(parsed)).toEqual(['YAML']);
    expect(parsed.issues[0].could_not_run).toBe(false);
    expect(parsed.issues[0].path).toBe(`${CANARY_DIR}/bad.yml`);
    expect(status).toBe(1);
  });
});

describe('integrity guard: the human-readable branch', () => {
  // Driven because a --json-only battery left this branch blind: it was the
  // largest block the change added, and two mutants inverting its predicates
  // survived with zero failing cases.
  const CORRUPTION = 'CORRUPTION DETECTED';
  const COULD_NOT = 'COULD NOT CHECK';
  const REPAIR = 'repair: bin/repair-corrupt.sh';

  it('clean -- says ok on stdout, says nothing on stderr, exits 0', () => {
    const run = runGuardText(fixtures({ 'valid.js': VALID_JS }));
    expect(run.stdout).toContain('1 files checked, 0 issues');
    expect(run.stderr).toBe('');
    expect(run.status).toBe(0);
  });

  it('corrupt only -- CORRUPTION DETECTED and a repair hint, and no COULD NOT CHECK', () => {
    const run = runGuardText(fixtures({ 'broken.json': BROKEN_JSON }));
    expect(run.stderr).toContain(CORRUPTION);
    expect(run.stderr).toContain(REPAIR);
    expect(run.stderr).not.toContain(COULD_NOT);
    expect(run.status).toBe(1);
  });

  itNodeless('could-not-run only -- COULD NOT CHECK, and NEITHER a corruption headline NOR a repair hint', () => {
    const run = runGuardText(fixtures({ 'valid.js': VALID_JS }), { env: noNode() });
    expect(run.stderr).toContain(COULD_NOT);
    expect(run.stderr).toContain('Unchecked is NOT clean');
    // Printing CORRUPTION DETECTED over a message saying the parser never ran is
    // the exact conflation this change exists to remove.
    expect(run.stderr).not.toContain(CORRUPTION);
    // repair-corrupt.sh restores files. It has nothing to offer a run that never
    // ran, and offering it invites a restore over a healthy file.
    expect(run.stderr).not.toContain(REPAIR);
    expect(run.status).toBe(2);
  });

  itNodeless('MIXED -- both headlines, in order, with the unchecked file OUT of the corruption list', () => {
    const rels = fixtures({ 'broken.json': BROKEN_JSON, 'valid.js': VALID_JS });
    const run = runGuardText(rels, { env: noNode() });
    const at = (needle: string) => run.stderr.indexOf(needle);

    expect(at(CORRUPTION)).toBeGreaterThanOrEqual(0);
    expect(at(COULD_NOT)).toBeGreaterThanOrEqual(0);
    expect(at(CORRUPTION), 'the corruption block must lead').toBeLessThan(at(COULD_NOT));
    expect(run.stderr).toContain(REPAIR);
    expect(run.status).toBe(1);

    // The count in the headline is over CORRUPT files only. Folding the
    // could-not-run in reported a phantom file, because it carries no path.
    expect(run.stderr).toContain(`${CORRUPTION} in 1 file(s)`);

    // And the JS-RUN line sits AFTER the could-not-check headline, never in the
    // list under CORRUPTION DETECTED beside a real finding.
    expect(at('[JS-RUN/'), 'a could-not-run was listed as corruption').toBeGreaterThan(at(COULD_NOT));
  });

  itNodeless('renders a pathless issue without a leading bare colon', () => {
    // ':0: [JS-RUN] ...' defeats path:line: parsing, and already reached an
    // agent through the post-write hook.
    const run = runGuardText(fixtures({ 'valid.js': VALID_JS }), { env: noNode() });
    expect(run.stderr).not.toContain(':0: [JS-RUN');
    expect(run.stderr).toContain('[JS-RUN/');
  });
});

describe('integrity guard: every arm, at the seam', () => {
  // The end-to-end cases above reach FileNotFoundError only. The hung-node and
  // missing-PyYAML arms have no cross-platform end-to-end route, and the Issue
  // invariant is reachable from no --files case at all -- see the harness header.
  type Arm = { code: string; path: string; line: number; reason: string; could_not_run: boolean; kind: string };
  let arms: Record<string, Arm | null | boolean | string>;

  beforeAll(() => {
    const run = runProcess(PYTHON, [
      join(REPO_ROOT, 'tests', 'fixtures', 'integrityGuardArms.py'),
      join(REPO_ROOT, 'scripts', 'integrity-guard.py'),
    ]);
    expect(run.status, `the arm harness itself failed: ${run.stderr}`).toBe(0);
    arms = JSON.parse(run.stdout);
  });

  it.each(['FileNotFoundError', 'TimeoutExpired'])(
    'check_js_node: %s returns a could-not-run JS-RUN, never None',
    (arm) => {
      const issue = arms[`js_${arm}`] as Arm | null;
      // null is the fail-open itself. Name it, so a reader of a failure knows
      // which shape came back.
      expect(issue, `${arm} was swallowed -- check_js_node returned None`).not.toBeNull();
      expect(issue!.code).toBe('JS-RUN');
      expect(issue!.could_not_run).toBe(true);
      expect(issue!.path, 'a could-not-run must carry no path').toBe('');
      expect(issue!.reason).toContain(arm);
    },
  );

  it('keeps the two JS arms distinguishable in the message', () => {
    // An absent node and a hung node need different remedies. A shared message
    // would satisfy every assertion above while leaving an operator unable to
    // tell which happened -- and would let a canary pin one arm believing it had
    // pinned both.
    const absent = arms.js_FileNotFoundError as Arm;
    const hung = arms.js_TimeoutExpired as Arm;
    expect(absent.reason).not.toEqual(hung.reason);
    expect(absent.reason).not.toContain('TimeoutExpired');
    expect(hung.reason).not.toContain('FileNotFoundError');
  });

  it.each(['RuntimeError', 'PermissionError'])(
    'check_js_node still lets an UNLISTED %s propagate',
    (exc) => {
      // The cheap wrong fixes are a bare `except Exception` and -- more
      // temptingly, because the two listed arms are both OS-level -- an
      // `except OSError`, which swallows PermissionError and NotADirectoryError
      // into a JS-RUN. Nothing else in this file can tell those apart.
      expect(arms[`js_propagates_${exc}`], `an unlisted ${exc} was swallowed`).toBe(exc);
    },
  );

  it('check_yaml: a missing PyYAML is a YAML-RUN, not a pass', () => {
    // Without this, every tracked .yml/.yaml -- all of .github/workflows/, the
    // files that decide whether anything else is checked at all -- reported
    // CLEAN having been parsed by nothing.
    const issue = arms.yaml_ImportError as Arm | null;
    expect(issue, 'a missing PyYAML was swallowed -- check_yaml returned None').not.toBeNull();
    expect(issue!.code).toBe('YAML-RUN');
    expect(issue!.could_not_run).toBe(true);
    expect(issue!.path).toBe('');
    expect(issue!.reason).toContain('probe.yml');
  });

  it('CONTROL -- with PyYAML importable, check_yaml still passes and still fails', () => {
    // A red case with no green control could be satisfied by a check_yaml that
    // had stopped working altogether.
    expect(arms.yaml_valid, 'a well-formed document was reported as an issue').toBeNull();
    const broken = arms.yaml_broken as Arm | null;
    expect(broken, 'a malformed document was reported as clean').not.toBeNull();
    expect(broken!.code).toBe('YAML');
    expect(broken!.could_not_run).toBe(false);
    expect(broken!.path, 'a corruption finding must name its file').toBe('probe.yml');
  });

  it('an UNREADABLE file is could-not-run, and carries no path', () => {
    // The arm most likely to fire on this mount, and the one that stayed a
    // corruption finding with a path attached through the first draft. A
    // transient EBUSY/EACCES read therefore landed in bin/repair-corrupt.sh's
    // restore list and overwrote the working file with HEAD's copy, taking any
    // uncommitted edit with it -- the exact hazard the Issue invariant exists to
    // close, left open where it was most reachable.
    const issue = arms.io_unreadable as Arm | null;
    expect(issue, 'an unreadable file produced no issue at all').not.toBeNull();
    expect(issue!.code).toBe('IO');
    expect(issue!.could_not_run, 'an unreadable file was called corruption').toBe(true);
    expect(issue!.path, 'a could-not-run must carry no path').toBe('');
    expect(issue!.reason, 'the file must still be named somewhere').toContain('integrity-guard.py');
  });

  it('carries the exception class as a FIELD, so grouping can keep arms apart', () => {
    // Grouping on the code alone folded 158 absent-node failures together with 2
    // hung-node ones: one line, a count covering both, an example naming only
    // the first. The kind is what the summariser keys on.
    expect((arms.js_FileNotFoundError as Arm).kind).toBe('FileNotFoundError');
    expect((arms.js_TimeoutExpired as Arm).kind).toBe('TimeoutExpired');
    expect((arms.io_unreadable as Arm).kind).toBe('PermissionError');
    // A corruption finding has no kind -- there is no failed call to name.
    expect((arms.yaml_broken as Arm).kind).toBe('');
  });

  it('Issue REFUSES to carry a path on a could-not-run', () => {
    // The invariant is what closes the destructive path by construction rather
    // than by a comment asking the next author to remember. No --files case can
    // reach a constructor call that no site makes.
    expect(arms.issue_rejects_pathful_could_not_run).toBe(true);
  });

  it('CONTROL -- the two LEGAL Issue shapes still build', () => {
    // Otherwise the refusal above would pass against an Issue that refuses
    // everything, and the guard would report nothing at all.
    const pathless = arms.issue_allows_pathless_could_not_run as Arm;
    expect(pathless.could_not_run).toBe(true);
    expect(pathless.path).toBe('');
    const corruption = arms.issue_allows_pathful_corruption as Arm;
    expect(corruption.could_not_run).toBe(false);
    expect(corruption.path).toBe('some/file.js');
  });

  it('renders a pathless issue without a leading bare colon', () => {
    // Asserted at the seam, not end to end, and that is the point: main() no
    // longer reaches this branch -- could-not-run issues print through
    // summarise_could_not_run, which formats them itself. Deleting the branch
    // left every end-to-end case in this file GREEN, so only a direct
    // assertion can hold the renderer to its contract. ':0: [JS-RUN] ...'
    // defeats path:line: parsing and already reached an agent through the
    // post-write hook.
    expect(arms.str_pathless).toBe('[JS-RUN] reason');
  });

  it('names EVERY unchecked file on a per-file arm, and still folds a systemic one', () => {
    // Both halves in one case, because either alone is satisfiable by the wrong
    // design: fold everything and the IO files lose their names; fold nothing
    // and an absent node buries the screen in 160 restatements of one fact.
    const lines = arms.summary_mixed as unknown as string[];

    // JS-RUN is SYSTEMIC -- one cause, one line, an exact count.
    const js = lines.filter((l) => l.includes('[JS-RUN/'));
    expect(js).toHaveLength(1);
    expect(js[0]).toContain('2 check(s) did not run');
    expect(lines.join('\n'), 'a systemic cause was listed per file').not.toContain('src/yankee.js');

    // IO is PER FILE -- the operator must be able to learn WHICH files went
    // unverified, which is the only thing that makes "unchecked is NOT clean"
    // actionable.
    const io = lines.join('\n');
    expect(io).toContain('src/alpha.tsx');
    expect(io, 'an unchecked file was counted but never named').toContain('src/bravo.tsx');
    expect(io, 'an unchecked file was counted but never named').toContain('src/charlie.tsx');
    expect(lines.filter((l) => l.includes('[IO/'))[0]).toContain('3 check(s) did not run');
  });

  it('CONTROL -- a pathful issue still renders path:line:', () => {
    // Without this, deleting the path branch entirely would satisfy the case
    // above while destroying the format every other consumer reads.
    expect(arms.str_pathful).toBe('some/file.js:3: [JS] reason');
  });
});

// >2 KB: the post-write hook skips anything smaller, because the mount's
// corruption class only bites above that.
const PAD = 'x'.repeat(2500);
const BIG_VALID_JS = `export const a = "${PAD}";\n`;
const BIG_VALID_JSON = `{ "a": "${PAD}" }\n`;
const BIG_BROKEN_JSON = `{ "a": "${PAD}",\n`;

function runHook(root: string, rel: string, env?: NodeJS.ProcessEnv): Run {
  const payload = JSON.stringify({
    tool_name: 'Write',
    tool_input: { file_path: join(root, rel) },
  });
  return runProcess(BASH, [join(root, '.claude', 'hooks', 'post-write-check.sh')], {
    cwd: root,
    env,
    input: payload,
  });
}

describe('consumer: .claude/hooks/post-write-check.sh', () => {
  // This hook's response to corruption is DESTRUCTIVE -- it instructs the agent
  // to reconstruct the whole file body from memory and overwrite the original.
  // Firing it on a could-not-run means overwriting a HEALTHY file, which is
  // strictly worse than the fail-open it replaced. Driven in a temp repo: the
  // real one has a live hook of the same name.
  const RECIPE = 'safe-write.py';
  const HEADLINE = 'POST-WRITE CORRUPTION DETECTED';

  it('CONTROL -- a healthy large file is silent and exits 0', () => {
    const root = tempRepo({ 'app.js': BIG_VALID_JS, 'data.json': BIG_VALID_JSON });
    const run = runHook(root, 'app.js');
    expect(run.stderr).toBe('');
    expect(run.status).toBe(0);
  });

  it('CONTROL -- a corrupt large file still gets the headline, the recipe and exit 2', () => {
    const root = tempRepo({ 'data.json': BIG_BROKEN_JSON });
    const run = runHook(root, 'data.json');
    expect(run.stderr).toContain(HEADLINE);
    expect(run.stderr).toContain(RECIPE);
    expect(run.status).toBe(2);
  });

  itNodeless('a could-not-run gets an ADVISORY, never the destructive recipe, and never exit 2', () => {
    const root = tempRepo({ 'app.js': BIG_VALID_JS });
    const run = runHook(root, 'app.js', noNode());
    expect(run.stderr).toContain('COULD NOT RUN');
    expect(run.stderr, 'a healthy file was reported as corrupt').not.toContain(HEADLINE);
    expect(run.stderr, 'a healthy file was offered a full-body overwrite').not.toContain(RECIPE);
    // exit 2 surfaces as an error in the agent's tool result. Nothing here is
    // evidence about the file, so nothing here should block.
    expect(run.status).toBe(0);
  });

  it('a guard that looked at NOTHING is reported, not read as clean', () => {
    // The guard silently drops any --files entry that does not resolve inside
    // the repo root, then reports considered:0, issues:[], exit:0 -- a perfect
    // clean bill of health for a file it never opened. The hook read only
    // `issues`, so both counts were 0 and it exited 0 in silence: a fail-open
    // sitting inside the consumer this change rewrote to remove fail-opens.
    // Reachable whenever REL_PATH stripping does not match (a symlinked or
    // realpath-differing repo root, a doubled slash).
    //
    // Driven with a STUB guard rather than by contriving a path mismatch,
    // because the shape is what the hook must survive and the shape is exactly
    // what the real guard emits in that case.
    const root = tempRepo({ 'app.js': BIG_VALID_JS });
    writeFileSync(
      join(root, 'scripts', 'integrity-guard.py'),
      'import json\nprint(json.dumps({"considered": 0, "issues": [], "exit": 0, "ok": True}))\n',
    );
    const run = runHook(root, 'app.js');
    expect(run.stderr, 'a file the guard never opened was passed in silence').toContain('COULD NOT RUN');
    expect(run.stderr).not.toContain(HEADLINE);
    expect(run.status).toBe(0);
  });

  it('CONTROL -- a stub reporting one considered file and no issues stays silent', () => {
    // Without this, the case above would pass against a hook that had become
    // noisy for every write, which would be its own defect.
    const root = tempRepo({ 'app.js': BIG_VALID_JS });
    writeFileSync(
      join(root, 'scripts', 'integrity-guard.py'),
      'import json\nprint(json.dumps({"considered": 1, "issues": [], "exit": 0, "ok": True}))\n',
    );
    const run = runHook(root, 'app.js');
    expect(run.stderr).toBe('');
    expect(run.status).toBe(0);
  });

  it('a guard that cannot SPEAK is reported, not read as clean', () => {
    // `[ -z "$OUTPUT" ] && OUTPUT='{"issues": []}'` was a second fail-open: a
    // crashed guard produced no output and the hook called the file fine.
    const root = tempRepo({ 'app.js': BIG_VALID_JS });
    writeFileSync(join(root, 'scripts', 'integrity-guard.py'), 'def (this is not python\n');
    const run = runHook(root, 'app.js');
    expect(run.stderr).toContain('COULD NOT RUN');
    expect(run.stderr).not.toContain(HEADLINE);
    // And it must say WHICH tool failed. The hook sent the guard's stderr to
    // /dev/null while advising "fix the tooling", so the SyntaxError naming the
    // actual cause was discarded -- the same defect this change fixed in
    // bin/repair-corrupt.sh, in the consumer an AGENT reads.
    expect(run.stderr, 'the cause was discarded and only "fix the tooling" survived').toContain(
      'SyntaxError',
    );
    expect(run.status).toBe(0);
  });

  it('a guard that CONTRADICTS itself -- a failing exit beside a clean verdict -- is reported', () => {
    // The advisory branch has three clauses and this is the only case that
    // reaches the GUARD_STATUS one alone: a verdict that parses, names one
    // considered file and lists no issues, beside a non-zero exit.
    //
    // Against the REAL guard the clause is redundant -- exit_code is
    // `1 if corrupt else (2 if could_not_run else 0)`, so exit 2 always implies
    // a could-not-run issue, and the exit-3 paths return before any JSON is
    // printed. That made the mutation removing it SURVIVE, and the honest
    // reading is that it defends against a guard that MISREPORTS rather than
    // one that works. Pinning it here turns an argued equivalence into a
    // contract: the hook must never trust a clean verdict from a run that
    // failed, whoever produced it.
    const root = tempRepo({ 'app.js': BIG_VALID_JS });
    writeFileSync(
      join(root, 'scripts', 'integrity-guard.py'),
      'import json, sys\n'
        + 'print(json.dumps({"considered": 1, "issues": [], "exit": 0, "ok": True}))\n'
        + 'sys.exit(2)\n',
    );
    const run = runHook(root, 'app.js');
    expect(run.stderr, 'a clean verdict from a FAILED run was believed').toContain('COULD NOT RUN');
    expect(run.stderr).not.toContain(HEADLINE);
    expect(run.stderr).not.toContain(RECIPE);
    expect(run.status).toBe(0);
  });

  it('a guard whose JSON has the wrong SHAPE is reported, not read as clean', () => {
    // The hook has TWO unparseable defaults and only the INNER one was covered.
    // `issues` as a string -- or as a list of non-dicts -- parses as JSON, so
    // the inner try SUCCEEDS; then `i.get` raises OUTSIDE it, python exits 1
    // with empty stdout, and the OUTER `|| COUNTS=''` default is the only thing
    // between that shape and a silent pass in the DESTRUCTIVE write-path
    // consumer.
    //
    // Found by MUTATION: flipping that outer default to '0 0 1' left all 47
    // cases green, because every existing case reaches the inner one instead.
    // Reachability was then proven by execution rather than argued.
    const root = tempRepo({ 'app.js': BIG_VALID_JS });
    writeFileSync(
      join(root, 'scripts', 'integrity-guard.py'),
      'import json\nprint(json.dumps({"considered": 1, "issues": "oops", "exit": 0, "ok": True}))\n',
    );
    const run = runHook(root, 'app.js');
    expect(run.stderr, 'a malformed verdict was read as a clean bill of health').toContain(
      'COULD NOT RUN',
    );
    expect(run.stderr).not.toContain(HEADLINE);
    expect(run.stderr).not.toContain(RECIPE);
    expect(run.status).toBe(0);
  });
});

describe('consumer: bin/repair-corrupt.sh', () => {
  // This script RESTORES FILES from HEAD. Every case runs in a temp repo, never
  // the working tree -- a canary that can destroy the work it is run beside is
  // not a canary.
  function runRepair(root: string, env?: NodeJS.ProcessEnv): Run {
    return runProcess(BASH, [join(root, 'bin', 'repair-corrupt.sh')], { cwd: root, env });
  }

  it('CONTROL -- a clean tree is nothing to do, and exits 0', () => {
    const root = tempRepo({ 'app.js': VALID_JS, 'data.json': BIG_VALID_JSON });
    const run = runRepair(root);
    expect(run.stdout).toContain('no corruption detected. nothing to do.');
    expect(run.status).toBe(0);
  });

  itNodeless('a guard that COULD NOT CHECK is not reported as nothing to do', () => {
    // Was an unconditional "nothing to do" + exit 0 whenever the corrupt list
    // came back empty -- including when the guard had exited 2 having parsed
    // nothing. That is the same unknown-recorded-as-clean, one layer out.
    const root = tempRepo({ 'app.js': VALID_JS });
    const before = readFileSync(join(root, 'app.js'), 'utf8');
    const run = runRepair(root, noNode());
    expect(run.stdout).not.toContain('nothing to do');
    expect(run.stderr).toContain('COULD NOT CHECK');
    expect(run.stderr).toContain('nothing here says the tree is clean');
    // CONTROL for the wrapper-stderr case below: the SAME could-not-check
    // branch, reached with a HEALTHY helper, must not print a TS-helper
    // remedy. Without it that case would pass against a script printing the
    // remedy unconditionally.
    expect(run.stderr).not.toContain('git checkout HEAD -- scripts/_integrity_ts_parse.cjs');
    expect(run.status).toBe(2);
    expect(readFileSync(join(root, 'app.js'), 'utf8'), 'a could-not-run triggered a write').toBe(before);
  });

  itNodeless('restores the corrupt file and leaves the UNCHECKED one alone', () => {
    // Both sides of the safety property in one run. The producer guarantees a
    // could-not-run carries no path (Issue.__init__); this asserts the consumer
    // acts on that -- the uncommitted edit to app.js is exactly what a restore
    // from HEAD would silently destroy.
    const root = tempRepo({ 'data.json': BIG_VALID_JSON, 'app.js': VALID_JS });
    const EDIT = `${VALID_JS}export const b = 2;\n`;
    writeFileSync(join(root, 'app.js'), EDIT);
    // A strict prefix of HEAD: pure truncation, the shape repair-corrupt knows
    // how to restore.
    writeFileSync(join(root, 'data.json'), BIG_VALID_JSON.slice(0, 1200));

    const run = runRepair(root, noNode());
    expect(run.stdout).toContain('[restored] data.json');
    // Line endings are normalised out of the comparison: restore_from_head pipes
    // HEAD through safe-write.py, which applies CRLF to source extensions by
    // design. That is repair-corrupt's own long-standing behaviour and nothing
    // this change touches -- asserting it byte-for-byte would pin an unrelated
    // decision into a spec about could-not-run.
    const restored = readFileSync(join(root, 'data.json'), 'utf8').replace(/\r\n/g, '\n');
    expect(restored).toBe(BIG_VALID_JSON);
    expect(
      readFileSync(join(root, 'app.js'), 'utf8'),
      'an uncommitted edit was destroyed by a could-not-run',
    ).toBe(EDIT);
    // The confirming re-run still cannot vouch for the tree, and says so.
    expect(run.status).toBe(2);
  });

  it('surfaces the WRAPPER stderr, which is where the actionable remedy lives', () => {
    // bin/check-integrity.sh exits 2 for a mount-truncated
    // scripts/_integrity_ts_parse.cjs and prints the exact `git checkout` that
    // repairs it. That stderr used to go to /dev/null, leaving this script
    // telling the operator to "fix the tooling" about a tracked file it could
    // have restored for them.
    //
    // Found by MUTATION: deleting the passthrough left all 47 cases green, so
    // the round-1 fix's entire stated purpose was unasserted. Its control is
    // the not.toContain in the case above -- same branch, healthy helper.
    const root = tempRepo({ 'app.js': VALID_JS });
    writeFileSync(join(root, 'scripts', '_integrity_ts_parse.cjs'), 'function ( {\n');
    const run = runRepair(root);
    expect(run.stderr).toContain('COULD NOT CHECK');
    expect(
      run.stderr,
      'the wrapper named the repair and this script swallowed it',
    ).toContain('git checkout HEAD -- scripts/_integrity_ts_parse.cjs');
    expect(run.status).toBe(2);
  });
});

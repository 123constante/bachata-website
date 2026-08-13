/*
 * NO SHEBANG, deliberately. tests/entryPoint.test.ts imports selfTest from
 * this file, and a `#!/usr/bin/env node` first line makes a module
 * unparseable when vitest inlines it -- 'SyntaxError: Invalid or unexpected
 * token' out of node:vm, which points at the importing spec rather than at
 * this line. check-rpc-typing.mjs records the same measurement, and all four
 * other test-imported scripts here are shebang-free for the same reason.
 * It is always invoked as `node scripts/...`, so nothing needed it.
 */
/**
 * Prove that every converted CLI still RUNS when invoked through a junction or
 * symlink -- and still does NOT run when merely imported.
 *
 * WHY THIS EXISTS. `import.meta.url === pathToFileURL(process.argv[1]).href`
 * fails open: node realpaths import.meta.url and leaves argv[1] as typed, so a
 * junction/symlink/mapped-drive spelling makes the two disagree, the dispatch
 * decides "imported", and the process exits 0 having run NOTHING. Measured
 * 2026-08-12: check-script-conventions.mjs printed 0 bytes and exited 0 through
 * a junction, including under --self-test. A guard's own canary cannot see this
 * -- every canary case calls main() directly, and the dispatch is the one line
 * no case drives. So the proof has to be a real invocation, from outside.
 *
 * HOW IT OBSERVES, and why that is not "did it print something". The first
 * version of this harness spawned each target with an argument chosen to make
 * it talk -- an unknown flag here, `--json` there, `--manual` for the stamp
 * writer, an fs.readFileSync spy for a hook that prints nothing at all -- and
 * scored "any byte on stdout or stderr" as proof the dispatch fired. A review
 * took that apart, correctly:
 *
 *   - it was WRONG IN BOTH DIRECTIONS. A module that threw during import
 *     scored as "the CLI ran", and isEntryPoint's own warning on stderr would
 *     have scored a PASS for a run where it returned FALSE.
 *   - `--probe-unknown-flag` is only a probe where the target rejects one.
 *     pre-ship.mjs has no unknown-flag arm, so the probe ran the REAL ship
 *     gate -- twice per sweep -- and was stopped only by SIGKILL racing an
 *     execSync spawning npm.
 *   - check-wallclock-brand.mjs prints only AFTER a whole-program tsc compile,
 *     so "killed on its first byte" cost two full compiles: 97 s of a 119 s
 *     run, with a timeout landing as a FAIL-OPEN accusation.
 *
 * So the predicate reports its own verdict instead. Under ENTRY_POINT_TRACE,
 * scripts/lib/entry-point.mjs writes `[entry-point-trace] <true|false> <path>`
 * to stderr as it returns -- BEFORE the caller's main() does any work. Every
 * target is now probed identically with no arguments, no spy, no per-target
 * timeout, and the observable is the verdict itself rather than noise the
 * target happened to emit. No target's real work is executed at all.
 *
 * WHY THE CONTROL ARM IS NOT OPTIONAL. Each target is probed three times:
 * canonically, through the link, and via a plain import. If the canonical run
 * produces no marker, nothing was measured and the target is INCONCLUSIVE,
 * never PASS -- the same lesson as the unparseable mutant that read as a
 * survivor. A timeout is likewise its own verdict and never a FAIL-OPEN: the
 * first version conflated the two and would have accused a correct dispatch of
 * mispredicting because a machine was slow.
 *
 * NOT WIRED INTO CI as a whole -- the link arms need link-creation rights. But
 * `--self-test`, which drives isEntryPoint's own branches, IS in the unit gate
 * via tests/entryPoint.test.ts.
 *
 *   node scripts/prove-entry-point-dispatch.mjs              (full sweep)
 *   node scripts/prove-entry-point-dispatch.mjs --self-test  (the predicate)
 *
 * Exit: 0 every target proven, 1 a target failed (fail-open or runs-on-import),
 *       2 the harness could not run or could not measure.
 */
import { spawn, spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { isEntryPoint } from './lib/entry-point.mjs';

const REPO_ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const IS_WINDOWS = process.platform === 'win32';

/**
 * The line scripts/lib/entry-point.mjs emits under ENTRY_POINT_TRACE, and the
 * module path it names.
 *
 * MATCHING THE PATH IS NOT OPTIONAL. The first version took the first marker in
 * the stream, and this harness immediately caught the consequence on itself:
 * scripts/pre-ship.mjs imports another converted guard, so the FIRST marker in
 * its output is `false scripts/check-plan-hygiene.mjs` -- a correct verdict
 * about the wrong module. The probe killed the child on it and reported
 * pre-ship as emitting no marker of its own. A trace is only evidence about the
 * module it names.
 */
const TRACE_RE = /\[entry-point-trace\] (true|false) (.+)/g;

/**
 * The same pattern, NON-global, for parsing one line at a time.
 *
 * Not a stylistic duplicate: `.exec()` on a /g regex carries `lastIndex`
 * between calls, so reusing TRACE_RE to parse two separate strings makes the
 * second call start mid-pattern and return null. The canary below caught
 * exactly that the moment it was wired into the unit gate -- it read
 * "true,false" as "true,".
 */
const TRACE_LINE_RE = /\[entry-point-trace\] (true|false) (.+)/;

/**
 * Every module converted to isEntryPoint(). No probe arguments: the trace
 * marker is emitted by the predicate itself, so the list is just names.
 *
 * It is checked against the tree rather than trusted -- see assertTargetsCover.
 * A hand-maintained list can only ever shrink in coverage silently, and this
 * one had already drifted on its first day: it omitted THIS FILE, which
 * dispatches through isEntryPoint like everything it proves. The instrument
 * that proves the class was not proving itself.
 *
 * THERE IS NO `deferred` FACILITY ANY MORE, deliberately. The last two deferrals
 * were the twin hooks; converting them left the DEFERRED / DEFERRAL-STALE arms
 * with no input AND no canary -- selfTest() drives isEntryPoint's branches and
 * never main()'s verdict ladder, so those arms would have run for the first time
 * on the day someone trusted them. A draft of this change kept them "for the next
 * deferral"; review pointed out that an unreachable satisfied state is not a gate,
 * which is this repo's own rule, so they were deleted instead. Re-add them WITH a
 * selfTest case that drives both arms and asserts WHICH fired.
 *
 * The live writer for "this file went back to the raw compare" is R6 in
 * check-script-conventions.mjs, which runs in `npm run lint`. Known gap, stated
 * rather than papered over: an un-converted target reads here as INCONCLUSIVE
 * (exit 2, "could not measure") rather than being named as a regression, because
 * a file that does not call the predicate emits no marker to judge.
 */
const TARGETS = [
  { rel: 'scripts/_serve-build.mjs' },
  { rel: 'scripts/check-bundle-budget.mjs' },
  { rel: 'scripts/check-ci-budget.mjs' },
  { rel: 'scripts/check-image-refs-live.mjs' },
  { rel: 'scripts/check-mojibake.mjs' },
  { rel: 'scripts/check-og-images.mjs' },
  { rel: 'scripts/check-plan-hygiene.mjs' },
  { rel: 'scripts/check-pr-mergeable.mjs' },
  { rel: 'scripts/check-rpc-typing.mjs' },
  { rel: 'scripts/check-script-conventions.mjs' },
  { rel: 'scripts/check-seo.mjs' },
  { rel: 'scripts/check-wallclock-brand.mjs' },
  { rel: 'scripts/hooks/arc-checkpoint.mjs' },
  { rel: 'scripts/hooks/review-stamp.mjs' },
  { rel: 'scripts/hooks/session-lock.mjs' },
  { rel: 'scripts/pre-ship.mjs' },
  { rel: 'scripts/prove-entry-point-dispatch.mjs' },
  { rel: 'scripts/rework-share.mjs' },
  { rel: 'scripts/ship-gate.mjs' },
];

/** Generous: nothing here runs a target's real work, so this only catches hangs. */
const DEFAULT_TIMEOUT_MS = 30_000;

/** Fold case only where the filesystem does -- same rule as the predicate's. */
const normaliseForCompare = (p) => (IS_WINDOWS ? p.toLowerCase() : p);

/**
 * Kill the process TREE, not just the child.
 *
 * scripts/_serve-build.mjs re-execs itself through spawnSync to add
 * --conditions=production, so the process that would bind a port is a
 * GRANDCHILD; child.kill reaches only the direct child and Windows has no
 * process-group signal. The trace marker fires before that re-exec, so the
 * window is small -- but "small" is how the last orphaned dev server got
 * loose, and this repo has a memory note about a zombie server faking test
 * results.
 */
function killTree(child) {
  try {
    if (IS_WINDOWS) {
      spawnSync('taskkill', ['/PID', String(child.pid), '/T', '/F'], { stdio: 'ignore' });
    } else {
      process.kill(-child.pid, 'SIGKILL');
    }
  } catch {
    // Already gone, or never started. The verdict below is decided by what was
    // observed, not by whether the kill had anything left to do.
  }
  try {
    child.kill('SIGKILL');
  } catch {
    // Same.
  }
}

/**
 * Run `node <script>` with the trace enabled and report the predicate's verdict.
 *
 * `script` is ABSOLUTE. The first version took (root, relativePath) and re-joined
 * them inside, which silently produced garbage when os.tmpdir() sat on a
 * different drive from the repo: path.relative across volumes returns an
 * ABSOLUTE path, and path.join('C:\\repo', 'D:\\tmp\\x') yields
 * 'C:\\repo\\D:\\tmp\\x'. Node then failed to resolve the module, printed to
 * stderr, and -- under the old byte-counting rule -- every target reported
 * RUNS-ON-IMPORT. Passing the path through untouched removes the whole class.
 */
function probeRun(script, args, timeoutMs, expectRealPath) {
  const wanted = expectRealPath === undefined ? null : normaliseForCompare(expectRealPath);
  return new Promise((resolve) => {
    const child = spawn(process.execPath, [script, ...args], {
      cwd: REPO_ROOT,
      stdio: ['ignore', 'pipe', 'pipe'],
      detached: !IS_WINDOWS,
      env: { ...process.env, NO_COLOR: '1', ENTRY_POINT_TRACE: '1' },
    });

    let text = '';
    let marker = null;
    let settled = false;

    const finish = (outcome) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      killTree(child);
      resolve({ marker, outcome, sample: text.slice(0, 200).trim() });
    };

    const onData = (buf) => {
      text += buf.toString('utf8');
      // Re-scan the whole buffer each time: a marker can arrive split across
      // two chunks, and there may be several from imported modules before the
      // target's own.
      TRACE_RE.lastIndex = 0;
      for (const found of text.matchAll(TRACE_RE)) {
        if (wanted !== null && normaliseForCompare(found[2].trim()) !== wanted) continue;
        marker = found[1];
        finish('traced');
        return;
      }
    };
    child.stdout.on('data', onData);
    child.stderr.on('data', onData);
    // A pipe whose writer is force-killed can emit ECONNRESET; unhandled, that
    // is an uncaught exception OUTSIDE main()'s finally, which would leave the
    // junction behind -- the one artifact that must never be left lying around.
    child.stdout.on('error', () => {});
    child.stderr.on('error', () => {});
    child.on('error', (error) => {
      text += 'spawn error: ' + error.message;
      finish('spawn-error');
    });
    child.on('close', () => finish('exited'));

    const timer = setTimeout(() => finish('timeout'), timeoutMs ?? DEFAULT_TIMEOUT_MS);
  });
}

/**
 * Import the module the way a spec would.
 *
 * The importer is a real file on disk, so process.argv[1] resolves to something
 * that is NOT the target -- exactly the shape a vitest worker presents. Probing
 * with `node --eval` instead would leave argv[1] undefined and exercise a
 * different, easier branch, proving less than it appears to.
 */
function probeImport(absTarget, importerPath, timeoutMs) {
  return probeRun(importerPath, [absTarget], timeoutMs, absTarget);
}

function makeLink(target) {
  const link = path.join(
    os.tmpdir(),
    'entry-point-proof-' + process.pid + '-' + Date.now().toString(36),
  );
  fs.symlinkSync(target, link, IS_WINDOWS ? 'junction' : 'dir');
  return link;
}

/**
 * REMOVE THE LINK, NEVER ITS TARGET.
 *
 * rmdir (Windows) and unlink (POSIX) both operate on the reparse point itself.
 * The first draft justified this by claiming `fs.rmSync(link, {recursive:true})`
 * follows a junction and deletes the repository on the other side; a review
 * measured that on Node 24 and it is FALSE -- rmSync lstats first, sees a link,
 * and unlinks it. The hazard this repo actually paid for is the SHELL's
 * `rm -rf`, which does follow it. The code was right; the reason given for it
 * was not, and a wrong reason in a comment about a destructive operation is
 * worth correcting rather than leaving as folklore.
 */
function removeLink(link) {
  try {
    if (IS_WINDOWS) fs.rmdirSync(link);
    else fs.unlinkSync(link);
    return true;
  } catch (error) {
    console.error('  ! could not remove the link at ' + link + ': ' + error.message);
    console.error('    Remove it by hand with `cmd /c rmdir` (Windows) or `unlink` -- NEVER rm -rf.');
    return false;
  }
}

/**
 * Every file that dispatches through isEntryPoint must be in TARGETS.
 *
 * main() used to fail only when a LISTED target had vanished, so the list could
 * lose coverage silently: convert a file, forget to add it, and the proof stays
 * green over a smaller set. Deriving the required set from the tree makes the
 * omission a hard failure instead.
 */
function assertTargetsCover(root) {
  const listed = new Set(TARGETS.map((t) => t.rel));
  // The module that DEFINES the predicate shows the call in its usage
  // docstring; it is not a dispatch. Excluded by name rather than by trying to
  // decide comment-vs-code from a substring search -- this check is a coverage
  // backstop, and a backstop that needs a parser to be right is the wrong
  // shape. (It caught this on its first run, which is the argument for it.)
  const NOT_A_DISPATCH = new Set(['scripts/lib/entry-point.mjs']);
  const missing = [];
  const walk = (relDir) => {
    let entries;
    try {
      entries = fs.readdirSync(path.join(root, relDir), { withFileTypes: true });
    } catch (error) {
      if (error.code === 'ENOENT') return;
      throw error;
    }
    for (const entry of entries) {
      const rel = relDir + '/' + entry.name;
      if (entry.isDirectory()) {
        if (entry.name !== 'node_modules' && entry.name !== '.git') walk(rel);
      } else if (entry.name.endsWith('.mjs') && !NOT_A_DISPATCH.has(rel)) {
        const src = fs.readFileSync(path.join(root, rel), 'utf8');
        if (src.includes('isEntryPoint(import.meta.url)') && !listed.has(rel)) missing.push(rel);
      }
    }
  };
  walk('scripts');
  return missing;
}

/**
 * The predicate's OWN branches, driven directly.
 *
 * The live probes prove isEntryPoint() in situ, but only along the paths a real
 * invocation takes. These drive the rest -- including the ones that decide what
 * happens when the question cannot be answered, which is where a fail-open
 * would hide next. Offline; one case needs a link and SKIPS if it cannot make
 * one, rather than reporting a failure that is really a permissions fact.
 */
export async function selfTest() {
  const cases = [];
  const SKIP = Symbol('skip');
  const add = (name, fn, expected) => cases.push({ name, fn, expected });
  const SELF = fileURLToPath(import.meta.url);
  const SELF_URL = import.meta.url;

  add('true when argv[1] IS this module', () => isEntryPoint(SELF_URL, { argv: ['node', SELF] }), true);
  // `node scripts/foo.mjs` is how every one of these is actually invoked, so
  // argv[1] is normally RELATIVE. path.relative is computed from the same cwd
  // the predicate resolves against, so this round-trips by construction -- and
  // the expectation is the literal `true`, not another call to the function
  // under test, which would assert only that it agrees with itself.
  add(
    'true through a RELATIVE spelling of the same file -- how it is really invoked',
    () => isEntryPoint(SELF_URL, { argv: ['node', path.relative(process.cwd(), SELF)] }),
    true,
  );
  add(
    'false for a DIFFERENT real file -- the plain-import case a spec presents',
    () => isEntryPoint(SELF_URL, { argv: ['node', path.join(REPO_ROOT, 'scripts/ship-gate.mjs')] }),
    false,
  );
  // node --eval / --print / the REPL. Legitimately not a CLI invocation, and it
  // must NOT warn: this is the ordinary case, and a predicate that cries on it
  // gets muted, taking the real warning with it.
  for (const value of [undefined, '']) {
    add(
      'false and SILENT when argv[1] is ' + JSON.stringify(value),
      () => {
        let warned = 0;
        const got = isEntryPoint(SELF_URL, { argv: ['node', value], warn: () => warned++ });
        return got + '/' + warned;
      },
      'false/0',
    );
  }
  add(
    'false when argv is not an array at all',
    () => isEntryPoint(SELF_URL, { argv: null, warn: () => {} }),
    false,
  );
  add('false for an empty importMetaUrl', () => isEntryPoint('', { argv: ['node', SELF] }), false);
  add('false for a non-string importMetaUrl', () => isEntryPoint(undefined, { argv: ['node', SELF] }), false);
  // A non-file: URL cannot be an entry script. False -- but LOUD, because it is
  // a caller bug rather than an ordinary import.
  add(
    'false and LOUD for a non-file: importMetaUrl',
    () => {
      let warned = 0;
      const got = isEntryPoint('data:text/javascript,0', {
        argv: ['node', SELF],
        warn: () => warned++,
      });
      return got + '/' + warned;
    },
    'false/1',
  );
  // The undecidable case: argv[1] names something that does not resolve. False
  // is the only safe answer (true would re-run the CLI inside an importer), but
  // it must SAY SO -- a silent false here is the very fail-open being removed.
  add(
    'false and LOUD when argv[1] cannot be resolved on disk',
    () => {
      let warned = 0;
      const got = isEntryPoint(SELF_URL, {
        argv: ['node', path.join(REPO_ROOT, 'no', 'such', 'file-8f3a1c.mjs')],
        warn: () => warned++,
      });
      return got + '/' + warned;
    },
    'false/1',
  );
  // The whole point of the exercise, proven on the predicate rather than on a
  // spawned process: a link spelling of this file must still read as the entry.
  add(
    'TRUE through a junction/symlink spelling -- the defect this closes',
    () => {
      let link;
      try {
        link = makeLink(REPO_ROOT);
      } catch {
        // Not a failure of isEntryPoint -- a fact about the filesystem or the
        // account. Reporting it as red would make this case indistinguishable
        // from a real regression on any runner without link rights.
        return SKIP;
      }
      try {
        const viaLink = path.join(link, path.relative(REPO_ROOT, SELF));
        // Guard the case itself: if the link spelling is not actually a
        // different string, it would pass without testing anything.
        if (viaLink === SELF) return 'link-not-distinct';
        return isEntryPoint(SELF_URL, { argv: ['node', viaLink] });
      } finally {
        removeLink(link);
      }
    },
    true,
  );
  if (IS_WINDOWS) {
    add(
      'case-insensitive on Windows, where the filesystem is',
      () => isEntryPoint(SELF_URL, { argv: ['node', SELF.toUpperCase()] }),
      true,
    );
  }
  // The trace is what the sweep observes, so it is itself under test: it must
  // report the verdict it returned, and must stay silent when unset.
  add(
    'ENTRY_POINT_TRACE off: no marker',
    () => {
      const before = process.env.ENTRY_POINT_TRACE;
      delete process.env.ENTRY_POINT_TRACE;
      const written = [];
      const original = process.stderr.write;
      process.stderr.write = (chunk) => (written.push(String(chunk)), true);
      try {
        isEntryPoint(SELF_URL, { argv: ['node', SELF] });
      } finally {
        process.stderr.write = original;
        if (before !== undefined) process.env.ENTRY_POINT_TRACE = before;
      }
      return written.join('').includes('[entry-point-trace]');
    },
    false,
  );
  add(
    'ENTRY_POINT_TRACE on: the marker reports the verdict, both ways',
    () => {
      const before = process.env.ENTRY_POINT_TRACE;
      process.env.ENTRY_POINT_TRACE = '1';
      const written = [];
      const original = process.stderr.write;
      process.stderr.write = (chunk) => (written.push(String(chunk)), true);
      try {
        isEntryPoint(SELF_URL, { argv: ['node', SELF] });
        isEntryPoint(SELF_URL, { argv: ['node', path.join(REPO_ROOT, 'scripts/ship-gate.mjs')] });
      } finally {
        process.stderr.write = original;
        if (before === undefined) delete process.env.ENTRY_POINT_TRACE;
        else process.env.ENTRY_POINT_TRACE = before;
      }
      return written
        .join('')
        .split('\n')
        .filter((l) => l.includes('[entry-point-trace]'))
        .map((l) => TRACE_LINE_RE.exec(l)?.[1])
        .join(',');
    },
    'true,false',
  );

  let failed = 0;
  let skipped = 0;
  for (const c of cases) {
    let got;
    try {
      got = await c.fn();
    } catch (error) {
      got = 'threw: ' + error.message;
    }
    if (got === SKIP) {
      skipped++;
      console.log('skip  ' + c.name + '  (no link-creation rights here)');
      continue;
    }
    const ok = got === c.expected;
    if (!ok) failed++;
    console.log(
      (ok ? 'ok  ' : 'FAIL') +
        '  ' +
        c.name +
        (ok ? '' : '  (expected ' + JSON.stringify(c.expected) + ', got ' + JSON.stringify(got) + ')'),
    );
  }
  if (failed > 0) {
    console.error('\nFAIL self-test -- ' + failed + ' of ' + cases.length + ' case(s).');
    return 1;
  }
  console.log(
    '\nPASS self-test -- ' +
      (cases.length - skipped) +
      ' of ' +
      cases.length +
      ' cases over isEntryPoint itself' +
      (skipped ? ' (' + skipped + ' skipped: no link-creation rights)' : '') +
      '.',
  );
  return 0;
}

export async function main() {
  const missingFromDisk = TARGETS.filter((t) => !fs.existsSync(path.join(REPO_ROOT, t.rel)));
  if (missingFromDisk.length > 0) {
    console.error('Entry-point proof: cannot run -- these targets do not exist:');
    for (const t of missingFromDisk) console.error('  ' + t.rel);
    console.error('If one was renamed, update TARGETS. A shrinking list is not a passing run.');
    return 2;
  }

  const unlisted = assertTargetsCover(REPO_ROOT);
  if (unlisted.length > 0) {
    console.error('Entry-point proof: cannot run -- these files dispatch through isEntryPoint');
    console.error('but are not in TARGETS, so the sweep would silently not cover them:');
    for (const rel of unlisted) console.error('  ' + rel);
    return 2;
  }

  const importerDir = fs.mkdtempSync(path.join(os.tmpdir(), 'entry-point-importer-'));
  const importerPath = path.join(importerDir, 'importer.mjs');
  fs.writeFileSync(
    importerPath,
    // Prints nothing of its own, so every marker observed came from the target.
    "import { pathToFileURL } from 'node:url';\n" +
      'await import(pathToFileURL(process.argv[2]).href);\n',
    'utf8',
  );

  let link;
  try {
    link = makeLink(REPO_ROOT);
  } catch (error) {
    console.error('Entry-point proof: could not create a link (' + error.message + ').');
    console.error('On Windows a junction needs no admin rights; a symlink does. This is exit 2,');
    console.error('not a pass: nothing was measured.');
    return 2;
  }
  console.log('Entry-point proof');
  console.log('  repo: ' + REPO_ROOT);
  console.log('  link: ' + link + '  (' + (IS_WINDOWS ? 'junction' : 'symlink') + ')');
  console.log('  probe: ENTRY_POINT_TRACE, no arguments -- no target does any real work');
  console.log('');

  const rows = [];
  let linkRemoved = false;
  try {
    for (const target of TARGETS) {
      // The marker always names the module's REALPATH -- which is the canonical
      // repo path on both arms, since that is the whole point of the predicate.
      // So the link arm is matched against the canonical path too.
      const absTarget = path.join(REPO_ROOT, target.rel);
      const control = await probeRun(absTarget, [], target.timeoutMs, absTarget);
      const linked = await probeRun(path.join(link, target.rel), [], target.timeoutMs, absTarget);
      const imported = await probeImport(
        path.join(REPO_ROOT, target.rel),
        importerPath,
        target.timeoutMs,
      );

      let verdict;
      if ([control, linked, imported].some((r) => r.outcome === 'timeout')) {
        // Its own verdict, never FAIL-OPEN. Conflating "it stayed silent" with
        // "it ran out of time" is how a slow machine gets reported as a bug.
        verdict = 'TIMEOUT';
      } else if (control.marker === null) {
        verdict = 'INCONCLUSIVE';
      } else if (control.marker !== 'true') {
        // Invoked by its own canonical path, a CLI must consider itself the
        // entry. If it does not, the probe is measuring something else.
        verdict = 'INCONCLUSIVE';
      } else if (linked.marker !== 'true') {
        verdict = 'FAIL-OPEN';
      } else if (imported.marker !== 'false') {
        verdict = 'RUNS-ON-IMPORT';
      } else {
        verdict = 'PASS';
      }

      rows.push({ ...target, control, linked, imported, verdict });
      const ok = verdict === 'PASS';
      console.log(
        (ok ? 'ok  ' : 'FAIL') +
          '  ' +
          target.rel.padEnd(42) +
          verdict.padEnd(16) +
          'direct ' +
          (control.marker ?? '-') +
          ' / link ' +
          (linked.marker ?? '-') +
          ' / import ' +
          (imported.marker ?? '-'),
      );
      if (!ok) {
        console.log('        direct: ' + (control.sample || '(silence)') + '  [' + control.outcome + ']');
        console.log('        link  : ' + (linked.sample || '(silence)') + '  [' + linked.outcome + ']');
        console.log('        import: ' + (imported.sample || '(silence)') + '  [' + imported.outcome + ']');
      }
    }
  } finally {
    linkRemoved = removeLink(link);
    try {
      fs.rmSync(importerDir, { recursive: true, force: true });
    } catch {
      // A leftover temp dir under os.tmpdir() is harmless; it is NOT the repo,
      // and it is not worth failing a green proof over. The LINK is different
      // -- see below.
    }
  }

  const timedOut = rows.filter((r) => r.verdict === 'TIMEOUT');
  const inconclusive = rows.filter((r) => r.verdict === 'INCONCLUSIVE');
  const failed = rows.filter(
    (r) => r.verdict === 'FAIL-OPEN' || r.verdict === 'RUNS-ON-IMPORT',
  );

  console.log('');
  if (!linkRemoved) {
    // Exit 2, not a warning line nobody reads. A junction pointing at the
    // repository root, left in the temp directory, is exactly the artifact a
    // cleaner running `rm -rf` would follow.
    console.error('Entry-point proof COULD NOT CLEAN UP: the link above is still on disk.');
    console.error('Remove it by hand before anything sweeps the temp directory.');
    return 2;
  }
  if (timedOut.length > 0 || inconclusive.length > 0) {
    console.error(
      'Entry-point proof COULD NOT MEASURE ' +
        (timedOut.length + inconclusive.length) +
        ' of ' +
        rows.length +
        ' target(s). Do not read this as green.',
    );
    for (const r of timedOut) console.error('  ? ' + r.rel + '  timed out before it reported a verdict');
    for (const r of inconclusive) {
      console.error(
        '  ? ' +
          r.rel +
          '  emitted no ENTRY_POINT_TRACE marker by its canonical path -- it may not use ' +
          'isEntryPoint at all, or it exits before the dispatch',
      );
    }
    return 2;
  }
  if (failed.length > 0) {
    console.error('Entry-point proof FAILED for ' + failed.length + ' of ' + rows.length + ' target(s).');
    for (const r of failed) {
      const why =
        r.verdict === 'FAIL-OPEN'
          ? 'reported itself the entry by its canonical path but NOT through the link -- the dispatch mispredicts.'
          : 'reported itself the entry on a plain import -- it would fire its CLI inside an importing test runner.';
      console.error('  x ' + r.rel + '  ' + why);
    }
    return 1;
  }
  console.log(
    'Entry-point proof PASSED -- all ' +
      rows.length +
      ' entry point(s) proven to RUN through a ' +
      (IS_WINDOWS ? 'junction' : 'symlink') +
      ' and to stay silent on a plain import.',
  );
  return 0;
}

// Realpath-to-realpath, like everything it proves.
if (isEntryPoint(import.meta.url)) {
  const argv = process.argv.slice(2);
  const KNOWN_FLAGS = ['--self-test'];
  const unknown = argv.filter((a) => !KNOWN_FLAGS.includes(a));
  if (unknown.length > 0) {
    console.error('Unknown flag(s): ' + unknown.join(', ') + '. Known: ' + KNOWN_FLAGS.join(', '));
    process.exitCode = 2;
  } else if (argv.includes('--self-test')) {
    process.exitCode = await selfTest();
  } else {
    // Every path returns a code, and a THROW is infrastructure (2), not "a
    // target failed open" (1). Without this a tmpdir EACCES or a spawn fault
    // exited 1 and read as a dispatch defect.
    process.exitCode = await main().catch((error) => {
      console.error('Entry-point proof could not run: ' + (error?.stack || error?.message || error));
      return 2;
    });
  }
}

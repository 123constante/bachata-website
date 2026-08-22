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
 * target happened to emit.
 *
 * WHY THE KILL IS NO LONGER THE THING PREVENTING REAL WORK. It never was, and
 * for six days this docblock said otherwise. The marker fires before main(),
 * but the child was still alive when it fired, so the harness had to race it --
 * and it lost. killTree's spawnSync('taskkill') costs ~180-210ms to RETURN
 * (measured 2026-08-20, 3 runs, C:/dev/Website-wt-probe); the child lives for
 * all of it. An earlier note put the window at ~1ms, which was the taskkill
 * SPAWN, not its effect. In that window a target opening its client at once
 * gets a request out, and scripts/mutate-workflow-artifact-policy.mjs writes a
 * .mutant file whose reclaiming `finally` a SIGKILL never reaches -- 2 leaked
 * per sweep, 42 orphans deleted across the worktrees on 2026-08-20, under a
 * filename `git status` will not show because .gitignore hides it.
 *
 * The window is not the defect. Racing at all is. So the child is no longer
 * killed at the marker: under ENTRY_POINT_PROBE, scripts/lib/entry-point.mjs
 * ENDS THE PROCESS on the line after the marker, and only where the verdict is
 * true -- the one moment where the answer is known and nothing has happened
 * yet. Measured on those same runs: zero mutants on disk at the marker, one by
 * the time taskkill returned. This harness now waits for that exit instead of
 * competing with it.
 *
 * WHAT IS ACTUALLY GUARANTEED, stated narrowly because the last version of this
 * paragraph overclaimed. No target's main() is ENTERED: the dispatch never
 * receives `true`. That is a claim about the dispatch line and nothing else. A
 * module whose top level does work before its dispatch -- an import with a side
 * effect, a client constructed at module scope -- is entirely unaffected by
 * this and always was; the predicate cannot run before the module body that
 * calls it. No such target is known here, and if one appears it needs its own
 * answer rather than an assumption that this one covers it.
 *
 * The claim is CHECKED, not trusted: an arm whose verdict is true must exit
 * with ENTRY_POINT_PROBE_EXIT, or the row is PROBE-UNSAFE and the run cannot
 * measure. "It exited" would have been the weaker predicate with several
 * causes; the code has one writer.
 *
 * The earlier docblock also recorded that an in-process listener reports a
 * false NEGATIVE here, because the parent cannot accept a socket while blocked
 * inside the very spawnSync being timed. Still true, still the trap to avoid
 * when re-measuring; the 2026-08-20 numbers above were taken from a separate
 * process for that reason.
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
import { ENTRY_POINT_PROBE_EXIT, isEntryPoint, probeArmed } from './lib/entry-point.mjs';

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
  { rel: 'scripts/check-first-load-requests.mjs' },
  { rel: 'scripts/check-image-refs-live.mjs' },
  { rel: 'scripts/check-mojibake.mjs' },
  { rel: 'scripts/check-occurrence-delete-booking-safety.mjs' },
  { rel: 'scripts/check-og-images.mjs' },
  { rel: 'scripts/check-og-scrape-evidence.mjs' },
  { rel: 'scripts/check-plan-hygiene.mjs' },
  { rel: 'scripts/check-pr-mergeable.mjs' },
  { rel: 'scripts/check-program-day-offsets.mjs' },
  { rel: 'scripts/check-rpc-typing.mjs' },
  { rel: 'scripts/check-script-conventions.mjs' },
  { rel: 'scripts/check-seo.mjs' },
  { rel: 'scripts/check-wallclock-brand.mjs' },
  { rel: 'scripts/hooks/arc-checkpoint.mjs' },
  { rel: 'scripts/hooks/pre-exec-guard.mjs' },
  { rel: 'scripts/hooks/review-stamp.mjs' },
  { rel: 'scripts/hooks/session-lock.mjs' },
  { rel: 'scripts/lint-workflow-notification.mjs' },
  { rel: 'scripts/mutate-workflow-artifact-policy.mjs' },
  { rel: 'scripts/pre-ship.mjs' },
  { rel: 'scripts/prove-entry-point-dispatch.mjs' },
  { rel: 'scripts/rework-share.mjs' },
  { rel: 'scripts/ship-gate.mjs' },
];

/** Generous: nothing here runs a target's real work, so this only catches hangs. */
const DEFAULT_TIMEOUT_MS = 30_000;

/**
 * How long the probe's own exit is allowed to take, once the marker says the
 * verdict was true.
 *
 * It is a deadline on ONE process.exit that has already been decided, not on
 * any work -- entry-point.mjs writes the marker and exits on the next
 * statement -- so this is generous by a wide margin rather than tuned. The
 * measured distance between the two on this machine is under a millisecond.
 *
 * It exists because the alternative to a deadline is a 30s timeout reported as
 * TIMEOUT, which says "the machine was slow" about a target that has in fact
 * gone off and started its real work. Those are different findings and the
 * operator needs the right one: a target whose predicate does not honour the
 * probe -- an un-updated vendored copy is the realistic way that happens -- is
 * a target this harness can no longer probe safely, and it must say so rather
 * than quietly falling back to the kill-race that leaked mutants for six days.
 */
const PROBE_GRACE_MS = 5_000;

/**
 * The arming, in ONE place, because two copies of it stopped agreeing the
 * moment anyone edited either.
 *
 * The spawned canary's whole claim is "this is the exact arming the sweep
 * uses", and a duplicated object literal cannot make that true -- rename or add
 * a variable in one and the canary keeps passing against an arming the sweep no
 * longer runs, which is the canary quietly measuring the wrong thing rather
 * than failing.
 *
 * Not spread into process.env here: it is merged at each spawn site, so this
 * stays the delta and never a snapshot of the environment.
 */
const PROBE_ENV = {
  NO_COLOR: '1',
  ENTRY_POINT_TRACE: '1',
  ENTRY_POINT_PROBE: '1',
};

/**
 * Does the predicate on disk honour ENTRY_POINT_PROBE at all?
 *
 * A PRE-FLIGHT, not a nicety. If the answer is no, this harness has no safe way
 * to run anything: it falls back to waiting PROBE_GRACE_MS per arm while the
 * target runs its real work -- which for a target that finishes inside the
 * grace means it runs COMPLETELY, strictly worse than the ~200ms kill this
 * change replaced. Discovering that 25 targets and 75 arms too late is how the
 * mutation harness would leak far more than the 2-per-sweep the header cites.
 * So it is asked once, of one cheap target, before the sweep spawns anything.
 *
 * check-mojibake.mjs is the subject because it is the cheapest thing in TARGETS
 * to be wrong about: pure filesystem, no credentials, no network. If the probe
 * is broken, the cost of finding out is one full mojibake scan.
 *
 * Every failure is DISTINGUISHED rather than collapsed into "not honoured".
 * Renaming the file, an EPERM, or a timeout would otherwise all print as a
 * probe regression -- accusing the mechanism when the file simply is not there,
 * which is the "it ended is not evidence of why" rule this harness applies
 * everywhere else.
 *
 * @returns {{ok: boolean, reason: string, detail: string}}
 */
export function probeSelfCheck(deps = {}) {
  const {
    run = spawnSync,
    target = path.join(REPO_ROOT, 'scripts', 'check-mojibake.mjs'),
    exists = fs.existsSync,
  } = deps;

  if (!exists(target)) return { ok: false, reason: 'target-missing', detail: target };

  const result = run(process.execPath, [target], {
    cwd: REPO_ROOT,
    encoding: 'utf8',
    timeout: DEFAULT_TIMEOUT_MS,
    env: { ...process.env, ...PROBE_ENV },
  });

  if (result.error) {
    return { ok: false, reason: 'spawn-failed', detail: result.error.message };
  }
  // A timeout is its own answer: spawnSync reports the signal, and reading it
  // as "did not exit 97" would blame the predicate for a hung machine.
  if (result.signal) return { ok: false, reason: 'killed', detail: String(result.signal) };
  // stderr SPECIFICALLY: fd 2 is part of the claim, so a merged stream would
  // pass with the marker on stdout.
  if (!/\[entry-point-trace\] true /.test(result.stderr ?? '')) {
    return { ok: false, reason: 'no-marker', detail: String(result.stderr ?? '').slice(0, 200).trim() };
  }
  if (result.status !== ENTRY_POINT_PROBE_EXIT) {
    return { ok: false, reason: 'not-honoured', detail: 'exit ' + String(result.status) };
  }
  return { ok: true, reason: 'honoured', detail: 'exit ' + String(result.status) };
}

/**
 * The verdict ladder, as a pure function over the three arms.
 *
 * Extracted so the canary can DRIVE it. It used to be inline in main(), where
 * -- as the TARGETS docblock says of the deferral arms that were deleted for
 * this exact reason -- no case could reach it: selfTest() drives isEntryPoint's
 * branches and never main()'s ladder. The PROBE-UNSAFE rungs would then have
 * run for the first time on the day someone trusted them, and one of them was
 * already wrong (see the arm naming below). An unreachable satisfied state is
 * not a gate.
 *
 * Returns the verdict AND which arms are implicated, because a message that
 * names the wrong arm is worse than one that names none.
 *
 * @param {{control: object, linked: object, imported: object}} arms
 * @returns {{verdict: string, unsafeArms: string[]}}
 */
export function classifyRow(arms) {
  const ordered = [
    ['direct', arms.control],
    ['link', arms.linked],
    ['import', arms.imported],
  ];

  if (ordered.some(([, r]) => r.outcome === 'timeout')) {
    // Its own verdict, never FAIL-OPEN. Conflating "it stayed silent" with "it
    // ran out of time" is how a slow machine gets reported as a bug.
    return { verdict: 'TIMEOUT', unsafeArms: [] };
  }

  // BEFORE the probe-health rungs, deliberately. A true marker on the import
  // arm is unambiguous evidence of the worst finding this harness has -- the
  // module fires its CLI inside whatever imported it -- and it is evidence
  // whether or not the probe then stopped the process, because the marker is
  // written first. Ranked below PROBE-UNSAFE it was MASKED: the arm reports
  // probe-not-honoured, the row became "could not measure" (exit 2), and a real
  // contract violation (exit 1) was downgraded to an infrastructure note.
  if (arms.imported.marker === 'true') {
    return { verdict: 'RUNS-ON-IMPORT', unsafeArms: [] };
  }

  // Probe health, per arm. The exit-code half is scoped to arms that actually
  // dispatched: a false marker never arms the probe, so demanding 97 of it
  // would fail every import arm on every row.
  const unsafeArms = ordered
    .filter(
      ([, r]) =>
        r.outcome === 'probe-not-honoured' ||
        (r.marker === 'true' && r.exitCode !== ENTRY_POINT_PROBE_EXIT),
    )
    .map(([name]) => name);
  if (unsafeArms.length > 0) {
    // Not a dispatch finding. Nothing about the predicate's verdict is in
    // doubt; what is in doubt is whether this harness can point at that file
    // without starting its real work.
    return { verdict: 'PROBE-UNSAFE', unsafeArms };
  }

  if (arms.control.marker === null) return { verdict: 'INCONCLUSIVE', unsafeArms: [] };
  // Invoked by its own canonical path, a CLI must consider itself the entry. If
  // it does not, the probe is measuring something else.
  if (arms.control.marker !== 'true') return { verdict: 'INCONCLUSIVE', unsafeArms: [] };
  if (arms.linked.marker !== 'true') return { verdict: 'FAIL-OPEN', unsafeArms: [] };
  // Reached only with imported.marker null -- 'true' returned above and 'false'
  // is the pass. Unchanged from before this ladder was extracted.
  if (arms.imported.marker !== 'false') return { verdict: 'RUNS-ON-IMPORT', unsafeArms: [] };
  return { verdict: 'PASS', unsafeArms: [] };
}

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
      // ENTRY_POINT_PROBE is set HERE, per child, and never exported into this
      // process's own environment -- this file is one of the targets, so a
      // global would stop the sweep at its own dispatch before it spawned
      // anything, exiting 97 having proven nothing.
      env: { ...process.env, ...PROBE_ENV },
    });

    let text = '';
    let marker = null;
    let settled = false;
    let graceTimer = null;
    let reaped = false;
    let markerSeen = false;

    const finish = (outcome, exitCode = null) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      if (graceTimer !== null) clearTimeout(graceTimer);
      // ONLY while the child is still alive. This used to be unconditional, and
      // that was safe only because the old code always settled from onData with
      // the child provably running. It now settles from 'close' on every
      // ordinary arm -- and by the time node emits 'close' it has reaped the
      // process, so the OS is free to reuse the pid. An unconditional
      // `taskkill /PID <reaped> /T /F` is then 75 blind force-kills per sweep
      // (25 targets x 3 arms) aimed at whatever inherited those numbers; on
      // POSIX process.kill(-pid) SIGKILLs an unrelated process GROUP. The
      // timeout, spawn-fault and probe-not-honoured arms still reach here with
      // a live tree, which is what killTree remains for -- _serve-build.mjs's
      // grandchild being the reason it must be the tree and not the child.
      //
      // NAMED GAP: no canary drives this. killTree is not injected, so a case
      // proving "we did not kill a reaped pid" would need a seam this file does
      // not have, and the observable -- an unrelated process surviving -- is
      // not one a canary can assert. It is stated here rather than left to look
      // covered, which is the same standard the DEFERRED arms were held to.
      if (!reaped) killTree(child);
      resolve({ marker, outcome, exitCode, sample: text.slice(0, 200).trim() });
    };

    const onData = (buf) => {
      // Once the target's own marker is captured there is nothing left to find,
      // and on the `true` path this handler stays subscribed for up to
      // PROBE_GRACE_MS. Without this bail, a target that does NOT honour the
      // probe -- the one case that lives long -- appends its entire real run to
      // `text` and re-matches the whole accumulated buffer on every chunk. That
      // is quadratic in output size, on precisely the path this change exists
      // to make cheap. The check has to be the FIRST statement: sitting below
      // the path filter, it still re-scanned everything before returning.
      if (markerSeen) return;
      text += buf.toString('utf8');
      // Re-scan the whole buffer each time: a marker can arrive split across
      // two chunks, and there may be several from imported modules before the
      // target's own.
      TRACE_RE.lastIndex = 0;
      for (const found of text.matchAll(TRACE_RE)) {
        if (wanted !== null && normaliseForCompare(found[2].trim()) !== wanted) continue;
        markerSeen = true;
        marker = found[1];
        if (marker !== 'true') {
          // The target decided it was IMPORTED, so its main() never runs and
          // there is nothing to stop. Nothing will exit 97 either -- the probe
          // fires only on true -- so waiting would buy a timeout. This is the
          // link arm of a FAIL-OPEN, and it is safe precisely because the
          // dispatch did not fire.
          finish('traced');
          return;
        }
        // Verdict true: the probe inside entry-point.mjs is ending this process
        // right now, BEFORE main(). Do not race it with a kill -- that race is
        // the whole defect (see the header). Wait for the exit it promises, and
        // hold it to a deadline so a target built against an older copy of the
        // predicate cannot quietly reinstate the old behaviour.
        graceTimer = setTimeout(() => finish('probe-not-honoured'), PROBE_GRACE_MS);
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
    child.on('close', (code) => {
      // Set BEFORE finish: node has already reaped the process by the time this
      // fires, so the pid must be treated as gone from here on.
      reaped = true;
      finish('exited', code);
    });

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

/**
 * Is this a CI runner? Exported so the canary can drive it -- the floor it arms
 * lives after the case loop, where no case can observe its return.
 *
 * Truthiness would arm that floor on CI="false" and CI="0", both ordinary
 * workstation exports, and the failure message then asserts the opposite of what
 * is true. That is the third instance of one class in three review rounds on
 * this branch -- `if (moduleRes.failure)`, `if (downgraded)`, and now this --
 * so it is written as an explicit predicate over the value, not a cast of it.
 */
export const isCiEnv = (value) =>
  value !== undefined && value !== '' && value !== 'false' && value !== '0';

// Date.now() alone is millisecond-resolution and selfTest now makes five links
// in a row, so two could collide and the second would fail EEXIST -- which used
// to be reported as "no link-creation rights here".
let linkSeq = 0;

function makeLink(target) {
  const link = path.join(
    os.tmpdir(),
    'entry-point-proof-' + process.pid + '-' + (linkSeq++).toString(36) + '-' + Date.now().toString(36),
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
  //
  // The message assert is not decoration. The facility cases below moved this
  // warning's wording, and the fix for a warning that blamed argv[1] for a
  // BROKEN REALPATH must not swing the other way and stop blaming argv[1] when
  // argv[1] is genuinely the thing at fault. This case owns that direction; case
  // 'the warning names realpathSync.native, NOT argv[1]' owns the other.
  add(
    'false and LOUD when argv[1] cannot be resolved on disk, naming argv[1] and the errno',
    () => {
      const warned = [];
      const got = isEntryPoint(SELF_URL, {
        argv: ['node', path.join(REPO_ROOT, 'no', 'such', 'file-8f3a1c.mjs')],
        warn: (m) => warned.push(m),
      });
      const named =
        warned.length === 1 &&
        warned[0].includes('could not resolve process.argv[1]') &&
        warned[0].includes('ENOENT');
      return got + '/' + warned.length + '/' + named;
    },
    'false/1/true',
  );
  // Returns the junction spelling of this file, or SKIP where links cannot be
  // made -- a fact about the account, not a failure of isEntryPoint, and
  // reporting it red would make every such case indistinguishable from a real
  // regression on a runner without link rights.
  //
  // ONLY a rights fact may skip. The first draft caught everything and labelled
  // it "no link-creation rights here", so an EEXIST from a colliding link name
  // or an ENOSPC read as a permissions fact -- and since five cases route
  // through here and selfTest still returned 0 with them skipped, the whole
  // junction arm could evaporate green. Anything that is not EPERM/EACCES is a
  // defect in this harness or its environment and now reds. The floor beneath
  // the loop closes the other half: under CI links are known to work, so a skip
  // there means the harness reported green over a smaller set than it named.
  const skipReasons = new Set();
  // main() treats a link it could not remove as exit 2 -- "exactly the artifact
  // a cleaner running `rm -rf` would follow". selfTest ran the identical hazard
  // through a `finally` that DISCARDED removeLink's boolean, so the same
  // junction-pointing-at-the-repo-root left in %TEMP% failed one caller and was
  // waved through by the other. Five links a run now, not one, and the CI floor
  // below guarantees all five are made, so this is the hot path.
  let linkLeftBehind = false;
  const viaJunction = (fn) => {
    let link;
    try {
      link = makeLink(REPO_ROOT);
    } catch (error) {
      if (error?.code !== 'EPERM' && error?.code !== 'EACCES') throw error;
      skipReasons.add(error.code);
      return SKIP;
    }
    try {
      const viaLink = path.join(link, path.relative(REPO_ROOT, SELF));
      // Guard the case itself: if the link spelling is not actually a different
      // string, it would pass without testing anything.
      if (viaLink === SELF) return 'link-not-distinct';
      return fn(viaLink);
    } finally {
      if (!removeLink(link)) linkLeftBehind = true;
    }
  };

  // The whole point of the exercise, proven on the predicate rather than on a
  // spawned process: a link spelling of this file must still read as the entry.
  add(
    'TRUE through a junction/symlink spelling -- the defect this closes',
    () => viaJunction((viaLink) => isEntryPoint(SELF_URL, { argv: ['node', viaLink] })),
    true,
  );
  // --- THE REALPATH FACILITY ITSELF FAILING -------------------------------
  //
  // The branch nothing drove, and the one that mattered: until 2026-08-14
  // entry-point.mjs caught every error class from realpathSync.native in a bare
  // catch, so a facility that was broken rather than a path that was missing
  // fell through to the literal compare -- the raw string compare this whole
  // exercise removed -- and returned FALSE through a junction while warning
  // about argv[1], which resolved perfectly well. Every converted target,
  // including both session hooks, would have quietly done nothing.
  //
  // Driven by stubbing fs.realpathSync.native, which is {writable, configurable}
  // and read at call time. That the stub REACHES the module under test is
  // self-proving rather than asserted: if the property lookup did not resolve to
  // this same function object, the first case below would return the unstubbed
  // 'true/0' and fail. Every stub is restored in a finally, and the last case
  // here asserts the restoration actually happened -- a leaked stub would make
  // every later case measure something other than what it names.
  const NATIVE = fs.realpathSync.native;
  const withNative = (stub, fn) => {
    if (stub === undefined) delete fs.realpathSync.native;
    else fs.realpathSync.native = stub;
    try {
      return fn();
    } finally {
      fs.realpathSync.native = NATIVE;
    }
  };
  const observe = (argvPath, extra = {}) => {
    const warned = [];
    const got = isEntryPoint(SELF_URL, {
      argv: ['node', argvPath],
      warn: (m) => warned.push(m),
      ...extra,
    });
    return { got, warned };
  };
  const verdictAndWarns = (argvPath, extra = {}) => {
    const { got, warned } = observe(argvPath, extra);
    return got + '/' + warned.length;
  };
  // The errno lives ONLY in `.code`, never in the message. An earlier fixture
  // built this as `new Error(code + ': simulated realpath failure')`, which made
  // every case asserting "the warning names the errno" pass identically whether
  // the module read `.code` or `.message` -- the `??` under test supplied by the
  // fixture rather than measured.
  const fsError = (code) => Object.assign(new Error('simulated realpath failure'), { code });
  const isSelfPath = (p) => normaliseForCompare(String(p)) === normaliseForCompare(SELF);
  // A realpath that refuses in BOTH implementations -- the state no fs stub can
  // produce, because stubbing the `.native` property leaves the real JS walker
  // live underneath it. That asymmetry is the whole point of the module's
  // fallback, so the branches reached only when both refuse need the injected
  // seam. `selfOnly` narrows the refusal to this file, for the asymmetric case.
  const refusingRealpath = (code, selfOnly = false) => {
    const refuse = (p) => {
      if (selfOnly && !isSelfPath(p)) return NATIVE(p);
      throw fsError(code);
    };
    refuse.native = refuse;
    return refuse;
  };

  // The headline: with the facility gone, the junction verdict must still be
  // TRUE (the JS realpathSync resolves links; only its case handling differs,
  // and samePath folds case on win32) and the downgrade must be announced.
  // Before the fix this measured false/1.
  add(
    'facility down (.native deleted): still TRUE through a junction, and announced',
    () => viaJunction((viaLink) => withNative(undefined, () => verdictAndWarns(viaLink))),
    'true/1',
  );
  // Announced even where the verdict was never at risk. A downgrade that only
  // speaks when it also changes the answer is a downgrade nobody finds.
  add(
    'facility down: canonical argv unaffected in verdict, still announced',
    () => withNative(undefined, () => verdictAndWarns(SELF)),
    'true/1',
  );
  // And the fallback must not become a fail-CLOSED in the other direction: an
  // ordinary import stays false.
  add(
    'facility down: a different real file is still not the entry',
    () => withNative(undefined, () => verdictAndWarns(path.join(REPO_ROOT, 'scripts/ship-gate.mjs'))),
    'false/1',
  );
  // Attribution. The old warning named argv[1] for a fault in neither argv[1]
  // nor the path it holds, which is how this survived: the message sent the
  // reader to look at the one thing that was fine.
  add(
    'facility down: the warning names realpathSync.native, NOT argv[1]',
    () =>
      withNative(undefined, () => {
        const { warned } = observe(SELF);
        return (
          warned.length === 1 &&
          warned[0].includes('realpathSync.native') &&
          // The PATH it failed on. Without it the line reads as a verdict on the
          // runtime, and `.native` is one CreateFileW handle -- a single file
          // held FILE_SHARE_NONE fails it while the lstat walker resolves it.
          warned[0].includes(SELF) &&
          !warned[0].includes('could not resolve process.argv[1]')
        );
      }),
    true,
  );
  // THE ERRNO-BEARING FACILITY FAILURE -- and the reason there is no longer a
  // classification. `.native` is one CreateFileW handle plus
  // GetFinalPathNameByHandle; the JS implementation walks the components with
  // lstat/readlink. A filesystem that does not support the former (a network
  // redirector, a FUSE-backed mount -- this repo runs on one) answers with
  // ERROR_INVALID_FUNCTION, which libuv hands back as an ordinary code-bearing
  // fs error. The first fix for the bare catch read that code and concluded the
  // PATH was gone, skipping the fallback that would have resolved it: both sides
  // came back unresolved, the compare degraded to the raw string, and this case
  // measured false/2/2 through a junction -- the fail-open, reached through its
  // own fix. It is a stub of `.native` ALONE precisely because the real JS
  // walker underneath is the thing that has to rescue it.
  add(
    '.native fails with an ERRNO but the JS walker resolves it: still TRUE through a junction',
    () =>
      viaJunction((viaLink) =>
        withNative(
          () => {
            throw fsError('EACCES');
          },
          () => {
            const { got, warned } = observe(viaLink);
            return got + '/' + warned.length + '/' + warned.filter((m) => m.includes('EACCES')).length;
          },
        ),
      ),
    'true/1/1',
  );
  // Only when BOTH refuse is the path really gone. Driven through the injected
  // seam, because no stub of the `.native` property can reach this state.
  add(
    'BOTH implementations refuse: false through a junction, both sides named with the errno',
    () =>
      viaJunction((viaLink) => {
        const { got, warned } = observe(viaLink, { realpath: refusingRealpath('EACCES') });
        return got + '/' + warned.length + '/' + warned.filter((m) => m.includes('EACCES')).length;
      }),
    'false/2/2',
  );
  // The same state with a CANONICAL argv, which is the arm that decides TRUE off
  // a raw string compare. It is right here only because the spelling happened to
  // be canonical; through a junction the identical state returns false (the case
  // above). So it warns on the way past -- the old code warned only when the
  // literal compare MISSED, which meant the one verdict reached by the
  // discredited comparison, and reached successfully, went unremarked.
  add(
    'BOTH refuse with a canonical argv: TRUE off the raw compare, and flagged as a guess',
    () => {
      const { got, warned } = observe(SELF, { realpath: refusingRealpath('EACCES') });
      return got + '/' + warned.length + '/' + warned.some((m) => m.includes('guess that happened to land'));
    },
    'true/2/true',
  );
  // THE SILENT BRANCH. Module side unresolvable, entry side fine: the compare
  // becomes realpath-against-raw and it used to happen with ZERO warnings --
  // the only DEGRADED branch that decided without saying anything (the plain
  // import and node --eval branches are silent by design, and stay that way:
  // two cases above pin them at false/0).
  // Measured at true/0 before the fix. Needs a link, because the two sides are
  // the same string whenever the spelling is canonical, and an asymmetry needs
  // two spellings.
  // Through the seam, not a `.native` stub: since the fallback became
  // unconditional, refusing `.native` for this file alone no longer leaves the
  // module side unresolved -- the JS walker rescues it, which is the fix
  // working. To reach the branch this case is named for, BOTH have to refuse.
  add(
    'module side alone unresolvable: TRUE through a junction, and no longer silent',
    () => viaJunction((viaLink) => verdictAndWarns(viaLink, { realpath: refusingRealpath('EBUSY', true) })),
    'true/1',
  );
  // The same branch without link rights, so the coverage does not evaporate on
  // a runner that cannot make one -- and it drives the false direction.
  add(
    'module side alone unresolvable: a different file is still not the entry, and it says so',
    () =>
      verdictAndWarns(path.join(REPO_ROOT, 'scripts/ship-gate.mjs'), {
        realpath: refusingRealpath('EBUSY', true),
      }),
    'false/1',
  );
  // NOT EVERY THROW IS AN ERROR, and this case has now caught two generations of
  // that. First: the three warnings reached straight for `.code ?? .message` on
  // the caught value, so a mocked fs throwing null made isEntryPoint itself
  // throw -- out of an ESM import resolved before any caller's try/catch exists,
  // i.e. a hook contracted to print nothing exiting 1 with a stack trace. Before
  // describe() this case did not fail, it THREW.
  //
  // Second, and the reason the expectation moved from 1 to 3: describe() fixed
  // the READ but the call sites still gated on truthiness, so a falsy throw
  // switched the warnings off instead of crashing on them -- and THIS CASE
  // ASSERTED THE ONE SURVIVING WARNING AS CORRECT. A case cannot catch a defect
  // its author expected; the count is what carried the information, and it was
  // pinned to the wrong number. All three warnings are now required, and each
  // must name the thrown value.
  //
  // Null rather than a string on purpose: a string still answers `.code` and
  // `.message` with undefined and never throws, so it would have proven nothing
  // about the first generation. It is falsy, so it proves the second.
  add(
    'a NULL thrown from realpath: all three warnings fire and every one names it',
    () => {
      const hostile = () => {
        throw null;
      };
      hostile.native = hostile;
      const { got, warned } = observe(SELF, { realpath: hostile });
      return got + '/' + warned.length + '/' + warned.every((m) => m.includes('null'));
    },
    'true/3/true',
  );
  // The DOWNGRADE gate, which is the falsy defect at its worst: `.native`
  // refuses with a falsy value and the JS walker succeeds, so nothing is wrong
  // with the verdict and the only job left is to say the facility is broken.
  // Measured before the boolean gates: true and ZERO warnings -- a downgrade
  // that speaks only when it also changes the answer, which is precisely what
  // the case named 'facility down: canonical argv unaffected in verdict, still
  // announced' three cases up exists to forbid. That case used a TypeError and
  // so never saw it.
  add(
    'facility down with a FALSY throw: the downgrade is still announced',
    () => {
      const halfHostile = (p) => NATIVE(p);
      halfHostile.native = () => {
        throw '';
      };
      return verdictAndWarns(SELF, { realpath: halfHostile });
    },
    'true/1',
  );
  // The same shape with the other falsy values, because `null` is the only one
  // describe() has to reach String() for -- '' and 0 answer `.code`/`.message`
  // with undefined, so they never exercised the read, only the gates.
  for (const thrown of ['', 0]) {
    add(
      'a falsy ' + JSON.stringify(thrown) + ' thrown from realpath still announces every branch',
      () => {
        const hostile = () => {
          throw thrown;
        };
        hostile.native = hostile;
        return verdictAndWarns(SELF, { realpath: hostile });
      },
      'true/3',
    );
  }
  // Both rescues exhausted: the facility is broken AND the JS fallback throws on
  // the path anyway. Two distinct warnings, a false verdict, and -- the point of
  // the case -- a RETURN rather than an exception escaping into a session hook.
  add(
    'facility down AND the JS fallback also fails: reports twice and still returns',
    () =>
      withNative(
        () => {
          throw new TypeError('realpathSync.native is not a function');
        },
        () => verdictAndWarns(path.join(REPO_ROOT, 'no', 'such', 'file-4b2e7d.mjs')),
      ),
    'false/2',
  );
  add('realpathSync.native restored after every stubbed case', () => fs.realpathSync.native === NATIVE, true);
  // The CI floor's predicate, driven directly -- the floor itself runs after the
  // loop, where no case can see its return. "false" and "0" are the pair a cast
  // gets wrong, and getting them wrong arms a hard FAIL carrying a message that
  // asserts the run is on a runner.
  add(
    'isCiEnv: only a real CI value arms the floor',
    () =>
      [undefined, '', 'false', '0', 'true', '1', 'yes'].map((v) => (isCiEnv(v) ? 1 : 0)).join(''),
    '0000111',
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
  /**
   * Drive isEntryPoint with the trace/probe environment set to `env` and both
   * debug seams captured.
   *
   * The marker is captured through the `write` seam because it now goes to fd 2
   * by number; stubbing process.stderr.write -- which these cases used to do --
   * stopped intercepting it, and a case that captures nothing while asserting
   * "no marker" passes for the wrong reason. The real fd-2 writer and the real
   * process.exit are proven separately, end to end, by the spawned case below:
   * injection here would otherwise hide exactly the defaults it replaces.
   *
   * Restores BOTH variables unconditionally, including the delete/restore
   * asymmetry -- leaking ENTRY_POINT_PROBE into the rest of the run would end
   * this process at the next dispatch.
   */
  const withTraceEnv = (env, run) => {
    const before = {
      trace: process.env.ENTRY_POINT_TRACE,
      probe: process.env.ENTRY_POINT_PROBE,
    };
    const restore = (name, value) => {
      if (value === undefined) delete process.env[name];
      else process.env[name] = value;
    };
    restore('ENTRY_POINT_TRACE', env.trace);
    restore('ENTRY_POINT_PROBE', env.probe);
    const written = [];
    const exits = [];
    try {
      const verdicts = run({
        write: (line) => written.push(String(line)),
        exit: (code) => exits.push(code),
      });
      // REFUSE a thenable rather than quietly mishandling it. The finally below
      // restores the environment when `run` RETURNS, so an async callback would
      // restore it at the first await -- before the probe branch had run -- and
      // every later case would then execute under whatever this one left set.
      // The stake is in this helper's own docstring: a leaked ENTRY_POINT_PROBE
      // ends the process at the next dispatch. The case loop does `await
      // c.fn()`, so writing an async case here is invited and would otherwise
      // fail in a way nobody could read.
      if (verdicts !== null && typeof verdicts?.then === 'function') {
        throw new Error('withTraceEnv: `run` must be synchronous -- it returned a thenable');
      }
      return { written, exits, verdicts };
    } finally {
      restore('ENTRY_POINT_TRACE', before.trace);
      restore('ENTRY_POINT_PROBE', before.probe);
    }
  };

  const markers = (written) =>
    written
      .join('')
      .split('\n')
      .filter((l) => l.includes('[entry-point-trace]'))
      .map((l) => TRACE_LINE_RE.exec(l)?.[1])
      .join(',');

  add(
    'ENTRY_POINT_TRACE off: no marker',
    () => {
      const { written } = withTraceEnv({ trace: undefined, probe: undefined }, (seams) => {
        isEntryPoint(SELF_URL, { argv: ['node', SELF], ...seams });
      });
      return written.join('').includes('[entry-point-trace]');
    },
    false,
  );
  add(
    'ENTRY_POINT_TRACE on: the marker reports the verdict, both ways',
    () => {
      const { written } = withTraceEnv({ trace: '1', probe: undefined }, (seams) => {
        isEntryPoint(SELF_URL, { argv: ['node', SELF], ...seams });
        isEntryPoint(SELF_URL, {
          argv: ['node', path.join(REPO_ROOT, 'scripts/ship-gate.mjs')],
          ...seams,
        });
      });
      return markers(written);
    },
    'true,false',
  );
  // TRACE alone must NOT end the process. The probe is a second switch, not a
  // consequence of the first: leaving them fused would turn every traced
  // debugging run into a run that stops at the dispatch.
  add(
    'ENTRY_POINT_TRACE on, PROBE off: verdict true is returned, nothing exits',
    () => {
      const { exits, verdicts } = withTraceEnv({ trace: '1', probe: undefined }, (seams) =>
        isEntryPoint(SELF_URL, { argv: ['node', SELF], ...seams }),
      );
      return String(verdicts) + '/' + exits.length;
    },
    'true/0',
  );
  // The probe arm itself: the marker is still emitted (it IS the measurement),
  // the process is ended with the dedicated code, and -- the half that matters
  // -- the caller does not receive true, so no dispatch can fire on a seam that
  // returns instead of exiting.
  add(
    'PROBE on, verdict true: marker emitted, exits 97, and never returns true',
    () => {
      const { written, exits, verdicts } = withTraceEnv({ trace: '1', probe: '1' }, (seams) =>
        isEntryPoint(SELF_URL, { argv: ['node', SELF], ...seams }),
      );
      return markers(written) + '/' + exits.join(',') + '/' + String(verdicts);
    },
    'true/97/false',
  );
  // The other half. A first draft of this comment justified it by saying that
  // exiting on false would hide RUNS-ON-IMPORT, and MUTATION DISPROVED THAT:
  // the marker is written BEFORE the exit, so the evidence survives and the
  // harness still reads `true` on the import arm. The real reason is duller and
  // was measured -- flip the condition to `if (process.env.ENTRY_POINT_PROBE)`
  // and scripts/pre-ship.mjs goes INCONCLUSIVE, because it imports
  // check-plan-hygiene.mjs, whose perfectly correct FALSE verdict now ends the
  // process before pre-ship reaches its own dispatch. Exiting on false stops
  // the IMPORTER, not the imported CLI; every ordinary import in the repo would
  // die the moment the variable was set.
  add(
    'PROBE on, verdict false: marker emitted, nothing exits, false returned',
    () => {
      const { written, exits, verdicts } = withTraceEnv({ trace: '1', probe: '1' }, (seams) =>
        isEntryPoint(SELF_URL, {
          argv: ['node', path.join(REPO_ROOT, 'scripts/ship-gate.mjs')],
          ...seams,
        }),
      );
      return markers(written) + '/' + exits.length + '/' + String(verdicts);
    },
    'false/0/false',
  );
  // PROBE without TRACE is inert -- trace() returns before reading it. Worth a
  // case because the guard is the `if (!process.env.ENTRY_POINT_TRACE) return`
  // at the top, which is easy to reorder while tidying and whose loss would
  // stop every CLI in the repo the moment the variable appeared anywhere.
  add(
    'PROBE on, TRACE off: inert -- no marker, no exit, verdict returned',
    () => {
      const { written, exits, verdicts } = withTraceEnv({ trace: undefined, probe: '1' }, (seams) =>
        isEntryPoint(SELF_URL, { argv: ['node', SELF], ...seams }),
      );
      return written.length + '/' + exits.length + '/' + String(verdicts);
    },
    '0/0/true',
  );
  // THE DEFAULTS, end to end, with no seam anywhere: a real child process, the
  // real fd-2 writer, the real process.exit. Every case above injects both, and
  // injection cannot prove what the un-injected code does -- the marker could
  // go to the wrong fd, or the exit could be missing entirely, and all five
  // would still pass. This is the exact arming probeRun uses, so a break shows
  // up here rather than 25 rows into a sweep.
  //
  // check-mojibake.mjs is the target because it is the cheapest thing in
  // TARGETS to be wrong about: pure filesystem, no credentials, no network. The
  // point is what it does NOT do -- if the probe failed, this case would sit
  // through its whole real scan and then report the wrong exit code, which is
  // the failure being guarded against, visible rather than silent.
  add(
    'defaults, spawned: the real writer reaches fd 2 and the real exit is 97',
    () => {
      const r = probeSelfCheck();
      return r.ok + '/' + r.reason + '/' + r.detail;
    },
    'true/honoured/exit 97',
  );
  // probeSelfCheck's failure arms, driven through injected collaborators. These
  // are what main() now refuses to spawn on, so each must be reachable AND
  // distinguishable -- collapsing them into one "not honoured" is how a renamed
  // file gets reported as a broken probe.
  const noRun = () => {
    throw new Error('probeSelfCheck must not spawn when the target is missing');
  };
  add(
    'probeSelfCheck: a missing target is named as missing, and nothing is spawned',
    () => probeSelfCheck({ exists: () => false, run: noRun, target: 'X' }).reason,
    'target-missing',
  );
  add(
    'probeSelfCheck: a spawn fault is a spawn fault, not a probe regression',
    () =>
      probeSelfCheck({
        exists: () => true,
        run: () => ({ error: new Error('EPERM'), status: null, stderr: null }),
      }).reason,
    'spawn-failed',
  );
  add(
    'probeSelfCheck: a killed/timed-out run is its own reason',
    () =>
      probeSelfCheck({ exists: () => true, run: () => ({ signal: 'SIGTERM', status: null, stderr: '' }) })
        .reason,
    'killed',
  );
  add(
    'probeSelfCheck: marker on STDOUT does not count -- fd 2 is the claim',
    () =>
      probeSelfCheck({
        exists: () => true,
        run: () => ({ status: 97, stdout: '[entry-point-trace] true x', stderr: '' }),
      }).reason,
    'no-marker',
  );
  add(
    'probeSelfCheck: marker but the wrong exit code is NOT honoured',
    () =>
      probeSelfCheck({
        exists: () => true,
        run: () => ({ status: 0, stderr: '[entry-point-trace] true x\n' }),
      }).reason,
    'not-honoured',
  );

  // classifyRow, every rung. Before this ladder was extracted it lived inside
  // main(), which no case can reach -- so PROBE-UNSAFE, its arm naming and the
  // RUNS-ON-IMPORT ordering would all have run for the first time in anger.
  // Each case asserts WHICH rung fired, not merely that something did: four
  // rungs can return a non-PASS verdict and a case asserting "not PASS" passes
  // for the wrong reason.
  const arm = (over = {}) => ({ marker: 'false', outcome: 'exited', exitCode: 0, ...over });
  const dispatched = (over = {}) =>
    arm({ marker: 'true', outcome: 'exited', exitCode: ENTRY_POINT_PROBE_EXIT, ...over });
  const row = (over = {}) => ({
    control: dispatched(),
    linked: dispatched(),
    imported: arm(),
    ...over,
  });
  const said = (over) => {
    const { verdict, unsafeArms } = classifyRow(row(over));
    return verdict + (unsafeArms.length ? ':' + unsafeArms.join('+') : '');
  };

  add('classifyRow: the ordinary all-good row', () => said({}), 'PASS');
  add('classifyRow: a timeout on any arm outranks everything', () => said({ linked: dispatched({ outcome: 'timeout' }) }), 'TIMEOUT');
  add('classifyRow: no marker by the canonical path is INCONCLUSIVE', () => said({ control: dispatched({ marker: null }) }), 'INCONCLUSIVE');
  add('classifyRow: canonical says imported -- measuring something else', () => said({ control: dispatched({ marker: 'false' }) }), 'INCONCLUSIVE');
  add('classifyRow: true canonically, false through the link, is FAIL-OPEN', () => said({ linked: dispatched({ marker: 'false', exitCode: 0 }) }), 'FAIL-OPEN');
  // The exit-code rung, per arm, and the arm is NAMED -- the half a first
  // version got wrong by always printing direct and link.
  add('classifyRow: direct exited 0 instead of 97 -- named, not guessed', () => said({ control: dispatched({ exitCode: 0 }) }), 'PROBE-UNSAFE:direct');
  add('classifyRow: the link arm alone, named alone', () => said({ linked: dispatched({ exitCode: 0 }) }), 'PROBE-UNSAFE:link');
  add('classifyRow: both dispatching arms, both named', () => said({ control: dispatched({ exitCode: 1 }), linked: dispatched({ exitCode: 1 }) }), 'PROBE-UNSAFE:direct+link');
  add('classifyRow: the grace timer expiring is PROBE-UNSAFE too', () => said({ control: dispatched({ outcome: 'probe-not-honoured', exitCode: null }) }), 'PROBE-UNSAFE:direct');
  // A false marker never arms the probe, so the import arm must NOT be held to
  // exit 97. Getting this wrong reds every row on every sweep.
  add('classifyRow: the import arm is not held to the probe exit code', () => said({ imported: arm({ exitCode: 0 }) }), 'PASS');
  // Ranked ABOVE probe health, deliberately: a true marker on import is the
  // worst finding here and is evidence whether or not the probe then stopped
  // the process. Ranked below, it was masked into "could not measure".
  add('classifyRow: RUNS-ON-IMPORT is not masked by an unhonoured probe', () => said({ imported: arm({ marker: 'true', outcome: 'probe-not-honoured', exitCode: null }) }), 'RUNS-ON-IMPORT');
  add('classifyRow: RUNS-ON-IMPORT on a clean row', () => said({ imported: arm({ marker: 'true', exitCode: ENTRY_POINT_PROBE_EXIT }) }), 'RUNS-ON-IMPORT');
  // ...but a TIMEOUT still outranks it: nothing was measured, so nothing is
  // being accused.
  add('classifyRow: a timeout still outranks a true import marker', () => said({ imported: arm({ marker: 'true', outcome: 'timeout' }) }), 'TIMEOUT');

  // The arming predicate. "0" and "false" are what somebody writes to turn the
  // switch OFF, and truthiness would arm it -- stopping every CLI in the repo.
  // Same values as isCiEnv above, because it is the same class, fixed here for
  // the fourth time.
  add(
    'probeArmed: only a real value arms the probe -- not "0", not "false"',
    () =>
      [undefined, '', 'false', '0', '1', 'true', 'yes'].map((v) => (probeArmed(v) ? 1 : 0)).join(''),
    '0000111',
  );
  // withTraceEnv restores the environment on `run` RETURNING, so an async case
  // would restore it too early and leak the probe into every later case. It
  // refuses instead of coping.
  add(
    'withTraceEnv: an async callback is refused, not silently mishandled',
    () => {
      try {
        withTraceEnv({ trace: '1', probe: undefined }, async () => true);
        return 'accepted';
      } catch (error) {
        return error.message.includes('must be synchronous') ? 'refused' : 'threw: ' + error.message;
      } finally {
        // Belt and braces: prove the refusal path still left nothing behind.
        if (process.env.ENTRY_POINT_PROBE !== undefined) delete process.env.ENTRY_POINT_PROBE;
      }
    },
    'refused',
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
      // Name the errno rather than asserting the reason. The label used to read
      // "(no link-creation rights here)" for every possible cause, which is how
      // a harness defect could present itself as a fact about the account.
      console.log('skip  ' + c.name + '  (cannot create links here: ' + [...skipReasons].join('/') + ')');
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
  // THE FLOOR. A skip is an honest answer on a workstation without link rights;
  // it is not one on a runner, where both GitHub images make symlinks and
  // junctions freely. Without this, the five junction cases -- the arm carrying
  // the defect this whole harness exists for -- could stop running in CI and the
  // suite would go on reporting PASS over a smaller set than it names.
  // A junction left on disk outranks a green case list: main() already exits 2
  // on it, and the two callers must not disagree about the same hazard. Exit 2
  // rather than 1 because it is infrastructure, not a contract violation.
  if (linkLeftBehind) {
    console.error(
      '\nCOULD NOT CLEAN UP -- a junction pointing at the repository root is still on disk ' +
        '(the path is in the error above). Remove it by hand with `cmd /c rmdir` (Windows) or ' +
        '`unlink` -- NEVER rm -rf -- before anything sweeps the temp directory.',
    );
    return 2;
  }
  if (skipped > 0 && isCiEnv(process.env.CI)) {
    console.error(
      '\nFAIL self-test -- ' +
        skipped +
        ' case(s) needing a junction/symlink were skipped (' +
        [...skipReasons].join('/') +
        '). Under CI that is not an acceptable answer: link creation works on both runner images, ' +
        'so this is the junction coverage silently leaving the run, not a fact about the account.',
    );
    return 1;
  }
  console.log(
    '\nPASS self-test -- ' +
      (cases.length - skipped) +
      ' of ' +
      cases.length +
      ' cases over isEntryPoint itself' +
      (skipped ? ' (' + skipped + ' skipped: ' + [...skipReasons].join('/') + ')' : '') +
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

  // Before ANY of the 75 arms: is the predicate on disk still stoppable? If not
  // the sweep has no safe way to run, and every target it touches from here
  // starts real work it will not finish. Cheaper to answer once, out loud.
  const preflight = probeSelfCheck();
  if (!preflight.ok) {
    console.error('Entry-point proof: cannot run -- the probe was not honoured on a trial target.');
    console.error('  reason: ' + preflight.reason + (preflight.detail ? '  (' + preflight.detail + ')' : ''));
    console.error(
      'Under ENTRY_POINT_PROBE, scripts/lib/entry-point.mjs must report its verdict and then end',
    );
    console.error(
      'the process with ' +
        ENTRY_POINT_PROBE_EXIT +
        '. Without that this harness would run each target\'s real work rather than',
    );
    console.error('stopping it at the dispatch, so it declines to spawn anything. Nothing was measured.');
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
  console.log('  probe: ENTRY_POINT_TRACE + ENTRY_POINT_PROBE, no arguments -- the predicate');
  console.log('         reports its verdict and then ends the process at the dispatch, so no');
  console.log('         target\'s main() is entered and no kill has to win a race to prevent it');
  console.log('');

  const rows = [];
  // DERIVED, not pinned. The literal 42 this replaces was already overrun by
  // scripts/mutate-workflow-artifact-policy.mjs (43) and the row added for
  // check-occurrence-delete-booking-safety.mjs (50) closed the gap entirely --
  // "...safety.mjsPASS", verdict glued to the filename in the one line an
  // operator reads. A width copied from the longest name at the time is the
  // same defect waiting for the next long name.
  const relWidth = Math.max(...TARGETS.map((t) => t.rel.length)) + 2;
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

      // BY INCLUSION, inside classifyRow: a dispatching arm must have ended
      // with the probe's OWN exit code. "It exited" is not evidence -- a module
      // that threw at import exits too, and this harness has already been wrong
      // once by accepting an outcome with several possible causes. 97 has
      // exactly one writer, on the line after the marker.
      const { verdict, unsafeArms } = classifyRow({ control, linked, imported });

      rows.push({ ...target, control, linked, imported, verdict, unsafeArms });
      const ok = verdict === 'PASS';
      console.log(
        (ok ? 'ok  ' : 'FAIL') +
          '  ' +
          target.rel.padEnd(relWidth) +
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
  const probeUnsafe = rows.filter((r) => r.verdict === 'PROBE-UNSAFE');
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
  if (timedOut.length > 0 || inconclusive.length > 0 || probeUnsafe.length > 0) {
    console.error(
      'Entry-point proof COULD NOT MEASURE ' +
        (timedOut.length + inconclusive.length + probeUnsafe.length) +
        ' of ' +
        rows.length +
        ' target(s). Do not read this as green.',
    );
    for (const r of timedOut) console.error('  ? ' + r.rel + '  timed out before it reported a verdict');
    for (const r of probeUnsafe) {
      // Name the arms that ACTUALLY failed, with their own exit codes. A first
      // version printed direct and link unconditionally, so a fault on the
      // import arm produced "direct exit 97, link exit 97, wanted 97" -- a
      // message asserting a contradiction and never naming the arm at fault.
      const armOf = { direct: r.control, link: r.linked, import: r.imported };
      const detail = r.unsafeArms
        .map((name) => name + ' exit ' + String(armOf[name].exitCode))
        .join(', ');
      console.error(
        '  ? ' +
          r.rel +
          '  reported the entry verdict but did NOT stop at it (' +
          detail +
          '; wanted ' +
          ENTRY_POINT_PROBE_EXIT +
          '). Its copy of scripts/lib/entry-point.mjs may predate ENTRY_POINT_PROBE. ' +
          'Until it honours the probe this harness cannot run it without starting its real work.',
      );
    }
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

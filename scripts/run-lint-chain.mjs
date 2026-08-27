/**
 * run-lint-chain.mjs -- the local lint tier, run to COMPLETION.
 *
 * NO SHEBANG, deliberately. This module is imported by tests/lintChain.test.ts,
 * and vite-node wraps an imported module body in a function before handing it to
 * node:vm -- a shebang inside that wrapper is a SyntaxError. pre-ship.mjs
 * carries the same note for the same reason. It is always invoked as
 * "node scripts/run-lint-chain.mjs" (via npm run lint), which needs no shebang.
 *
 * WHY THIS EXISTS
 *
 * "lint" used to be one shell `&&` chain: sixteen `npm run` links followed by a
 * bare `eslint .`. An `&&` chain stops dead at the first non-zero exit, so the
 * first red link hid every link behind it -- and these links are not independent
 * in the way that matters. Four of them are `:self-test` CANARIES sitting
 * immediately ahead of the check they prove. A canary that reds for its own
 * reasons therefore printed "this guard is broken" and the guard itself never
 * got to run and name the actual defect.
 *
 * That is not hypothetical. Of the four canaries in this chain, ALL FOUR have
 * held a live-subject assertion in a gating position; exactly one has been
 * closed (check:image-widths, #302, by deleting three cases that re-asserted
 * what the guard already contracts). The other three are still there today:
 * check:mojibake:self-test reads a tracked file under .claude/,
 * check:script-conventions:self-test scores the live source of
 * check-ci-budget.mjs, and check:workflow-artifact-policy:self-test fans out
 * over the real .github/workflows. Closing them one at a time costs a
 * both-directions proof each. This file removes the CAUSE instead -- every link
 * runs, every link gets its own verdict line, and no link can hide another, so
 * a future canary author no longer has to re-derive live-tree independence
 * before their canary is safe to pair. The three are still worth closing; they
 * are simply no longer load-bearing for whether their checks get to speak.
 *
 * WHAT IT DELIBERATELY DOES NOT DO
 *
 * It decides nothing about the links themselves. package.json remains the single
 * source of truth for what each id INVOKES; LINKS below owns only the order and
 * the membership, which is exactly what the `&&` string owned before it. And no
 * FAILURE aborts the run: there is no "this one is bad enough to stop on"
 * predicate, because such a predicate is a hand-maintained exception list and
 * this file exists to delete one of those, not add one. The loop breaks for
 * exactly one thing, and it is not a verdict: the operator's Ctrl-C. See
 * ABORT_SIGNALS.
 *
 * IT IS OUTSIDE check:script-conventions' R1-R5 CORPUS, and that is stated here
 * rather than left to be discovered. That guard selects on /^(check|lint)-.*\.mjs$/
 * under scripts/, which this filename does not match -- so only R6 (entry-point
 * realpath) reaches it. scripts/pre-ship.mjs, which decides the SHIP verdict, is
 * outside for exactly the same reason, so this is the established treatment of a
 * runner rather than a hole this file opened. What covers it instead:
 * tests/lintChain.test.ts drives every branch, and four mutants (short-circuit
 * reintroduced, tail folded into the verdict, classify excusing unknown codes,
 * canary moved behind its check) were each killed by it. Whether RUNNERS belong
 * in that corpus is a real question about two files, and it needs its own PR --
 * bringing one in costs an R4 allowlist row, because neither has an in-file
 * --self-test and both are tested from vitest instead.
 *
 * THE ESLINT TAIL IS NOT A GATE, AND NOW SAYS SO
 *
 * `eslint .` reports a few hundred pre-existing errors on a clean main, and NO
 * workflow runs it -- architecture-guard.yml runs lint:architecture, which is a
 * different script. So a red eslint has never meant "this branch broke
 * something", yet it made `npm run lint` exit non-zero on a clean tree, which
 * trained everyone to ignore the exit code of the whole tier. It now runs LAST,
 * reports [PASS] when clean and [WARN] when not, and gates nothing.
 * pre-ship.mjs's decideEslint already draws that line for the ship gate; this
 * draws the same one locally.
 *
 * It is SKIPPED once any link is red, and the ledger says so. Not a second
 * shape -- it was never a gate and decideExit still cannot see it -- but ~35s
 * and ~290 lines of eslint sitting between a failing guard's remediation line
 * and the prompt buried the one thing the operator needed under the one thing
 * this file has just finished calling informational.
 *
 * No error COUNT is printed here. eslint's own output is inherited and ends with
 * its own total; a second copy computed in this file is a number with no writer
 * maintaining it, and this repo has been bitten by exactly that four times.
 *
 * EXIT CODES (the R3 convention every guard in the chain already follows)
 *
 *   0  every link passed
 *   1  at least one link reported a contract violation
 *   2  no violation was REPORTED and at least one link could not answer --
 *      it could not run, it is not an npm script, or the run was interrupted.
 *      Also the code for an EMPTY links list, which must never read as a pass.
 *
 * Exit 2 is reported DISTINCTLY rather than collapsed into "failed": a guard
 * saying "I am broken" and a guard saying "the repo is broken" are different
 * facts and only one of them is about your diff. (pre-ship.mjs's runCheck still
 * collapses them -- that is a known, separately queued residual, not this file.)
 *
 * Note 2 is NOT "nothing is wrong, it merely went unmeasured", which is what
 * this said until review. bin/check-integrity.sh exits 2 when its own TS parse
 * helper is corrupt ON DISK -- a tracked file, and exactly the mount corruption
 * that apparatus exists to catch. Hence the headline word COULD NOT VOUCH.
 */

import { execSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { isEntryPoint } from "./lib/entry-point.mjs";
import { REPO_ROOT } from "./lib/review-scope.mjs";

// REPO_ROOT is IMPORTED, not re-derived. It was a third hand-rolled copy of the
// same expression (review-scope.mjs, pre-ship.mjs, here), and this is the copy
// that feeds `cwd` for every guard -- so a future change to how the root is
// resolved (realpath for junction safety, worktree handling) would have had
// three sites to find and would have broken the guards from the one it missed.
// tests/lintChain.test.ts already imported the shared one; the runner and its
// own test computing the root two different ways was the tell.

/**
 * The chain, in order. Each entry is an npm script name, so package.json stays
 * the single source of truth for what a link actually invokes.
 *
 * ORDER IS NOT DECORATION. Each `<id>:self-test` sits immediately ahead of the
 * `<id>` it proves, so a reader of the ledger sees the canary's verdict directly
 * above its check's. That adjacency used to be load-bearing (in an `&&` chain a
 * canary behind its check would never run when the check failed) and is now
 * merely legible, which is the point of this file.
 *
 * NO COUNT IS PINNED IN THIS COMMENT. pre-ship.mjs's CHECKS band comment has
 * gone stale twice, both times in the very commit that changed the number it
 * names, because a count copied into prose has no writer maintaining it. This
 * array IS the count; ask it, and the answer cannot be wrong:
 *
 *   node -e "import('./scripts/run-lint-chain.mjs').then(m => console.log(m.LINKS.length))"
 */
export const LINKS = [
  "check:integrity",
  "check:mojibake:self-test",
  "check:mojibake",
  "check:legacy-tables",
  "check:legacy-program-rpcs",
  "check:no-social-word",
  "lint:architecture",
  "check:route-boundaries",
  "check:image-widths:self-test",
  "check:image-widths",
  "check:rpc-typing",
  "check:script-conventions:self-test",
  "check:script-conventions",
  "check:wallclock-brand",
  "check:workflow-artifact-policy:self-test",
  "check:workflow-artifact-policy",
];

/**
 * The informational tail. Runs after every link, reports as [WARN], and does NOT
 * feed the exit code -- see the header. It is an npm script id like the others
 * so that "what does it invoke" still has exactly one answer, in package.json.
 */
export const TAIL = "lint:eslint";

/** Verdict words, and the tick each prints. Exported so the tests name them. */
export const PASS = "PASS";
export const FAIL = "FAIL";
export const BROKEN = "BROKEN";

/**
 * An exit code -> a verdict. The R3 convention across every guard in this chain
 * is 0 pass / 1 contract violated / 2 infrastructure.
 *
 * Anything ELSE -- 127 from a missing binary, a signal, npm's own 1 for an
 * unknown script -- is reported as FAIL rather than BROKEN, deliberately. The
 * safe direction for an unrecognised code is the one that blocks: a code this
 * function has never seen is not evidence that the repo is fine. The raw code is
 * printed beside the verdict either way, so an operator is never left guessing
 * which of the two a 127 was.
 */
export function classify(code) {
  if (code === 0) return PASS;
  if (code === 2) return BROKEN;
  return FAIL;
}

/**
 * The tier's exit code, from the links' results. The eslint tail is NOT an
 * input: there is no parameter for it and main() does not pass one.
 *
 * That is a fact about today's signature, not a guarantee about tomorrow's --
 * a later `decideExit(results, tail = null)` would compile, and would even keep
 * Function.length at 1, so the arity case in tests/lintChain.test.ts would not
 * see it. What catches the wiring is the behavioural case: every link green
 * plus a red tail must still be a PASS.
 *
 * A violation outranks a guard that could not run: if anything reported a real
 * contract violation, that is the fact the operator needs and 1 is the code that
 * says it. 2 means this tier cannot VOUCH for the tree.
 *
 * "2 means nothing was violated" is what this said until review, and it is
 * false for link 1: bin/check-integrity.sh exits 2 when the guard's own TS parse
 * helper is corrupt on disk (:77) -- a tracked file, and precisely the mount
 * corruption the integrity apparatus exists to catch. So 2 is not "all clear,
 * merely unmeasured". It is "no violation was REPORTED and at least one link
 * could not answer", which is a weaker and honest claim, and it is why the
 * headline word is COULD NOT VOUCH rather than PASSED.
 *
 * An EMPTY result set is 2, not 0. A links list that is empty or truncated --
 * a bad merge, a future --only flag, an array built from a read that failed --
 * would otherwise print "lint PASSED" having executed no guard whatsoever. This
 * repo has been bitten by unknowns recorded as an extreme failing open before;
 * block by inclusion. What catches a PARTIALLY truncated list is the prefix
 * equality against pre-ship's CHECKS in tests/reviewScope.test.ts, deliberately
 * there rather than here, because a floor pinned as a NUMBER in this file would
 * be the second copy of a count that LINKS already owns.
 */
export function decideExit(results) {
  if (!results.length) return 2;
  if (results.some((r) => classify(r.code) === FAIL)) return 1;
  if (results.some((r) => classify(r.code) === BROKEN)) return 2;
  return 0;
}

/**
 * The summary block, as lines. Pure, so the tests can read a ledger without
 * running a hundred and thirty seconds of guards.
 *
 * `tail` is {code}, {skipped: reason}, or null when there is no tail at all. It
 * never gets a [FAIL] line, because it is not a gate here -- see the header.
 * A GREEN tail prints [PASS], not [WARN]: labelling a clean eslint with a
 * warning tick, over two lines explaining a redness that no longer exists,
 * trains the reader to ignore [WARN] -- the same habituation this file removed
 * from the exit code.
 */
export function ledger(results, tail = null, aborted = null) {
  const out = [""];
  out.push("-- lint chain summary --");
  for (const r of results) {
    const verdict = classify(r.code);
    out.push("   [" + verdict + "] " + r.id + (verdict === PASS ? "" : " -- exit " + r.code));
  }
  if (tail && tail.skipped) {
    out.push("   [SKIP] " + TAIL + " -- " + tail.skipped);
  } else if (tail && tail.code === 0) {
    out.push("   [PASS] " + TAIL + " -- informational, not a gate here.");
  } else if (tail) {
    out.push("   [WARN] " + TAIL + " -- exit " + tail.code + ", INFORMATIONAL, not a gate here.");
    out.push("           Whole-tree eslint is red on main and no workflow runs it.");
    out.push("           pre-ship's scoped ratchet is what actually gates eslint.");
  }
  if (aborted) {
    out.push("   [STOP] run INTERRUPTED (" + aborted + ") -- the links below never ran.");
  }
  const bad = results.filter((r) => classify(r.code) !== PASS);
  const code = decideExit(results);
  out.push("");
  if (!results.length) {
    out.push("lint COULD NOT VOUCH -- NO LINKS RAN. The links list was empty, so this");
    out.push("   tier executed no guard at all and cannot say anything about the tree.");
  } else if (code === 0) {
    out.push("lint PASSED -- " + results.length + " of " + results.length + " links green");
  } else {
    // The headline word tracks the CODE, not merely "something was not green".
    // "FAILED" over a tier whose only non-green link said "I could not run" is
    // the collapse this file refuses to make everywhere else, and the summary
    // line is the part most people read.
    const word = code === 2 ? "COULD NOT VOUCH" : "FAILED";
    out.push("lint " + word + " -- " + bad.length + " of " + results.length + " links not green:");
    for (const r of bad) out.push("   " + classify(r.code) + "  " + r.id + " (exit " + r.code + ")");
  }
  out.push("");
  return out;
}

/**
 * Run one npm script, inheriting stdio, and return {code, signal}.
 *
 * `signal` is what lets an operator's Ctrl-C stop the tier -- see main(). It is
 * reported separately rather than folded into the code because a child killed by
 * a signal has `status: null`, which is indistinguishable from a spawn failure
 * once the signal is discarded.
 *
 * `exec` is injectable for the same single reason pre-ship.mjs's runCheck is:
 * so a test can prove the loop keeps going past a red without spending two
 * minutes of real guards to do it. `write` is injectable so those cases do not
 * have to print sixteen fake links apiece to make their point.
 *
 * execSync goes through a shell, so `npm` resolves to npm.cmd on Windows and
 * npm on POSIX. Every id is a fixed literal from LINKS -- there is no injection
 * surface here and no user input reaches this string.
 *
 * A thrown error with no numeric `status` (a signal, a spawn failure) becomes 2,
 * not 1: we could not run it, which is precisely what 2 means.
 */
export function runLink(id, exec = execSync, write = (s) => process.stdout.write(s)) {
  write("\n> lint: " + id + "\n");
  try {
    exec("npm run --silent " + id, { cwd: REPO_ROOT, stdio: "inherit" });
    return { code: 0, signal: null };
  } catch (err) {
    return {
      code: typeof err?.status === "number" ? err.status : 2,
      signal: typeof err?.signal === "string" ? err.signal : null,
    };
  }
}

/**
 * Signals that mean "the operator asked for this to stop", as opposed to a guard
 * being killed by something else.
 *
 * This is NOT the abort predicate the design deliberately refused. That one was
 * "this FAILURE is bad enough to stop on" -- a hand-maintained list of guards,
 * which rots. This is "the human pressed Ctrl-C", which is about no guard at all.
 *
 * It is needed because main() is synchronous: execSync never yields the event
 * loop, so node cannot process its own pending SIGINT until main() returns. Left
 * unhandled, one Ctrl-C killed only the current child and the loop spawned the
 * next link -- seventeen interrupts to stop a three-minute run, where the old &&
 * chain needed one.
 */
const ABORT_SIGNALS = new Set(["SIGINT", "SIGTERM"]);

/**
 * The ids in `ids` that are not npm scripts at all.
 *
 * This exists because of what `npm run --silent <missing>` does: it prints
 * NOTHING and exits 1. Measured in this tree. WITHOUT --silent npm says
 * "Missing script: ...", so the old && chain surfaced it; the runner passes
 * --silent (it prints its own `> lint: <id>` header and does not want npm's
 * banner sixteen times over) and would therefore have turned a renamed or
 * deleted script into `[FAIL] check:rpc-typing (exit 1)` with no explanation
 * anywhere in the output -- a guard that had silently stopped running, reported
 * as a contract violation. A missing script is INFRASTRUCTURE: it is caught here,
 * before exec, and reported as BROKEN with the reason named.
 */
export function missingScripts(ids, scripts) {
  return ids.filter((id) => !Object.hasOwn(scripts, id));
}

/** package.json's scripts map. Injectable so the tests need no fixture on disk. */
export function readScripts(root = REPO_ROOT) {
  return JSON.parse(fs.readFileSync(path.join(root, "package.json"), "utf8")).scripts || {};
}

/**
 * Run the whole tier and return the process exit code.
 *
 * The loop breaks for EXACTLY ONE reason: the operator interrupted it. No
 * failure of any link stops it and none ever may -- the whole reason this file
 * replaced an `&&` chain is that stopping on a red is what let a canary silence
 * the check behind it. A link that is not an npm script is REPORTED without
 * being run, and the loop carries on past it.
 */
export function main({
  links = LINKS,
  tail = TAIL,
  exec = execSync,
  write = (s) => process.stdout.write(s),
  scripts = readScripts(),
} = {}) {
  const absent = new Set(missingScripts([...links, ...(tail ? [tail] : [])], scripts));
  const results = [];
  let aborted = null;

  for (const id of links) {
    if (absent.has(id)) {
      // Reported, never run. See missingScripts for why --silent makes this
      // otherwise indistinguishable from a contract violation.
      write("\n> lint: " + id + "\n");
      write("   NOT AN NPM SCRIPT -- package.json has no script by this name.\n");
      write("   This guard is NOT RUNNING. Fix LINKS, or restore the script.\n");
      results.push({ id, code: 2 });
      continue;
    }
    const { code, signal } = runLink(id, exec, write);
    results.push({ id, code });
    if (signal && ABORT_SIGNALS.has(signal)) {
      aborted = signal;
      break;
    }
  }

  // The tail runs only when every link is green. It is ~35s and ~290 lines, and
  // with a link red all of that landed BETWEEN the failing guard's remediation
  // line and the prompt -- burying the one thing the operator needs under the
  // one thing this file has just declared is not a gate. This is not a second
  // shape: the tail was never a gate, decideExit still cannot see it, and the
  // ledger prints [SKIP] with the reason rather than going quiet.
  let tailResult = null;
  if (tail && aborted) {
    tailResult = { skipped: "run interrupted (" + aborted + ")" };
  } else if (tail && absent.has(tail)) {
    tailResult = { skipped: "package.json has no script by that name" };
  } else if (tail && decideExit(results) !== 0) {
    tailResult = { skipped: "a link above is not green -- read that, not the eslint backlog" };
  } else if (tail) {
    tailResult = { code: runLink(tail, exec, write).code };
  }

  write(ledger(results, tailResult, aborted).join("\n"));
  return decideExit(results);
}

// Realpath-to-realpath (scripts/lib/entry-point.mjs), never a hand-rolled
// import.meta.url === process.argv[1] compare: Node realpaths one side and not
// the other, so invoked through a junction the whole tier would print nothing
// and exit 0, which reads as a pass. That is R6, and it is enforced.
//
// process.exitCode, never process.exit(): process.exit() truncates stdout on
// Windows, and the ledger is the last thing written.
if (isEntryPoint(import.meta.url)) {
  process.exitCode = main();
}

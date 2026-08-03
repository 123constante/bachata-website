/**
 * pre-ship.mjs -- the Website ship gate: ONE command that reproduces the PR
 * gate locally and prints an honest ledger of what ran, what was skipped, and
 * why.
 *
 * NO SHEBANG, deliberately. vite-node wraps an imported module body in a
 * function before handing it to node:vm, and a shebang inside that wrapper is a
 * SyntaxError -- so a shebang here would make this file unimportable and the
 * decideSmoke / CHECKS tests impossible to write. It is always invoked as
 * "node scripts/pre-ship.mjs" (via npm run pre-ship), which needs no shebang.
 *
 * Ported from the admin repo's pre-ship with three Website differences:
 *
 *   1. The lint chain is decomposed. "npm run lint" is a nine-deep && chain, so
 *      the first failure hides the other eight. Here each link is its own entry
 *      with its own tick, and ALL of them run.
 *
 *   2. typecheck and test:unit ARE run here. Admin drops them because its
 *      pre-commit runs tsc and its pre-push runs test:unit; this repo's
 *      pre-commit only runs the integrity scan, so nothing else would catch
 *      them before CI. (Note: the typecheck script is
 *      "react-router typegen && tsc -p tsconfig.app.json --noEmit" -- a bare
 *      "npx tsc --noEmit" reads a different tsconfig and is a known false-green
 *      in this repo, so always go through the npm script.)
 *
 *   3. Scope drift is a first-class check. See scopeDrift() in
 *      lib/review-scope.mjs for why.
 *
 * The smoke E2E runs ONLY IF this ship's diff touches app code. A docs- or
 * scripts-only ship skips the browser gate. If the diff CANNOT be computed the
 * smoke RUNS: never skip a safety gate on uncertainty.
 *
 * QUIET REPORTERS. vitest and playwright are invoked with dot/line reporters
 * here and only here -- package.json scripts and CI workflows stay verbose,
 * because CI wants the detail and a local gate does not.
 *
 * Exit 0 iff every repo-only check passed AND (smoke skipped OR smoke passed)
 * AND scope drift is not a hard error. Never process.exit() mid-flight (the
 * Windows libuv keep-alive quirk); sets process.exitCode.
 *
 * Flags:
 *   --dry-run   print the plan (which checks would run, the smoke decision, the
 *               scope-drift verdict) WITHOUT executing anything. The exit code
 *               then reflects the scope-drift verdict only.
 */

import { execFileSync, execSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import fs from "node:fs";
import path from "node:path";
import {
  resolveBaseRef,
  resolveDeclaredScope,
  scopeDrift,
  shipFiles,
  toPosix,
} from "./lib/review-scope.mjs";
import { plansDir } from "./check-plan-hygiene.mjs";

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

/**
 * Repo-only checks, in order. Each is an npm script name so package.json stays
 * the single source of truth for what a check actually invokes; `args` is
 * appended after `--` and exists only to make a reporter quiet.
 *
 * The first TEN are exactly the links of the "lint" chain, decomposed, in the
 * chain's own order -- tests/reviewScope.test.ts enforces set membership, so
 * this comment is the only thing marking where the chain prefix ends and the
 * non-chain entries (check:plan-hygiene, test:unit, ...) begin. Keep the count
 * accurate when adding a link, or the next editor inserts into the wrong band.
 */
export const CHECKS = [
  ["check:integrity", "source integrity (null-byte / truncation scan)"],
  ["check:mojibake", "cp1252 mojibake scan"],
  ["check:legacy-tables", "no references to retired tables"],
  ["check:legacy-program-rpcs", "no references to retired program RPCs"],
  ["check:no-social-word", "banned-copy scan"],
  ["lint:architecture", "runtime architecture lint"],
  ["check:route-boundaries", "every route has an error boundary"],
  ["check:image-widths", "no /_vercel/image width or quality vercel.json would 400"],
  ["check:rpc-typing", "no rpc(x as never) escapes"],
  ["check:wallclock-brand", "wall-clock branded-boundary contract"],
  // Not a lint-chain link: the plan layer lives outside the repo (the home
  // plans dir), so it has no place in "npm run lint" and SKIPs in CI. It sits
  // here because the ship gate is the one place a local tree is guaranteed to
  // have that directory. It also RE-RENDERS PLANS-INDEX.md on a passing lint.
  ["check:plan-hygiene", "arc-plan frontmatter + arc-state cross-check (lint-only)"],
  ["test:unit", "vitest unit + contract suite", ["--reporter=dot"]],
];

/**
 * Per-check SKIP predicates, decided by pre-ship BEFORE running the check so
 * the ledger can print an honest [SKIP] instead of a [PASS] that verified
 * nothing (review finding 5). Returns a reason string to skip, or null to run.
 *
 * plan-hygiene: its target is the HOME plans dir, which does not exist on a
 * fresh clone, a container, or CI. The check itself also fail-opens there, but
 * routing the decision through pre-ship keeps the ledger truthful; the vitest
 * suite (tests/planHygiene.test.ts) still covers the rules on such machines.
 */
export const CHECK_SKIPS = {
  "check:plan-hygiene": () => {
    const dir = plansDir();
    return fs.existsSync(dir) ? null : "no plans dir at " + dir + " -- nothing to lint on this machine";
  },
};

/**
 * typecheck is a COUNT RATCHET, for the same reason eslint is a file ratchet:
 * origin/main carries 107 tsc errors as of 2026-07-30, so a pass/fail gate
 * could never go green and would only teach you to bypass it.
 *
 * Instead the gate pins the count. Below or at the baseline is green; ABOVE it
 * is red, which is exactly "this ship introduced a new type error". When the
 * count drops, the ledger says so and asks you to lower the baseline, so the
 * ratchet tightens instead of quietly banking slack.
 *
 * tsc cannot be scoped to a file list the way eslint can -- the type graph is
 * project-wide -- so counting is the only honest scoping available.
 */
export const TYPECHECK_BASELINE = 107;

const TSC_FILE_ERROR = /^[^\s(].*\([0-9]+,[0-9]+\): error TS[0-9]+/gm;
const TSC_ANY_ERROR = /error TS[0-9]+/g;

/** Count the "file(line,col): error TSxxxx" diagnostics in tsc output. */
export function countTscErrors(output) {
  return (String(output).match(TSC_FILE_ERROR) || []).length;
}

/**
 * Did tsc fail BEFORE it compiled anything? Config-level failures -- TS5083
 * "Cannot read file tsconfig.app.json", TS18003 "No inputs were found",
 * TS6053 -- are emitted with no file(line,col) anchor, so countTscErrors sees
 * ZERO of them.
 *
 * That was a fail-OPEN, and a self-destroying one: renaming tsconfig.app.json
 * made the count 0, decideTypecheck reported "0 errors, below the baseline of
 * 107" -- a PASS -- and then actively instructed the operator to set the
 * baseline to 0, permanently disarming the ratchet. Any TSxxxx that is not an
 * anchored diagnostic means tsc never got to the code.
 */
export function hasConfigLevelTscError(output) {
  const text = String(output);
  const all = (text.match(TSC_ANY_ERROR) || []).length;
  return all > countTscErrors(text);
}

/**
 * Pure typecheck verdict. `ran` false means tsc could not be run at all, and a
 * config-level error means it never reached the code; neither may read as
 * green.
 */
export function decideTypecheck({
  count = null,
  baseline = TYPECHECK_BASELINE,
  ran = true,
  configError = false,
} = {}) {
  if (!ran || count === null) {
    return { ok: false, count: null, reason: "tsc did not produce parseable output -- treating as a failure" };
  }
  if (configError) {
    return {
      ok: false,
      count,
      reason: "tsc reported a CONFIG-level error (it never compiled the code) -- the count is meaningless",
    };
  }
  if (count > baseline) {
    return {
      ok: false,
      count,
      reason: count + " errors vs a baseline of " + baseline + " -- this ship ADDED " + (count - baseline),
    };
  }
  if (count < baseline) {
    return {
      ok: true,
      count,
      reason: count + " errors, below the baseline of " + baseline + " -- lower TYPECHECK_BASELINE to " + count,
    };
  }
  return { ok: true, count, reason: count + " errors, exactly the baseline (no new type errors)" };
}

/**
 * eslint is a RATCHET, not a whole-tree gate, and that is a deliberate call.
 *
 * As of 2026-07-30 origin/main carries 189 pre-existing eslint errors and NO CI
 * workflow runs eslint at all (architecture-guard.yml runs the individual
 * check:* scripts and lint:architecture). A gate that is red on a clean
 * checkout is not a gate -- it teaches you to pass --no-verify, and then it
 * guards nothing. So pre-ship lints only the files THIS ship touches: clean
 * today, and it blocks the moment you introduce a new error.
 *
 * PRE_SHIP_ESLINT_ALL=1 runs the whole tree when you want the full picture.
 *
 * SCOPE CAVEAT, so the ledger is not read as more coverage than it has:
 * eslint.config.js declares its files glob as ts/tsx only, so a .mjs / .js /
 * .cjs file is linted with NO rules and always passes. The other extensions
 * stay in the list below so widening the eslint config later needs no change
 * here, but today the ratchet bites on .ts and .tsx only.
 */
export const ESLINT_EXTS = [".ts", ".tsx", ".js", ".jsx", ".mjs", ".cjs"];

/** Pure eslint decision, so both directions are testable without running it. */
export function decideEslint({ files = [], all = false, diffError = null, exists = fs.existsSync } = {}) {
  // Whole-tree mode is ADVISORY (blocking:false). It reports 189 errors on a
  // pristine main, so as a hard fail it could only ever say FAILED -- and worse,
  // its failure fed the same anyFailed that gates the smoke E2E, so the flag
  // documented as "when you want the full picture" silently switched the
  // browser gate OFF. Informational is what it actually is.
  if (all) {
    return { mode: "all", blocking: false, files: [], reason: "PRE_SHIP_ESLINT_ALL=1 -- whole tree, informational" };
  }
  if (diffError) {
    return {
      mode: "all",
      blocking: false,
      files: [],
      reason: "diff unavailable -- whole tree, informational (the ship's own files could not be identified)",
    };
  }
  const lintable = files
    .map(toPosix)
    .filter((f) => ESLINT_EXTS.some((e) => f.endsWith(e)))
    .filter((f) => exists(path.join(REPO_ROOT, f)));
  if (!lintable.length) {
    return { mode: "skip", blocking: false, files: [], ruleCovered: 0, reason: "no lintable files in this ship" };
  }
  // Only .ts/.tsx are actually rule-checked (see the SCOPE CAVEAT above), so
  // say so in the reason -- the ledger must not show a green tick over files
  // that were linted with no rules at all.
  const ruleCovered = lintable.filter((f) => f.endsWith(".ts") || f.endsWith(".tsx")).length;
  return {
    mode: "scoped",
    blocking: true,
    files: lintable,
    ruleCovered,
    reason:
      lintable.length + " file(s) in this ship, " + ruleCovered + " of them rule-covered (.ts/.tsx only)",
  };
}

/** A changed path matching any of these means the smoke E2E must run. */
export const APP_PATHS = [
  /^(src|api|server|public|tests\/e2e)\//,
  /^index\.html$/,
  /^vite\.config/,
  /^react-router\.config/,
  /^package(-lock)?\.json$/,
  /^playwright\.config/,
  // Build/style/type config that changes what actually ships. Editing any of
  // these can break every page while touching no file under src/, and the
  // first cut skipped the browser gate on all of them.
  /^tailwind\.config/,
  /^postcss\.config/,
  /^tsconfig[^/]*\.json$/,
  /^eslint\.config/,
  /^\.env($|\.)/,
];

// --workers=1 is LOCAL DETERMINISM, not a CI setting: e2e-smoke.yml runs the same
// spec list at Playwright's default parallelism and is green there. On one dev
// machine the default reddened dancer-dashboard-concept-b-smoke reproducibly
// (measured 2026-08-03: two consecutive pre-ship runs failed it at ~55.5s, the
// spec passed alone in 46.4s, and the full list passed 6/6 at --workers=1) --
// contention, not a defect in the spec or the diff under test. A ship gate that
// reds on how busy the machine is trains the operator to push past it, which is
// the one thing this gate cannot afford; it is the same alarm-fatigue class as
// the clock-sensitive check-search-public-v5 window. Serial costs NOTHING here --
// measured on the same machine, the parallel run took 1.6 min and failed, serial
// takes 35.7s and passes 6/6, because the contention was buying nothing. CI is
// untouched either way: only pre-ship passes these args.
export const SMOKE = ["test:e2e", "playwright smoke specs", ["--reporter=line", "--workers=1"]];

/**
 * The smoke decision, pure so both directions are unit-testable without a
 * browser. `diffError` is the message from a failed diff computation, or null.
 */
export function decideSmoke({ files = [], base = "(unknown)", anyFailed = false, diffError = null }) {
  if (diffError) {
    return {
      ran: true,
      reason: "could not compute the diff (" + diffError + ") -- running smoke to be safe",
    };
  }
  const appTouched = files.some((f) => APP_PATHS.some((re) => re.test(toPosix(f))));
  if (!appTouched) {
    return { ran: false, reason: "no app code in this ship's diff (vs " + base + ")" };
  }
  if (anyFailed) {
    return { ran: false, reason: "repo-only checks failed -- fix those before the browser gate runs" };
  }
  return { ran: true, reason: "app code in this ship's diff (vs " + base + ")" };
}

/** Run eslint over an explicit file list, bypassing the shell entirely so a
 *  path with a space cannot be split. Returns true on exit 0. */
function runEslintScoped(files) {
  process.stdout.write("\n> pre-ship: eslint (" + files.length + " file(s) in this ship)\n");
  try {
    execFileSync(process.execPath, [path.join(REPO_ROOT, "node_modules", "eslint", "bin", "eslint.js"), ...files], {
      cwd: REPO_ROOT,
      stdio: "inherit",
    });
    return true;
  } catch {
    return false;
  }
}

/** Run typecheck, CAPTURING output so the error count can be parsed. tsc exits
 *  non-zero when it reports errors, so a throw is the normal path here -- the
 *  count, not the exit code, is the verdict. Returns null if tsc never ran. */
function runTypecheck() {
  process.stdout.write("\n> pre-ship: typecheck (count ratchet)\n");
  const capture = (err) => {
    const out = err && (err.stdout || err.output);
    return Array.isArray(out) ? out.filter(Boolean).join("") : String(out || "");
  };
  const read = (text) => ({ count: countTscErrors(text), configError: hasConfigLevelTscError(text) });
  try {
    return read(execSync("npm run --silent typecheck", { cwd: REPO_ROOT, encoding: "utf8", stdio: "pipe" }));
  } catch (err) {
    const text = capture(err);
    // Distinguish "tsc ran and reported errors" from "tsc could not start".
    // The second must not read as a clean zero-error run, which would fail OPEN.
    if (!/error TS[0-9]+/.test(text)) return null;
    return read(text);
  }
}

/** Run an npm script, inheriting stdio. Returns true on exit 0. */
function runCheck(id, args = []) {
  process.stdout.write("\n> pre-ship: " + id + "\n");
  try {
    // execSync uses a shell, so `npm` resolves to npm.cmd on Windows and npm on
    // POSIX. `id` and `args` are fixed literals from CHECKS -- no injection surface.
    const suffix = args.length ? " -- " + args.join(" ") : "";
    execSync("npm run --silent " + id + suffix, { cwd: REPO_ROOT, stdio: "inherit" });
    return true;
  } catch {
    return false;
  }
}

/**
 * Every repo-relative path in THIS ship. Delegates to the library's shipFiles
 * rather than re-deriving it.
 *
 * The first cut hand-rolled the same git plumbing here and, in doing so,
 * dropped unquoteGitPath -- stripping the wrapping quotes but never decoding
 * the C-escapes. core.quotepath=false only suppresses quoting for non-ASCII
 * bytes; git still C-quotes any path containing a quote, backslash or control
 * char, so such a file resolved to a name that does not exist on disk, the
 * exists() filter dropped it, and it was never linted. review-scope.mjs
 * documents that exact bug as having "reported GREEN on unreviewed content".
 * Two copies of a scope predicate is one copy too many.
 */
function changedFiles() {
  const base = resolveBaseRef();
  return { base, files: shipFiles(base) };
}

function main(argv = process.argv.slice(2)) {
  const dryRun = argv.includes("--dry-run");
  const strictScope = process.env.PRE_SHIP_STRICT_SCOPE === "1";

  // -- what is in this ship ---------------------------------------------------
  let base = "(unknown)";
  let files = [];
  let diffError = null;
  try {
    const cf = changedFiles();
    base = cf.base;
    files = cf.files;
  } catch (err) {
    diffError = String((err && err.message) || err);
  }

  // -- scope drift ------------------------------------------------------------
  const declaration = resolveDeclaredScope();
  const drift = diffError
    ? { ok: true, mode: "unknown", severity: "none", foreign: [], reason: "diff unavailable -- not judged" }
    : declaration.status === "corrupt"
      ? {
          // A garbled declaration must NOT quietly become "declared nothing".
          // Silently dropping to the advisory heuristic is indistinguishable
          // from a ship that never declared a scope at all.
          ok: false,
          mode: "declared",
          severity: "error",
          foreign: [],
          reason: ".claude/arc-state.json is present but unreadable/not JSON -- the declaration cannot be trusted",
        }
      : scopeDrift(files, { declared: declaration.scope });
  // A declared scope is an explicit promise, so breaking it is fatal. An
  // INFERRED verdict is a heuristic and only warns unless asked to be strict --
  // a guard that reds a legitimate ship gets ignored, and then it guards nothing.
  const driftFatal = !drift.ok && (drift.severity === "error" || strictScope);

  // -- repo-only checks -------------------------------------------------------
  const results = [];
  if (!dryRun) {
    for (const [id, label, args] of CHECKS) {
      const skipReason = CHECK_SKIPS[id] ? CHECK_SKIPS[id]() : null;
      if (skipReason) {
        console.log("SKIP " + id + " -- " + skipReason);
        results.push({ id, label, ok: true, skipped: true, skipReason });
      } else {
        results.push({ id, label, ok: runCheck(id, args || []) });
      }
    }
  }

  // -- typecheck (count ratchet) ----------------------------------------------
  const tscRun = dryRun ? null : runTypecheck();
  const tsc = dryRun
    ? null
    : decideTypecheck({ count: tscRun && tscRun.count, configError: !!(tscRun && tscRun.configError) });

  // -- eslint (ship-scoped ratchet) -------------------------------------------
  const eslintPlan = decideEslint({ files, all: process.env.PRE_SHIP_ESLINT_ALL === "1", diffError });
  let eslintOk = null;
  if (!dryRun && eslintPlan.mode === "scoped") eslintOk = runEslintScoped(eslintPlan.files);
  if (!dryRun && eslintPlan.mode === "all") eslintOk = runCheck("lint:eslint");

  const eslintFailed = eslintOk === false && eslintPlan.blocking;
  const anyFailed = results.some((r) => !r.ok) || eslintFailed || (tsc !== null && !tsc.ok);

  // -- smoke ------------------------------------------------------------------
  const smokeDecision = decideSmoke({ files, base, anyFailed, diffError });
  let smokeOk = null;
  if (!dryRun && smokeDecision.ran) smokeOk = runCheck(SMOKE[0], SMOKE[2]);

  // -- ledger -----------------------------------------------------------------
  const out = [];
  out.push("");
  out.push("-- pre-ship summary" + (dryRun ? " (DRY RUN -- nothing executed)" : "") + " --");
  out.push("   base ref: " + base + "   files in ship: " + (diffError ? "(unknown)" : files.length));
  if (dryRun) {
    for (const [id, label] of CHECKS) out.push("   -  " + id + " -- WOULD RUN: " + label);
  } else {
    for (const r of results) {
      if (r.skipped) out.push("   [SKIP] " + r.id + " -- SKIPPED: " + r.skipReason);
      else out.push("   " + (r.ok ? "[PASS]" : "[FAIL]") + " " + r.id + " -- " + r.label);
    }
  }
  if (dryRun) {
    out.push("   -  typecheck -- WOULD RUN: count ratchet against a baseline of " + TYPECHECK_BASELINE);
  } else {
    out.push("   " + (tsc.ok ? "[PASS]" : "[FAIL]") + " typecheck (count ratchet) -- " + tsc.reason);
  }
  if (eslintPlan.mode === "skip") {
    out.push("   [SKIP] eslint -- SKIPPED: " + eslintPlan.reason);
  } else {
    const tick = eslintOk ? "[PASS]" : eslintPlan.blocking ? "[FAIL]" : "[WARN]";
    const mark = dryRun ? "   -  " : "   " + tick + " ";
    out.push(
      mark + "eslint (" + eslintPlan.mode + ") -- " + (dryRun ? "WOULD RUN" : "RAN") + ": " + eslintPlan.reason
    );
    if (eslintPlan.mode === "scoped") {
      out.push("           whole-tree eslint is NOT a gate here (189 pre-existing errors on main,");
      out.push("           no CI enforcement). PRE_SHIP_ESLINT_ALL=1 for the full picture.");
      if (eslintPlan.ruleCovered < eslintPlan.files.length) {
        out.push(
          "           " +
            (eslintPlan.files.length - eslintPlan.ruleCovered) +
            " file(s) here have NO eslint rules at all (the config globs ts/tsx only)."
        );
      }
    } else {
      out.push("           informational -- whole-tree mode does not gate the ship.");
    }
  }
  if (smokeDecision.ran) {
    const mark = dryRun ? "   -  " : "   " + (smokeOk ? "[PASS]" : "[FAIL]") + " ";
    out.push(mark + SMOKE[0] + " -- " + (dryRun ? "WOULD RUN" : "RAN") + ": " + smokeDecision.reason);
  } else {
    out.push("   [SKIP] " + SMOKE[0] + " -- SKIPPED: " + smokeDecision.reason);
  }

  const driftMark = drift.ok ? "[PASS]" : driftFatal ? "[FAIL]" : "[WARN]";
  out.push("   " + driftMark + " scope-drift (" + drift.mode + ") -- " + drift.reason);
  for (const f of drift.foreign) out.push("           unrelated to this ship: " + f.path + "  (" + f.surface + ")");
  if (!drift.ok && !driftFatal) {
    out.push("           advisory only. Set PRE_SHIP_STRICT_SCOPE=1 to make it block,");
    out.push("           or declare a scope array in .claude/arc-state.json to make it exact.");
  }
  if (!drift.ok && driftFatal) {
    out.push("           uncommitted work follows the WORKTREE, not the branch it was authored");
    out.push("           on. Move these files off this ship (git restore --staged / stash) or");
    out.push("           widen the declared scope if they genuinely belong here.");
  }

  const ok = dryRun ? !driftFatal : !anyFailed && smokeOk !== false && !driftFatal;
  out.push("");
  out.push(ok ? "pre-ship PASSED" : "pre-ship FAILED");
  if (dryRun) out.push("(dry run: no checks executed; the exit code reflects the scope-drift verdict only)");
  out.push("");
  process.stdout.write(out.join("\n"));

  process.exitCode = ok ? 0 : 1;
}

const invokedDirectly =
  process.argv[1] && path.resolve(process.argv[1]) === path.resolve(fileURLToPath(import.meta.url));
if (invokedDirectly) main();

export { main };

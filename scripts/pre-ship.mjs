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
 *   1. The lint chain is decomposed. "npm run lint" is a single && chain, so the
 *      first failure hides every link after it. Here each link is its own entry
 *      with its own tick, and ALL of them run. Deliberately NO count in this
 *      paragraph: the band comment on CHECKS below is the ONE place that number
 *      is maintained, and this second copy of it went stale exactly as a second
 *      copy always does -- it still read "nine-deep" at thirteen links.
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
import { isEntryPoint } from "./lib/entry-point.mjs";
import fs from "node:fs";
import path from "node:path";
import {
  diffOrigin,
  renamePairs,
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
 * The first SIXTEEN are exactly the npm-run links of the "lint" chain (which
 * also ends in a bare `eslint .`, run by the chain and not listed here),
 * decomposed, in the chain's own order -- tests/reviewScope.test.ts enforces set
 * membership, so this comment is the only thing marking where the chain prefix
 * ends and the non-chain entries (check:plan-hygiene, test:unit, ...) begin.
 * Keep the count accurate when adding a link, or the next editor inserts into
 * the wrong band. It said TEN in the same edit that added check:image-widths and
 * made the count load-bearing, which would have put the next new link above
 * check:wallclock-brand and outside the band it describes (review finding).
 */
export const CHECKS = [
  ["check:integrity", "source integrity (null-byte / control-byte / truncation scan)"],
  // Canary BEFORE the check, same reason as check:script-conventions below.
  // The regex half is the easy half and check-mojibake.mjs already has a
  // positive control for it; the canary's substance is SCOPE -- that ROOTS
  // still contains .claude, that collectFiles actually reaches
  // .claude/settings.local.json, and that the generated-local-state skip is
  // driven through its predicate rather than through collectFiles (asserted
  // the obvious way it passes vacuously in every CI checkout, where those
  // files are gitignored and absent). A scan that looks nowhere useful is
  // green over a corrupt tree.
  //
  // Safe ahead of the check: verified 2026-08-26 by writing a genuinely corrupt
  // file into scripts/ -- the canary stayed PASS (11 cases) and the check exited
  // 1 naming the file, which is the order that must hold. It does read disk for
  // one case (collectFiles(['.claude']) must reach settings.local.json), and
  // that passes only because .claude/settings.local.json is TRACKED -- four of
  // its siblings under .claude/ are gitignored. If it is ever untracked this
  // canary reds at link 2 and blocks the FOURTEEN links behind it, so keep it
  // tracked or move that case behind a "file exists" guard. Fourteen, not the
  // thirteen this said until 2026-08-26: pairing check:image-widths took the
  // chain to 16 links and this second copy of the count went stale in the very
  // commit that updated the band word, which is what a second copy always does.
  //
  // Note what that hazard IS, because it has a name now and two siblings: a
  // live-subject assertion sitting in a gating position. See the image-widths
  // block below for the full account and the queue.
  //
  // Cost 2026-08-26: ~0.3s of work. The npm spawn is not recorded as the cost
  // of THIS link, because it is the same toll every link already in the chain
  // pays. The "~2-3s" this said until review was an estimate nobody ran --
  // measured on this machine it is ~800ms, mean of 3. See the image-widths note
  // for why a spawn IS marginal cost for a link a diff ADDS.
  ["check:mojibake:self-test", "the detector fires AND the scan still reaches .claude"],
  ["check:mojibake", "cp1252 mojibake scan"],
  ["check:legacy-tables", "no references to retired tables"],
  ["check:legacy-program-rpcs", "no references to retired program RPCs"],
  ["check:no-social-word", "banned-copy scan"],
  ["lint:architecture", "runtime architecture lint"],
  ["check:route-boundaries", "every route has an error boundary"],
  // Canary BEFORE the check. This one was deliberately left UNPAIRED when the
  // other three landed, because its --self-test was not fixture-only: three
  // cases ran checkTree() against the LIVE tree, so an ORDINARY width violation
  // red the CANARY and the && chain never reached the check. Those cases are
  // gone -- every one of them duplicated the fail-loud measurement contract
  // that checkTree() already runs, so the canary bought no coverage and cost a
  // second 551-file walk. See the block where they used to be for the full
  // account; do not put them back.
  //
  // Proven independent 2026-08-26, which is the bar any canary must clear
  // before it is allowed to gate a check in an && chain: with a real violation
  // injected (optimizedImageUrl(image, 123)) the canary stays GREEN at 49/49
  // and the check exits 1 naming the file, the line and the remediation. The
  // coverage the deleted cases claimed is still enforced, on the live tree, by
  // the guard -- scan dirs pointing nowhere and helpers renamed to nothing both
  // still exit 1 -- and the canary still PROVES that contract fires, through
  // its fixture case rather than through the repository.
  //
  // Cost 2026-08-26, measured rather than estimated: 2889ms of WORK before the
  // deletion, 953ms after (mean of 3) -- a 3x drop, because the canary no
  // longer walks the 551-file tree the check is about to walk anyway. The
  // check itself is 1837ms, so the pair does 2790ms of work against the old
  // canary's 2889ms on its own.
  //
  // That is a work-time comparison and on its own it flatters this change, so
  // do not read it as the cost of pairing. Pairing adds a SIXTEENTH `npm run`
  // to the chain, and therefore one npm spawn that was not being paid here
  // before -- ~800ms, mean of 3, measured on this machine 2026-08-26. A spawn
  // is shared overhead for a link that already exists and MARGINAL cost for a
  // link a diff creates; those are different ledgers and the mojibake note's
  // reasoning for excluding it does not carry over. Net added cost of pairing
  // this guard is ~953ms of work PLUS ~800ms of spawn, i.e. the excluded term
  // is the larger half of what this diff actually adds to `npm run lint`.
  ["check:image-widths:self-test", "the width and quality rules still fire, driven through checkTree"],
  ["check:image-widths", "no /_vercel/image width or quality vercel.json would 400"],
  ["check:rpc-typing", "no rpc(x as never) escapes"],
  // Canary BEFORE the check: the check alone is a diff against an allowlist, so
  // it would still pass if the DETECTORS silently stopped matching. That pairing
  // was local-tier for this guard only; check-mojibake and
  // check-workflow-artifact-policy each had a canary too, but ONLY in
  // .github/workflows/architecture-guard.yml, and both are now paired here and
  // in the lint chain as well.
  //
  // SCOPE THAT CLAIM TO THE LINT CHAIN -- it is true there and NOT true of the
  // local tiers generally, which is a wider set than the chain. Then scope it
  // twice more. "Every link of the chain is now paired" is what stood here
  // until review and it was false in two directions at once.
  //
  // TRUE: every chain link that has a canary ANYWHERE now runs it locally,
  // immediately ahead of its own check. check:image-widths was the last holdout
  // and joined once its canary was made independent of the live tree.
  //
  // FALSE, direction one -- most of the chain has no canary to pair. Counted
  // 2026-08-26: 16 npm-run links over 12 distinct checks, of which FOUR have a
  // `:self-test` (mojibake, image-widths, script-conventions,
  // workflow-artifact-policy). The other eight have none in any tier --
  // check:integrity, check:legacy-tables, check:legacy-program-rpcs,
  // check:no-social-word, lint:architecture, check:route-boundaries,
  // check:rpc-typing, check:wallclock-brand. Each diffs against a tree or an
  // allowlist with nothing proving its detectors still match, which is the
  // older and wider gap. Recorded because nothing else records it.
  //
  // FALSE, direction two -- the live-subject class closed for ONE guard, not
  // for the chain. Three of the four paired canaries still assert a fact about
  // the live subject while gating their own check in this && chain:
  //
  //   check:mojibake:self-test  (link 2)   .claude/settings.local.json is
  //     collected -- see the note at that entry; tracked-file dependent.
  //   check:script-conventions:self-test  (link 12)   R5 run over the live
  //     source of scripts/check-ci-budget.mjs -- check-script-conventions.mjs
  //     :1191 reads it, :1630 asserts r5(referenceSource) is clean. Refactor
  //     that file's exit tail into a shape R5 scores differently and the canary
  //     reds ahead of its check.
  //   check:workflow-artifact-policy:self-test  (link 15)   A5 fan-out measured
  //     over the live .github/workflows -- check-workflow-artifact-policy.mjs
  //     :4560. See that entry below.
  //
  // Any of the three can red on ordinary work and take its own check offline,
  // which is exactly the defect this diff removed from check:image-widths.
  // QUEUED, not fixed here: three separate guards, each owing its own
  // both-directions proof, and folding them into a diff about a fourth is how a
  // review round's fixes ship unreviewed.
  //
  // Still unpaired locally, all three with a canary that runs in CI only:
  // check:plan-hygiene (architecture-guard.yml:77), check:bundle-budget and
  // check:first-load-requests (perf-budget.yml:74 and :80). All three are
  // CHECKS entries BELOW the chain band, so the chain-shaped fix does not reach
  // them and they need their own decision -- two of them want a built bundle,
  // which is not a DB-less local scan. Recorded here rather than asserted
  // closed, because the marker this comment replaced said "queued -- close it in
  // the same shape or say why not" and a claim of closure would have deleted the
  // only record that the class is still open. Also required by the
  // tests/reviewScope.test.ts -- every npm-run link in the lint chain needs its
  // own entry here, and adding the alias to lint without this line is exactly
  // what that test caught.
  ["check:script-conventions:self-test", "the six rules are still proven in both directions"],
  ["check:script-conventions", "no guard script reports green without checking"],
  ["check:wallclock-brand", "wall-clock branded-boundary contract"],
  // Canary BEFORE the check, and the last of the three pairings this repo was
  // missing locally. Several of that guard's arms are UNREACHABLE on this
  // repository's own numbers, so its 393 self-test cases are the only thing
  // proving those arms can fail at all -- reading the check against this tree
  // cannot tell you, and the guard is green either way.
  //
  // Safe to put in a local tier because the five MEASURED drift comparisons are
  // NOT in the canary: they were deliberately moved into the guard, after the
  // verdict is printed, precisely so ordinary repo growth (one contract check
  // added to db-contract-check.yml, a workflow split in two) stops taking the
  // check offline. Adding the canary here therefore does not import that
  // failure mode into every local lint run.
  //
  // Safe ahead of the check FOR THAT INJECTION, verified the same way on
  // 2026-08-26: an unbounded actions/upload-artifact step injected into
  // workflow-lint.yml left the canary PASS (393 cases) and made the check exit 1
  // naming "A1 retention-missing" and the step.
  //
  // The sentence that used to close this paragraph -- "the canary does not read
  // .github/workflows at all" -- was FALSE, and review caught it. Case
  // "measured: no upload in this repository exceeds the fan-out budget" reads
  // the live directory at check-workflow-artifact-policy.mjs:4560 and asserts
  // `unreadable === 0 && max <= FANOUT_CAP_LEGS`. So one live-subject
  // assertion still gates this check: a workflow whose matrix expands past the
  // cap, or one this parser cannot read, reds the CANARY at link 15 and the
  // check at link 16 never runs. That case defends itself in its own comment --
  // it "cannot red on ordinary work, because the only way past it is the rule
  // genuinely firing, and then the guard is red anyway and names the upload" --
  // and that is precisely the fallacy, because in an && chain the guard does
  // not get to run. A1 injection is proven independent; A5 is not. Queued with
  // the other two live-subject canaries listed at check:script-conventions.
  //
  // ONE REPORTING CAVEAT, queued rather than fixed here because it belongs to
  // runCheck and would change how all of CHECKS is reported: this canary exits 2
  // for "the guard is broken, not the repo" (a checkout with no node_modules),
  // and runCheck collapses every non-zero exit to ok:false, so the ledger prints
  // it as an ordinary FAIL. The distinction the exit code was added to draw does
  // not survive into the ledger.
  //
  // Cost 2026-08-26: ~1.7s of work; see the mojibake note on why the npm-spawn
  // figure is not the number recorded.
  ["check:workflow-artifact-policy:self-test", "upload steps are still recognised, and the policy still rejects"],
  ["check:workflow-artifact-policy", "every workflow artifact upload is cost-bounded"],
  // Not a lint-chain link: the plan layer lives outside the repo (the home
  // plans dir), so it has no place in "npm run lint" and SKIPs in CI. It sits
  // here because the ship gate is the one place a local tree is guaranteed to
  // have that directory. It also RE-RENDERS PLANS-INDEX.md on a passing lint.
  ["check:plan-hygiene", "arc-plan frontmatter + arc-state cross-check (lint-only)"],
  ["test:unit", "vitest unit + contract suite", ["--reporter=dot"]],
  // The edge-TTL specs, in their own pass with file parallelism off. The
  // failure class this pass exists for is documented IN TREE, with the
  // evidence attached: see the header comment of
  // tests/dancerEditorPayloads.test.ts and installFixtureFetchGate in
  // tests/fixtures/festivalFixture.tsx. No summary is kept here, because
  // every summary written into this file so far has been wrong.
  ["test:unit:timing", "edge-TTL specs (serial)", ["--reporter=dot"]],
  // The BUILD, and the gate that reads its output. Placed at the END of the
  // list, which is NOT a short-circuit -- every CHECKS entry runs regardless of
  // what failed before it (see the header), and typecheck and eslint still run
  // after the loop. It is ordering for the READER of the ledger: the expensive
  // pair sits below the cheap ones it can never explain.
  //
  // WHY THE BUILD IS A STEP AND NOT A PRECONDITION. check:first-load-requests
  // counts the modulepreloads in the PRERENDERED HTML, which exists only after a
  // build, and it cannot tell whether the build/client on disk describes this
  // working tree. On 2026-08-15 a stale build/client -- left over from before the
  // chunk-consolidation PR -- was measured by its sibling guard, which reported
  // "+41 chunk(s)" against the baseline and STILL printed [ok] on every route,
  // because the KB budgets have headroom. A confident verdict about a tree that
  // no longer exists is worse than no verdict at all.
  //
  // WHICH IS WHY THE SCRIPT IS build:ship AND NOT build. It deletes build/ before
  // invoking react-router, so a build that dies EARLY -- a syntax error in
  // vite.chunks.ts, say, which is exactly the file these guards watch -- cannot
  // leave yesterday's artefact behind for the next step to measure. Vite empties
  // outDir itself, but only once it has loaded its config; a config-load failure
  // never gets there. With the directory gone, check:first-load-requests takes
  // its "cannot measure" path (exit 2) and the ledger reads FAIL, instead of
  // parsing stale HTML and matching every pin. Two rows, not one, so a broken
  // build is reported AS a broken build rather than as a request-count failure.
  //
  // This is why the pair is here and not in "npm run lint": that chain is
  // buildless by design and is what CI's fast guards run. CI catches a request
  // regression either way -- perf-budget.yml builds and runs both request guards
  // -- but only after the push. This is the same verdict, before it.
  ["build:ship", "production build, from a clean build/ (the request ratchet reads its HTML)"],
  // Both request gates read the build above, so the expensive half is already
  // paid for. This one is the ONLY gate on the first-load chunk count of the SSR
  // routes -- /city/:slug and /event/:id emit no prerendered HTML, so the guard
  // below is structurally blind to them, and they are most of the edge-request
  // bill. Held back from the PR that made it blocking only because that diff had
  // already had its review round.
  ["check:bundle-budget", "first-load JS budgets + puller/chunk ratchets (SSR routes included)"],
  ["check:first-load-requests", "first-load REQUEST-count ratchet (prerendered routes)"],
];

/** Where CI declares the env the perf build is designed to run under. */
const PERF_WORKFLOW = ".github/workflows/perf-budget.yml";

/**
 * The Supabase env the PERF build is built with, lifted out of perf-budget.yml.
 *
 * WHY THIS EXISTS, and it is the same failure smokeEnvFrom below was written for.
 * supabase-js validates the URL shape at module init, so prerendering a route
 * constructs a client and a build with no VITE_SUPABASE_URL simply throws --
 * perf-budget.yml says so in a comment beside the very values this reads. `.env`
 * is gitignored, so a fresh `git worktree` or clone (a trap this repo has hit
 * twice) has none, and without this the ship gate would hard-fail at the build
 * for a reason with no relation to the diff. That is the red-on-a-clean-tree
 * shape that teaches you to reach for --no-verify, which also drops the stamp.
 *
 * A SECOND, SMALLER BENEFIT worth naming because it is load-bearing elsewhere:
 * Vite inlines import.meta.env.VITE_* as string LITERALS at build time, so the
 * key's LENGTH lands in the bundle. Building with the same placeholder CI uses
 * is what makes perf-budgets.json's CI-measured baseline reproducible on a
 * developer's machine; building with .env's real key does not (measured
 * 2026-08-15: it accounts for most of a systematic 0.2-0.4 KB gap).
 *
 * READ from the workflow, not copied, for the reason smokeEnvFrom gives: two
 * copies of a value whose only job is to match is drift waiting to happen. A
 * SIBLING of smokeEnvFrom rather than a generalisation of it, because that
 * function is pinned by five canary cases and its error text names its own
 * workflow and its own failure; parameterising it to serve both would put a
 * shipped, tested gate at risk to save a dozen lines.
 *
 * Blocking by INCLUSION -- both names must be found -- because a renamed key or
 * a moved block otherwise reads as "nothing to set".
 */
export function buildEnvFrom(text, parseYaml) {
  const doc = parseYaml(text);
  const found = {};
  const lift = (block) => {
    if (!block || typeof block !== "object") return;
    for (const [k, v] of Object.entries(block)) {
      if (k.startsWith("VITE_") && typeof v === "string") found[k] = v;
    }
  };
  const runsBuild = (s) => s && typeof s.run === "string" && s.run.includes("npm run build");
  const jobs = doc && doc.jobs && typeof doc.jobs === "object" ? Object.values(doc.jobs) : [];
  for (const job of jobs) {
    const steps = job && Array.isArray(job.steps) ? job.steps : [];
    if (!steps.some(runsBuild)) continue;
    // Workflow < job < step, GitHub's own precedence order.
    lift(doc.env);
    lift(job.env);
    for (const step of steps) if (runsBuild(step)) lift(step.env);
  }
  const REQUIRED = ["VITE_SUPABASE_URL", "VITE_SUPABASE_PUBLISHABLE_KEY"];
  const missing = REQUIRED.filter((k) => !found[k]);
  if (missing.length > 0) {
    throw new Error(
      "pre-ship: could not read " + missing.join(" and ") + " from " + PERF_WORKFLOW +
        " (looked for a step whose `run` mentions npm run build). The production build " +
        "constructs a Supabase client while prerendering and throws without a valid-shaped " +
        "placeholder, so the ship gate would red on a clean tree. Fix the lookup rather " +
        "than dropping the env.",
    );
  }
  return found;
}

/** Resolve the perf-build env, or null with the reason recorded. Never throws. */
async function buildEnv() {
  try {
    const YAML = await import("yaml");
    const text = fs.readFileSync(path.join(REPO_ROOT, PERF_WORKFLOW), "utf8");
    return { env: buildEnvFrom(text, (t) => YAML.parse(t)), error: null };
  } catch (error) {
    return { env: null, error: error.message };
  }
}

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
 *
 * 106 -> 95 on 2026-08-09, taking the ledger up on its own offer: the dancer
 * profile funnel fix (#222) removed 11 pre-existing errors on its way past.
 * Banked in a SEPARATE ship, deliberately -- lowering it inside #222 would have
 * pinned main to a count main did not yet measure, so every unrelated branch cut
 * before that merge would have red on errors it never introduced. The same
 * merge-base-vs-tip mistake the eslint ratchet in that PR exists to fix, one
 * constant to the left. A ratchet may only tighten to a number the base ref
 * actually reports.
 *
 * 95 -> 91 on 2026-08-10, same offer taken again: #224 (8dbf85c) removed four
 * more on its way past, and main MEASURED 91 after that merge, before this
 * constant moved. Measured with the authoritative command -- a bare
 * "npx tsc --noEmit" reads a different tsconfig and reports 0, the false-green
 * this file's own header warns about; the ratchet's own
 * "react-router typegen && tsc -p tsconfig.app.json --noEmit" is what said 91.
 */
export const TYPECHECK_BASELINE = 91;

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
 * guards nothing. So pre-ship lints only the files THIS ship touches, and
 * compares each against its OWN count on the base ref: a file may carry the
 * debt it already had, but not one error more.
 *
 * The honest limit of a COUNT ratchet, written down because an earlier draft of
 * this docstring promised more than the code delivers ("it blocks the moment you
 * introduce a new error"): swapping one error for a DIFFERENT one leaves the
 * count level and passes. Keying the ratchet on rule ids would catch that -- and
 * would also red the gate on rule churn from an eslint upgrade. Since pre-ship
 * is the only place eslint runs at all, a gate that reds on an upgrade is a gate
 * that teaches the bypass this whole design exists to avoid, so the weaker
 * promise is the one worth keeping. Say what it does, not what you wish it did.
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

// THIS GATE EXISTS TO REPRODUCE THE PR GATE, so it must not diverge from
// e2e-smoke.yml on the axes that decide whether a spec passes.
//
// The first cut pinned --workers=1 for local determinism: on one dev machine the
// default parallelism reddened dancer-dashboard-concept-b-smoke reproducibly
// (measured 2026-08-03: two consecutive pre-ship runs failed it at ~55.5s, the
// spec passed alone in 46.4s, the full list passed 6/6 serially in 35.7s). That
// diagnosis stands -- it was contention, not a defect. The REMEDY was wrong.
// e2e-smoke.yml runs this same spec list at Playwright's default parallelism
// (playwright.config.ts sets fullyParallel: true and pins no worker count), so a
// serial gate stops reproducing the one thing it is here to reproduce: a genuine
// cross-spec race -- two specs sharing auth storage state, or the same DB rows --
// passes locally and reds only in CI, which is exactly the class of failure a
// pre-push gate is supposed to catch BEFORE the push (review finding). One spec
// being timing-sensitive under load does not establish that no spec is
// order- or concurrency-sensitive.
//
// So: match CI on BOTH axes. Default parallelism, and --retries=1 to mirror
// playwright.config.ts's `retries: process.env.CI ? 1 : 0` -- which is also what
// absorbs the measured contention flake, since CI has been absorbing it all
// along. A spec that only passes on retry is green in CI, so a gate that reds on
// it is not reproducing CI either; it is the alarm-fatigue class the original
// comment was right to fear, reached from the other direction.
export const SMOKE = ["test:e2e", "playwright smoke specs", ["--reporter=line", "--retries=1"]];

/** Where CI declares the env this suite is designed to run under. */
const SMOKE_WORKFLOW = ".github/workflows/e2e-smoke.yml";

/**
 * The URL Playwright probes, READ from playwright.config.ts rather than copied,
 * for the same reason the env is read from the workflow: two copies of a value
 * whose only job is to match is a drift waiting to happen. Returns null when it
 * cannot be found, and the caller says so rather than silently skipping.
 */
export function smokeServerUrlFrom(text) {
  const webServer = text.slice(text.indexOf("webServer:"));
  const m = webServer.match(/url:\s*['"]([^'"]+)['"]/);
  return m ? m[1] : null;
}

/**
 * The Supabase env the smoke suite is BUILT for, lifted out of e2e-smoke.yml.
 *
 * WHY THIS EXISTS. This gate was red on a clean tree -- 6 failed / 1 skipped --
 * while CI's E2E Smoke was green on main on every run, which is the shape that
 * teaches you to reach for --no-verify (and that also drops the review stamp).
 * The cause is not a defect in either place: playwright.config.ts says outright
 * that with a PLACEHOLDER key every SSR route 500s by design and the specs
 * therefore visit only client-only routes, where their page.route() mocks
 * actually apply. CI supplies that placeholder inline. A local run instead
 * picks up .env with the REAL project, so the pages render a different state
 * and locator.fill times out. The retries half was already handled here
 * (--retries=1 above); the env half was not.
 *
 * READ, NOT COPIED, and that is the point. Writing the placeholder key out
 * again here would make two copies of the thing whose whole job is to match --
 * and the drift would show up as this gate diverging from CI again, silently.
 * The workflow is the source of truth; this follows it.
 *
 * Fails LOUDLY rather than returning {}: an empty env would put us straight
 * back to the red-on-a-clean-tree state with no explanation, which is the
 * failure this function exists to remove. Blocking by INCLUSION -- both names
 * must be found -- because a renamed key or a moved block otherwise reads as
 * "nothing to set".
 */
export function smokeEnvFrom(text, parseYaml) {
  const doc = parseYaml(text);
  const found = {};
  const lift = (block) => {
    if (!block || typeof block !== "object") return;
    for (const [k, v] of Object.entries(block)) {
      if (k.startsWith("VITE_") && typeof v === "string") found[k] = v;
    }
  };
  // Workflow < job < step, which is GitHub's own precedence order. Reading only
  // step-level env made an ordinary refactor -- hoisting the block to the job so
  // a second step can use it -- look like drift and hard-fail the ship gate,
  // for values sitting in the file at a location GitHub honours.
  const jobs = doc && doc.jobs && typeof doc.jobs === "object" ? Object.values(doc.jobs) : [];
  for (const job of jobs) {
    const steps = job && Array.isArray(job.steps) ? job.steps : [];
    const runsSmoke = steps.some(
      (s) => s && typeof s.run === "string" && s.run.includes("test:e2e"),
    );
    if (!runsSmoke) continue;
    lift(doc.env);
    lift(job.env);
    for (const step of steps) {
      if (step && typeof step.run === "string" && step.run.includes("test:e2e")) lift(step.env);
    }
  }
  const REQUIRED = ["VITE_SUPABASE_URL", "VITE_SUPABASE_PUBLISHABLE_KEY"];
  const missing = REQUIRED.filter((k) => !found[k]);
  if (missing.length > 0) {
    throw new Error(
      "pre-ship: could not read " + missing.join(" and ") + " from " + SMOKE_WORKFLOW +
        " (looked for a step whose `run` mentions test:e2e). The smoke suite is built for the " +
        "PLACEHOLDER Supabase key that workflow declares; running it against .env's real project " +
        "reds the gate on a clean tree. Fix the lookup rather than dropping the env.",
    );
  }
  return found;
}

/**
 * Resolve the smoke env, or return null with the reason recorded.
 *
 * `yaml` is imported HERE, not at module scope, and that is not style. This file
 * had only node: builtins as module-level imports, so a fresh `git worktree` --
 * which starts with no node_modules, a trap this repo has hit twice -- would
 * have died at module load with ERR_MODULE_NOT_FOUND before a single check ran,
 * reporting a failure with no relation to the diff. Same shape as the problem
 * this whole function exists to remove.
 *
 * It NEVER throws. Thrown from its old call site at the end of main(), a lookup
 * failure discarded the entire ledger -- fourteen checks, the typecheck ratchet
 * and scoped eslint, ten-plus minutes of work -- and printed a raw stack instead
 * of the summary.
 */
async function smokeEnv() {
  try {
    const YAML = await import("yaml");
    const text = fs.readFileSync(path.join(REPO_ROOT, SMOKE_WORKFLOW), "utf8");
    return { env: smokeEnvFrom(text, (t) => YAML.parse(t)), error: null };
  } catch (error) {
    return { env: null, error: error.message };
  }
}

/**
 * Refuse to believe the injected env if a dev server is ALREADY serving the
 * port Playwright targets.
 *
 * playwright.config.ts sets `reuseExistingServer: true` explicitly, so when
 * something answers on 4173 Playwright spawns nothing -- and the placeholder
 * env resolved above is handed to a child that is never created. The suite then
 * runs against whatever that server was started with, which is usually .env's
 * REAL project, and the gate reds exactly as it did before this fix while the
 * ledger asserts the env half is handled. A red gate that contradicts its own
 * explanation is the thing this whole function exists to remove, so this is
 * detected and reported rather than left to be rediscovered.
 *
 * Returns a reason string when the reuse would happen, or null.
 */
export function detectReusedServer() {
  let url = null;
  try {
    url = smokeServerUrlFrom(fs.readFileSync(path.join(REPO_ROOT, "playwright.config.ts"), "utf8"));
  } catch {
    url = null;
  }
  if (!url) {
    return "could not read webServer.url out of playwright.config.ts, so the " +
      "reused-server check did not run -- if the smoke suite reds, check for a " +
      "stray dev server before believing the failure.";
  }
  try {
    const probe = execFileSync(
      process.execPath,
      [
        "-e",
        "const u=new URL(process.argv[1]);" +
          "const r=require('node:net').connect(u.port,u.hostname);" +
          "r.on('connect',()=>{console.log('open');r.destroy()});" +
          "r.on('error',()=>console.log('closed'));" +
          "setTimeout(()=>{console.log('closed');process.exit(0)},1500);",
        url,
      ],
      { encoding: "utf8", timeout: 5000 },
    );
    if (!probe.includes("open")) return null;
    return (
      "a server is already listening on " + url + ", and playwright.config.ts sets " +
      "reuseExistingServer: true -- Playwright will NOT spawn a fresh one, so the " +
      "placeholder Supabase env this gate injects would be ignored and the suite " +
      "would run against whatever that server was started with. Stop it and re-run."
    );
  } catch {
    // A failed probe is not evidence of reuse; say nothing rather than block.
    return null;
  }
}

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

const ESLINT_BIN = () => path.join(REPO_ROOT, "node_modules", "eslint", "bin", "eslint.js");

/* eslint's JSON reporter embeds each offending file's ENTIRE source in a
 * `source` key, so the report is roughly the size of the code it lints, not the
 * size of the findings. Measured on the dancer-profile ship: 23 files => 331,405
 * bytes, already a third of execFileSync's 1 MiB default. Overflow does not fail
 * legibly -- node raises ENOBUFS and hands back a TRUNCATED stdout, which parses
 * as garbage and reds the gate with no way to tell a broken ship from a broken
 * buffer. The same ceiling applies to `git show` on a large source file, where
 * the failure is worse: it lands in the catch that means "absent from the base
 * ref" and silently baselines that file at zero. */
const MAX_BUFFER = 64 * 1024 * 1024;

/** stdout from a thrown child-process error, however node attached it.
 *  (runTypecheck keeps its own capture(): tsc reports through stderr as well, so
 *  it wants both streams joined. The two eslint call sites want stdout ALONE --
 *  joining stderr in would corrupt the JSON they are about to parse.) */
function capturedStdout(err) {
  if (!err) return "";
  const out = err.stdout != null ? err.stdout : Array.isArray(err.output) ? err.output[1] : null;
  return String(out || "");
}

/** stderr from a thrown child-process error. Every child below runs with stderr
 *  PIPED rather than inherited, because execFileSync's default sends it straight
 *  to the operator's terminal: one bare `fatal: path ... exists on disk, but not
 *  in origin/main` per new file in the ship, mid-ledger, in a run that then
 *  reports PASS. Captured here so it can be printed deliberately, on the paths
 *  where it is the diagnosis rather than noise. */
function capturedStderr(err) {
  if (!err) return "";
  const out = err.stderr != null ? err.stderr : Array.isArray(err.output) ? err.output[2] : null;
  return String(out || "");
}

/** Indent a captured child message so it reads as quoted evidence in the ledger
 *  rather than as pre-ship's own voice. */
function indentBlock(text, prefix = "     | ") {
  return text
    .trim()
    .split(/\r?\n/)
    .map((line) => prefix + line)
    .join("\n");
}

/** A merge-base sha is 40 hex chars of noise in a one-line verdict; a symbolic
 *  ref is already short. Shorten only the former. */
function shortRev(rev) {
  return /^[0-9a-f]{40}$/.test(rev) ? rev.slice(0, 12) : rev;
}

/** Parse eslint's JSON reporter into { posixPath: errorCount }. Warnings are
 *  deliberately ignored: the ratchet has only ever blocked on errors. */
export function parseEslintJson(text, repoRoot = REPO_ROOT) {
  let report;
  try {
    report = JSON.parse(text);
  } catch {
    return null; // unparseable output must NOT be read as "no errors"
  }
  if (!Array.isArray(report)) return null;
  const counts = {};
  for (const entry of report) {
    const rel = toPosix(path.relative(repoRoot, entry.filePath || ""));
    counts[rel] = (counts[rel] || 0) + (entry.errorCount || 0);
  }
  return counts;
}

/**
 * Pure verdict, so all THREE directions are testable without running eslint.
 *
 * A file blocks when it carries more errors than the same file on the base ref.
 * A file the base ref genuinely does not contain has a baseline of 0, so any
 * error in a brand-new file blocks.
 *
 * THE THIRD DIRECTION, which the first cut got backwards: a baseline that could
 * not be MEASURED is neither zero nor infinity -- it is an unanswered question,
 * and it blocks. Recording it as Infinity made that file permanently ungateable
 * (0 -> 500 errors returned ok), and it poisoned `improved` into printing the
 * literal line "Infinity pre-existing error(s) removed" at the exact moment the
 * gate had stopped measuring. Blocking is also what the now-side already does
 * when eslint's own report is unparseable; the two halves of one gate must not
 * disagree about what "I don't know" means.
 *
 * Unmeasured is decided by INCLUSION of what can be compared, not exclusion of
 * what cannot: only a finite, non-negative count is a baseline, so undefined,
 * null, NaN and Infinity all block. eslintBaseCounts populates every key it is
 * asked about, so a missing one means the caller and the measurer disagree about
 * the file list -- not a state to guess through.
 */
export function decideEslintRatchet({ now = {}, base = {} } = {}) {
  const regressions = [];
  const unmeasured = [];
  let improved = 0;
  for (const [file, count] of Object.entries(now)) {
    const was = base[file];
    if (!Number.isFinite(was) || was < 0) {
      unmeasured.push(file);
      continue;
    }
    if (count > was) regressions.push({ file, was, now: count });
    else if (count < was) improved += was - count;
  }
  return {
    ok: regressions.length === 0 && unmeasured.length === 0,
    regressions,
    unmeasured,
    improved,
  };
}

/**
 * Error counts for the BASE versions of the given files, obtained by piping the
 * base blob through eslint's --stdin. --stdin-filename keeps config resolution
 * anchored to a real path, so the same rules apply as they do in-tree.
 *
 * Three corrections, each of which had the ratchet answering a question nobody
 * asked:
 *
 * 1. THE MERGE BASE, NOT THE REF TIP. shipFiles() routes `base` through
 *    diffOrigin() before diffing, so the ship's file list is computed against
 *    merge-base(base, HEAD). Reading baselines from the TIP compared the two
 *    halves of one ratchet at different commits: a cleanup landing on main after
 *    your branch cut reads here as YOUR regression -- precisely the false block
 *    this ratchet exists to remove -- while errors main GAINS after the cut
 *    inflate the baseline and absorb real new ones. review-scope.mjs already
 *    exports diffOrigin for this trap; #149 paid for it once ("a stale base, 12
 *    commits behind main").
 *
 * 2. RENAMES. git names a rename by its DESTINATION only, so `git show
 *    base:<new path>` finds nothing and the moved file baselines at zero: a pure
 *    `git mv` with no content change would block the ship for errors it
 *    inherited verbatim. renamePairs() exists for exactly this hole.
 *
 * 3. "ABSENT" AND "COULD NOT ASK" ARE DIFFERENT ANSWERS. One catch-all around
 *    `git show` gave both a baseline of zero, so an unfetched origin/main, a
 *    shallow clone, or a stale REVIEW_SCOPE_BASE left exported in the shell
 *    baselined EVERY file at zero, turned all pre-existing debt into regressions,
 *    and left --no-verify as the only way through. Presence now comes from the
 *    base TREE LISTING, so it is data rather than a parsed error string, and a
 *    read that fails on a path the tree says is there is reported as a
 *    measurement failure instead of being laundered into "new file".
 *
 * Only files that CURRENTLY carry errors get a baseline, so a file cleaned all
 * the way to zero earns no "removed" credit in the ledger. Deliberate: at a
 * process per file (~1.5-3s of eslint startup each, on a FUSE/NTFS mount) that
 * would add tens of seconds to every ship in order to improve a congratulation.
 *
 * @returns {{rev: string, counts: Record<string, number|null>}} null == unmeasured.
 */
export function eslintBaseCounts(files, base) {
  const rev = diffOrigin(base);
  const counts = {};
  if (!files.length) return { rev, counts };

  const renamedFrom = new Map();
  try {
    for (const { from, to } of renamePairs(base)) renamedFrom.set(to, from);
  } catch {
    /* Best-effort. Missing a pair costs one false block on a moved file, which
     * is loud and recoverable; failing the whole gate over it is not. */
  }
  const basePathOf = (file) => renamedFrom.get(file) || file;

  let present;
  try {
    const listed = execFileSync(
      "git",
      ["ls-tree", "-r", "--name-only", "-z", rev, "--", ...files.map(basePathOf)],
      { cwd: REPO_ROOT, encoding: "utf8", maxBuffer: MAX_BUFFER, stdio: ["ignore", "pipe", "pipe"] },
    );
    present = new Set(listed.split("\0").filter(Boolean).map(toPosix));
  } catch (err) {
    // The REF itself is unusable, so every baseline is unknown. Say that once,
    // in git's own words, rather than N identical mysteries.
    process.stdout.write("   base ref " + shortRev(rev) + " could not be read -- every baseline is unknown\n");
    const said = capturedStderr(err).trim();
    if (said) process.stdout.write(indentBlock(said) + "\n");
    for (const file of files) counts[file] = null;
    return { rev, counts };
  }

  for (const file of files) {
    const basePath = basePathOf(file);
    if (!present.has(basePath)) {
      counts[file] = 0; // genuinely new in this ship: no debt to inherit
      continue;
    }
    let content;
    try {
      content = execFileSync("git", ["show", rev + ":" + basePath], {
        cwd: REPO_ROOT,
        encoding: "utf8",
        maxBuffer: MAX_BUFFER,
        stdio: ["ignore", "pipe", "pipe"],
      });
    } catch {
      // The listing says this path IS in the base tree, so a failed read is a
      // measurement failure (ENOBUFS, a corrupt object) and never a new file.
      counts[file] = null;
      continue;
    }
    let out = "";
    try {
      out = execFileSync(
        process.execPath,
        [ESLINT_BIN(), "--stdin", "--stdin-filename", basePath, "-f", "json"],
        {
          cwd: REPO_ROOT,
          encoding: "utf8",
          input: content,
          maxBuffer: MAX_BUFFER,
          stdio: ["pipe", "pipe", "pipe"],
        },
      );
    } catch (err) {
      out = capturedStdout(err);
    }
    const parsed = parseEslintJson(out);
    counts[file] = parsed === null ? null : Object.values(parsed).reduce((a, b) => a + b, 0);
  }
  return { rev, counts };
}

/**
 * Run eslint over an explicit file list, bypassing the shell entirely so a path
 * with a space cannot be split.
 *
 * COUNT RATCHET, matching the typecheck gate directly below rather than the
 * absolute pass/fail this used to be. It is scoped to touched files on the
 * premise that they are "clean today". That premise is false for the older parts
 * of this tree -- the dancer-profile screens alone carry 29 pre-existing
 * no-explicit-any errors -- so as an absolute gate it blocked a ship that
 * measurably IMPROVED the count, 30 -> 29, and left no way through but a bypass.
 * Comparing each file against its own count on the base ref is what "do not make
 * it worse" actually means.
 *
 * Returns {ok, reason}, and the reason is load-bearing. The end-of-run ledger
 * used to reprint decideEslint's PLAN ("23 file(s) in this ship"), computed
 * before anything ran, so a reader who scrolled to the summary saw a green tick
 * over 29 tolerated errors with the words "ratchet" and "base" appearing
 * nowhere. The typecheck line one row above has always carried its verdict text;
 * this one now does too.
 */
function runEslintScoped(files, base) {
  process.stdout.write("\n> pre-ship: eslint (" + files.length + " file(s) in this ship)\n");
  let out = "";
  let stderr = "";
  try {
    out = execFileSync(process.execPath, [ESLINT_BIN(), ...files, "-f", "json"], {
      cwd: REPO_ROOT,
      encoding: "utf8",
      maxBuffer: MAX_BUFFER,
      stdio: ["ignore", "pipe", "pipe"],
    });
  } catch (err) {
    out = capturedStdout(err);
    stderr = capturedStderr(err);
  }

  const now = parseEslintJson(out);
  if (now === null) {
    // Print what eslint actually SAID. stderr is piped rather than inherited, so
    // this is the only place the operator can learn why: a broken
    // eslint.config.js, a missing node_modules/eslint and a report truncated at
    // maxBuffer are otherwise indistinguishable from one another and from a
    // genuine failure. A gate whose stated purpose is to remove the incentive to
    // bypass must never hand back an unexplained red.
    process.stdout.write("   eslint produced no parseable report -- treating as FAILED\n");
    const said = (stderr || out).trim();
    if (said) process.stdout.write(indentBlock(said.slice(0, 2000)) + "\n");
    return { ok: false, reason: "eslint produced no parseable report -- see the quoted output above" };
  }

  const offenders = Object.fromEntries(Object.entries(now).filter(([, c]) => c > 0));
  if (!Object.keys(offenders).length) {
    process.stdout.write("   0 errors in the ship's files\n");
    return { ok: true, reason: files.length + " file(s) in this ship, 0 errors" };
  }

  // Only the files that currently have errors need a baseline measured.
  const { rev, counts: baseCounts } = eslintBaseCounts(Object.keys(offenders), base);
  const verdict = decideEslintRatchet({ now: offenders, base: baseCounts });
  const against = shortRev(rev);

  for (const [file, count] of Object.entries(offenders)) {
    const was = baseCounts[file];
    process.stdout.write(
      "   " + file + ": " + count + " error(s), base " + (Number.isFinite(was) ? was : "UNKNOWN") + "\n"
    );
  }
  if (verdict.improved) process.stdout.write("   " + verdict.improved + " pre-existing error(s) removed\n");
  for (const file of verdict.unmeasured) {
    process.stdout.write("   UNMEASURED " + file + ": no baseline from " + against + " -- the ratchet cannot answer\n");
  }
  for (const r of verdict.regressions) {
    process.stdout.write("   REGRESSION " + r.file + ": " + r.was + " -> " + r.now + "\n");
  }

  if (verdict.ok) {
    const total = Object.values(offenders).reduce((a, b) => a + b, 0);
    const removed = verdict.improved ? ", " + verdict.improved + " removed" : "";
    return {
      ok: true,
      reason:
        total +
        " pre-existing error(s) in " +
        Object.keys(offenders).length +
        " file(s), held level against " +
        against +
        removed,
    };
  }

  const parts = [];
  if (verdict.regressions.length) {
    parts.push(
      "gained errors vs " +
        against +
        ": " +
        verdict.regressions.map((r) => r.file + " " + r.was + "->" + r.now).join(", ")
    );
    // Quote each path. This function's own premise is that a path with a space
    // must not be split, and this line exists to be pasted into a shell.
    process.stdout.write(
      "\n   Re-run to see them: npx eslint " + verdict.regressions.map((r) => JSON.stringify(r.file)).join(" ") + "\n"
    );
  }
  if (verdict.unmeasured.length) {
    parts.push("no baseline could be measured for " + verdict.unmeasured.join(", "));
  }
  return { ok: false, reason: parts.join("; ") };
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
/**
 * `exec` is injectable and this function is exported for ONE reason: proving
 * that extraEnv reaches the child. The five cases covering smokeEnvFrom prove
 * the workflow can be READ; deleting the `env:` property below left every one of
 * them green while the smoke suite went back to running against .env's real
 * project. The sibling guard's docstring records the identical lesson -- 88 rule
 * cases stayed green when a `return 2` became `return 0`, because none of them
 * called the function that owned the behaviour.
 */
export function runCheck(id, args = [], extraEnv = null, exec = execSync) {
  process.stdout.write("\n> pre-ship: " + id + "\n");
  try {
    // execSync uses a shell, so `npm` resolves to npm.cmd on Windows and npm on
    // POSIX. `id` and `args` are fixed literals from CHECKS -- no injection surface.
    const suffix = args.length ? " -- " + args.join(" ") : "";
    exec("npm run --silent " + id + suffix, {
      cwd: REPO_ROOT,
      stdio: "inherit",
      // Passed through the environment, never interpolated into the command
      // string: these values contain a JWT-shaped key and dots, and a shell is
      // the wrong place for either.
      env: extraEnv ? { ...process.env, ...extraEnv } : process.env,
    });
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

async function main(argv = process.argv.slice(2)) {
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
  // Resolved ONCE, before the loop, and only used by build:ship. A failure here
  // is reported as that check failing rather than thrown: a lookup problem in a
  // workflow file must not discard a ledger the rest of the run has earned.
  const perfBuild = dryRun ? { env: null, error: null } : await buildEnv();

  const results = [];
  if (!dryRun) {
    for (const [id, label, args] of CHECKS) {
      const skipReason = CHECK_SKIPS[id] ? CHECK_SKIPS[id]() : null;
      if (skipReason) {
        console.log("SKIP " + id + " -- " + skipReason);
        results.push({ id, label, ok: true, skipped: true, skipReason });
        continue;
      }
      if (id === "build:ship" && !perfBuild.env) {
        // NOT run without the env. Building against .env's real project (or
        // against nothing at all, on a fresh worktree) measures something other
        // than what CI measures, and a green row would say otherwise.
        //
        // The artefact is DELETED anyway, which is the half this branch was
        // missing: the two checks below read build/ and cannot tell whether it
        // describes this working tree. Left in place, a stale build/client from
        // an earlier run is parsed by both and matches every pin -- two
        // confident PASS rows about a tree that no longer exists, sitting beside
        // this FAIL. With it gone they take their cannot-measure path, which is
        // the whole argument for build:ship in the header above.
        fs.rmSync(path.join(REPO_ROOT, "build"), { recursive: true, force: true });
        console.log("FAIL " + id + " -- could not resolve the build env: " + perfBuild.error);
        results.push({ id, label, ok: false });
        continue;
      }
      const extraEnv = id === "build:ship" ? perfBuild.env : null;
      results.push({ id, label, ok: runCheck(id, args || [], extraEnv) });
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
  let eslintVerdict = null;
  if (!dryRun && eslintPlan.mode === "scoped") {
    eslintVerdict = runEslintScoped(eslintPlan.files, base);
    eslintOk = eslintVerdict.ok;
  }
  if (!dryRun && eslintPlan.mode === "all") eslintOk = runCheck("lint:eslint");

  const eslintFailed = eslintOk === false && eslintPlan.blocking;
  const anyFailed = results.some((r) => !r.ok) || eslintFailed || (tsc !== null && !tsc.ok);

  // -- smoke ------------------------------------------------------------------
  const smokeDecision = decideSmoke({ files, base, anyFailed, diffError });
  let smokeOk = null;
  let smokeEnvError = null;
  if (!dryRun && smokeDecision.ran) {
    // Resolved and reported through the LEDGER, never thrown past it: a failed
    // lookup becomes a named smoke failure beside every other result, which is
    // the difference between "here is what went wrong" and a bare stack trace
    // after ten minutes of passing checks.
    const resolved = await smokeEnv();
    const reused = detectReusedServer();
    if (resolved.error) {
      smokeEnvError = resolved.error;
      smokeOk = false;
    } else if (reused) {
      // Not run at all. Running it would produce a red whose stated cause
      // (the placeholder env) is not the actual cause, which is worse than
      // not running: it is the unexplained red this gate was fixed to stop.
      smokeEnvError = reused;
      smokeOk = false;
    } else {
      smokeOk = runCheck(SMOKE[0], SMOKE[2], resolved.env);
    }
  }

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
    // The VERDICT where there is one, not the plan. eslintPlan.reason is computed
    // before anything runs, so a scoped run reported its file count and said
    // nothing about how much pre-existing debt the ratchet had just tolerated --
    // a green tick over unmentioned errors, in the summary this file exists for.
    const said = !dryRun && eslintVerdict ? eslintVerdict.reason : eslintPlan.reason;
    out.push(mark + "eslint (" + eslintPlan.mode + ") -- " + (dryRun ? "WOULD RUN" : "RAN") + ": " + said);
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
    if (smokeEnvError) {
      out.push("           NOT RUN: could not resolve the placeholder Supabase env that this");
      out.push("           suite is built for -- " + smokeEnvError);
      out.push("           Fix the lookup in smokeEnvFrom, or the env block in " + SMOKE_WORKFLOW + ".");
    }
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

// Realpath-to-realpath (scripts/lib/entry-point.mjs). Resolving BOTH sides with
// path.resolve still compares two non-canonical spellings: it makes a path
// absolute without following a junction or symlink. Invoked through one, the
// whole pre-ship gate printed nothing and exited 0 -- which reads as a pass.
//
// awaited, and its rejection surfaced rather than becoming an unhandled one:
// main() is async now (the smoke env is read with a dynamic import so a
// node_modules-less worktree does not die at module load).
if (isEntryPoint(import.meta.url)) {
  main().catch((error) => {
    process.stderr.write("\npre-ship: crashed -- " + (error && error.stack ? error.stack : error) + "\n");
    process.exitCode = 1;
  });
}

export { main };

#!/usr/bin/env node
/**
 * Static policy lint over .github/workflows: what an artifact upload is allowed
 * to cost. Phase P3 of the ci-spend-never-silent arc.
 *
 * WHAT IT IS FOR. P2's check-ci-budget.mjs measures the bill after it is run
 * up: it reads the held artifact pool daily and goes red when the account is
 * heading for overage. This guard is the author-time half -- it runs on every
 * PR, reads no network and no secrets, and refuses the SHAPES that produced the
 * bill in the first place. A daily meter tells you a nightly burned 858 MB over
 * four months; this tells you at review time that it could.
 *
 * FOUR RULES, each earned by the incident:
 *
 *   A1 retention-missing     an upload with no `retention-days` inherits the
 *                            ACCOUNT default (90 days until P4 lowers it), so
 *                            the step's cost is set somewhere the reviewer of
 *                            that step cannot see.
 *   A2 retention-over-cap    `retention-days` above the account cap. GitHub
 *                            silently clamps rather than erroring, so the
 *                            number in the file is a claim nobody checks. An
 *                            expression it cannot read statically counts here
 *                            too: a value this guard cannot bound is not bound.
 *   A3 schedule-failure      an `if: failure()` upload on a `schedule:`
 *                            workflow -- with the gate read wherever it is
 *                            written: on the step, on the job, or on a job in
 *                            another file that calls this one, transitively.
 *                            THIS IS THE INCIDENT. `if: failure()`
 *                            reads as a bound on cost, and it is one only if
 *                            the job sometimes succeeds. On a never-green
 *                            nightly it is an unconditional upload wearing a
 *                            conditional's clothes: 15 of the last 15 runs
 *                            failed, x 122 MB, x 7 days retention = 858 MB
 *                            steady state, rebuilt nightly, 1.7x the whole free
 *                            allowance. Passing needs an explicit allowlist
 *                            entry below, with a reason, so the next one is a
 *                            decision instead of an accident.
 *                            `if: always()` is NOT flagged: it makes no claim
 *                            to be a bound, and A1/A2 bound it by retention.
 *                            The rule is about the DISGUISE, not the upload.
 *   A4 budget-guard-uploads  ci-budget-guard.yml must upload nothing. It reads
 *                            the pool it would otherwise join. Asserted here,
 *                            from OUTSIDE that file, because a guard that
 *                            polices itself is the thing it is meant to catch
 *                            (proving_a_guard_can_break_it).
 *
 * HOW IT REFUSES TO GO BLIND. P2's failure mode was an empty API reading that
 * summed to 0 bytes and read as wonderfully under budget. A static guard's
 * version is subtler: a rule that matches NOTHING. Unparseable YAML, a renamed
 * key, a `jobs:` shape nobody anticipated -- each makes the scan see zero steps
 * and report clean, and it looks identical to a repo that is simply compliant.
 *
 * So nothing here is decided by exclusion. Every run must clear FIVE inclusion
 * gates before any verdict is printed, and failing one is exit 2 -- could not
 * measure -- never a pass:
 *
 *   1. DECLARED VERSUS WALKED. Each document is read TWICE by separate code:
 *      once to count the jobs it declares and the steps each job declares, and
 *      once by the walk that actually does the work. The two must agree
 *      exactly, per file. This is an invariant rather than a calibrated number,
 *      and it exists because the floors below provably could not do it: a walk
 *      that visited only the first job of each file leaves 190 of this repo's
 *      221 steps intact -- fourteen of the 21 workflows have exactly one job --
 *      so no step floor low enough to survive an ordinary deletion could ever
 *      catch it. A guessed floor cannot; counting what you were supposed to
 *      visit can.
 *   2. FLOORS. It parsed at least N workflow files, found at least N uploads,
 *      and walked at least N steps in total (CONFIG below). Now that gate 1
 *      owns the per-file walk, these three guard only what gate 1 cannot see:
 *      the DIRECTORY read, the upload matcher, and a collapse at or below the
 *      YAML parse -- where both halves of gate 1 read the same truncated
 *      document and agree with each other perfectly.
 *   3. SHAPE. Every job must be a shape this guard actually understands --
 *      `steps:` or a reusable `uses:`, one of the two and not both, and not an
 *      empty `steps:` list. An unrecognised one is exit 2 and names itself,
 *      rather than contributing zero steps in silence.
 *   4. PARSE. A file that will not parse is exit 2. It is never skipped: the
 *      one file the guard cannot read is the one worth reading.
 *   5. SELF-PROBE. On EVERY run, before touching the repo, the detector is run
 *      against an embedded fixture carrying one of each violation. If it does
 *      not find all of them, the guard says so and exits 2 without reporting on
 *      the repo at all. This is what makes a zero-upload repo honest: it
 *      separates "the matcher works and there are none" from "the matcher is
 *      broken", which the upload floor alone cannot do once that floor is 0 --
 *      as it is in bachata-admin, where this same file is the enforcement copy.
 *
 * WHERE A PROPERTY CAN LIVE, enumerated once, because not enumerating it is the
 * single most expensive mistake this file has made. The same defect reappeared
 * FOUR times, each time one indentation level up from where it was last fixed:
 * `step.if`, then the job's `if`, then a called workflow inheriting its
 * caller's triggers, then a `failure()` gate on the job that DOES the calling.
 * Each fix was correct and each was aimed one level too low, and a canary case
 * only ever covers the level it was written for -- one of these asserted the
 * gate INSIDE a called file and passed happily while the caller's went
 * unnoticed. So, exhaustively:
 *
 *   failure gate      step.if | job.if | CALLER job.if | transitively, any
 *                     caller of that caller
 *   schedule reach    the same four
 *   triggers          the workflow's own `on:` | inherited from every caller,
 *                     transitively
 *   retention         the upload step's `with:` and nowhere else -- GitHub has
 *                     no job-level or workflow-level retention default, so
 *                     this one genuinely has a single level
 *   the upload itself a job's steps | a called workflow's steps (covered, by
 *                     parsing that file) | a composite action (NOT covered,
 *                     named in the report) | a matrix leg (NOT covered, named
 *                     above)
 *
 * The first three are handled by carrying a CONTEXT along each call edge --
 * propagateScheduleArrival below -- rather than by three more special cases,
 * because a special case per level is what produced four rounds of this.
 *
 * WHAT IT DOES NOT BOUND, stated because a pass line that reads as total
 * coverage is its own kind of silence. Held storage is retention x FREQUENCY x
 * size, and only retention is checked. A scheduled `if: always()` upload at the
 * budget's own maximum is arithmetically WORSE than the shape A3 refuses: the
 * incident held 7 copies; gsc-health-check.yml (daily, always(), 14 days) holds
 * 14, and prod-smoke.yml (every 6h plus every production deployment, always(),
 * 14 days) holds 56 or more. Both are small JSON reports today, so nothing is
 * burning -- but swap one `path:` to a directory of traces and the incident is
 * back with this check green.
 *
 * The same gap has a second multiplier INSIDE a single job: a `strategy.matrix`
 * of 8 shards uploading `if: always()` at 14 days holds 112 copies against the
 * incident's 7, from one nightly run. Frequency and fan-out are the two terms
 * this guard does not read, and naming both is the price of the pass line
 * meaning anything.
 *
 * A3 is deliberately not widened to always(): flagging two shipped, honest
 * workflows would buy two allowlist entries by reflex, which is how an
 * exception stops being a decision. The real rule is a bound on COPIES
 * (frequency x retention), it needs the cron read out of each trigger, and it
 * is queued rather than smuggled in here. Meanwhile P2's daily meter is what
 * catches a payload that grows, and it caught nothing for four months because
 * it did not exist -- so this caveat is a promise outstanding, not a shrug.
 *
 * Local:  node scripts/check-workflow-artifact-policy.mjs
 *         node scripts/check-workflow-artifact-policy.mjs --self-test
 * CI:     .github/workflows/architecture-guard.yml, every push and PR.
 *
 * Exit: 0 pass, 1 policy violated, 2 the guard could not run.
 */
import { readFileSync, readdirSync, realpathSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import YAML from 'yaml';
import { assertMeasured } from './lib/previewProbe.mjs';

const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const WORKFLOW_DIR = '.github/workflows';

// ---------------------------------------------------------------------------
// CONFIG -- the whole per-repo surface. Porting this file to bachata-admin
// means editing this block, and the MEASURED block below it, and nothing else.
//
// That sentence used to stop at "and nothing else", and it was false in three
// places: the self-probe named this repo's ci-budget-guard.yml literally, the
// report legend printed it as a hardcoded string, and the canary pinned this
// repo's floor edges as literals. A port editing only CONFIG would have failed
// its own canary on arrival -- and architecture-guard.yml runs the canary
// BEFORE the guard, so the port's first CI run would have been exit 2 against
// numbers from a different repository. The probe is fixture-local now, the
// legend reads NO_UPLOAD_WORKFLOWS, and the floor edges derive from MEASURED.
// ---------------------------------------------------------------------------

/**
 * The maximum retention this project will hold, in days.
 *
 * It is a POLICY budget today, deliberately not described as an account
 * mirror. The live account cap is still GitHub's default 90; P4 lowers it to
 * 14, and only then do the two coincide. An earlier draft called this "the
 * account cap" and had A2 tell the author that GitHub was silently clamping
 * their 30-day retention -- which on this account it is not, so the reader was
 * being sent to fix a mechanism that was not running. If P4 slips, a wrong
 * message would have stayed wrong indefinitely; a policy budget is true either
 * way, and becomes belt-and-braces once P4 lands.
 */
const RETENTION_CAP_DAYS = 14;

/** ci-budget-guard.yml must upload nothing. Asserted from outside that file. */
const NO_UPLOAD_WORKFLOWS = ['ci-budget-guard.yml'];

/**
 * Inclusion floors -- THREE, where there were four, and the change of job is
 * the point rather than the count.
 *
 * MEASURED on this repo, 2026-08-12: 21 workflow files, 28 jobs, 221 steps,
 * 5 upload-artifact steps.
 *
 * The JOBS floor is gone outright, and the STEPS floor survives with a
 * different job: it is a collapse detector now, not a traversal gate, and
 * conflating those two is the whole story below. The history is worth keeping
 * because it is a complete worked example of why a guessed number is not a
 * gate. The step floor was first 60 (derived from figures
 * nobody had run), then 180 ("well below 221"), which reddened on deleting one
 * perfectly ordinary workflow -- db-contract-check.yml is 76 of the 221 steps
 * by itself -- then 120, which was low enough to survive that and therefore too
 * low to catch anything. MEASURED at 120: a walk that visited only the first
 * job of each file leaves 190 steps, clears every floor, and prints "policy
 * passed". Fourteen of the 21 workflows have exactly one job, so only 31 steps
 * live outside a first job. There is no number that is both high enough to
 * catch the bug and low enough to survive ordinary work, and three drafts spent
 * themselves discovering that. Counting what the document DECLARES and
 * asserting the walk visited exactly that costs nothing and cannot rot.
 *
 * What is left are the dimensions that invariant genuinely cannot see:
 *
 *   workflowFiles  the DIRECTORY read. Declared-versus-walked is per file, so
 *                  a readdir that returns three files agrees with itself
 *                  perfectly. Floor 16 against a measured 21; both edges are
 *                  pinned by canary cases, because an unpinned floor is what
 *                  produced the three drafts above. The upper edge (<= 19)
 *                  absorbs deleting two workflows; the lower (>= 11) keeps it
 *                  above half, so a directory read that returns half the files
 *                  is still caught.
 *   uploadSteps    the upload MATCHER. Every other gate is satisfied by a scan
 *                  that walks all 221 steps and recognises none of them as an
 *                  upload. Floor 3 against a measured 5, so retiring a monitor
 *                  is not a CI incident. Its LOWER edge is deliberately not
 *                  pinned: 0 is the correct value in bachata-admin, where this
 *                  same file is the enforcement copy and there is not one
 *                  upload step to notice with. At 0 the live SELF-PROBE is the
 *                  only thing left proving the matcher works, which is why the
 *                  probe runs unconditionally rather than only when the floor
 *                  is 0.
 *
 * A drop through one means the guard broke far more often than it means three
 * workflows were deleted at once, and the failure message says so, in those
 * words, so the reader checks the guard before the repo.
 *
 * A key here that nothing asserts is also a blocker -- see assertInclusion.
 * "An undeclared floor is not a floor of zero" has a twin: a floor declared and
 * never read is not a floor either, and it reads exactly like one.
 */
const FLOORS = {
  workflowFiles: 16,
  uploadSteps: 3,
  // A COLLAPSE floor, and deliberately nothing more. Gate 1 compares two reads
  // of the same parsed document, so both halves see the same thing if the
  // failure is at or BELOW the parse -- a yaml bump (Dependabot is live here), a
  // change to the parse options, a future edit to where `jobs` is read from.
  // Declared and walked then agree exactly, gate 1 stays silent, and the run
  // prints "walk was complete, counted by two separate reads" over a scan that
  // saw a tenth of the repo. Raised in review, and it is the one hole removing
  // these floors opened.
  //
  // The band is measured, both edges: it must stay at or below 145 (221 minus
  // db-contract-check.yml's 76, so deleting the largest workflow is not a CI
  // incident) and comfortably above the ~22 that a catastrophic under-read
  // leaves. 100 sits inside [23, 145] and away from both ends, because the two
  // previous step floors each died by hugging one edge. (It is not the
  // arithmetic midpoint, which is 84 -- an earlier draft of this line said it
  // was, and a number described wrongly is how the last gap stayed invisible.)
  //
  // It is NOT a traversal gate and must never be described as one again. Three
  // drafts were spent proving no number can be both, and the comment claiming
  // otherwise is what made the gap invisible.
  steps: 100,
};

/**
 * What this repo actually measured, 2026-08-12. The floors above are derived
 * from these, and so are the canary cases that pin both edges of each floor --
 * so a port edits this block and CONFIG, and nothing else.
 *
 * Written down because "measured" appeared in four comments as an adjective
 * before any of it was in the file as a number.
 */
const MEASURED = {
  workflowFiles: 21,
  jobs: 28,
  steps: 221,
  uploadSteps: 5,
  /** db-contract-check.yml, the largest single workflow, in steps. */
  largestWorkflowSteps: 76,
};

/**
 * A3 allowlist: `if: failure()` uploads on `schedule:` workflows that are
 * ACCEPTED, each with the reason it is not the incident shape.
 *
 * The bar for an entry is one measured claim: THIS JOB SOMETIMES SUCCEEDS.
 * That is the entire difference between a bound and a costume. Anything else --
 * "it is only small", "it is on a public repo" -- belongs in A1/A2's retention
 * numbers, not here.
 *
 * WHAT AN ENTRY CANNOT PROMISE, said plainly because the entries below rest on
 * it. "This job sometimes succeeds" is a claim about RUN HISTORY, and nothing
 * in this repo re-measures it. If the allowlisted monitor starts failing every
 * night -- the exact history of the nightly this arc exists for -- the
 * conditional stops bounding anything and this file goes on printing it as an
 * allowed exception. Staleness is detected when the STEP disappears, never
 * when the JUSTIFICATION stops being true, and P2's meter watches pool totals
 * rather than per-workflow success rate, so no layer currently catches it.
 * Closing that needs a success-rate reading per allowlisted job; it is queued,
 * not solved, and every entry here should be read as provisional.
 *
 * A stale entry (one matching no flagged step) FAILS. Not because tidiness is
 * worth a red build, but because an entry outliving its step is an accepted
 * exception nobody re-decided: rename the step and the exception silently
 * transfers to whatever occupies the name next. Deleting it is the cheap half;
 * the message asks for the other half, which is proving the construct is
 * actually gone rather than merely renamed (ratchet_shrink_not_a_win).
 */
const SCHEDULE_FAILURE_ALLOWLIST = [
  {
    file: 'synthetic-ssr-monitor.yml',
    job: 'synthetic',
    step: 'Upload traces on failure',
    // This monitor watches PRODUCTION SSR and is green in the ordinary case --
    // a failure here is a real prod defect, not the daily weather, so the
    // upload fires on the exception rather than on every run. That is what
    // makes the conditional a real bound and the nightly's was not. Bounded
    // twice over: retention-days 7, and bachata-website is public, so its
    // storage is never metered at all.
    reason: 'prod SSR monitor, ordinarily green: the conditional really does bound it',
  },
  // There was a SECOND entry here, for the same file's `synthetic-preview`
  // job, and removing it is the point. That job is
  // `if: github.event_name == 'pull_request'`, so a schedule run cannot reach
  // it at all -- A3 had flagged something structurally impossible and the
  // entry bought it off with a reason that hedged ("not in the usual case")
  // about a case that does not exist. scheduleCanReach() now declines to flag
  // it, so the exception is unnecessary; and because a stale entry FAILS, the
  // guard would not let it be left behind either way.
];

// ---------------------------------------------------------------------------
// Parsing
//
// A real YAML parse, not a substring scan, and that is not fastidiousness.
// ci-budget-guard.yml contains the string "upload-artifact" inside a comment
// explaining why it must never have one -- a text scanner flags the guard's own
// self-exclusion RULE as a violation of itself, and looks entirely correct
// doing it. Anything that reasons about steps has to actually have steps.
//
// Errors are RETURNED, never thrown past the caller and never defaulted away.
// A file that will not parse is the single most interesting file in the
// directory; the one thing it must not do is scan clean.
// ---------------------------------------------------------------------------

/** An `uses:` naming actions/upload-artifact, or any fork or pinned SHA of it. */
export function isUploadArtifact(uses) {
  if (typeof uses !== 'string') return false;
  const action = uses.split('@')[0].trim();
  // upload-pages-artifact writes to the SAME billed pool, so leaving it out
  // meant a Pages deploy could hold unbounded artifacts while the guard read
  // clean -- and without even raising the upload count the inclusion floors
  // watch, so nothing else would have noticed either.
  // `/merge` is a real sub-action of upload-artifact@v4 and it CREATES a new
  // artifact, with its own retention-days. Left out, a merged matrix artifact
  // took the 90-day account default while being invisible to all four rules --
  // and, exactly as with upload-pages-artifact before it, without raising the
  // upload count the inclusion floor watches, so nothing else noticed either.
  return /(?:^|\/)upload-(?:pages-)?artifact(?:\/merge)?$/.test(action);
}

/**
 * Which workflows an `on: workflow_run` file watches, by NAME.
 *
 * Both key spellings are read for the same reason readTriggers below reads
 * both: a `%YAML 1.1` directive turns the key `on` into the boolean true, and a
 * rule about how a workflow is triggered must not answer "not triggered at all"
 * because of a schema version.
 */
export function readWorkflowRunWatches(doc) {
  const raw = doc?.on ?? doc?.true;
  const none = { present: false, names: [], any: false };
  if (typeof raw === 'string') return raw === 'workflow_run' ? { present: true, names: [], any: true } : none;
  if (Array.isArray(raw)) return raw.includes('workflow_run') ? { present: true, names: [], any: true } : none;
  if (!raw || typeof raw !== 'object' || !('workflow_run' in raw)) return none;
  const cfg = raw.workflow_run;
  const names = cfg && typeof cfg === 'object' && !Array.isArray(cfg) && Array.isArray(cfg.workflows)
    ? cfg.workflows.filter((n) => typeof n === 'string')
    : [];
  // No readable `workflows:` list means it watches everything, which is also
  // GitHub's own default. Unknown is resolved towards MORE reach, never less:
  // the alternative records "could not tell" as "nothing arrives here", which
  // is this arc's own failure mode.
  return { present: true, names, any: names.length === 0 };
}

/**
 * The trigger names of a workflow, as a plain array.
 *
 * `on:` survives as the STRING key 'on' under the YAML 1.2 core schema this
 * parser uses, but the same document read by a YAML 1.1 parser gives the
 * BOOLEAN key true -- the old Norway problem, wearing the one hat that matters
 * here. Both are read, because a guard whose central rule is "is this on a
 * schedule" must not answer "no triggers at all" because of a schema version.
 */
export function readTriggers(doc) {
  const raw = doc?.on ?? doc?.true;
  if (typeof raw === 'string') return [raw];
  if (Array.isArray(raw)) return raw.filter((t) => typeof t === 'string');
  if (raw && typeof raw === 'object') return Object.keys(raw);
  return [];
}

/**
 * The jobs and steps a document DECLARES, counted by a second read that shares
 * no code with the walk.
 *
 * That independence is the entire value. Both halves are trivial and either
 * alone proves nothing; what proves something is that a change to the walk
 * does not change this, so the two disagree the moment the walk stops being
 * complete. Deriving one from the other -- or from a shared helper -- would
 * give a number that agrees with itself by construction, which is the shape of
 * every gate in this arc that failed open.
 *
 * A job that is not a mapping still counts as a declared job (it exists, and
 * the walk must account for it); it declares no steps, and neither does a
 * reusable `uses:` call, whose steps live in another file.
 */
export function declaredCounts(doc) {
  const jobs = doc?.jobs;
  if (!jobs || typeof jobs !== 'object' || Array.isArray(jobs)) return { jobs: 0, steps: 0 };
  const declared = Object.values(jobs);
  let steps = 0;
  for (const job of declared) {
    if (!job || typeof job !== 'object' || Array.isArray(job)) continue;
    if (Array.isArray(job.steps)) steps += job.steps.length;
  }
  return { jobs: declared.length, steps };
}

/**
 * The comparison itself, split out so the canary can drive it in both
 * directions without having to break the walk to do it.
 *
 * BOTH directions of the inequality are a problem, not just under-counting. A
 * walk that visits MORE than was declared is double-counting somewhere, and a
 * number inflated by a bug is exactly what would keep a broken floor green --
 * which is how the guessed floors this replaced would have died. Refusing to
 * pick a side costs one branch and removes a whole class of "it passed, so it
 * must be fine".
 */
export function traversalProblems(name, declared, walked) {
  const problems = [];
  for (const dim of ['jobs', 'steps']) {
    if (declared[dim] === walked[dim]) continue;
    problems.push({
      kind: 'traversal',
      file: name,
      detail: 'declares ' + declared[dim] + ' ' + dim + ' but the walk visited ' + walked[dim] +
        '. These are counted by two separate reads of the same document precisely so they CAN disagree; ' +
        'when they do, the scan is incomplete and nothing it reports about this file can be believed. ' +
        'This is the guard, not the repo.',
    });
  }
  return problems;
}

/**
 * Walk one workflow file.
 *
 * Returns counts as well as findings. The counts are what the inclusion floors
 * and the declared-versus-walked invariant are asserted against, so they must
 * be honest even -- especially -- on a file that yields no uploads at all.
 *
 * `deps.declaredCounts` is a seam and exists for exactly one reason, the same
 * reason `deps.listFiles` and `cfg.selfProbe` do: without it, no case can prove
 * this function is WIRED to the invariant rather than merely sitting next to
 * it. By construction the two counts agree on every document a test can write,
 * so deleting the comparison here is invisible to any fixture -- and mutation
 * showed exactly that, with the call replaced by `void traversalProblems` and
 * all 184 cases still green. A stub that disagrees is the only way to drive the
 * wiring, and the canary drives it in both directions so the seam itself cannot
 * be what makes the case pass.
 */
export function parseWorkflow(name, text, deps = {}) {
  const countDeclared = deps.declaredCounts ?? declaredCounts;
  const result = {
    name,
    workflowName: null,
    triggers: [],
    watch: { present: false, names: [], any: false },
    uploads: [],
    jobs: 0,
    steps: 0,
    declaredJobs: 0,
    declaredSteps: 0,
    reusableJobs: 0,
    // Each entry is { target, job, jobIf }: the file called, the job that
    // calls it, and THAT job's condition. The condition used to be dropped
    // here, which is what made a `failure()` gate on a calling job invisible.
    calls: [],
    problems: [],
  };

  let doc;
  try {
    doc = YAML.parse(text);
  } catch (error) {
    result.problems.push({
      kind: 'parse',
      file: name,
      detail: 'YAML will not parse: ' + error.message,
    });
    return result;
  }

  if (doc === null || typeof doc !== 'object' || Array.isArray(doc)) {
    result.problems.push({
      kind: 'shape',
      file: name,
      detail: 'top level is not a mapping (got ' + (Array.isArray(doc) ? 'a list' : typeof doc) + ')',
    });
    return result;
  }

  result.triggers = readTriggers(doc);
  // `on: workflow_run` is a FIFTH level a schedule can arrive by, and the
  // canonical "collect artifacts when the nightly failed" workflow is written
  // exactly this way: an `on: workflow_run` file whose job is
  // `if: github.event.workflow_run.conclusion == 'failure'`. Before this it
  // scanned completely clean -- its own triggers say `workflow_run`, which is
  // not `schedule`, and nothing followed the edge -- so the guard printed
  // "policy passed" over the incident's own shape, one level above the four the
  // header enumerates. The workflow's `name:` is recorded too, because a
  // workflow_run list names workflows by NAME, not by filename.
  result.workflowName = typeof doc.name === 'string' ? doc.name : null;
  result.watch = readWorkflowRunWatches(doc);
  if (result.triggers.length === 0) {
    result.problems.push({
      kind: 'shape',
      file: name,
      detail: 'no `on:` triggers found -- either the key was renamed or this is not a workflow',
    });
  }

  const jobs = doc.jobs;
  if (!jobs || typeof jobs !== 'object' || Array.isArray(jobs)) {
    result.problems.push({
      kind: 'shape',
      file: name,
      detail: 'no `jobs:` mapping -- a workflow with no jobs contributes no steps, which is how a scan reads clean by seeing nothing',
    });
    return result;
  }

  for (const [jobId, job] of Object.entries(jobs)) {
    result.jobs += 1;
    if (!job || typeof job !== 'object' || Array.isArray(job)) {
      result.problems.push({
        kind: 'shape',
        file: name,
        detail: 'job `' + jobId + '` is not a mapping',
      });
      continue;
    }
    // The JOB's condition, read BEFORE the shape branches rather than after
    // them, which is not a tidying. It used to be read only on the step-bearing
    // path, so a job that CALLS a reusable workflow dropped its `if:` on the
    // floor -- and `if: failure()` on a calling job is the incident with the
    // upload moved into another file. Fourth appearance of the same
    // one-level-up miss; see the enumeration at the top of this file. It is
    // carried on the call edge now, so every level shares one mechanism.
    const jobIf = typeof job.if === 'string' ? job.if : null;

    // A reusable-workflow call has no steps of its own. That is a shape this
    // guard KNOWS it cannot see into, which is different from one it failed to
    // recognise -- but "knows" only counts if it SAYS so, and the first draft
    // passed over these in complete silence while the report read "policy
    // passed" as though coverage were total. It is counted here and printed in
    // the report, so a repo that moves its uploads behind a called workflow
    // gets a named caveat rather than a clean bill.
    if (typeof job.uses === 'string') {
      result.reusableJobs += 1;
      result.calls.push({ target: calledWorkflowName(job.uses), job: jobId, jobIf });
      if (job.steps === undefined) continue;
      // BOTH `uses:` and `steps:`. GitHub rejects the combination outright, so
      // this is never a real workflow -- but the guard used to treat it as an
      // ordinary step-bearing job, which meant it recorded NO call (triggers
      // stopped propagating through it) while the `uses:` sat there in plain
      // sight. With `steps: []` it also contributed zero steps and raised
      // nothing at all: understood, empty, silent, which is precisely the state
      // the shape gate exists to refuse. Both halves are taken now -- the call
      // is recorded above and the steps are still walked below -- because a
      // shape the guard refuses must never also be a shape it sees LESS of.
      result.problems.push({
        kind: 'shape',
        file: name,
        detail: 'job `' + jobId + '` declares BOTH `uses:` and `steps:` -- GitHub rejects that combination, so this file cannot run as written. The guard reads both halves rather than guessing which one is real, and refuses the file.',
      });
    }

    if (!Array.isArray(job.steps)) {
      // Two messages for one job used to contradict each other here: a job with
      // `uses:` and an empty scalar `steps:` was told it declares BOTH, and then
      // that it has NEITHER. The second message was written for a job with no
      // `uses:` at all, so it now says what is actually wrong in each case.
      result.problems.push({
        kind: 'shape',
        file: name,
        detail: typeof job.uses === 'string'
          ? 'job `' + jobId + '` has a `steps:` key that is not a list (' +
            (job.steps === null ? 'empty' : typeof job.steps) + '). Delete it, or make it a list.'
          : 'job `' + jobId + '` has neither a `steps:` list nor a reusable `uses:` -- unrecognised shape, refusing to call it zero steps',
      });
      continue;
    }

    if (job.steps.length === 0) {
      // An empty list is the one shape that satisfies every count honestly --
      // it declares zero and walks zero, so declared-versus-walked agrees
      // perfectly -- while contributing nothing whatever to the scan. GitHub
      // rejects it too (a job needs at least one step). It gets its own branch
      // because the invariant structurally cannot see it: agreement between two
      // reads of nothing is still nothing.
      result.problems.push({
        kind: 'shape',
        file: name,
        detail: 'job `' + jobId + '` has an EMPTY `steps:` list. GitHub requires at least one step, and a job that walks clean by containing nothing is indistinguishable from a job the guard failed to read.',
      });
    }

    for (const step of job.steps) {
      result.steps += 1;
      // A step that is not a mapping is REFUSED by name, like every other shape
      // here. It used to be counted and skipped in silence, which meant it
      // satisfied both the walked count and the steps floor while being
      // invisible to all four rules -- the guard seeing LESS of a shape it does
      // not understand, which is the one thing the shape gate exists to stop.
      if (!step || typeof step !== 'object' || Array.isArray(step)) {
        result.problems.push({
          kind: 'shape',
          file: name,
          detail: 'job `' + jobId + '` has a step that is not a mapping (' +
            (Array.isArray(step) ? 'a list' : typeof step) + '). Refusing to treat it as a step with no `uses:`.',
        });
        continue;
      }
      if (!isUploadArtifact(step.uses)) continue;
      const withBlock = step.with && typeof step.with === 'object' ? step.with : {};
      result.uploads.push({
        file: name,
        job: jobId,
        step: typeof step.name === 'string' ? step.name : '(unnamed step)',
        uses: step.uses,
        ifExpr: typeof step.if === 'string' ? step.if : null,
        jobIf,
        retention: withBlock['retention-days'],
      });
    }
  }

  // GATE 1, declared versus walked, asserted per file. The floors this replaced
  // were a number somebody chose; this is a number the document states. A walk
  // that visits only the first job of each file clears every floor this repo
  // could tolerate (190 of 221 steps survive it, measured) and fails here on
  // the first multi-job file it touches.
  const declared = countDeclared(doc);
  result.declaredJobs = declared.jobs;
  result.declaredSteps = declared.steps;
  result.problems.push(...traversalProblems(name, declared, { jobs: result.jobs, steps: result.steps }));

  return result;
}

// ---------------------------------------------------------------------------
// Rules
// ---------------------------------------------------------------------------

/**
 * True when a condition GATES ON FAILURE -- whichever of the several spellings
 * GitHub offers is used.
 *
 * It read only the literal `failure()` call at first, which missed the two
 * forms GitHub's own documentation uses for a collection job:
 * `needs.build.result == 'failure'` and `job.status == 'failure'`. Those are
 * the idiomatic way to write exactly the job this rule was widened to catch,
 * so the incident could be re-spelled straight past it -- and a canary case
 * asserted one of them as CORRECTLY ignored, which is how no case could find
 * the hole. Found in review round 2, in a round-1 fix.
 *
 * The QUOTED literal is the discriminator, not the word. `failure_count` and
 * `on_failure` are identifiers and do not gate on anything; `== 'failure'` and
 * `contains(needs.*.result, 'failure')` do.
 */
export function conditionIsFailureGate(expr) {
  if (typeof expr !== 'string') return false;
  // NEGATED failure tests are the opposite gate and go first, because every
  // positive test below would otherwise match inside them. `!failure()` and
  // `!contains(needs.*.result, 'failure')` are the standard "publish unless
  // something failed" spelling: they run when things SUCCEED, so their cost is
  // bounded by the success rate. Round 2 -- the function had grown careful
  // handling for `!= 'failure'` and for `!success()`, and the negation of the
  // positive form was handled for neither.
  const withoutNegated = expr
    .replace(/!\s*failure\s*\(\s*\)/g, ' ')
    .replace(/!\s*contains\s*\([^)]*\)/g, ' ');
  if (/\bfailure\s*\(\s*\)/.test(withoutNegated)) return true;
  // `!= 'failure'` is the opposite gate -- upload UNLESS it failed -- and its
  // cost is bounded by how often the job succeeds, which is the ordinary case.
  //
  // It is REMOVED and the rest re-read, rather than short-circuiting the whole
  // expression the moment one appears. Short-circuiting made
  // `needs.build.result == 'failure' && needs.setup.result != 'failure'`
  // return false: that is the idiomatic "upload when a shard failed but setup
  // did not", i.e. the incident with one extra conjunct, and the extra
  // conjunct was enough to switch the rule off. One negative term does not
  // cancel a positive one -- the two mean different things about different
  // jobs, and only the positive one decides how often this upload runs.
  // The negated-SUCCESS family, which gates on precisely the same event and is
  // the documented way to write it: `!success()` means "run unless everything
  // succeeded", and `result != 'success'` is how a collection job is written
  // when `skipped` should count too. Keying only on the word `failure` meant the
  // incident could be re-spelled past this rule in three ordinary ways. Same
  // class as the widening this function already took in round 2 -- and every
  // negative canary case was built from `!= 'failure'`, so none could see it.
  if (/!\s*success\s*\(\s*\)/.test(expr)) return true;
  if (/!=\s*['"]success['"]/.test(expr)) return true;
  const positive = withoutNegated.replace(/!=\s*['"]failure['"]/g, ' ');
  return /['"]failure['"]/.test(positive);
}

/**
 * Whether a `schedule:` run could reach this job at all, given its job-level
 * condition. Only the one shape that is unambiguous is read: an equality
 * against github.event_name naming some OTHER event. Everything else -- a
 * disjunction, an inequality, an input, a shape not anticipated -- returns
 * true, so the job is still judged.
 *
 * The default direction is the whole point. A false positive costs an
 * allowlist entry; a false negative is the incident. But a false positive is
 * not free either, and this function exists because the guard shipped with
 * one: synthetic-ssr-monitor's `synthetic-preview` job is
 * `if: github.event_name == 'pull_request'`, so the schedule trigger can never
 * reach it, and A3 flagged it anyway. It was bought off with an allowlist
 * entry whose stated reason hedged ("not in the usual case") about something
 * that is structurally impossible. That is exactly the reflex the allowlist is
 * supposed to prevent, appearing in the first allowlist the guard ever had.
 */
export function splitTopLevelAnd(expr) {
  const terms = [];
  let current = '';
  let quote = null;
  let depth = 0;
  for (let i = 0; i < expr.length; i++) {
    const ch = expr[i];
    if (quote) {
      if (ch === quote) quote = null;
      current += ch;
      continue;
    }
    if (ch === "'" || ch === '"') {
      quote = ch;
      current += ch;
      continue;
    }
    if (ch === '(') depth += 1;
    if (ch === ')') depth -= 1;
    if (ch === '&' && expr[i + 1] === '&' && depth === 0) {
      terms.push(current);
      current = '';
      i += 1;
      continue;
    }
    current += ch;
  }
  terms.push(current);
  return terms;
}

/**
 * Whether a run ARRIVING BY one of `events` could reach this job, given its
 * condition.
 *
 * The event list is not decoration. This function used to ask only "can a
 * SCHEDULE reach", which contradicted the arrival model the moment
 * workflow_run edges were added: inside a collector, `github.event_name` is
 * always `workflow_run` and never `schedule`, so the entirely correct and
 * idiomatic conjunct `github.event_name == 'workflow_run' && failure()` excused
 * the collector from the very level that was added to catch it. Reachability
 * has to be asked against the event the run actually arrives as.
 */
export function scheduleCanReach(cond, events = ['schedule']) {
  if (typeof cond !== 'string') return true;
  const bare = cond.split('${{').join(' ').split('}}').join(' ');
  // A disjunction may still admit a schedule run, so it proves nothing.
  if (bare.includes('||')) return true;
  // Every conjunct must hold, so ONE conjunct excluding schedule excludes the
  // whole condition. Each is matched WHOLE: an unanchored match read
  // `!(github.event_name == 'pull_request')` as if it were the equality and
  // excused a job the schedule genuinely reaches -- a false NEGATIVE in the one
  // function whose entire docstring is about not producing them. Round 2, in a
  // round-1 fix. Anchoring also means anything unfamiliar simply fails to
  // match, and an unmatched condition is judged rather than excused.
  for (const term of splitTopLevelAnd(bare)) {
    // Anchored WHOLE, which is what carries the negation case as well: a
    // conjunct like `!(github.event_name == 'pull_request')` simply does not
    // match, so it excuses nothing. An explicit `startsWith('!')` skip stood
    // here until the mutation pass showed it could be deleted with every case
    // still green -- it was doing nothing the anchors were not already doing,
    // and unasserted code in a guard is a place for a future mistake to hide.
    const eq = term.trim().match(/^github\.event_name\s*==\s*['"]([A-Za-z_]+)['"]$/);
    if (eq && !events.includes(eq[1])) return false;
  }
  return true;
}

/**
 * Classify a `retention-days` value.
 *
 * `${{ ... }}` is deliberately NOT resolved and deliberately not tolerated. Its
 * value is decided at run time from inputs this file cannot see, so a guard
 * that waved it through would be reporting a bound it never checked -- the
 * exact move this arc exists to stop. An unreadable bound is not a bound.
 */
export function classifyRetention(value) {
  // Trim BEFORE the emptiness test: `retention-days: " "` used to survive it,
  // become Number('') = 0, and be reported as "0 is not a valid retention" --
  // a number the author never wrote, in place of the truth, which is that the
  // key is blank.
  const trimmed = typeof value === 'string' ? value.trim() : value;
  if (trimmed === undefined || trimmed === null || trimmed === '') return { kind: 'missing' };
  // A LIST or a MAPPING, before anything coerces it. `retention-days: [7]`
  // used to reach String() -- which renders a one-element array as `7` -- and
  // be classified as a perfectly good 7-day retention. It is not one: GitHub
  // takes a scalar there, so the value is unreadable and, by this file's own
  // rule, a bound nobody can read is not a bound. JSON.stringify rather than
  // String for the message, since String([7]) prints the very `7` that caused
  // the mistake.
  if (typeof trimmed === 'object') {
    return { kind: 'unreadable', shown: JSON.stringify(value) };
  }
  if (typeof trimmed === 'string' && trimmed.includes('${{')) {
    return { kind: 'not-static', shown: String(value) };
  }
  const days = typeof trimmed === 'number' ? trimmed : Number(String(trimmed));
  // A malformed LITERAL is its own kind, split out from the expression case.
  // Both used to be 'not-static', whose message says "Pin a literal" -- which
  // is unhelpful advice to hand someone whose 7.5 already is one.
  // Number.isInteger is already false for NaN and Infinity, so the isFinite
  // half could never be the one that fired -- a doubled predicate reads as
  // though the two catch different inputs and invites a future edit to delete
  // the wrong one.
  if (!Number.isInteger(days)) {
    return { kind: 'unreadable', shown: String(value) };
  }
  if (days < 1) return { kind: 'invalid', days };
  if (days > RETENTION_CAP_DAYS) return { kind: 'over-cap', days };
  return { kind: 'ok', days };
}

const allowKey = (o) => o.file + ' :: ' + o.job + ' :: ' + o.step;

/**
 * The file a LOCAL `uses: ./.github/workflows/x.yml` job call points at, or
 * null when the call leaves this repository.
 *
 * The null case is the fix for a live false positive. This took the bare
 * basename of any `uses:`, so a cross-repo call --
 * `uses: otherorg/otherrepo/.github/workflows/build.yml@main` -- resolved to
 * `build.yml` and was matched against a LOCAL build.yml of the same name.
 * Verified: a `failure()` gate on the calling job then propagated into a
 * perfectly compliant push-only local workflow, reddened CI, and sent the
 * author to a calling job that contains no call to their file. It fails the
 * other way too: a remote basename shadowing a local one can mask a real
 * arrival. Only a leading `./` means this repository, and only this
 * repository's files are in `parsed`, so anything else is a call this guard
 * cannot see into -- counted as a reusable job and named in the report, which
 * is what that count is for.
 */
function calledWorkflowName(uses) {
  const target = String(uses).split('@')[0].trim();
  if (!target.startsWith('./')) return null;
  const parts = target.split('/');
  return parts[parts.length - 1];
}

/**
 * How a SCHEDULE run arrives at each workflow, if it arrives at all.
 *
 * This replaces a plain trigger propagation, and the replacement is the fix for
 * the fourth one-level-up miss rather than a refactor. Triggers alone answered
 * "does a schedule reach this file", which is only two thirds of the question.
 * The other third is what the schedule passed THROUGH to get here: a caller
 * whose job is `if: failure()` hands the callee a run that only happens when
 * something failed, and every upload in that callee is then gated on failure
 * without a single `failure()` appearing in the callee's own text. That is the
 * incident, moved one file over. A caller gated on `github.event_name ==
 * 'pull_request'` is the mirror image: a schedule cannot come down that edge at
 * all, so costing the callee against it would be the false positive
 * scheduleCanReach exists to prevent, one level up.
 *
 * Each workflow gets two booleans rather than one, because they are genuinely
 * different arrivals and the rule treats them differently:
 *
 *   plain  a schedule run reaches this file with NO failure gate on the path.
 *          An upload here needs a gate of its OWN to be flagged.
 *   gated  a schedule run reaches it only behind somebody's failure gate.
 *          Every upload here is flagged whatever its own condition says --
 *          there is nothing left for it to add.
 *
 * Both can be true at once (two callers, one of each), and that is not a
 * contradiction: it means both arrivals exist, and the gated one is enough.
 * Once gated, always gated -- a second gate further down the chain cannot
 * un-gate a run that already only happens on failure.
 *
 * `gatedBy` remembers the FIRST edge that gated the path, so the violation can
 * name a file and job the author can actually go and look at. Without it the
 * message would say "gated on failure" and point at a file whose text contains
 * no such thing.
 *
 * There are TWO kinds of edge, and the second was a fifth level this file's own
 * enumeration had missed. A job-level `uses:` is one. The other is
 * `on: workflow_run`, which is how the canonical collector is written: a
 * separate file that fires when the nightly completes and uploads
 * `if: github.event.workflow_run.conclusion == 'failure'`. Its own triggers say
 * `workflow_run`, so before this it was never on a schedule, never judged, and
 * scanned clean over the incident's exact shape. That edge yields a PLAIN
 * arrival deliberately: the run happens on every completion whatever the
 * conclusion, so the downstream file must supply its own gate to be flagged --
 * and it invariably does, which is what A3 then reads.
 *
 * Iterated to a fixed point so a chain propagates, and monotone (booleans only
 * ever go false -> true) so the pass bound is sufficient rather than merely
 * hopeful. If it ever fails to settle inside that bound it THROWS, which
 * main() turns into exit 2. Returning a half-propagated map would report every
 * unreached file as "no schedule arrives here" and print a clean pass -- an
 * unknown recorded as the most permissive value, which is the failure mode this
 * whole arc exists to refuse. Nothing today can exhaust the bound; the point is
 * that the next edge kind added here cannot do it silently.
 */
export function propagateScheduleArrival(parsed, opts = {}) {
  const maxPasses = opts.maxPasses ?? parsed.length + 1;
  const arrival = new Map(
    parsed.map((w) => [
      w.name,
      {
        plain: (w.triggers ?? []).includes('schedule'),
        gated: false,
        gatedBy: null,
        // WHICH event the run arrives as, which is not always `schedule`. A
        // workflow_call callee sees the original event; a workflow_run
        // collector sees `workflow_run`. Reachability is asked against this,
        // because a collector's own `github.event_name` test is about
        // workflow_run and would otherwise excuse it from the level added to
        // catch it.
        events: new Set((w.triggers ?? []).includes('schedule') ? ['schedule'] : []),
      },
    ]),
  );
  // workflow_run names its upstreams by the workflow's `name:`, not its file.
  // Name -> EVERY file with that name, not the first. Two workflows may legally
  // share a display name, and GitHub fires workflow_run for both; keeping only
  // the first resolved a watch to whichever sorted earlier and silently lost
  // the arrival if the other was the scheduled one. Unknown resolved towards
  // LESS reach, which readWorkflowRunWatches deliberately refuses one level up.
  const byWorkflowName = new Map();
  for (const w of parsed) {
    if (typeof w.workflowName !== 'string') continue;
    const list = byWorkflowName.get(w.workflowName) ?? [];
    list.push(w.name);
    byWorkflowName.set(w.workflowName, list);
  }
  let settled = false;
  for (let pass = 0; pass < maxPasses && !settled; pass++) {
    let changed = false;
    for (const wf of parsed) {
      const from = arrival.get(wf.name);
      // No schedule has reached the caller, so it has none to pass on. This is
      // also what keeps a `failure()` gate on a push-only workflow out of A3
      // entirely, which is right: off the schedule, the conditional is bounded
      // by how often anyone pushes.
      if (!from || (!from.plain && !from.gated)) continue;
      for (const call of wf.calls ?? []) {
        const to = arrival.get(call.target);
        // A called file this scan does not hold -- a reusable workflow in
        // another repository, say. Nothing to propagate to, and nothing this
        // guard can claim about it; the report names reusable jobs as the
        // uncovered surface they are.
        if (!to) continue;
        // The caller's own job condition, read at the level it is written at,
        // and against the event the CALLER's run arrives as.
        if (!scheduleCanReach(call.jobIf, [...from.events])) continue;
        const gate = conditionIsFailureGate(call.jobIf);
        // A workflow_call callee runs as the original event, so the caller's
        // event names travel down the edge unchanged.
        for (const e of from.events) {
          if (to.events.has(e)) continue;
          to.events.add(e);
          changed = true;
        }
        if ((from.gated || gate) && !to.gated) {
          to.gated = true;
          to.gatedBy = gate
            ? { file: wf.name, job: call.job, expr: call.jobIf }
            : from.gatedBy;
          changed = true;
        }
        if (from.plain && !gate && !to.plain) {
          to.plain = true;
          changed = true;
        }
      }
    }

    // The workflow_run edge, walked in the same pass so a chain of collectors
    // propagates like any other. Direction is inverted from a `uses:` call --
    // the DOWNSTREAM file names its upstreams -- which is why it is a separate
    // loop rather than another branch inside the one above.
    for (const wf of parsed) {
      const watch = wf.watch;
      if (!watch || !watch.present) continue;
      const to = arrival.get(wf.name);
      if (!to || to.plain) continue;
      // A name this scan cannot resolve widens the watch to EVERYTHING rather
      // than dropping it. A workflow with no `name:` key takes its file path as
      // its display name, which is not recorded here; a typo, or a cross-repo
      // name, resolves to nothing either. Dropping them silently is the same
      // unknown-as-less-reach mistake, one level further down.
      const unresolved = !watch.any && watch.names.some((n) => !byWorkflowName.has(n));
      const upstreams = watch.any || unresolved
        ? parsed.map((p) => p.name)
        : watch.names.flatMap((n) => byWorkflowName.get(n) ?? []);
      for (const upstream of upstreams) {
        if (upstream === wf.name) continue;
        const from = arrival.get(upstream);
        // Either arrival counts. workflow_run fires when the upstream WORKFLOW
        // completes, not when a particular job in it ran, so a schedule that
        // reaches the upstream at all reaches this collector.
        if (!from || (!from.plain && !from.gated)) continue;
        to.plain = true;
        // Inside a collector the run is a workflow_run, whatever triggered the
        // upstream. This is the whole reason arrivals carry an event set.
        to.events.add('workflow_run');
        changed = true;
        break;
      }
    }

    settled = !changed;
  }
  if (!settled) {
    throw new Error(
      'schedule-arrival propagation did not settle in ' + maxPasses + ' pass(es) over ' +
      parsed.length + ' workflow(s). A half-propagated map reads as "no schedule reaches this file" ' +
      'for everything it did not get to, which is a clean pass over an unmeasured repo.',
    );
  }
  return arrival;
}

/**
 * EVERY kind findViolations is allowed to emit, declared in one place.
 *
 * This exists so the self-probe's coverage can be asserted against the CODE
 * instead of against a copy of itself. SELF_PROBE_EXPECTS listed eight kinds
 * while the detector could emit nine -- `allowlist-ambiguous` was missing --
 * and the canary case that was supposed to notice compared the list to a
 * hardcoded literal of the same eight. Two copies of the same omission agree
 * perfectly, so the case passed, and the one control that is meant to be the
 * last line of cover in a zero-upload repo had a rule it could not see.
 *
 * A kind not listed here THROWS at the point of emission rather than being
 * quietly reported, which turns "someone added a rule and forgot the probe"
 * from an invisible hole into exit 2 on the first run that provokes it.
 */
export const VIOLATION_KINDS = Object.freeze([
  'retention-missing',
  'retention-over-cap',
  'retention-not-static',
  'retention-unreadable',
  'retention-invalid',
  'schedule-failure-upload',
  'allowlist-ambiguous',
  'allowlist-stale',
  'budget-guard-uploads',
]);

/** One violation, refusing any kind the registry above does not know. */
function violation(rule, kind, where, detail) {
  if (!VIOLATION_KINDS.includes(kind)) {
    throw new Error(
      'unregistered violation kind `' + kind + '`: add it to VIOLATION_KINDS and give the ' +
      'self-probe fixture a case that provokes it. A rule the positive control cannot see is a ' +
      'rule that can stop matching without anything going red.',
    );
  }
  return { rule, kind, file: where.file, job: where.job, step: where.step, detail };
}

/**
 * Every violation across every parsed workflow, plus the allowlist bookkeeping.
 *
 * `parsed` is the output of parseWorkflow per file. Pure: it reads no disk and
 * no clock, which is what lets the canary drive it against fixtures.
 */
export function findViolations(parsed, cfg = {}) {
  const allowlist = cfg.allowlist ?? SCHEDULE_FAILURE_ALLOWLIST;
  const noUpload = cfg.noUploadWorkflows ?? NO_UPLOAD_WORKFLOWS;
  const violations = [];
  const allowedHit = new Set();
  const flagged = [];
  // How a schedule run ARRIVES here, not merely whether one does. A called
  // workflow declares `on: workflow_call` and nothing else, so A3 -- the only
  // rule that reads triggers -- silently never applied to it, while A1 and A2
  // did: the file was reported on as though covered with its one cost-shape
  // rule dead. And the arrival carries the caller's condition, so a `failure()`
  // gate on the CALLING job is read at the level it is written at.
  const arrival = propagateScheduleArrival(parsed);

  for (const wf of parsed) {
    // No `??` default. The map is built from this very array, so the lookup
    // cannot miss -- and a fallback that cannot fire is a place a future edit
    // lands quietly, which is what the dead arms below turned out to be.
    const arrivedBy = arrival.get(wf.name);

    for (const up of wf.uploads) {
      const retention = classifyRetention(up.retention);
      if (retention.kind === 'missing') {
        violations.push(violation('A1', 'retention-missing', up,
          'no retention-days: this upload inherits the ACCOUNT default, so its cost is set where the reviewer of this step cannot see it'));
      } else if (retention.kind === 'over-cap') {
        violations.push(violation('A2', 'retention-over-cap', up,
          'retention-days ' + retention.days + ' exceeds this project\'s budget of ' + RETENTION_CAP_DAYS + ' days. Held storage is retention x frequency x size, and retention is the only one of the three this file states out loud.'));
      } else if (retention.kind === 'not-static') {
        violations.push(violation('A2', 'retention-not-static', up,
          'retention-days is the expression `' + retention.shown + '`, decided at run time from inputs this file does not contain. Pin a literal: a bound nobody can read is not a bound.'));
      } else if (retention.kind === 'unreadable') {
        violations.push(violation('A2', 'retention-unreadable', up,
          'retention-days is `' + retention.shown + '`, which is not a whole number of days. GitHub takes an integer 1-90, as a scalar.'));
      } else if (retention.kind === 'invalid') {
        violations.push(violation('A2', 'retention-invalid', up,
          'retention-days ' + retention.days + ' is not a valid retention (1-' + RETENTION_CAP_DAYS + ')'));
      }

      // THREE levels, and the third is why this reads an arrival rather than a
      // boolean. The gate can sit on the step, on the job, or on the job in
      // ANOTHER FILE that calls this one -- and reachability must be read at
      // every level too: an earlier draft applied it to the job only, so the
      // false positive it was written to stop still fired one indentation level
      // down, on `if: github.event_name == 'pull_request' && failure()`.
      const stepGate = conditionIsFailureGate(up.ifExpr);
      const jobGate = conditionIsFailureGate(up.jobIf);
      // A schedule that ONLY arrives behind somebody's failure gate makes every
      // upload here failure-gated, whatever this file says; the upload has
      // nothing left to add, so its own condition is not consulted for the gate,
      // only for whether a schedule reaches it at all.
      //
      // `&& !arrivedBy.plain` is load-bearing, and its absence was a false
      // POSITIVE found in review. If an UNGATED caller also reaches this file,
      // the upload genuinely runs on every tick: its cost is bounded by
      // retention, no conditional is disguising anything, and A3 has nothing to
      // refuse. Flagging it would have bought an allowlist entry whose required
      // justification -- "this job sometimes succeeds" -- says nothing at all
      // about the case, which is the exact reflex the allowlist docstring says
      // the allowlist exists to prevent. A canary case had asserted that
      // behaviour as CORRECT, which is why no case could have found it.
      const callerGate = arrivedBy.gated && !arrivedBy.plain;
      const arrivesAs = [...arrivedBy.events];
      const reachable = scheduleCanReach(up.jobIf, arrivesAs) && scheduleCanReach(up.ifExpr, arrivesAs);
      if (reachable && (callerGate || (arrivedBy.plain && (stepGate || jobGate)))) {
        const by = arrivedBy.gatedBy;
        flagged.push({
          up,
          // The expression that ACTUALLY gated on failure, not whichever one
          // exists. Reporting `up.ifExpr ?? up.jobIf` sent the author to a step
          // condition that was merely present -- `hashFiles(...) != ''` -- and
          // told them it was a failure gate, which it is not. The caller case
          // has to name its file and job as well, or the message points at a
          // file whose text contains no failure gate anywhere.
          expr: stepGate ? up.ifExpr : jobGate ? up.jobIf : by.expr,
          // A COMPLETE phrase. The message used to append the word " level" to
          // this, which reads correctly for the bare nouns 'step' and 'job' and
          // printed "(the calling job `go` in nightly.yml level)" for the third
          // case -- and the two canary assertions on that message stopped just
          // short of the broken tail, so the suite written to prove the message
          // names the right thing could not see it.
          level: stepGate
            ? 'step level'
            : jobGate
              ? 'job level'
              : 'gated by the calling job `' + by.job + '` in ' + by.file,
        });
      }
    }
  }

  // A3 verdicts, decided once the whole set is known so ambiguity is visible.
  const perKey = new Map();
  for (const f of flagged) {
    const key = allowKey(f.up);
    perKey.set(key, (perKey.get(key) ?? 0) + 1);
  }
  const ambiguousReported = new Set();
  for (const f of flagged) {
    const key = allowKey(f.up);
    const entry = allowlist.find((a) => allowKey(a) === key);
    // Two flagged uploads sharing a key -- same job, same step name, or both
    // unnamed and collapsed to '(unnamed step)' -- cannot be told apart by an
    // allowlist entry, so ONE entry would silently exempt BOTH, including one
    // nobody reviewed. Refuse the ambiguity rather than resolve it by
    // position: the design's whole claim is that each exception is a decision.
    if (perKey.get(key) > 1) {
      // An entry naming this key is UNUSABLE, which is what the ambiguity
      // already says -- it is not STALE. Marking it hit is the fix for a
      // second violation that contradicted the first: the author was told the
      // entry matched two steps and, in the next paragraph, that it matched
      // none and should be deleted. Deleting it would have been wrong, and it
      // is the only instruction the guard gave that could not be followed.
      if (entry) allowedHit.add(key);
      // ONCE per key, not once per upload. The finding is about a NAME being
      // shared, so N identical paragraphs for one shared name is N-1 copies of
      // the same instruction, and it reads as N problems.
      if (ambiguousReported.has(key)) continue;
      ambiguousReported.add(key);
      violations.push(violation('A3', 'allowlist-ambiguous', f.up,
        perKey.get(key) + ' failure-gated uploads in this job share the step name `' + f.up.step +
        '`, so no allowlist entry can name just one of them -- one entry would exempt all of them, ' +
        'including whichever nobody reviewed. Give each step a distinct name.'));
      continue;
    }
    if (entry) {
      allowedHit.add(key);
      continue;
    }
    violations.push(violation('A3', 'schedule-failure-upload', f.up,
      'if: `' + f.expr + '` (' + f.level +
      ') gates this upload on failure, on a workflow that runs on a schedule. That bounds cost ONLY if the job sometimes succeeds -- on a never-green job it is an unconditional upload wearing a conditional. If this job really is ordinarily green, say so in SCHEDULE_FAILURE_ALLOWLIST with the reason.'));
  }

  for (const name of noUpload) {
    const wf = parsed.find((w) => w.name === name);
    if (!wf) continue; // absence is an INCLUSION failure, raised in assertInclusion
    for (const up of wf.uploads) {
      violations.push(violation('A4', 'budget-guard-uploads', up,
        name + ' must upload nothing: it reads the artifact pool it would be joining, and a guard that measures itself is the failure it exists to catch'));
    }
  }

  for (const entry of allowlist) {
    const key = allowKey(entry);
    if (allowedHit.has(key)) continue;
    violations.push(violation('A3', 'allowlist-stale', entry,
      'allowlisted as "' + entry.reason + '", but no schedule+failure() upload matches it any more. Delete the entry -- and check the construct is GONE rather than renamed, because an entry that outlives its step transfers the exception to whatever takes the name.'));
  }

  return violations;
}

// ---------------------------------------------------------------------------
// Inclusion -- the part that makes a clean report mean something
// ---------------------------------------------------------------------------

/**
 * A workflow carrying one of every violation, used to prove the DETECTOR works
 * on every single run before the repo's own result is believed.
 *
 * A static guard's way of going blind is a rule that matches nothing, and from
 * the outside that is indistinguishable from a compliant repo. The floors below
 * catch a broken traversal; they cannot catch a broken MATCHER in a repo whose
 * honest answer is zero -- which is bachata-admin today, where this same file
 * is the enforcement copy and there is not one upload step to notice with.
 * So the guard carries its own positive control and runs it unconditionally.
 *
 * It covers MECHANISMS, not just kinds, and that distinction was a review
 * finding. The fixture used to be a single file whose failure gate sat on a
 * step, so the whole call-propagation and caller-gate machinery was never
 * exercised on a live run: it could regress to a no-op and the probe would
 * still see `schedule-failure-upload` coming from the direct step gate and
 * report the detector alive. In bachata-admin, where the upload floor is
 * legitimately 0 and this probe is the ONLY remaining control, a repo that had
 * moved its uploads behind `workflow_call` would then have reported clean with
 * A3 dead -- the exact scenario the probe exists to make impossible. There are
 * now three independent routes to that one kind, which is why the expectations
 * below are keyed by FILE as well as kind.
 *
 * Nothing here reads CONFIG. The A4 fixture used to be named after this repo's
 * real ci-budget-guard.yml, which made the probe -- a control for the DETECTOR
 * -- depend on a per-repo setting. Its subject is a fixture-local name now, so
 * porting this file cannot break its own positive control.
 */
const PROBE_NO_UPLOAD_FILE = 'zz-probe-budget-guard.yml';
const SELF_PROBE = [
  {
    name: 'zz-self-probe.yml',
    text: [
      'name: Self Probe',
      'on:',
      '  schedule:',
      "    - cron: '0 0 * * *'",
      'jobs:',
      '  probe:',
      '    runs-on: ubuntu-latest',
      '    steps:',
      '      - name: unbounded upload on failure',
      '        if: failure()',
      '        uses: actions/upload-artifact@v7',
      '      - name: upload retained past the cap',
      '        uses: actions/upload-artifact@v7',
      '        with:',
      '          retention-days: 90',
      '      - name: retention behind an expression',
      '        uses: actions/upload-artifact@v7',
      '        with:',
      '          retention-days: ${{ inputs.days }}',
      '      - name: retention that is a literal but not a day count',
      '        uses: actions/upload-artifact@v7',
      '        with:',
      "          retention-days: 'soon'",
      '      - name: retention below the legal floor',
      '        uses: actions/upload-artifact@v7',
      '        with:',
      '          retention-days: 0',
      // Two steps sharing one name, so no allowlist entry could name just one.
      // The pair is here because the probe's kind list omitted
      // `allowlist-ambiguous` while claiming to carry one of every violation,
      // and the fixture could not have provoked it even if the list had said
      // so. A list that names a kind the fixture cannot produce is a promise,
      // not a control.
      '      - name: an ambiguous pair, sharing one step name',
      '        if: failure()',
      '        uses: actions/upload-artifact@v7',
      '        with:',
      '          retention-days: 7',
      '      - name: an ambiguous pair, sharing one step name',
      '        if: failure()',
      '        uses: actions/upload-artifact@v7',
      '        with:',
      '          retention-days: 7',
    ].join('\n'),
  },
  {
    name: PROBE_NO_UPLOAD_FILE,
    text: [
      'name: Self Probe Budget Guard',
      'on:',
      '  schedule:',
      "    - cron: '0 0 * * *'",
      'jobs:',
      '  measure:',
      '    runs-on: ubuntu-latest',
      '    steps:',
      '      - name: an upload the real guard must never have',
      '        uses: actions/upload-artifact@v7',
      '        with:',
      '          retention-days: 7',
    ].join('\n'),
  },
  // MECHANISM 2: the gate on a CALLING job, with the upload in another file and
  // no condition of its own. If the call edge, the carried condition, or the
  // gated arrival regresses, this one stops being flagged while the step-level
  // gate above goes on reporting the detector alive.
  {
    name: 'zz-probe-caller.yml',
    text: [
      'name: Self Probe Caller',
      'on:',
      '  schedule:',
      "    - cron: '0 0 * * *'",
      'jobs:',
      '  go:',
      '    if: failure()',
      '    uses: ./.github/workflows/zz-probe-called.yml',
    ].join('\n'),
  },
  {
    name: 'zz-probe-called.yml',
    text: [
      'name: Self Probe Called',
      'on:',
      '  workflow_call:',
      'jobs:',
      '  collect:',
      '    runs-on: ubuntu-latest',
      '    steps:',
      '      - name: upload with no condition of its own',
      '        uses: actions/upload-artifact@v7',
      '        with:',
      '          retention-days: 7',
    ].join('\n'),
  },
  // MECHANISM 3: the workflow_run collector -- a separate file that fires when
  // the nightly completes and uploads on its conclusion. Its own triggers say
  // `workflow_run`, so nothing here is on a schedule by its own account.
  {
    name: 'zz-probe-nightly.yml',
    text: [
      'name: Self Probe Nightly',
      'on:',
      '  schedule:',
      "    - cron: '0 0 * * *'",
      'jobs:',
      '  run:',
      '    runs-on: ubuntu-latest',
      '    steps:',
      '      - run: echo nightly',
    ].join('\n'),
  },
  {
    name: 'zz-probe-collector.yml',
    text: [
      'name: Self Probe Collector',
      'on:',
      '  workflow_run:',
      "    workflows: ['Self Probe Nightly']",
      '    types: [completed]',
      'jobs:',
      '  collect:',
      // The event_name conjunct is here deliberately. Without it the probe
      // could not see the round-2 defect where reachability was asked as
      // `schedule` inside a collector whose event is always `workflow_run` --
      // the collector excused itself from the level added to catch it, and the
      // positive control agreed, because its fixture omitted the one term that
      // triggers it. A control that omits the hard case is not a control.
      "    if: github.event_name == 'workflow_run' && github.event.workflow_run.conclusion == 'failure'",
      '    runs-on: ubuntu-latest',
      '    steps:',
      '      - name: upload the failed run',
      '        uses: actions/upload-artifact@v7',
      '        with:',
      '          retention-days: 7',
    ].join('\n'),
  },
];

/**
 * EVERY kind the detector can emit. Fewer than all of them means blind.
 *
 * It has been short twice. First it listed four of the eight while the
 * docstring claimed "one of each violation"; the three retention kinds it
 * omitted are the ones whose regressions are quietest -- an expression
 * re-classified as ok, say. Then, at eight of nine, it omitted
 * `allowlist-ambiguous`, and the case meant to catch that compared this list to
 * a hardcoded copy of itself, so two identical omissions agreed and the case
 * passed.
 *
 * It is now asserted three ways, and the third is the one that would have
 * caught both: against VIOLATION_KINDS (the kinds the CODE can emit, not a
 * literal), against the kinds the fixture actually provokes, and in the
 * direction that catches a kind listed here but unprovokable.
 */
const SELF_PROBE_EXPECTS = [
  'retention-missing::zz-self-probe.yml',
  'retention-over-cap::zz-self-probe.yml',
  'retention-not-static::zz-self-probe.yml',
  'retention-unreadable::zz-self-probe.yml',
  'retention-invalid::zz-self-probe.yml',
  'allowlist-ambiguous::zz-self-probe.yml',
  'allowlist-stale::zz-self-probe.yml',
  'budget-guard-uploads::' + PROBE_NO_UPLOAD_FILE,
  // The same KIND by three different routes, which is the point of keying these
  // by file. Kind alone let two whole mechanisms regress in silence, because the
  // step-level gate kept producing the kind on its own.
  'schedule-failure-upload::zz-self-probe.yml',
  'schedule-failure-upload::zz-probe-called.yml',
  'schedule-failure-upload::zz-probe-collector.yml',
];

/**
 * An allowlist entry matching nothing in the fixture, so the probe exercises
 * the stale-entry path too. Named to be unmistakable if it ever surfaces.
 */
const SELF_PROBE_ALLOWLIST = [
  { file: 'zz-self-probe.yml', job: 'no-such-job', step: 'no-such-step', reason: 'built-in positive control for the stale-entry rule' },
];

/**
 * Run the positive control. Returns [] when the detector is demonstrably alive,
 * or one blocker naming what it failed to see.
 */
export function runSelfProbe() {
  const parsed = SELF_PROBE.map((f) => parseWorkflow(f.name, f.text));
  const broken = parsed.flatMap((p) => p.problems);
  if (broken.length > 0) {
    return [{
      kind: 'self-probe',
      detail: 'the built-in fixture no longer parses (' + broken[0].detail + '), so the detector could not be proved alive',
    }];
  }
  return probeVerdict(new Set(probeKeys(parsed)));
}

/** The violation keys the fixture actually produces, as `kind::file`. */
export function probeKeys(parsed) {
  return findViolations(parsed, {
    allowlist: SELF_PROBE_ALLOWLIST,
    noUploadWorkflows: [PROBE_NO_UPLOAD_FILE],
  }).map((v) => v.kind + '::' + v.file);
}

/**
 * The probe's JUDGEMENT, split out from the run so it can be driven directly.
 *
 * It is split for one measured reason. While this function was inlined above,
 * a mutant that replaced its comparison with `return []` -- a probe that
 * reports the detector alive without looking at what it saw -- SURVIVED the
 * whole canary. The only assertion on the probe was `runSelfProbe().length === 0`,
 * which stays 0 when the probe can no longer fail. The watchman had no watchman.
 */
export function probeVerdict(keys) {
  const missed = SELF_PROBE_EXPECTS.filter((k) => !keys.has(k));
  if (missed.length === 0) return [];
  return [{
    kind: 'self-probe',
    detail: 'the detector did NOT flag its own fixture for: ' + missed.join(', ') +
      '. Each entry is kind::file, so a rule that still fires by one route and not another is named ' +
      'here rather than covered up by the route that still works. A rule that no longer matches reports ' +
      'every repo as clean, so this is exit 2 and not a pass.',
  }];
}

/**
 * The floors, plus the assertion that each no-upload workflow actually exists.
 *
 * That second one matters more than it looks: A4 is a rule about the ABSENCE of
 * something, and absence rules pass triumphantly when their subject is deleted
 * or renamed. "ci-budget-guard.yml uploads nothing" is trivially true of a file
 * that is not there.
 */
export function assertInclusion(stats, cfg = {}) {
  const floors = cfg.floors ?? FLOORS;
  const noUpload = cfg.noUploadWorkflows ?? NO_UPLOAD_WORKFLOWS;
  const blockers = [];
  // THREE dimensions, not four. The JOBS floor is gone: the
  // declared-versus-walked invariant in parseWorkflow does that job properly.
  // What is left is what the invariant cannot see -- the directory read, the
  // upload matcher, and a collapse at or below the YAML parse, where both
  // halves of the invariant read the same truncated document and agree. See
  // the FLOORS docstring for why no step floor can be a TRAVERSAL gate, which
  // is a different claim from the one this floor makes.
  const pairs = [
    ['workflowFiles', 'workflow files parsed'],
    ['uploadSteps', 'upload-artifact steps found'],
    ['steps', 'steps walked'],
  ];

  // A floor declared and never read is not a floor, and it reads exactly like
  // one. This is the twin of the undeclared-floor blocker below: that one
  // refuses to treat an unknown as permissive, and this one refuses to let a
  // number sit in CONFIG looking like a gate while nothing asserts it. It is
  // how the removal above would be noticed if a future edit put `steps` back in
  // FLOORS and forgot to assert it.
  const known = pairs.map(([key]) => key);
  for (const key of Object.keys(floors)) {
    if (known.includes(key)) continue;
    blockers.push({
      kind: 'floor',
      detail: 'FLOORS.' + key + ' is declared but nothing asserts it. Either assert it or delete it -- a floor nobody reads is indistinguishable from one that passes.',
    });
  }

  for (const [key, label] of pairs) {
    const floor = floors[key];
    // An ABSENT floor is a blocker, not a floor of zero. `floors[key] ?? 0`
    // meant that mistyping a key in FLOORS -- uploadSteps as uploadsteps --
    // switched that inclusion gate off in silence, and a scan that walked
    // nothing then cleared inclusion. Recording an unknown as the most
    // permissive value is this arc's own failure mode: it fails OPEN, and the
    // gate it disables is the one this file calls the only thing standing
    // between a clean report and a blind one.
    if (typeof floor !== 'number' || !Number.isFinite(floor)) {
      blockers.push({
        kind: 'floor',
        detail: 'no floor declared for ' + label + ' (FLOORS.' + key +
          ' is ' + JSON.stringify(floor) + '). An undeclared floor is not a floor of zero.',
      });
      continue;
    }
    try {
      assertMeasured(stats[key] ?? 0, floor, label);
    } catch (error) {
      blockers.push({
        kind: 'floor',
        detail: error.message + ' -- check the GUARD before the repo: a traversal that broke reads exactly like a repo that shrank.',
      });
    }
  }

  for (const name of noUpload) {
    if (stats.seenFiles.includes(name)) continue;
    blockers.push({
      kind: 'missing-subject',
      detail: name + ' was not found in ' + WORKFLOW_DIR + '. Rule A4 asserts that file uploads nothing, which is vacuously true of a file that does not exist -- so this is exit 2, not a pass.',
    });
  }

  return blockers;
}

// ---------------------------------------------------------------------------
// Analysis + report
// ---------------------------------------------------------------------------

/**
 * The whole verdict from a list of { name, text } files. Pure -- no disk, no
 * clock, no network -- so the canary drives exactly this function rather than
 * an approximation of it.
 *
 * ORDER IS THE CONTRACT. The self-probe runs FIRST and short-circuits: if the
 * detector cannot be shown to work, nothing that follows is worth printing,
 * and printing it anyway is how a broken guard produces a clean report.
 */
export function analyse(files, cfg = {}) {
  const probe = (cfg.selfProbe ?? runSelfProbe)();
  if (probe.length > 0) return { code: 2, blockers: probe, violations: [], stats: null, parsed: [] };

  const parsed = files.map((f) => parseWorkflow(f.name, f.text));
  const blockers = parsed.flatMap((p) =>
    p.problems.map((pr) => ({ kind: pr.kind, detail: pr.file + ': ' + pr.detail })),
  );

  const stats = {
    workflowFiles: parsed.length,
    jobs: parsed.reduce((n, p) => n + p.jobs, 0),
    steps: parsed.reduce((n, p) => n + p.steps, 0),
    // Carried so the report can print the invariant it cleared rather than
    // merely having cleared it. A gate nobody sees in the log is a gate the
    // next reader has to take on trust -- and the floors it replaced were
    // trusted for exactly that long.
    declaredJobs: parsed.reduce((n, p) => n + (p.declaredJobs ?? 0), 0),
    declaredSteps: parsed.reduce((n, p) => n + (p.declaredSteps ?? 0), 0),
    uploadSteps: parsed.reduce((n, p) => n + p.uploads.length, 0),
    reusableJobs: parsed.reduce((n, p) => n + p.reusableJobs, 0),
    seenFiles: parsed.map((p) => p.name),
  };

  blockers.push(...assertInclusion(stats, cfg));

  if (blockers.length > 0) return { code: 2, blockers, violations: [], stats, parsed };

  const violations = findViolations(parsed, cfg);
  const allowlist = cfg.allowlist ?? SCHEDULE_FAILURE_ALLOWLIST;
  const noUploadWorkflows = cfg.noUploadWorkflows ?? NO_UPLOAD_WORKFLOWS;
  return {
    code: violations.length > 0 ? 1 : 0,
    blockers: [],
    violations,
    stats,
    parsed,
    allowlist,
    noUploadWorkflows,
  };
}

function report(result, out, err) {
  const { stats } = result;

  if (result.code === 2) {
    err('\nWorkflow artifact policy: COULD NOT RUN (exit 2).\n');
    err('This is not a pass. Every line below is a reason the scan cannot be believed.\n');
    for (const b of result.blockers) err('  ! [' + b.kind + '] ' + b.detail);
    err('');
    return;
  }

  const measured = stats
    ? stats.workflowFiles + ' workflow file(s), ' + stats.jobs + ' job(s), ' +
      stats.steps + ' step(s), ' + stats.uploadSteps + ' upload-artifact step(s)'
    : 'nothing';

  if (result.code === 0) {
    out('Workflow artifact policy passed -- measured ' + measured + '.');
    out('  detector proved alive against its own fixture before reporting.');
    // Printed even though it is guaranteed true at exit 0: the numbers are the
    // point. A reader who sees 28/28 and 221/221 knows the walk was complete
    // AND knows what complete was, which is the thing four drafts of guessed
    // floors could never tell anyone.
    out('  walk was complete: ' + stats.jobs + ' of ' + stats.declaredJobs + ' declared job(s), ' +
      stats.steps + ' of ' + stats.declaredSteps + ' declared step(s), counted by two separate reads.');
    // The accepted exceptions, printed. The design leans on each one carrying
    // a reason "so the next one is a decision instead of an accident" -- and
    // then kept every reason inside the source file, visible to nobody reading
    // a CI log. An exception nobody sees is not a decision either.
    const allowlist = result.allowlist ?? [];
    for (const a of allowlist) {
      out('  allowed exception: ' + a.file + ' / ' + a.job + ' / ' + a.step);
      out('      because ' + a.reason);
    }
    if (stats && stats.reusableJobs > 0) {
      out('  NOT covered: ' + stats.reusableJobs + ' reusable-workflow job(s), whose steps live in the called file.');
      out('      Composite actions under .github/actions are outside this scan for the same reason.');
    }
    return;
  }

  err('\nWorkflow artifact policy FAILED: an artifact upload is not cost-bounded.\n');
  err('Measured ' + measured + '.\n');
  for (const v of result.violations) {
    err('  x ' + v.rule + ' ' + v.kind);
    err('    ' + v.file + '  job `' + v.job + '`  step `' + v.step + '`');
    err('    ' + v.detail);
    err('');
  }
  // The legend must cover every kind the list above can contain, not the four
  // rule names. A reader who hit `allowlist-ambiguous` or `allowlist-stale`
  // found a legend explaining three rules that were not their problem.
  err('  A1/A2  every upload sets retention-days, and it is a literal <= ' + RETENTION_CAP_DAYS + '.');
  err('  A3     an if: failure() upload on a schedule: workflow needs an allowlist entry with a reason.');
  err('         The gate counts wherever it is written -- on the step, on the job, or on a job in');
  err('         another file that calls this one.');
  err('         allowlist-ambiguous: two such uploads share a step name, so no entry can name one of');
  err('         them. Rename the steps; do not add an entry, because it would exempt both.');
  err('         allowlist-stale: an entry matches nothing. Delete it once you have checked the');
  err('         construct is gone rather than renamed.');
  err('  A4     ' + (result.noUploadWorkflows ?? NO_UPLOAD_WORKFLOWS).join(', ') +
    ' upload nothing; they read the pool they would join.');
  // The accepted exceptions belong on the FAILURE path too, and leaving them
  // only on the pass path was backwards: the reader who needs to compare their
  // flagged step against the ones already accepted, and with what reason, is by
  // definition looking at a red build. An allowlist-stale violation in
  // particular is unreadable without the surrounding entries.
  const allowlist = result.allowlist ?? [];
  if (allowlist.length > 0) {
    err('');
    err('  Already accepted, for comparison:');
    for (const a of allowlist) {
      err('    ' + a.file + ' / ' + a.job + ' / ' + a.step);
      err('        because ' + a.reason);
    }
  }
  err('');
}

// ---------------------------------------------------------------------------
// CLI
//
// The 0/1/2 contract lives here and nowhere else, so the canary drives THIS
// function for the exit-code cases rather than asserting rules and hoping the
// codes follow. P2 learned that the hard way by mutation: flipping a `return 2`
// to `return 0` left all 88 of its rule cases green, because not one of them
// had ever called main().
//
// The collaborators are injectable for that reason only -- the disk and the
// console are what make the branches below otherwise unreachable from a test.
// ---------------------------------------------------------------------------

export function main(argv = [], deps = {}) {
  const {
    out = console.log,
    err = console.error,
    root = ROOT,
    listFiles = null,
    cfg = {},
    // Injectable for one reason: without it, the canary cannot assert the
    // --self-test exit code, because calling main(['--self-test']) from inside
    // selfTest recurses forever. The seam is what makes "a broken detector
    // reports 2" a measured claim rather than a written one.
    runSelfTest = selfTest,
  } = deps ?? {};

  const KNOWN_FLAGS = ['--self-test'];
  const unknown = argv.filter((a) => !KNOWN_FLAGS.includes(a));
  if (unknown.length > 0) {
    err('Unknown flag(s): ' + unknown.join(', ') + '. Known: ' + KNOWN_FLAGS.join(', '));
    return 2;
  }
  if (argv.includes('--self-test')) {
    // 2, not 1. A failing canary means the DETECTOR is broken, which is the
    // textbook could-not-run condition -- the same thing analyse() returns 2
    // for when the live probe comes back blind. Returning 1 would tell a
    // reader (or anything branching on the code to choose between "fix your
    // workflow" and "fix the guard") that an upload is unbounded, when what is
    // actually unbounded is the guard's own reliability.
    return runSelfTest(out, err) ? 0 : 2;
  }

  // The WHOLE body, not just the disk read. Only the read was wrapped at
  // first, so a throw anywhere in parsing, the rules, or the report escaped
  // main() and node exited 1 -- the code reserved for "policy violated". A
  // broken guard would have been read as an unbounded upload, inverting the
  // one distinction this CLI's docstring calls its contract.
  try {
    const files = listFiles ? listFiles() : readWorkflowsFromDisk(root);
    const result = analyse(files, cfg);
    report(result, out, err);
    return result.code;
  } catch (error) {
    err('\nWorkflow artifact policy: COULD NOT RUN (exit 2).');
    err('  ! ' + (error && error.stack ? error.stack : error));
    err('');
    return 2;
  }
}

function readWorkflowsFromDisk(root) {
  const dir = path.join(root, WORKFLOW_DIR);
  const names = readdirSync(dir).filter((n) => /\.ya?ml$/.test(n)).sort();
  return names.map((name) => ({ name, text: readFileSync(path.join(dir, name), 'utf8') }));
}

// ---------------------------------------------------------------------------
// Canary (R4) -- every rule proven in BOTH directions, and the exit codes
// proven through main() rather than inferred from the rules.
//
// A guard with no proof it can fail is a guard nobody has seen fail. The cases
// below were then MUTATED -- see the arc record -- because reading a canary
// cannot tell you what it does not assert, and a rule that quietly stops
// matching produces a clean report and a green canary at the same time.
// ---------------------------------------------------------------------------

/** A one-job workflow with the given triggers and step lines. */
function fixtureWorkflow(triggers, stepLines, jobId = 'j') {
  return [
    'name: Fixture',
    'on:',
    ...triggers.map((t) => '  ' + t + ':'),
    'jobs:',
    '  ' + jobId + ':',
    '    runs-on: ubuntu-latest',
    '    steps:',
    ...stepLines,
  ].join('\n');
}

/** An upload step, with only the keys the case is actually about. */
function fixtureUpload(name, opts = {}) {
  return [
    '      - name: ' + name,
    ...(opts.if === undefined ? [] : ['        if: ' + opts.if]),
    '        uses: ' + (opts.uses ?? 'actions/upload-artifact@v7'),
    ...(opts.retention === undefined
      ? []
      : ['        with:', '          retention-days: ' + opts.retention]),
  ];
}

function selfTest(out = console.log, err = console.error) {
  const cases = [];
  const add = (name, fn, expected) => cases.push({ name, fn, expected });

  /** Violation kinds provoked by a set of files, sorted and joined. */
  const kindsOf = (files, cfg = {}) =>
    findViolations(
      files.map((f) => parseWorkflow(f.name, f.text)),
      { allowlist: [], noUploadWorkflows: [], ...cfg },
    )
      .map((v) => v.kind)
      .sort()
      .join(',');

  // --- The upload matcher, both directions -------------------------------
  add('matcher: actions/upload-artifact@v7', () => isUploadArtifact('actions/upload-artifact@v7'), true);
  add('matcher: a SHA-pinned upload', () => isUploadArtifact('actions/upload-artifact@a1b2c3d4'), true);
  add('matcher: a fork of it still counts', () => isUploadArtifact('someorg/upload-artifact@v1'), true);
  add('matcher: unpinned, no @', () => isUploadArtifact('actions/upload-artifact'), true);
  add('matcher: download-artifact is NOT an upload', () => isUploadArtifact('actions/download-artifact@v7'), false);
  // A prefix match would swallow this one, and the whole point of the rule is
  // that it fires on the real action and only the real action.
  add('matcher: a lookalike name is not it', () => isUploadArtifact('actions/upload-artifact-lite@v1'), false);
  add('matcher: a missing uses is not it', () => isUploadArtifact(undefined), false);
  add('matcher: a step whose uses is a number is not it', () => isUploadArtifact(7), false);

  // --- Triggers, every spelling GitHub accepts ---------------------------
  add('triggers: map form', () => readTriggers({ on: { push: null, schedule: [] } }).sort().join(','), 'push,schedule');
  add('triggers: list form', () => readTriggers({ on: ['push', 'schedule'] }).join(','), 'push,schedule');
  add('triggers: scalar form', () => readTriggers({ on: 'schedule' }).join(','), 'schedule');
  // The Norway problem, in the one place it can actually hurt: a YAML 1.1
  // parser turns the key `on` into the boolean true, and a guard that only
  // looked at doc.on would decide a scheduled workflow has NO triggers -- and
  // then never apply the schedule rule to the exact workflows it exists for.
  // Through the REAL parser, not a hand-built object. Asserting against
  // `{ true: ... }` proved the fallback against a state nobody had shown the
  // pipeline can produce -- and a defence for an unreachable state is not a
  // defence. It IS reachable: a `%YAML 1.1` directive puts this parser in 1.1
  // mode, where the Norway problem turns the key `on` into the boolean true.
  add(
    'triggers: a %YAML 1.1 directive really does give the boolean-true key',
    () => Object.keys(YAML.parse('%YAML 1.1\n---\non:\n  schedule:\n')).join(','),
    'true',
  );
  add(
    'triggers: and readTriggers reads a schedule through it',
    () => readTriggers(YAML.parse('%YAML 1.1\n---\non:\n  schedule:\n')).join(','),
    'schedule',
  );
  add(
    'triggers: the ordinary 1.2 document keeps the string key',
    () => readTriggers(YAML.parse('name: X\non:\n  schedule:\n')).join(','),
    'schedule',
  );
  add('triggers: nothing at all', () => readTriggers({}).length, 0);

  // --- Retention classification, both directions -------------------------
  add('retention: absent is missing', () => classifyRetention(undefined).kind, 'missing');
  add('retention: empty string is missing', () => classifyRetention('').kind, 'missing');
  add('retention: 7 is ok', () => classifyRetention(7).kind, 'ok');
  add('retention: the cap itself is ok, not over', () => classifyRetention(RETENTION_CAP_DAYS).kind, 'ok');
  add('retention: one day past the cap is over-cap', () => classifyRetention(RETENTION_CAP_DAYS + 1).kind, 'over-cap');
  add('retention: 90 (the account default) is over-cap', () => classifyRetention(90).kind, 'over-cap');
  add('retention: a quoted number still reads', () => classifyRetention('7').kind, 'ok');
  add('retention: an expression cannot be bounded', () => classifyRetention('${{ inputs.days }}').kind, 'not-static');
  // (superseded: 'soon' is an unreadable LITERAL, asserted with the other
  // retention kinds above -- not the same defect as an expression.)
  // A malformed LITERAL is a different problem from an expression, and gets a
  // different instruction: telling someone who wrote 7.5 to "pin a literal"
  // is advice they have already taken.
  add('retention: a fraction is an unreadable literal, not an expression', () => classifyRetention(7.5).kind, 'unreadable');
  add('retention: a word is an unreadable literal too', () => classifyRetention('soon').kind, 'unreadable');
  add('retention: only ${{ }} is not-static', () => classifyRetention('${{ inputs.d }}').kind, 'not-static');
  add('retention: a blank string is MISSING, not a mysterious zero', () => classifyRetention('   ').kind, 'missing');
  add('retention: whitespace around a number is still that number', () => classifyRetention(' 7 ').kind, 'ok');
  // A LIST is not a bound. `String([7])` is '7', so a one-element list used to
  // classify as a perfectly good seven-day retention -- a number the author
  // never wrote, read out of a shape GitHub does not accept.
  add('retention: a LIST is unreadable, not the number it stringifies to', () => classifyRetention([7]).kind, 'unreadable');
  add('retention: and the message shows the list rather than that 7', () => classifyRetention([7]).shown, '[7]');
  add('retention: a mapping is unreadable too', () => classifyRetention({ days: 7 }).kind, 'unreadable');
  // Through the REAL parser, because a defence against a state nobody has shown
  // the pipeline can produce is not a defence.
  add(
    'retention: a YAML list really does reach classifyRetention from a workflow',
    () => kindsOf([{ name: 'a.yml', text: fixtureWorkflow(['push'], fixtureUpload('up', { retention: '[7]' })) }]),
    'retention-unreadable',
  );
  add('retention: 0 is invalid, not ok', () => classifyRetention(0).kind, 'invalid');
  add('retention: 1 is the floor and is ok', () => classifyRetention(1).kind, 'ok');

  // --- A1 / A2, both directions ------------------------------------------
  add(
    'A1 fires: an upload with no retention-days',
    () => kindsOf([{ name: 'a.yml', text: fixtureWorkflow(['push'], fixtureUpload('up')) }]),
    'retention-missing',
  );
  add(
    'A1 silent: the same upload with retention-days set',
    () => kindsOf([{ name: 'a.yml', text: fixtureWorkflow(['push'], fixtureUpload('up', { retention: 7 })) }]),
    '',
  );
  add(
    'A2 fires: retention past the cap',
    () => kindsOf([{ name: 'a.yml', text: fixtureWorkflow(['push'], fixtureUpload('up', { retention: 90 })) }]),
    'retention-over-cap',
  );
  add(
    'A2 fires: retention behind an expression',
    () => kindsOf([{ name: 'a.yml', text: fixtureWorkflow(['push'], fixtureUpload('up', { retention: '${{ inputs.d }}' })) }]),
    'retention-not-static',
  );
  add(
    'A2 fires: a literal that is not a day count',
    () => kindsOf([{ name: 'a.yml', text: fixtureWorkflow(['push'], fixtureUpload('up', { retention: "'soon'" })) }]),
    'retention-unreadable',
  );
  add(
    'A2 fires: a zero-day retention',
    () => kindsOf([{ name: 'a.yml', text: fixtureWorkflow(['push'], fixtureUpload('up', { retention: 0 })) }]),
    'retention-invalid',
  );
  add(
    'A1/A2 silent: a NON-upload step is none of their business',
    () =>
      kindsOf([{
        name: 'a.yml',
        text: fixtureWorkflow(['push'], ['      - name: build', '        run: npm ci']),
      }]),
    '',
  );

  // --- A3, the incident shape, both directions ---------------------------
  const scheduleFailure = (opts = {}) => [{
    name: 'nightly.yml',
    text: fixtureWorkflow(
      opts.triggers ?? ['schedule'],
      // `'if' in opts`, not `opts.if ?? ...`: the nullish default silently put
      // failure() back when a case passed an explicit undefined, so the
      // "no condition at all" case below was testing failure() and passing for
      // the wrong reason. The canary caught it on its first run.
      fixtureUpload(opts.step ?? 'Upload on failure', {
        if: 'if' in opts ? opts.if : 'failure()',
        retention: 7,
      }),
    ),
  }];

  add('A3 fires: if failure() on a schedule: workflow', () => kindsOf(scheduleFailure()), 'schedule-failure-upload');
  add(
    'A3 fires: the ${{ }}-wrapped spelling of the same condition',
    () => kindsOf(scheduleFailure({ if: '${{ failure() }}' })),
    'schedule-failure-upload',
  );
  add(
    'A3 fires: failure() as one term of a compound condition',
    () => kindsOf(scheduleFailure({ if: "failure() && github.event_name == 'schedule'" })),
    'schedule-failure-upload',
  );
  // The rule is about the DISGUISE, not the upload. always() claims nothing,
  // and A1/A2 bound it by retention; flagging it too would train the reader to
  // allowlist by reflex, which is how the exception stops being a decision.
  add('A3 silent: if always() -- honest, and bounded by retention', () => kindsOf(scheduleFailure({ if: 'always()' })), '');
  add('A3 silent: if success()', () => kindsOf(scheduleFailure({ if: 'success()' })), '');
  // Found by MUTATION, not by reading. Loosening the detector from the CALL
  // failure() to the bare word `failure` survived the entire canary, because
  // every negative case used a condition with no such word in it. A condition
  // can mention failure without being one: these two are the cases that make
  // the parenthesised call load-bearing rather than decorative.
  add(
    'A3 silent: a condition that MENTIONS failure without calling it',
    () => kindsOf(scheduleFailure({ if: 'steps.probe.outputs.failure_count > 0' })),
    '',
  );
  // This case USED to assert the opposite -- that `job.status == 'failure'` is
  // correctly ignored -- and it passed, which is how the canary could not find
  // the hole: a case cannot catch a defect its author believes in. It is one
  // of the two spellings GitHub's own documentation uses for a collection job,
  // i.e. the incident, rewritten idiomatically.
  add(
    'A3 fires: job.status == failure is a failure gate',
    () => kindsOf(scheduleFailure({ if: "job.status == 'failure'" })),
    'schedule-failure-upload',
  );
  add(
    'A3 fires: needs.<job>.result == failure is a failure gate',
    () => kindsOf(scheduleFailure({ if: "needs.build.result == 'failure'" })),
    'schedule-failure-upload',
  );
  add(
    'A3 fires: contains(needs.*.result, failure) is one too',
    () => kindsOf(scheduleFailure({ if: "contains(needs.*.result, 'failure')" })),
    'schedule-failure-upload',
  );
  add(
    'A3 silent: != failure is the OPPOSITE gate -- upload unless it failed',
    () => kindsOf(scheduleFailure({ if: "job.status != 'failure'" })),
    '',
  );
  // A NEGATIVE term no longer cancels a POSITIVE one. Short-circuiting on the
  // first `!= 'failure'` made this compound -- "upload when a shard failed but
  // setup did not", which is the idiomatic collection job and therefore the
  // incident with one extra conjunct -- return false. One extra conjunct was
  // enough to switch the rule off.
  add(
    'A3 detector: a positive term survives a negative one in the same condition',
    () => conditionIsFailureGate("needs.build.result == 'failure' && needs.setup.result != 'failure'"),
    true,
  );
  add(
    'A3 fires: upload when a shard failed but setup did not',
    () => kindsOf(scheduleFailure({ if: "needs.build.result == 'failure' && needs.setup.result != 'failure'" })),
    'schedule-failure-upload',
  );
  add('A3 detector: a lone negative term is still not a gate', () => conditionIsFailureGate("needs.setup.result != 'failure'"), false);
  add('A3 detector: two negatives are still not a gate', () => conditionIsFailureGate("a.result != 'failure' && b.result != 'failure'"), false);
  // NEGATED failure tests are the opposite gate: they run when things SUCCEED.
  add('A3 detector: !failure() is NOT a failure gate', () => conditionIsFailureGate('!failure()'), false);
  add('A3 detector: !contains(needs.*.result, failure) is not either', () => conditionIsFailureGate("!contains(needs.*.result, 'failure')"), false);
  add(
    'A3 detector: the whole publish-unless-something-failed idiom is not a gate',
    () => conditionIsFailureGate("!cancelled() && !contains(needs.*.result, 'failure')"),
    false,
  );
  add(
    'A3 silent: that idiom on a scheduled upload is left alone',
    () => kindsOf(scheduleFailure({ if: "${{ !cancelled() && !contains(needs.*.result, 'failure') }}" })),
    '',
  );
  // And the positive forms still fire, so the negation handling did not simply
  // switch the rule off.
  add('A3 detector: a plain failure() call is still a gate', () => conditionIsFailureGate('failure()'), true);
  add('A3 detector: contains(..., failure) unnegated is still a gate', () => conditionIsFailureGate("contains(needs.*.result, 'failure')"), true);
  add('A3 detector: an identifier containing the word is not a gate', () => conditionIsFailureGate('on_failure'), false);
  add('A3 detector: a failure_count comparison is not a gate', () => conditionIsFailureGate('steps.p.outputs.failure_count > 0'), false);
  add('A3 detector: the call, spaced out, still is', () => conditionIsFailureGate('failure ( )'), true);
  add('A3 detector: the quoted literal is what makes it a gate', () => conditionIsFailureGate("job.status == 'failure'"), true);

  // --- A3 at the JOB level: the same condition, one indent up -------------
  //
  // Found in review by running it. A dedicated collection job -- the more
  // idiomatic way to write the incident -- carried its failure() on the JOB
  // and scored a completely clean pass, retention at the policy maximum.
  const jobLevel = (jobIf, stepLines) =>
    [{
      name: 'nightly.yml',
      text: [
        'name: Fixture',
        'on:',
        '  schedule:',
        'jobs:',
        '  collect:',
        '    runs-on: ubuntu-latest',
        ...(jobIf === undefined ? [] : ['    if: ' + jobIf]),
        '    steps:',
        ...stepLines,
      ].join('\n'),
    }];

  add(
    'A3 fires: failure() on the JOB, with an unconditional upload inside it',
    () => kindsOf(jobLevel('failure()', fixtureUpload('up', { retention: 14 }))),
    'schedule-failure-upload',
  );
  add(
    'A3 fires once, not twice, when BOTH job and step carry failure()',
    () => kindsOf(jobLevel('failure()', fixtureUpload('up', { if: 'failure()', retention: 14 }))),
    'schedule-failure-upload',
  );
  add(
    'A3 silent: an ordinary job condition that is not a failure() gate',
    () => kindsOf(jobLevel("github.ref == 'refs/heads/main'", fixtureUpload('up', { retention: 14 }))),
    '',
  );
  // The false positive the guard shipped with, now declined instead of
  // allowlisted: a PR-gated job cannot be reached by a schedule at all.
  add(
    'A3 silent: a job a schedule can never reach is not judged',
    () => kindsOf(jobLevel("github.event_name == 'pull_request'", fixtureUpload('up', { if: 'failure()', retention: 7 }))),
    '',
  );
  add('reach: a PR-gated job is unreachable from a schedule', () => scheduleCanReach("github.event_name == 'pull_request'"), false);
  add('reach: an event_name test naming schedule IS reachable', () => scheduleCanReach("github.event_name == 'schedule'"), true);
  // Reachability is asked against the event the run ARRIVES as. Inside a
  // workflow_run collector that is `workflow_run`, never `schedule`, so asking
  // the schedule question there excused the collector from the level that was
  // added to catch it -- with an extra conjunct that is entirely correct.
  add("reach: a collector's own event_name test is reachable AS workflow_run", () => scheduleCanReach("github.event_name == 'workflow_run'", ['workflow_run']), true);
  add('reach: and the same test is NOT reachable as a schedule', () => scheduleCanReach("github.event_name == 'workflow_run'", ['schedule']), false);
  // Conservative in the safe direction: anything not understood is still judged.
  add('reach: an INEQUALITY is not understood, so the job is still judged', () => scheduleCanReach("github.event_name != 'pull_request'"), true);
  add('reach: a disjunction may still admit a schedule', () => scheduleCanReach("github.event_name == 'pull_request' || github.event_name == 'schedule'"), true);
  add('reach: no job condition at all is reachable', () => scheduleCanReach(undefined), true);
  add('reach: an unfamiliar condition is reachable, not excused', () => scheduleCanReach('inputs.deep == true'), true);
  // Round 2: an unanchored match read the NEGATION as the equality and excused
  // a job the schedule genuinely reaches -- a false negative in the function
  // whose docstring is about not producing them.
  add('reach: a NEGATED equality is not the equality', () => scheduleCanReach("!(github.event_name == 'pull_request')"), true);
  add('reach: the wrapped negation too', () => scheduleCanReach("${{ !(github.event_name == 'pull_request') }}"), true);
  // The LEADING anchor, pinned separately from the trailing one. Mutation found
  // that dropping `^` left every case green: the parenthesised negations above
  // are all caught by the trailing `$` instead, because they end in `)`. A bare
  // `!` in front ends at the quote, so only the leading anchor declines it --
  // and declining it is the same false-negative class as round 2's.
  add('reach: a bare-negated equality is not the equality either', () => scheduleCanReach("!github.event_name == 'pull_request'"), true);
  // The conjunct SPLITTER, asserted in its own right. Round 1 tried to handle a
  // `&&` inside a quoted literal with a regex bailout, and that regex matched
  // the gap BETWEEN two quoted literals instead -- so every ordinary compound
  // condition of the form `A == 'x' && B == 'y'` switched the whole exclusion
  // path off and reddened compliant work. Round 2 caught it. A ten-line
  // quote-and-paren-aware split is exact, and these cases are what make it a
  // measurement rather than a second guess.
  add('split: an ordinary conjunction splits in two', () => splitTopLevelAnd("a == 'x' && b == 'y'").length, 2);
  add('split: a && inside a quoted literal is NOT a separator', () => splitTopLevelAnd("contains('a && b', x) && c").length, 2);
  // The case above passes on the PAREN tracking alone -- `contains(` opens a
  // depth, so the quoted && is protected twice over and mutation showed the
  // quote tracking could be deleted with everything still green. This one has
  // the literal at depth 0, so only the quote tracking can save it.
  add('split: a quoted && outside any parentheses is not a separator either', () => splitTopLevelAnd("x == 'a && b' && y").length, 2);
  add('split: ...and the literal is still whole', () => splitTopLevelAnd("x == 'a && b' && y")[0].trim(), "x == 'a && b'");
  add('split: ...and the literal survives intact', () => splitTopLevelAnd("contains('a && b', x) && c")[0].trim(), "contains('a && b', x)");
  add('split: a && inside parentheses is not a top-level conjunct', () => splitTopLevelAnd('f(a && b) && c').length, 2);
  add('split: no conjunction is one term, not zero', () => splitTopLevelAnd('always()').length, 1);
  add(
    'reach: a quoted && no longer disables the exclusion -- the conjunct still excludes',
    () => scheduleCanReach("contains('a && b', inputs.x) && github.event_name == 'pull_request'"),
    false,
  );
  // The shape that the broken bailout turned into a false positive: two quoted
  // comparisons, the commonest compound `if:` there is.
  add(
    'reach: two quoted comparisons still exclude a schedule',
    () => scheduleCanReach("github.event_name == 'pull_request' && github.ref == 'refs/heads/main'"),
    false,
  );
  add(
    'reach: an ordinary conjunction with no quoted && still excludes',
    () => scheduleCanReach("inputs.x == true && github.event_name == 'pull_request'"),
    false,
  );
  add('reach: an event_name test buried in a conjunction still excludes', () => scheduleCanReach("github.event_name == 'pull_request' && failure()"), false);
  add('reach: the wrapped equality is read through the braces', () => scheduleCanReach("${{ github.event_name == 'pull_request' }}"), false);
  // The anchoring is a DELIBERATE choice and is asserted as one: a conjunct
  // that is not exactly the equality is judged rather than excused, even when
  // a human can see it means the same thing. Dropping the anchors would excuse
  // more, and excusing is the direction that produces the incident. Mutation
  // found that nothing pinned this.
  add('reach: a PARENTHESISED equality is not matched, so the job is still judged', () => scheduleCanReach("(github.event_name == 'pull_request')"), true);
  add('reach: an equality embedded in a larger term is not matched either', () => scheduleCanReach("format('{0}', github.event_name == 'pull_request')"), true);
  add(
    'A3 silent: a STEP condition a schedule cannot reach is not judged either',
    () => kindsOf(scheduleFailure({ if: "github.event_name == 'pull_request' && failure()" })),
    '',
  );
  // The message must name the condition that actually gated on failure.
  add(
    'A3 message: names the JOB condition when that is the gate',
    () => {
      const v = findViolations(
        jobLevel('failure()', fixtureUpload('up', { if: "hashFiles('t/**') != ''", retention: 7 })).map((f) => parseWorkflow(f.name, f.text)),
        { allowlist: [], noUploadWorkflows: [] },
      );
      return v[0].detail.includes('`failure()` (job level)');
    },
    true,
  );
  // Two uploads that an allowlist entry could not tell apart.
  add(
    'A3 refuses an AMBIGUOUS pair rather than letting one entry cover both',
    () =>
      kindsOf([{
        name: 'nightly.yml',
        text: fixtureWorkflow(['schedule'], [
          ...fixtureUpload('Upload', { if: 'failure()', retention: 7 }),
          ...fixtureUpload('Upload', { if: 'failure()', retention: 7 }),
        ]),
      }]),
    'allowlist-ambiguous',
  );
  // ONE finding per shared NAME, not one per upload: the defect is the name.
  add(
    'A3: an allowlist entry naming an ambiguous key is UNUSABLE, not stale',
    () =>
      kindsOf(
        [{
          name: 'nightly.yml',
          text: fixtureWorkflow(['schedule'], [
            ...fixtureUpload('Upload', { if: 'failure()', retention: 7 }),
            ...fixtureUpload('Upload', { if: 'failure()', retention: 7 }),
          ]),
        }],
        { allowlist: [{ file: 'nightly.yml', job: 'j', step: 'Upload', reason: 'fixture' }] },
      ),
    'allowlist-ambiguous',
  );
  add(
    'A3: distinct step names are attributable, so an entry covers just one',
    () =>
      kindsOf(
        [{
          name: 'nightly.yml',
          text: fixtureWorkflow(['schedule'], [
            ...fixtureUpload('Upload A', { if: 'failure()', retention: 7 }),
            ...fixtureUpload('Upload B', { if: 'failure()', retention: 7 }),
          ]),
        }],
        { allowlist: [{ file: 'nightly.yml', job: 'j', step: 'Upload A', reason: 'fixture' }] },
      ),
    'schedule-failure-upload',
  );
  // upload-pages-artifact bills to the same pool.
  add('matcher: upload-pages-artifact counts', () => isUploadArtifact('actions/upload-pages-artifact@v3'), true);
  // The v4 merge sub-action CREATES an artifact, with its own retention-days.
  add('matcher: the upload-artifact/merge sub-action counts', () => isUploadArtifact('actions/upload-artifact/merge@v4'), true);
  // A ref written the wrong way round still names upload-artifact before the
  // `@`, and counting it is the safe direction.
  add('matcher: ...and a malformed ref still counts, rather than slipping past', () => isUploadArtifact('actions/upload-artifact@v4/merge'), true);
  add('matcher: download-artifact/merge is still not an upload', () => isUploadArtifact('actions/download-artifact/merge@v4'), false);
  add(
    'A1 fires on an unbounded merge step',
    () => kindsOf([{ name: 'a.yml', text: fixtureWorkflow(['push'], fixtureUpload('merged', { uses: 'actions/upload-artifact/merge@v4' })) }]),
    'retention-missing',
  );

  // --- The negated-SUCCESS family: the same gate, spelled the other way -----
  add('A3 detector: !success() is a failure gate', () => conditionIsFailureGate('!success()'), true);
  add('A3 detector: the wrapped spelling too', () => conditionIsFailureGate('${{ !success() }}'), true);
  add("A3 detector: result != 'success' is a failure gate", () => conditionIsFailureGate("needs.build.result != 'success'"), true);
  // Both directions: the POSITIVE success test is not a gate on failure, and
  // neither is a bare success() call -- those bound cost by how often the job
  // succeeds, which is the ordinary case.
  add('A3 detector: success() alone is not', () => conditionIsFailureGate('success()'), false);
  add("A3 detector: == 'success' is not", () => conditionIsFailureGate("needs.build.result == 'success'"), false);
  add('A3 detector: !cancelled() is not a failure gate either', () => conditionIsFailureGate('!cancelled()'), false);
  // Through the REAL parser, in the spelling a workflow can actually carry: a
  // bare leading `!` is a YAML TAG, so GitHub's own docs write this wrapped.
  // The first draft of this case used the bare form, which did not parse -- and
  // an unparseable fixture produces no violations, which looks exactly like a
  // rule that failed to fire. The canary caught it on its first run.
  add(
    'A3 fires: the nightly re-spelled as ${{ !success() }}',
    () => kindsOf(scheduleFailure({ if: '${{ !success() }}' })),
    'schedule-failure-upload',
  );
  add(
    "A3 fires: and re-spelled as result != 'success'",
    () => kindsOf(scheduleFailure({ if: "needs.build.result != 'success'" })),
    'schedule-failure-upload',
  );
  add(
    'A3 silent: the positive success test is not a gate on failure',
    () => kindsOf(scheduleFailure({ if: "needs.build.result == 'success'" })),
    '',
  );
  add(
    'A1 fires on an unbounded upload-pages-artifact',
    () => kindsOf([{ name: 'a.yml', text: fixtureWorkflow(['push'], fixtureUpload('pages', { uses: 'actions/upload-pages-artifact@v3' })) }]),
    'retention-missing',
  );
  add('A3 silent: no condition at all on a schedule', () => kindsOf(scheduleFailure({ if: undefined })), '');
  // Off the schedule the conditional is bounded by how often anyone pushes,
  // which is a bound the reviewer can actually see.
  add('A3 silent: the same failure() upload on push', () => kindsOf(scheduleFailure({ triggers: ['push'] })), '');
  add(
    'A3 fires: a workflow triggered on BOTH push and schedule is a schedule workflow',
    () => kindsOf(scheduleFailure({ triggers: ['push', 'schedule'] })),
    'schedule-failure-upload',
  );

  const allowEntry = { file: 'nightly.yml', job: 'j', step: 'Upload on failure', reason: 'fixture' };
  add(
    'A3 silent: an exact allowlist entry accepts it',
    () => kindsOf(scheduleFailure(), { allowlist: [allowEntry] }),
    '',
  );
  add(
    'A3 fires: an allowlist entry for a DIFFERENT job does not cover this one',
    () => kindsOf(scheduleFailure(), { allowlist: [{ ...allowEntry, job: 'other' }] }),
    'allowlist-stale,schedule-failure-upload',
  );
  add(
    'A3 fires: renaming the step drops the exception rather than transferring it',
    () => kindsOf(scheduleFailure({ step: 'Upload on failure (renamed)' }), { allowlist: [allowEntry] }),
    'allowlist-stale,schedule-failure-upload',
  );
  add(
    'A3 fires stale: an entry whose shape is gone must be removed, not left',
    () => kindsOf([{ name: 'a.yml', text: fixtureWorkflow(['push'], fixtureUpload('up', { retention: 7 })) }], { allowlist: [allowEntry] }),
    'allowlist-stale',
  );

  // --- Two rules on one step: neither masks the other --------------------
  add(
    'A1 + A3 both fire on an unbounded nightly upload',
    () =>
      kindsOf([{
        name: 'nightly.yml',
        text: fixtureWorkflow(['schedule'], fixtureUpload('up', { if: 'failure()' })),
      }]),
    'retention-missing,schedule-failure-upload',
  );

  // --- A4, and TRAP ONE ---------------------------------------------------
  //
  // The real ci-budget-guard.yml carries a comment saying there is no
  // upload-artifact step here and there must never be one. A substring scanner
  // reads that sentence and flags the guard for the rule the sentence is
  // stating -- correctly-looking, entirely wrong, and self-inflicted. The
  // fixture below reproduces it, and the case after asserts the fixture really
  // does contain the string, so this can never pass by being vacuous.
  const guardWithComment = [
    'name: CI Budget Guard',
    '# IT UPLOADS NO ARTIFACTS, DELIBERATELY. There is no upload-artifact step',
    '# here and there must never be one: it reads the pool it would join.',
    'on:',
    '  schedule:',
    'jobs:',
    '  measure:',
    '    runs-on: ubuntu-latest',
    '    steps:',
    '      - name: measure   # not an actions/upload-artifact step',
    '        run: node scripts/check-ci-budget.mjs',
  ].join('\n');

  add(
    'A4 silent: a COMMENT naming upload-artifact is not an upload step',
    () => kindsOf([{ name: 'ci-budget-guard.yml', text: guardWithComment }], { noUploadWorkflows: ['ci-budget-guard.yml'] }),
    '',
  );
  add(
    'A4 trap is real: that fixture does contain the substring a text scan trips on',
    () => guardWithComment.includes('upload-artifact'),
    true,
  );
  add(
    'A4 fires: an actual upload step in the budget guard',
    () =>
      kindsOf(
        [{ name: 'ci-budget-guard.yml', text: fixtureWorkflow(['schedule'], fixtureUpload('up', { retention: 7 }), 'measure') }],
        { noUploadWorkflows: ['ci-budget-guard.yml'] },
      ),
    'budget-guard-uploads',
  );
  add(
    'A4 silent: an upload in a DIFFERENT workflow does not implicate the guard',
    () =>
      kindsOf(
        [
          { name: 'ci-budget-guard.yml', text: guardWithComment },
          { name: 'other.yml', text: fixtureWorkflow(['push'], fixtureUpload('up', { retention: 7 })) },
        ],
        { noUploadWorkflows: ['ci-budget-guard.yml'] },
      ),
    '',
  );

  // --- Shape and parse: an unreadable file must never scan clean ---------
  const problemsOf = (text, name = 'x.yml') => parseWorkflow(name, text).problems.map((p) => p.kind).join(',');

  add('parse: broken YAML is a problem, not a clean file', () => problemsOf('jobs:\n  a:\n   - [unclosed'), 'parse');
  add('shape: a top-level list is not a workflow', () => problemsOf('- a\n- b'), 'shape');
  add('shape: no jobs: mapping is a problem', () => problemsOf('name: X\non:\n  push:\n'), 'shape');
  add(
    'shape: a job with neither steps nor a reusable uses is refused, not counted as zero',
    () => problemsOf('name: X\non:\n  push:\njobs:\n  a:\n    runs-on: ubuntu-latest\n'),
    'shape',
  );
  add(
    'shape: a reusable-workflow job is a KNOWN shape, not a problem',
    () => problemsOf('name: X\non:\n  push:\njobs:\n  a:\n    uses: ./.github/workflows/other.yml\n'),
    '',
  );
  // Known is not the same as covered. The skip has to be COUNTED, or the pass
  // line reads as total coverage over a repo that moved its uploads into a
  // called workflow. Mutation found this: zeroing the counter left every other
  // case green.
  // A reusable workflow inherits its CALLER's triggers, because that is how it
  // runs. Without this, moving the incident into a `workflow_call` file removed
  // it from A3 entirely -- the file was still parsed, A1/A2 still fired on it,
  // so the report read as covering it while its one cost-shape rule was dead.
  const calledIncident = [
    {
      name: 'nightly.yml',
      text: [
        'name: Nightly', 'on:', '  schedule:', 'jobs:', '  go:',
        '    uses: ./.github/workflows/called.yml',
      ].join('\n'),
    },
    {
      name: 'called.yml',
      text: fixtureWorkflow(['workflow_call'], fixtureUpload('up', { if: 'failure()', retention: 7 }), 'collect'),
    },
  ];
  add(
    'A3 fires: the incident hidden inside a workflow_call file, via its caller',
    () => kindsOf(calledIncident),
    'schedule-failure-upload',
  );
  add(
    'A3 silent: the same called file when NO caller is on a schedule',
    () =>
      kindsOf([
        { ...calledIncident[0], text: calledIncident[0].text.replace('  schedule:', '  push:') },
        calledIncident[1],
      ]),
    '',
  );
  /** How a schedule arrives at `name`, as a word, for readable expectations. */
  const arrivalAt = (files, name) => {
    const a = propagateScheduleArrival(files.map((f) => parseWorkflow(f.name, f.text))).get(name);
    if (!a) return 'absent';
    return (a.plain ? 'plain' : '') + (a.plain && a.gated ? '+' : '') + (a.gated ? 'gated' : '') || 'none';
  };

  add('arrival: a schedule reaches a called workflow, ungated', () => arrivalAt(calledIncident, 'called.yml'), 'plain');
  add('arrival: and the caller itself is on the schedule directly', () => arrivalAt(calledIncident, 'nightly.yml'), 'plain');
  // A propagation that runs out of passes THROWS rather than returning a
  // half-filled map: every file it did not reach would otherwise read as "no
  // schedule arrives here", which is a clean pass over an unmeasured repo.
  // Driven through the pass bound, because nothing today can exhaust it -- the
  // point is that the next edge kind added cannot exhaust it in silence.
  add(
    'arrival: running out of passes THROWS instead of returning a partial map',
    () => {
      try {
        propagateScheduleArrival(calledIncident.map((f) => parseWorkflow(f.name, f.text)), { maxPasses: 1 });
        return 'no throw';
      } catch (error) {
        return error.message.includes('did not settle') ? 'threw, saying so' : 'threw';
      }
    },
    'threw, saying so',
  );
  add(
    'arrival: and the ordinary bound is enough, so nothing throws in practice',
    () => arrivalAt(calledIncident, 'called.yml'),
    'plain',
  );
  add(
    'arrival: a call CYCLE terminates instead of hanging the guard',
    () =>
      arrivalAt(
        [
          { name: 'a.yml', text: 'name: A\non:\n  schedule:\njobs:\n  j:\n    uses: ./.github/workflows/b.yml\n' },
          { name: 'b.yml', text: 'name: B\non:\n  workflow_call:\njobs:\n  j:\n    uses: ./.github/workflows/a.yml\n' },
        ],
        'b.yml',
      ),
    'plain',
  );
  add(
    'arrival: a workflow nothing calls and nothing schedules is not reached at all',
    () => arrivalAt([{ name: 'x.yml', text: fixtureWorkflow(['push'], ['      - run: echo']) }], 'x.yml'),
    'none',
  );

  // --- A3 at the CALLER's job: the fourth level, and the fourth time --------
  //
  // The same defect has now been fixed four times, each time one indentation
  // level up from the last: step.if, job.if, the callee inheriting triggers,
  // and this -- a `failure()` gate on the job that DOES the calling, with the
  // upload sitting unconditional in another file. Every earlier fix was
  // correct and aimed one level too low, and the canary case written for each
  // level passed while the next level up went unnoticed. So this block asserts
  // the level AND the chain AND the interaction with reachability, in one pass.
  const callerGated = (callerIf, opts = {}) => [
    {
      name: 'nightly.yml',
      text: [
        'name: Nightly', 'on:', '  ' + (opts.trigger ?? 'schedule') + ':', 'jobs:', '  go:',
        ...(callerIf === undefined ? [] : ['    if: ' + callerIf]),
        '    uses: ./.github/workflows/called.yml',
      ].join('\n'),
    },
    {
      name: 'called.yml',
      text: fixtureWorkflow(
        ['workflow_call'],
        fixtureUpload('up', { retention: 7, ...(opts.stepIf === undefined ? {} : { if: opts.stepIf }) }),
        'collect',
      ),
    },
  ];

  add('A3 fires: failure() on the CALLING job, with an unconditional upload in the called file', () => kindsOf(callerGated('failure()')), 'schedule-failure-upload');
  add('arrival: that edge marks the callee gated rather than merely reached', () => arrivalAt(callerGated('failure()'), 'called.yml'), 'gated');
  add('A3 silent: an ordinary condition on the calling job is not a gate', () => kindsOf(callerGated("github.ref == 'refs/heads/main'")), '');
  add('A3 silent: no condition on the calling job at all', () => kindsOf(callerGated(undefined)), '');
  add('A3 silent: the same gate on a caller that is not on a schedule', () => kindsOf(callerGated('failure()', { trigger: 'push' })), '');
  // Reachability at the caller's level, which is the mirror image: a schedule
  // cannot come down a PR-gated edge, so costing the callee against it would be
  // the false positive scheduleCanReach exists to prevent, one level up.
  add('A3 silent: a calling job a schedule can never reach', () => kindsOf(callerGated("github.event_name == 'pull_request' && failure()")), '');
  add(
    'A3 message: names the calling job and the file it lives in',
    () => {
      const v = findViolations(
        callerGated('failure()').map((f) => parseWorkflow(f.name, f.text)),
        { allowlist: [], noUploadWorkflows: [] },
      );
      return v[0].detail.includes('the calling job `go` in nightly.yml');
    },
    true,
  );
  add(
    'arrival: a gated arrival always carries the edge that gated it',
    () => {
      const a = propagateScheduleArrival(callerGated('failure()').map((f) => parseWorkflow(f.name, f.text))).get('called.yml');
      return a.gated && a.gatedBy !== null && a.gatedBy.file === 'nightly.yml' && a.gatedBy.job === 'go';
    },
    true,
  );
  add(
    'A3 silent: an allowlist entry naming the upload in the CALLED file still works',
    () => kindsOf(callerGated('failure()'), { allowlist: [{ file: 'called.yml', job: 'collect', step: 'up', reason: 'fixture' }] }),
    '',
  );

  // TRANSITIVE: schedule -> plain call -> gated call -> upload. A per-level
  // special case would have handled the direct caller and missed this; carrying
  // the arrival along the edge handles both by construction.
  const gatedChain = [
    { name: 'a.yml', text: 'name: A\non:\n  schedule:\njobs:\n  go:\n    uses: ./.github/workflows/b.yml\n' },
    { name: 'b.yml', text: 'name: B\non:\n  workflow_call:\njobs:\n  mid:\n    if: failure()\n    uses: ./.github/workflows/c.yml\n' },
    { name: 'c.yml', text: fixtureWorkflow(['workflow_call'], fixtureUpload('up', { retention: 7 }), 'collect') },
  ];
  add('A3 fires: a gate two calls up still reaches the upload', () => kindsOf(gatedChain), 'schedule-failure-upload');

  // --- A call that LEAVES this repository is not a local file ---------------
  //
  // Found in review. The basename was taken from any `uses:`, so a cross-repo
  // call to `otherorg/otherrepo/.github/workflows/build.yml@main` resolved to
  // `build.yml` and was matched against a LOCAL build.yml of that name: a
  // failure() gate then propagated into a compliant push-only workflow, redded
  // CI, and pointed the author at a calling job that does not call their file.
  const crossRepo = [
    { name: 'nightly.yml', text: 'name: N\non:\n  schedule:\njobs:\n  go:\n    if: failure()\n    uses: otherorg/otherrepo/.github/workflows/build.yml@main\n' },
    { name: 'build.yml', text: fixtureWorkflow(['push'], fixtureUpload('up', { retention: 7 }), 'b') },
  ];
  add('A3 silent: a cross-repo call does not implicate a local file of the same name', () => kindsOf(crossRepo), '');
  add('arrival: and that local file is not reached by the schedule at all', () => arrivalAt(crossRepo, 'build.yml'), 'none');
  add('calls: a remote target resolves to null rather than a basename', () => parseWorkflow('n.yml', crossRepo[0].text).calls[0].target, null);
  add('calls: a local target still resolves', () => parseWorkflow('n.yml', 'name: N\non:\n  push:\njobs:\n  go:\n    uses: ./.github/workflows/b.yml\n').calls[0].target, 'b.yml');
  // Still COUNTED as an uncovered surface, which is the honest half: the guard
  // cannot see into it, and the report says so.
  add('calls: a remote call is still counted as a reusable job', () => parseWorkflow('n.yml', crossRepo[0].text).reusableJobs, 1);

  // --- The workflow_run collector: a FIFTH level ---------------------------
  //
  // The canonical "collect artifacts when the nightly failed" workflow. Its own
  // triggers say `workflow_run`, so before this it was never on a schedule and
  // never judged: findViolations returned [] over the incident's exact shape at
  // retention 14, and the guard printed "policy passed".
  const collector = (opts = {}) => [
    {
      name: 'nightly.yml',
      text: 'name: The Nightly\non:\n  ' + (opts.upstreamTrigger ?? 'schedule') + ':\njobs:\n  run:\n    runs-on: ubuntu-latest\n    steps:\n      - run: echo\n',
    },
    {
      name: 'collect.yml',
      text: [
        'name: Collect',
        'on:',
        '  workflow_run:',
        ...(opts.watches === null ? [] : ["    workflows: ['" + (opts.watches ?? 'The Nightly') + "']"]),
        '    types: [completed]',
        'jobs:',
        '  collect:',
        "    if: " + (opts.jobIf ?? "github.event.workflow_run.conclusion == 'failure'"),
        '    runs-on: ubuntu-latest',
        '    steps:',
        ...fixtureUpload('traces', { retention: 14 }),
      ].join('\n'),
    },
  ];

  add('A3 fires: the workflow_run collector for a scheduled nightly', () => kindsOf(collector()), 'schedule-failure-upload');
  // END TO END: the collector carrying the event_name conjunct it needs the
  // moment it also answers workflow_dispatch. Before round 2 this scored clean.
  add(
    'A3 fires: ...even when the collector names its own event_name',
    () => kindsOf(collector({ jobIf: "github.event_name == 'workflow_run' && github.event.workflow_run.conclusion == 'failure'" })),
    'schedule-failure-upload',
  );
  add('arrival: the collector is reached plainly, and supplies its own gate', () => arrivalAt(collector(), 'collect.yml'), 'plain');
  add('A3 silent: the same collector when the upstream is not on a schedule', () => kindsOf(collector({ upstreamTrigger: 'push' })), '');
  add('A3 silent: a collector whose job condition is not a failure gate', () => kindsOf(collector({ jobIf: "github.event.workflow_run.conclusion == 'success'" })), '');
  add('A3 fires: a workflow_run with no readable workflows: list watches everything', () => kindsOf(collector({ watches: null })), 'schedule-failure-upload');
  // A name this scan cannot resolve WIDENS the watch instead of dropping it. A
  // workflow with no `name:` takes its file path as its display name, which is
  // not recorded here; a typo or a cross-repo name resolves to nothing either.
  // This case asserted the silent drop as correct until round 2 -- the same
  // unknown-as-less-reach mistake the level above deliberately refuses. It
  // costs at most an allowlist entry; the other direction is the incident.
  add('A3 fires: an unresolvable watched name is widened, not dropped', () => kindsOf(collector({ watches: 'Some Other Repo Workflow' })), 'schedule-failure-upload');
  add(
    'A3 silent: ...and with no scheduled workflow anywhere, widening still finds nothing',
    () => kindsOf(collector({ watches: 'Some Other Repo Workflow', upstreamTrigger: 'push' })),
    '',
  );
  // Two workflows may legally share a display name, and GitHub fires
  // workflow_run for BOTH. Keeping only the first match lost the arrival when
  // the other was the scheduled one.
  add(
    'A3 fires: a duplicated workflow name resolves to every file that carries it',
    () =>
      kindsOf([
        { name: 'a.yml', text: 'name: Shared\non:\n  push:\njobs:\n  j:\n    runs-on: x\n    steps:\n      - run: echo\n' },
        { name: 'b.yml', text: 'name: Shared\non:\n  schedule:\njobs:\n  j:\n    runs-on: x\n    steps:\n      - run: echo\n' },
        // Watching `Shared` BY NAME. An earlier draft of this case reused the
        // collector that watches `The Nightly`, which resolves to nothing here
        // and therefore passed through the unresolvable-name widening instead
        // -- green, and measuring a different mechanism entirely.
        { name: 'collect.yml', text: collector()[1].text.split("'The Nightly'").join("'Shared'") },
      ]),
    'schedule-failure-upload',
  );
  add('watches: the names are read off the on: block', () => readWorkflowRunWatches(YAML.parse("on:\n  workflow_run:\n    workflows: ['A', 'B']\n")).names.join(','), 'A,B');
  add('watches: an absent workflows: list means any', () => readWorkflowRunWatches(YAML.parse('on:\n  workflow_run:\n    types: [completed]\n')).any, true);
  add('watches: a file with no workflow_run trigger watches nothing', () => readWorkflowRunWatches(YAML.parse('on:\n  push:\n')).present, false);
  add('watches: the scalar spelling is read too', () => readWorkflowRunWatches(YAML.parse('on: workflow_run\n')).any, true);
  add('arrival: the middle file is reached plainly', () => arrivalAt(gatedChain, 'b.yml'), 'plain');
  add('arrival: and the far end is gated', () => arrivalAt(gatedChain, 'c.yml'), 'gated');

  // The gate on an EARLY edge, with an ORDINARY call after it. Found by
  // mutation: reading only this edge's gate and not the arrival it inherited --
  // gating that does not propagate -- survived every case above, because
  // gatedChain puts the gate on the LAST edge, where the two are
  // indistinguishable. This is the same one-level-up shape as the bug being
  // fixed, one level further out again, which is why it is asserted here rather
  // than trusted.
  const deepChain = [
    { name: 'a.yml', text: 'name: A\non:\n  schedule:\njobs:\n  go:\n    uses: ./.github/workflows/b.yml\n' },
    { name: 'b.yml', text: 'name: B\non:\n  workflow_call:\njobs:\n  mid:\n    if: failure()\n    uses: ./.github/workflows/c.yml\n' },
    { name: 'c.yml', text: 'name: C\non:\n  workflow_call:\njobs:\n  onward:\n    uses: ./.github/workflows/d.yml\n' },
    { name: 'd.yml', text: fixtureWorkflow(['workflow_call'], fixtureUpload('up', { retention: 7 }), 'collect') },
  ];
  add('A3 fires: a gate on an EARLY edge carries past an ungated call after it', () => kindsOf(deepChain), 'schedule-failure-upload');
  add('arrival: the far end is gated through an ungated edge', () => arrivalAt(deepChain, 'd.yml'), 'gated');
  add(
    'A3 message: three files away, it still names the edge that actually gated',
    () => {
      const v = findViolations(deepChain.map((f) => parseWorkflow(f.name, f.text)), { allowlist: [], noUploadWorkflows: [] });
      return v[0].detail.includes('the calling job `mid` in b.yml');
    },
    true,
  );

  // Two callers, one of each. Both arrivals are real; the gated one is enough.
  const twoCallers = [
    { name: 'gated.yml', text: 'name: G\non:\n  schedule:\njobs:\n  go:\n    if: failure()\n    uses: ./.github/workflows/called.yml\n' },
    { name: 'plain.yml', text: 'name: P\non:\n  schedule:\njobs:\n  go:\n    uses: ./.github/workflows/called.yml\n' },
    { name: 'called.yml', text: fixtureWorkflow(['workflow_call'], fixtureUpload('up', { retention: 7 }), 'collect') },
  ];
  add('arrival: two callers, one gated and one plain, is BOTH arrivals', () => arrivalAt(twoCallers, 'called.yml'), 'plain+gated');
  // This case USED to assert that the gated arrival flags the upload even when
  // an ungated one exists, and it was WRONG in the direction that costs a
  // reviewer their attention: with a plain caller in the picture the upload
  // really does run on every tick, so retention is its bound and there is no
  // conditional disguising anything. Flagging it forces an allowlist entry
  // whose required reason ("this job sometimes succeeds") is not about the case
  // at all. Found in review round 1 -- a case asserting a bug as correct is
  // exactly why no case could find it, and this is the second time in this
  // file's history that has happened.
  add('A3 silent: an UNGATED caller also reaches it, so the upload runs every tick', () => kindsOf(twoCallers), '');
  add(
    'A3 fires: remove the ungated caller and the gated arrival is all that is left',
    () => kindsOf(twoCallers.filter((f) => f.name !== 'plain.yml')),
    'schedule-failure-upload',
  );
  add(
    'shape: a reusable-workflow job is COUNTED so the report can name the gap',
    () => parseWorkflow('x.yml', 'name: X\non:\n  push:\njobs:\n  a:\n    uses: ./.github/workflows/other.yml\n').reusableJobs,
    1,
  );
  add(
    'shape: an ordinary job is not counted as a coverage gap',
    () => parseWorkflow('x.yml', fixtureWorkflow(['push'], ['      - run: echo'])).reusableJobs,
    0,
  );
  add(
    'analyse: the reusable-job count reaches the report',
    () =>
      analyse(
        [...cleanFiles, { name: 'reuse.yml', text: 'name: X\non:\n  push:\njobs:\n  a:\n    uses: ./.github/workflows/other.yml\n' }],
        anCfg,
      ).stats.reusableJobs,
    1,
  );
  add('shape: a missing on: is a problem', () => problemsOf('jobs:\n  a:\n    steps:\n      - run: x\n'), 'shape');
  add(
    'counts: jobs and steps are counted honestly',
    () => {
      const p = parseWorkflow('x.yml', fixtureWorkflow(['push'], [...fixtureUpload('u', { retention: 7 }), '      - run: echo']));
      return p.jobs + '/' + p.steps + '/' + p.uploads.length;
    },
    '1/2/1',
  );

  // --- GATE 1: declared versus walked ------------------------------------
  //
  // What replaced two calibrated floors that provably could not do this. The
  // regression it exists for -- a walk that visits only the first job of each
  // file -- leaves 190 of this repo's 221 steps in place, so it cleared every
  // floor the repo could tolerate and printed "policy passed". END TO END,
  // against the real .github/workflows, that mutation is now exit 2; the cases
  // here drive the two halves directly so a failure names which half broke.
  const threeJobs = [
    'name: X', 'on:', '  push:', 'jobs:',
    '  a:', '    runs-on: ubuntu-latest', '    steps:', '      - run: one', '      - run: two',
    '  b:', '    runs-on: ubuntu-latest', '    steps:', '      - run: three',
    '  c:', '    uses: ./.github/workflows/other.yml',
  ].join('\n');

  add(
    'declared: a three-job document declares three jobs and three steps',
    () => {
      const d = declaredCounts(YAML.parse(threeJobs));
      return d.jobs + '/' + d.steps;
    },
    '3/3',
  );
  add('declared: a reusable job declares no steps of its own', () => declaredCounts(YAML.parse('jobs:\n  a:\n    uses: ./x.yml\n')).steps, 0);
  add('declared: a job that is not a mapping is still a declared job', () => declaredCounts(YAML.parse('jobs:\n  a: 7\n')).jobs, 1);
  add('declared: a document with no jobs: mapping declares nothing', () => declaredCounts(YAML.parse('name: X\n')).jobs, 0);
  add('declared: a top-level list declares nothing rather than throwing', () => declaredCounts(['a']).jobs, 0);
  add(
    'walk: the real walk agrees with the declaration, and raises no problem',
    () => {
      const p = parseWorkflow('x.yml', threeJobs);
      return p.jobs + '/' + p.steps + '/' + p.problems.length;
    },
    '3/3/0',
  );
  add(
    'walk: both sides are recorded, so the report prints what it cleared',
    () => {
      const p = parseWorkflow('x.yml', threeJobs);
      return p.declaredJobs + '/' + p.declaredSteps;
    },
    '3/3',
  );

  // The WIRING, not just the comparison. Found by mutation: replacing the call
  // in parseWorkflow with `void traversalProblems` left all 184 cases green,
  // because the two counts agree by construction on every document a fixture
  // can write. The stub is the only way to make them disagree -- and the case
  // after it, with an AGREEING stub, is what stops the seam itself being the
  // reason this passes.
  add(
    'walk: parseWorkflow is WIRED to the invariant, not merely sitting near it',
    () => parseWorkflow('x.yml', threeJobs, { declaredCounts: () => ({ jobs: 99, steps: 99 }) }).problems.map((p) => p.kind).join(','),
    'traversal,traversal',
  );
  add(
    'walk: an agreeing stub is silent, so the seam is not what fires it',
    () => parseWorkflow('x.yml', threeJobs, { declaredCounts: () => ({ jobs: 3, steps: 3 }) }).problems.length,
    0,
  );
  add('traversal: agreement is silent', () => traversalProblems('x.yml', { jobs: 3, steps: 9 }, { jobs: 3, steps: 9 }).length, 0);
  add('traversal: a first-job-only walk is caught on the JOB count', () => traversalProblems('x.yml', { jobs: 3, steps: 9 }, { jobs: 1, steps: 9 })[0].kind, 'traversal');
  add('traversal: steps missed while the job count agrees is caught too', () => traversalProblems('x.yml', { jobs: 3, steps: 9 }, { jobs: 3, steps: 4 }).length, 1);
  // Over-counting is a bug in the other direction and is refused as well. A
  // number inflated by double-walking is exactly what would keep a broken floor
  // green, which is how the guessed floors this replaced would have died.
  add('traversal: walking MORE than was declared is refused too', () => traversalProblems('x.yml', { jobs: 1, steps: 1 }, { jobs: 1, steps: 2 }).length, 1);
  add('traversal: both dimensions wrong reports both', () => traversalProblems('x.yml', { jobs: 3, steps: 9 }, { jobs: 1, steps: 2 }).length, 2);
  add(
    'traversal: the message sends the reader to the guard, not the repo',
    () => traversalProblems('x.yml', { jobs: 3, steps: 9 }, { jobs: 1, steps: 9 })[0].detail.includes('This is the guard, not the repo'),
    true,
  );

  // --- The two shapes that read clean by contributing nothing -------------
  const usesAndSteps = 'name: X\non:\n  push:\njobs:\n  a:\n    uses: ./.github/workflows/other.yml\n    steps:\n      - name: up\n        uses: actions/upload-artifact@v7\n';

  add('shape: a job declaring BOTH uses: and steps: is refused', () => problemsOf(usesAndSteps), 'shape');
  // The message names both keys. A mutant that only damaged the wording left
  // every kind-only assertion green, and a shape problem whose text does not
  // say WHICH shape sends the reader hunting through a 900-step scan.
  add(
    'shape: ...and says which two keys collided',
    () => parseWorkflow('x.yml', usesAndSteps).problems[0].detail.includes('declares BOTH `uses:` and `steps:`'),
    true,
  );
  // Refusing it is half. The other half is that refusing must not mean SEEING
  // LESS: the steps are still walked and the call is still recorded, so the
  // upload inside cannot hide behind the very shape the guard rejects.
  add('shape: ...its steps are still walked', () => parseWorkflow('x.yml', usesAndSteps).steps, 1);
  add('shape: ...its call is still recorded, so triggers keep propagating', () => parseWorkflow('x.yml', usesAndSteps).calls.length, 1);
  add('shape: ...and the upload inside it is still found', () => kindsOf([{ name: 'a.yml', text: usesAndSteps }]), 'retention-missing');
  add('shape: a bare EMPTY steps list is refused', () => problemsOf('name: X\non:\n  push:\njobs:\n  a:\n    steps: []\n'), 'shape');
  // A step that is not a mapping is refused BY NAME too, rather than counted
  // and skipped: counted-and-skipped satisfied the walked count and the steps
  // floor while being invisible to all four rules.
  add(
    'shape: a step that is not a mapping is refused, not silently counted',
    () => problemsOf('name: X\non:\n  push:\njobs:\n  a:\n    steps:\n      - just-a-string\n'),
    'shape',
  );
  add(
    'shape: ...and it is still COUNTED, so the invariant stays exact',
    () => {
      const p = parseWorkflow('x.yml', 'name: X\non:\n  push:\njobs:\n  a:\n    steps:\n      - just-a-string\n');
      return p.steps + '/' + p.declaredSteps;
    },
    '1/1',
  );
  // One job, one honest message. A `uses:` job with an empty scalar `steps:`
  // used to be told it declares BOTH and then that it has NEITHER.
  add(
    'shape: a uses: job with a non-list steps: gets one message, not two contradictory ones',
    () => {
      const p = parseWorkflow('x.yml', 'name: X\non:\n  push:\njobs:\n  a:\n    uses: ./.github/workflows/o.yml\n    steps:\n');
      return p.problems.filter((q) => q.detail.includes('neither')).length;
    },
    0,
  );
  add(
    'shape: uses: plus an EMPTY steps list is refused twice over -- it used to read clean',
    () => problemsOf('name: X\non:\n  push:\njobs:\n  a:\n    uses: ./x.yml\n    steps: []\n'),
    'shape,shape',
  );
  // The invariant structurally cannot see this one: zero declared and zero
  // walked agree perfectly. That is why it has its own branch.
  add(
    'shape: an empty steps list satisfies declared-versus-walked, which is the point',
    () => {
      const p = parseWorkflow('x.yml', 'name: X\non:\n  push:\njobs:\n  a:\n    steps: []\n');
      return p.declaredSteps + '/' + p.steps;
    },
    '0/0',
  );

  // --- TRAP TWO: the guard must not be able to report clean on nothing ----
  const statsOf = (o) => ({ workflowFiles: 0, jobs: 0, steps: 0, uploadSteps: 0, seenFiles: [], ...o });
  const tinyFloors = { workflowFiles: 1, uploadSteps: 1, steps: 1 };

  add(
    'inclusion: an empty scan is blocked on every floor at once',
    () => assertInclusion(statsOf({}), { floors: tinyFloors, noUploadWorkflows: [] }).length,
    3,
  );
  add(
    'inclusion: a scan that met every floor is not blocked',
    () => assertInclusion(statsOf({ workflowFiles: 1, uploadSteps: 1, steps: 1 }), { floors: tinyFloors, noUploadWorkflows: [] }).length,
    0,
  );
  add(
    'inclusion: files parsed but no upload RECOGNISED is blocked -- the matcher, not the walk',
    () => assertInclusion(statsOf({ workflowFiles: 40, jobs: 40, steps: 900 }), { floors: tinyFloors, noUploadWorkflows: [] }).length,
    1,
  );
  // A floor nobody asserts is not a floor. This case also stopped two of its
  // neighbours passing for the WRONG reason: while `jobs` and `steps` sat in
  // tinyFloors unread, they contributed exactly the two blockers the old
  // counts expected, so `an empty scan is blocked on every floor at once` was
  // still green while measuring something else entirely.
  add(
    'inclusion: a floor declared but never asserted is a blocker, not a gate',
    () => assertInclusion(statsOf({ workflowFiles: 9, uploadSteps: 9, steps: 9 }), { floors: { ...tinyFloors, jobs: 20 }, noUploadWorkflows: [] }).length,
    1,
  );
  add(
    'inclusion: and it names the key, so the fix is obvious',
    () => assertInclusion(statsOf({ workflowFiles: 9, uploadSteps: 9, steps: 9 }), { floors: { ...tinyFloors, jobs: 20 }, noUploadWorkflows: [] })[0].detail.includes('FLOORS.jobs'),
    true,
  );
  // A4 is a rule about an ABSENCE, and absence rules pass loudest when their
  // subject is deleted. Renaming ci-budget-guard.yml must not read as "it
  // uploads nothing".
  add(
    'inclusion: the A4 subject going missing is exit-2 material, not a pass',
    () => assertInclusion(statsOf({ workflowFiles: 1, jobs: 1, steps: 1, uploadSteps: 1, seenFiles: ['other.yml'] }), { floors: tinyFloors }).length,
    1,
  );
  // An UNDECLARED floor is not a floor of zero. Mistyping a FLOORS key used to
  // switch that gate off in silence -- an unknown recorded as the most
  // permissive value, which is this arc's own failure mode.
  // BOTH EDGES of every surviving floor, pinned as measurements. Only the upper
  // edge was ever pinned before, which is half a gate: a floor can fail by
  // being too high (it reds on ordinary work -- the step floor of 180 did
  // exactly that, because db-contract-check.yml is 76 of the 221 steps) or by
  // being too low (it stops catching anything, which is what 120 did). A number
  // with one edge pinned has been calibrated against one failure mode and left
  // free against the other.
  // Derived from MEASURED rather than written as literals, so a port edits the
  // measurements and these follow. As literals they pinned THIS repo's 21 and 5
  // into the canary, and a port with eight workflows would have failed its own
  // control on arrival -- before the guard ever ran, because architecture-guard
  // runs --self-test first.
  add('floors: the file floor absorbs losing two workflows', () => FLOORS.workflowFiles <= MEASURED.workflowFiles - 2, true);
  add('floors: and stays above half, so half a directory read is still caught', () => FLOORS.workflowFiles >= Math.ceil(MEASURED.workflowFiles / 2), true);
  add('floors: the upload floor absorbs retiring two monitors', () => FLOORS.uploadSteps <= MEASURED.uploadSteps - 2, true);
  // The collapse floor, both edges, from the same measurements: below the
  // largest-single-deletion line and well above the tenth-of-the-repo line.
  add('floors: the collapse floor survives deleting the largest workflow', () => FLOORS.steps <= MEASURED.steps - MEASURED.largestWorkflowSteps, true);
  add('floors: and is high enough to catch a catastrophic under-read', () => FLOORS.steps >= Math.ceil(MEASURED.steps / 10) + 1, true);
  // MEASURED against the REPOSITORY, which is the only case in this canary that
  // touches disk -- and it earns the exception. Everything else here pins
  // FLOORS against MEASURED, so without this the whole "both edges are pinned
  // by measurement" claim is two hand-written constants agreeing with each
  // other and never failing on real data. Add ten workflows and leave MEASURED
  // at 21 and the half-directory floor is silently wrong while the canary stays
  // green.
  //
  // A BAND, not equality: an exact pin would red on adding one workflow, which
  // is ordinary work, and this file has already spent three drafts learning
  // what happens when a gate reds on ordinary work. 25% is wide enough to
  // absorb normal churn and narrow enough that MEASURED cannot quietly become
  // fiction.
  const liveStats = () => {
    const files = readWorkflowsFromDisk(ROOT);
    const parsedLive = files.map((f) => parseWorkflow(f.name, f.text));
    return {
      workflowFiles: parsedLive.length,
      steps: parsedLive.reduce((n, p) => n + p.steps, 0),
      uploadSteps: parsedLive.reduce((n, p) => n + p.uploads.length, 0),
    };
  };
  const drifted = (live, recorded) => Math.abs(live - recorded) > recorded * 0.25;

  add('measured: the recorded file count still matches the repository', () => drifted(liveStats().workflowFiles, MEASURED.workflowFiles), false);
  add('measured: and the recorded step count does too -- re-measure if this reds', () => drifted(liveStats().steps, MEASURED.steps), false);
  add('measured: and the recorded upload count', () => drifted(liveStats().uploadSteps, MEASURED.uploadSteps), false);
  // Both directions: the drift test can actually fail, so a green above is a
  // measurement rather than a tautology like the `MEASURED.steps > 0` it
  // replaced.
  add('measured: the drift test is capable of failing', () => drifted(MEASURED.steps * 2, MEASURED.steps), true);
  // Deliberately no lower edge on uploadSteps: 0 is correct in bachata-admin,
  // where this same file is the enforcement copy over a repo with no upload
  // steps at all. Asserting >= 1 here would make the shared file un-portable to
  // the one repo whose zero the SELF-PROBE exists to cover.
  // Jobs is gone for good: the invariant owns it, and no number could do it.
  // Steps survives ONLY as a collapse floor, which is a different job from the
  // one three drafts failed at -- see the FLOORS docstring.
  add('floors: jobs is NOT a floor any more -- the invariant owns it', () => 'jobs' in FLOORS, false);
  add(
    'inclusion: a MISSING floor key is a blocker, not a free pass',
    () =>
      assertInclusion(statsOf({ workflowFiles: 0, uploadSteps: 0, steps: 0 }), {
        floors: { workflowFiles: 1 },
        noUploadWorkflows: [],
      }).length,
    3,
  );
  add(
    'inclusion: a non-numeric floor is a blocker too',
    () =>
      assertInclusion(statsOf({ workflowFiles: 9, uploadSteps: 9, steps: 9 }), {
        floors: { ...tinyFloors, uploadSteps: 'lots' },
        noUploadWorkflows: [],
      }).length,
    1,
  );
  add(
    'inclusion: the subject present is not blocked',
    () => assertInclusion(statsOf({ workflowFiles: 1, jobs: 1, steps: 1, uploadSteps: 1, seenFiles: ['ci-budget-guard.yml'] }), { floors: tinyFloors }).length,
    0,
  );

  // The live positive control, checked in the canary too, so a broken fixture
  // is a named FAIL here rather than a mystery exit 2 on the next PR.
  add('self-probe: the detector flags all four rules on its own fixture', () => runSelfProbe().length, 0);
  // The line above is necessary and was not sufficient: it stays 0 when the
  // probe stops being able to fail at all. These drive the judgement directly,
  // in both directions, so a probe that always reports "alive" is a FAIL here.
  add('self-probe: seeing all four kinds is alive', () => probeVerdict(new Set(SELF_PROBE_EXPECTS)).length, 0);
  add('self-probe: seeing NOTHING is blind, and says so', () => probeVerdict(new Set()).length, 1);
  add(
    'self-probe: three of four is still blind -- it is not a majority vote',
    () => probeVerdict(new Set(SELF_PROBE_EXPECTS.slice(1))).length,
    1,
  );
  add(
    'self-probe: the blocker names the rule that went quiet',
    () => probeVerdict(new Set(SELF_PROBE_EXPECTS.slice(1)))[0].detail.includes(SELF_PROBE_EXPECTS[0]),
    true,
  );
  // The probe must cover EVERY kind the detector can emit, not a sample of
  // them. Its first draft covered four of eight while claiming "one of each",
  // and the four it skipped were the quietest regressions.
  // Against the CODE's own registry, not a literal. The literal that stood here
  // was a second copy of SELF_PROBE_EXPECTS, so the two agreed while both
  // omitted `allowlist-ambiguous` and the case reported full coverage of a
  // detector with a rule it could not see.
  add(
    'self-probe: it covers every kind the detector is registered to emit',
    () => [...new Set(SELF_PROBE_EXPECTS.map((k) => k.split('::')[0]))].sort().join(','),
    VIOLATION_KINDS.slice().sort().join(','),
  );
  // And the MECHANISMS, not merely the kinds. Keyed by file because one kind
  // arrives by three different routes -- a step gate, a caller's gate, and a
  // workflow_run collector -- and covering it once let two of the three regress
  // in silence while the probe went on reporting the detector alive.
  add(
    'self-probe: the caller-gate route is covered in its own right',
    () => SELF_PROBE_EXPECTS.includes('schedule-failure-upload::zz-probe-called.yml'),
    true,
  );
  add(
    'self-probe: and so is the workflow_run collector route',
    () => SELF_PROBE_EXPECTS.includes('schedule-failure-upload::zz-probe-collector.yml'),
    true,
  );
  // The collector fixture must keep its event_name conjunct. It is what makes
  // the probe a control for the round-2 defect -- reachability asked as
  // `schedule` inside a collector whose event is always `workflow_run` -- and
  // without it the fixture still fires, so nothing else would notice it being
  // quietly weakened.
  add(
    'self-probe: the collector fixture keeps the conjunct that makes it a control',
    () => SELF_PROBE.find((f) => f.name === 'zz-probe-collector.yml').text.includes("github.event_name == 'workflow_run'"),
    true,
  );
  // And the registry is load-bearing rather than descriptive: a kind that is
  // not in it cannot be emitted at all. That is what stops the next rule being
  // added with no positive control, which is how this list fell short twice.
  add(
    'registry: an unregistered kind THROWS rather than being reported quietly',
    () => {
      try {
        violation('A9', 'not-a-kind', { file: 'a', job: 'b', step: 'c' }, 'detail');
        return 'no throw';
      } catch (error) {
        return error.message.includes('not-a-kind') ? 'threw, naming it' : 'threw';
      }
    },
    'threw, naming it',
  );
  add(
    'registry: a registered kind passes through untouched',
    () => violation('A1', 'retention-missing', { file: 'a', job: 'b', step: 'c' }, 'detail').kind,
    'retention-missing',
  );
  // This case used to be a byte-for-byte duplicate of the one above while its
  // NAME claimed a stronger property -- the same watchman-with-no-watchman
  // shape the probe split was meant to end. It now reads the kinds the fixture
  // actually produces and compares them to the list, so a kind listed but
  // unprovokable is a named FAIL rather than an invisible gap.
  add(
    'self-probe: every listed expectation is one the fixture ACTUALLY provokes',
    () => {
      const produced = new Set(probeKeys(SELF_PROBE.map((f) => parseWorkflow(f.name, f.text))));
      return SELF_PROBE_EXPECTS.filter((k) => !produced.has(k)).join(',');
    },
    '',
  );
  add(
    'self-probe: and the fixture provokes nothing the list omits',
    () => {
      const produced = [...new Set(probeKeys(SELF_PROBE.map((f) => parseWorkflow(f.name, f.text))))];
      return produced.filter((k) => !SELF_PROBE_EXPECTS.includes(k)).join(',');
    },
    '',
  );

  // --- analyse(): the order contract -------------------------------------
  const cleanFiles = [
    { name: 'ci-budget-guard.yml', text: guardWithComment },
    { name: 'ok.yml', text: fixtureWorkflow(['push'], fixtureUpload('up', { retention: 7 })) },
  ];
  const dirtyFiles = [
    { name: 'ci-budget-guard.yml', text: guardWithComment },
    { name: 'bad.yml', text: fixtureWorkflow(['schedule'], fixtureUpload('up', { if: 'failure()' })) },
  ];
  const anCfg = { floors: tinyFloors, allowlist: [], noUploadWorkflows: ['ci-budget-guard.yml'] };

  add('analyse: a compliant set is 0', () => analyse(cleanFiles, anCfg).code, 0);
  add('analyse: a violating set is 1', () => analyse(dirtyFiles, anCfg).code, 1);
  add(
    'analyse: a violating set that ALSO cannot be measured is 2, not 1',
    () => analyse(dirtyFiles, { ...anCfg, floors: { ...tinyFloors, uploadSteps: 99 } }).code,
    2,
  );
  add(
    'analyse: a blind detector is 2 and reports NO verdict on the repo',
    () => {
      const blind = () => [{ kind: 'self-probe', detail: 'fixture went unflagged' }];
      const r = analyse(dirtyFiles, { ...anCfg, selfProbe: blind });
      return r.code + '/' + r.violations.length;
    },
    '2/0',
  );
  add(
    'analyse: an unparseable file is 2 even when every other file is clean',
    () => analyse([...cleanFiles, { name: 'broken.yml', text: 'jobs:\n  a:\n   - [unclosed' }], anCfg).code,
    2,
  );

  // --- The 0/1/2 contract, driven through main() -------------------------
  //
  // Every case above proves a RULE. None of them proved a CODE, because none
  // called main(). P2 found by mutation that flipping one of its `return 2`s to
  // `return 0` left all 88 of its rule cases green -- the guard's headline
  // promise was the one thing its canary could not see.
  const quiet = { out: () => {}, err: () => {} };
  const runMain = (argv, extra = {}) => main(argv, { ...quiet, ...extra });

  // --- The CLI dispatch itself ------------------------------------------
  //
  // Unasserted until round 2, and it is the one branch whose failure is
  // completely silent: a false here means the module body never runs, nothing
  // is printed, and node exits 0 -- which every caller reads as PASSED. Eight
  // of this repo's guards once did exactly that under a junctioned working
  // directory, because the ESM loader realpaths `import.meta.url` while
  // `process.argv[1]` is left as typed.
  // Built from ROOT with path.join, and the canonicalisation is a rename rather
  // than a drive-letter trick. An earlier draft simulated the Windows drive
  // case with /^c:/ and passed locally while failing on Linux CI, where `c:/x`
  // is a RELATIVE path and the anchor never matches. A canary case that only
  // holds on the author's OS is worse than none: it goes red on the first
  // machine that matters.
  const asPath = (base) => path.join(ROOT, 'scripts', base);
  const canonicalise = (p) => p.split('shadow').join('canonical');
  add(
    'cli: an entry point reached by a shadow path still counts as the CLI run',
    () => isCliInvocation(asPath('shadow.mjs'), pathToFileURL(asPath('canonical.mjs')).href, canonicalise),
    true,
  );
  add(
    'cli: without canonicalising, that same invocation is missed -- which exits 0 in silence',
    () => isCliInvocation(asPath('shadow.mjs'), pathToFileURL(asPath('canonical.mjs')).href, (p) => p),
    false,
  );
  add(
    'cli: a genuinely different entry point is still not this module',
    () => isCliInvocation(asPath('other.mjs'), pathToFileURL(asPath('canonical.mjs')).href, canonicalise),
    false,
  );
  add('cli: no argv[1] at all is not a CLI run', () => isCliInvocation(undefined, 'file:///x'), false);
  // The regression the first version of this fix SHIPPED, on Windows: realpath
  // canonicalises the drive letter, so realpathing one side only made an
  // ordinary absolute invocation stop matching -- and the guard then printed
  // nothing and exited 0. Found by mutation, where every mutant abruptly
  // "produced no verdict".
  // THE DISCRIMINATING CASE: the MODULE side is the one needing canonicalisation
  // here, so it fails if only argv[1] is realpathed. That is the shape that
  // shipped and broke Windows -- realpath canonicalises the drive letter, so
  // `node c:/dev/...` stopped matching the loader's `file:///c:/...`, IS_CLI
  // came out false, and the guard printed nothing and exited 0.
  add(
    'cli: the MODULE side needs canonicalising too -- doing only argv[1] loses the match',
    () => isCliInvocation(asPath('canonical.mjs'), pathToFileURL(asPath('shadow.mjs')).href, canonicalise),
    true,
  );
  add(
    'cli: and an already-canonical pair matches without either side moving',
    () => isCliInvocation(asPath('canonical.mjs'), pathToFileURL(asPath('canonical.mjs')).href, canonicalise),
    true,
  );
  add('cli: a non-file URL matches nothing on disk', () => isCliInvocation('C:/x.mjs', 'data:text/javascript,0'), false);
  add(
    'cli: a path that cannot be realpathed falls back rather than deciding no',
    () => isCliInvocation(asPath('canonical.mjs'), pathToFileURL(asPath('canonical.mjs')).href, () => { throw new Error('ENOENT'); }),
    true,
  );

  add('exit: an unknown flag is 2', () => runMain(['--nope']), 2);
  // A BROKEN DETECTOR is could-not-run, not policy-violated. Driven through
  // main() via the injected seam, because the direct call recurses.
  add('exit: a failing canary is 2 -- the guard is broken, not the repo', () => runMain(['--self-test'], { runSelfTest: () => false }), 2);
  add('exit: a passing canary is 0', () => runMain(['--self-test'], { runSelfTest: () => true }), 0);
  add(
    'exit: a compliant repo is 0 -- the contract is not merely "always 2"',
    () => runMain([], { listFiles: () => cleanFiles, cfg: anCfg }),
    0,
  );
  add(
    'exit: a policy violation is 1, held distinct from could-not-run',
    () => runMain([], { listFiles: () => dirtyFiles, cfg: anCfg }),
    1,
  );
  // Not just the disk read: a throw from the RULES or the REPORT must be 2 as
  // well. Only the read was wrapped at first, so anything else escaped main()
  // and exited 1 -- a broken guard read as an unbounded upload.
  add(
    'exit: a throw from inside analyse() is 2, not the policy code',
    () =>
      runMain([], {
        listFiles: () => cleanFiles,
        cfg: {
          ...anCfg,
          selfProbe: () => {
            throw new Error('the detector blew up');
          },
        },
      }),
    2,
  );
  add(
    'exit: a workflow directory that cannot be read is 2, never 0',
    () =>
      runMain([], {
        listFiles: () => {
          throw new Error('ENOENT: no .github/workflows here');
        },
        cfg: anCfg,
      }),
    2,
  );
  add(
    'exit: an unmet floor is 2 even though no rule was violated',
    () => runMain([], { listFiles: () => cleanFiles, cfg: { ...anCfg, floors: { ...tinyFloors, workflowFiles: 99 } } }),
    2,
  );
  add(
    'exit: an empty workflow directory is 2, not a clean 0',
    () => runMain([], { listFiles: () => [], cfg: anCfg }),
    2,
  );

  // --- What the REPORT actually says -------------------------------------
  //
  // Driven through main() and captured, because every case above proves what
  // the guard decided and none proved what it TELLS anyone. The legend used to
  // explain four rule names while the list above it could contain kinds none of
  // them covered: a reader who hit `allowlist-ambiguous` got a paragraph about
  // three rules that were not their problem.
  const captured = (files, cfg) => {
    const lines = [];
    main([], { out: (l) => lines.push(l), err: (l) => lines.push(l), listFiles: () => files, cfg });
    return lines.join('\n');
  };
  const ambiguousFiles = [
    { name: 'ci-budget-guard.yml', text: guardWithComment },
    {
      name: 'nightly.yml',
      text: fixtureWorkflow(['schedule'], [
        ...fixtureUpload('Upload', { if: 'failure()', retention: 7 }),
        ...fixtureUpload('Upload', { if: 'failure()', retention: 7 }),
      ]),
    },
  ];
  const staleCfg = { ...anCfg, allowlist: [{ file: 'gone.yml', job: 'j', step: 's', reason: 'fixture' }] };

  add(
    'report: the run that emits allowlist kinds also explains them',
    () => {
      const text = captured(ambiguousFiles, staleCfg);
      return text.includes('Rename the steps') && text.includes('Delete it once you have checked');
    },
    true,
  );
  add(
    'report: and the legend says the gate counts at the caller level too',
    () => captured(ambiguousFiles, staleCfg).includes('another file that calls this one'),
    true,
  );
  add(
    'report: a passing run prints the declared-versus-walked numbers it cleared',
    () => captured(cleanFiles, anCfg).includes('walk was complete: 2 of 2 declared job(s), 2 of 2 declared step(s)'),
    true,
  );
  // The accepted exceptions belong on the FAILURE path too. They were printed
  // only on the pass path, which is backwards: the reader who needs to compare
  // their flagged step against the ones already accepted is by definition
  // looking at a red build.
  add(
    'report: a FAILING run prints the accepted exceptions and their reasons',
    () => {
      const text = captured(ambiguousFiles, { ...anCfg, allowlist: [{ file: 'other.yml', job: 'j', step: 's', reason: 'a stated reason' }] });
      return text.includes('Already accepted, for comparison:') && text.includes('because a stated reason');
    },
    true,
  );
  add(
    'report: a failing run with NO exceptions does not print an empty heading',
    () => captured(ambiguousFiles, anCfg).includes('Already accepted'),
    false,
  );
  // The legend names the A4 subject from CONFIG rather than as a literal, so a
  // port does not print another repository's filename at its authors.
  add(
    'report: the A4 legend names the configured subject, not a hardcoded file',
    () => captured(ambiguousFiles, { ...anCfg, noUploadWorkflows: ['ci-budget-guard.yml'] }).includes('  A4     ci-budget-guard.yml upload nothing'),
    true,
  );

  let failed = 0;
  for (const c of cases) {
    let got;
    try {
      got = c.fn();
    } catch (error) {
      got = 'threw: ' + error.message;
    }
    const ok = got === c.expected;
    if (!ok) failed += 1;
    const detail = ok ? '' : '  (expected ' + JSON.stringify(c.expected) + ', got ' + JSON.stringify(got) + ')';
    out((ok ? 'ok  ' : 'FAIL') + '  ' + c.name + detail);
  }

  if (failed > 0) {
    err('\nFAIL self-test -- ' + failed + ' of ' + cases.length + ' case(s).');
    return false;
  }
  out('\nPASS self-test -- ' + cases.length + ' cases, every rule proven in both directions.');
  return true;
}

// ---------------------------------------------------------------------------
// Only act as a CLI when actually invoked as one: the exports above are pulled
// in by the canary and by the mutation harness, and an unguarded top-level scan
// would run -- and set an exit code -- on mere import.
// ---------------------------------------------------------------------------
// realpath BOTH sides. The ESM loader has already resolved symlinks and
// junctions in `import.meta.url`, while `process.argv[1]` is left exactly as
// typed, so an invocation through a junctioned working directory leaves this
// false: the module body never runs, nothing is printed, and node exits 0 --
// which every caller reads as PASSED. That is not hypothetical here; eight of
// this repo's guards once printed 0 bytes and exited 0 for exactly this reason,
// and scripts/lib/review-scope.mjs already realpaths for the same reason.
export function isCliInvocation(invoked, moduleUrl, realpath = realpathSync.native) {
  if (invoked === undefined) return false;
  // BOTH sides through the same canonicalisation, which is the whole trick.
  // Realpathing only argv[1] fixed the junction case and introduced a worse
  // one on Windows: realpath canonicalises the DRIVE LETTER, so invoking
  // `node c:/dev/Website/scripts/...` gave `file:///C:/...` on one side and the
  // loader's `file:///c:/...` on the other, IS_CLI came out false, and the
  // guard printed nothing and exited 0. That is the exact silent pass this
  // function exists to prevent, introduced by the first attempt at preventing
  // it -- and it was found by the mutation harness, not by reading, because
  // every mutant suddenly "produced no verdict".
  const canon = (p) => {
    try {
      return realpath(p);
    } catch {
      // Not on disk (a virtual entry point): fall back to the literal argument
      // rather than deciding this is not a CLI run.
      return p;
    }
  };
  let modulePath;
  try {
    modulePath = fileURLToPath(moduleUrl);
  } catch {
    // Not a file: URL at all -- nothing on disk can match it.
    return false;
  }
  return pathToFileURL(canon(invoked)).href === pathToFileURL(canon(modulePath)).href;
}

const IS_CLI = isCliInvocation(process.argv[1], import.meta.url);

if (IS_CLI) {
  // process.exitCode, never process.exit(): process.exit() truncates stdout on
  // Linux, where 904 lines of a sibling guard's output arrived as 194 in CI.
  process.exitCode = main(process.argv.slice(2));
}

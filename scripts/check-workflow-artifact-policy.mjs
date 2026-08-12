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
 *                            workflow. THIS IS THE INCIDENT. `if: failure()`
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
 * So nothing here is decided by exclusion. Every run must clear FOUR inclusion
 * gates before any verdict is printed, and failing one is exit 2 -- could not
 * measure -- never a pass:
 *
 *   1. FLOORS. It parsed at least N workflow files, walked at least N jobs and
 *      N steps, and found at least N uploads (CONFIG below). A traversal that
 *      quietly returns nothing cannot clear these.
 *   2. SHAPE. Every job must be a shape this guard actually understands --
 *      `steps:` or a reusable `uses:`. An unrecognised one is exit 2 and names
 *      itself, rather than contributing zero steps in silence.
 *   3. PARSE. A file that will not parse is exit 2. It is never skipped: the
 *      one file the guard cannot read is the one worth reading.
 *   4. SELF-PROBE. On EVERY run, before touching the repo, the detector is run
 *      against an embedded fixture carrying one of each violation. If it does
 *      not find all four, the guard says so and exits 2 without reporting on
 *      the repo at all. This is what makes a zero-upload repo honest: it
 *      separates "the matcher works and there are none" from "the matcher is
 *      broken", which the upload floor alone cannot do once that floor is 0 --
 *      as it is in bachata-admin, where this same file is the enforcement copy.
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
import { readFileSync, readdirSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import YAML from 'yaml';
import { assertMeasured } from './lib/previewProbe.mjs';

const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const WORKFLOW_DIR = '.github/workflows';

// ---------------------------------------------------------------------------
// CONFIG -- the whole per-repo surface. Porting this file to bachata-admin
// means editing this block and nothing else.
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
 * Inclusion floors. Not decoration -- these are the only thing standing between
 * "policy clean" and "scanned nothing and said so nicely".
 *
 * MEASURED on this repo, 2026-08-12: 21 workflow files, 28 jobs, 221 steps,
 * 5 upload-artifact steps. The floors below are set from those numbers -- an
 * earlier draft quoted "24 jobs" and no step count at all, figures nobody had
 * run, and derived floors of 12/12/60 from them. At 57%/43%/27% of true reach
 * a traversal regression that dropped every job after the first in each file
 * (about 21 jobs and 90 steps) would have cleared all three and reported the
 * repo clean. A floor guessed under a number you never measured is decoration.
 *
 * They are a floor on the guard's REACH, not a budget on the repo, and the
 * headroom is set from the worst ORDINARY case, measured rather than guessed:
 * db-contract-check.yml alone is 76 of the 221 steps, so deleting that single
 * file takes the count to 145. A step floor of 180 -- which this had, derived
 * from "well below 221" -- therefore reddened on one perfectly ordinary
 * deletion.
 *
 * WHAT THESE FLOORS DO NOT CATCH, measured, because a draft of this comment
 * claimed the opposite and a canary case pinned the claim: a JOB-LEVEL
 * traversal bug. If parseWorkflow walked only the first job of each file, this
 * repo yields 21 files / 21 jobs / 190 steps / 4 uploads -- every floor
 * cleared, "policy passed" printed. FOURTEEN of the 21 workflows have exactly
 * one job, so only 31 of the 221 steps live outside a first job; the earlier
 * comment guessed "about 90" and was wrong by a hundred. A scenario appeared to
 * prove the catch, but it truncated the file TEXT after the first job, which
 * also removes the steps -- it measured a different bug from the one it named.
 *
 * So these floors honestly guard only the DIRECTORY read -- too few files, or a
 * total collapse. The per-file walk needs a declared-versus-walked assertion
 * (count the jobs the document contains, then assert the loop visited them
 * all), which is a real invariant rather than a calibrated number and is
 * QUEUED. Until it lands, do not read a passing floor as proof the traversal
 * is intact. Recording that is the point: an overclaimed gate is worse than an
 * absent one, because it is the reason nobody looks.
 *
 * A drop through one means the guard broke far more often than it means three
 * workflows were deleted at once, and the failure message says so, in those
 * words, so the reader checks the guard before the repo.
 *
 * uploadSteps is the delicate one. It is 3, not 5, so retiring a monitor is not
 * a CI incident -- and if it ever legitimately reaches 0 the floor must go to 0
 * with it, at which point the live SELF-PROBE below is the only thing proving
 * the upload matcher still works. That is why the probe exists and why it runs
 * unconditionally rather than only when the floor is 0.
 */
const FLOORS = {
  workflowFiles: 16,
  jobs: 20,
  steps: 120,
  uploadSteps: 3,
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
  return /(?:^|\/)upload-(?:pages-)?artifact$/.test(action);
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
 * Walk one workflow file.
 *
 * Returns counts as well as findings. The counts are what the inclusion floors
 * are asserted against, so they must be honest even -- especially -- on a file
 * that yields no uploads at all.
 */
export function parseWorkflow(name, text) {
  const result = {
    name,
    triggers: [],
    uploads: [],
    jobs: 0,
    steps: 0,
    reusableJobs: 0,
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
    // A reusable-workflow call has no steps of its own. That is a shape this
    // guard KNOWS it cannot see into, which is different from one it failed to
    // recognise -- but "knows" only counts if it SAYS so, and the first draft
    // passed over these in complete silence while the report read "policy
    // passed" as though coverage were total. It is counted here and printed in
    // the report, so a repo that moves its uploads behind a called workflow
    // gets a named caveat rather than a clean bill.
    if (typeof job.uses === 'string' && job.steps === undefined) {
      result.reusableJobs += 1;
      result.calls.push(calledWorkflowName(job.uses));
      continue;
    }

    if (!Array.isArray(job.steps)) {
      result.problems.push({
        kind: 'shape',
        file: name,
        detail: 'job `' + jobId + '` has neither a `steps:` list nor a reusable `uses:` -- unrecognised shape, refusing to call it zero steps',
      });
      continue;
    }

    // The JOB's condition is carried alongside the step's, because a condition
    // one indentation level up is the same condition. Reading only `step.if`
    // let the incident shape through untouched: a dedicated collection job
    // written `collect:` / `if: failure()` with a bare upload inside it -- the
    // MORE idiomatic spelling -- scanned completely clean. Found in review, by
    // running it: schedule + job-level failure() + retention 14 scored 0
    // violations, which is the 858 MB nightly with a green tick.
    const jobIf = typeof job.if === 'string' ? job.if : null;

    for (const step of job.steps) {
      result.steps += 1;
      if (!step || typeof step !== 'object' || Array.isArray(step)) continue;
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
  if (/\bfailure\s*\(\s*\)/.test(expr)) return true;
  // `!= 'failure'` is the opposite gate -- upload UNLESS it failed -- and its
  // cost is bounded by how often the job succeeds, which is the ordinary case.
  if (/!=\s*['"]failure['"]/.test(expr)) return false;
  return /['"]failure['"]/.test(expr);
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
export function scheduleCanReach(cond) {
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
  for (const term of bare.split('&&')) {
    // Anchored WHOLE, which is what carries the negation case as well: a
    // conjunct like `!(github.event_name == 'pull_request')` simply does not
    // match, so it excuses nothing. An explicit `startsWith('!')` skip stood
    // here until the mutation pass showed it could be deleted with every case
    // still green -- it was doing nothing the anchors were not already doing,
    // and unasserted code in a guard is a place for a future mistake to hide.
    const eq = term.trim().match(/^github\.event_name\s*==\s*['"]([A-Za-z_]+)['"]$/);
    if (eq && eq[1] !== 'schedule') return false;
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
  if (typeof trimmed === 'string' && trimmed.includes('${{')) {
    return { kind: 'not-static', shown: String(value) };
  }
  const days = typeof trimmed === 'number' ? trimmed : Number(String(trimmed));
  // A malformed LITERAL is its own kind, split out from the expression case.
  // Both used to be 'not-static', whose message says "Pin a literal" -- which
  // is unhelpful advice to hand someone whose 7.5 already is one.
  if (!Number.isFinite(days) || !Number.isInteger(days)) {
    return { kind: 'unreadable', shown: String(value) };
  }
  if (days < 1) return { kind: 'invalid', days };
  if (days > RETENTION_CAP_DAYS) return { kind: 'over-cap', days };
  return { kind: 'ok', days };
}

const allowKey = (o) => o.file + ' :: ' + o.job + ' :: ' + o.step;

/** The file a `uses: ./.github/workflows/x.yml` job call points at. */
function calledWorkflowName(uses) {
  const path = String(uses).split('@')[0].trim();
  const parts = path.split('/');
  return parts[parts.length - 1];
}

/**
 * Effective triggers per workflow: its own, plus those of anything that calls
 * it. A reusable workflow inherits the triggers of its callers, because that
 * is literally how it runs -- a `workflow_call` file invoked from a nightly IS
 * running nightly, whatever its own `on:` block says.
 *
 * Iterated to a fixed point so a chain of calls propagates, and bounded by the
 * number of workflows so a cycle terminates rather than hanging the guard.
 */
export function propagateTriggers(parsed) {
  const effective = new Map(parsed.map((w) => [w.name, new Set(w.triggers)]));
  for (let pass = 0; pass <= parsed.length; pass++) {
    let changed = false;
    for (const wf of parsed) {
      const from = effective.get(wf.name);
      for (const target of wf.calls ?? []) {
        const to = effective.get(target);
        if (!to) continue;
        for (const t of from) {
          if (to.has(t)) continue;
          to.add(t);
          changed = true;
        }
      }
    }
    if (!changed) break;
  }
  return effective;
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
  const effective = propagateTriggers(parsed);

  for (const wf of parsed) {
    // EFFECTIVE triggers, not the file's own. A called workflow declares
    // `on: workflow_call` and nothing else, so A3 -- the only rule that reads
    // triggers -- silently never applied to it, while A1 and A2 did. The file
    // was reported on as though covered, with its one cost-shape rule dead.
    // Moving the incident into a reusable workflow was therefore a way to walk
    // straight past this guard. Round 2.
    const onSchedule = (effective.get(wf.name) ?? new Set(wf.triggers)).has('schedule');

    for (const up of wf.uploads) {
      const retention = classifyRetention(up.retention);
      if (retention.kind === 'missing') {
        violations.push({
          rule: 'A1',
          kind: 'retention-missing',
          file: up.file,
          job: up.job,
          step: up.step,
          detail: 'no retention-days: this upload inherits the ACCOUNT default, so its cost is set where the reviewer of this step cannot see it',
        });
      } else if (retention.kind === 'over-cap') {
        violations.push({
          rule: 'A2',
          kind: 'retention-over-cap',
          file: up.file,
          job: up.job,
          step: up.step,
          detail: 'retention-days ' + retention.days + ' exceeds this project\'s budget of ' + RETENTION_CAP_DAYS + ' days. Held storage is retention x frequency x size, and retention is the only one of the three this file states out loud.',
        });
      } else if (retention.kind === 'not-static') {
        violations.push({
          rule: 'A2',
          kind: 'retention-not-static',
          file: up.file,
          job: up.job,
          step: up.step,
          detail: 'retention-days is the expression `' + retention.shown + '`, decided at run time from inputs this file does not contain. Pin a literal: a bound nobody can read is not a bound.',
        });
      } else if (retention.kind === 'unreadable') {
        violations.push({
          rule: 'A2',
          kind: 'retention-unreadable',
          file: up.file,
          job: up.job,
          step: up.step,
          detail: 'retention-days is `' + retention.shown + '`, which is a literal but not a whole number of days. GitHub takes an integer 1-90.',
        });
      } else if (retention.kind === 'invalid') {
        violations.push({
          rule: 'A2',
          kind: 'retention-invalid',
          file: up.file,
          job: up.job,
          step: up.step,
          detail: 'retention-days ' + retention.days + ' is not a valid retention (1-' + RETENTION_CAP_DAYS + ')',
        });
      }

      // The gate can sit on either the step or the job, and reachability must
      // be read from BOTH: an earlier draft applied it to the job only, so the
      // very false positive it was written to stop still fired one indentation
      // level down, on `if: github.event_name == 'pull_request' && failure()`.
      const stepGate = conditionIsFailureGate(up.ifExpr);
      const jobGate = conditionIsFailureGate(up.jobIf);
      if (
        onSchedule &&
        (stepGate || jobGate) &&
        scheduleCanReach(up.jobIf) &&
        scheduleCanReach(up.ifExpr)
      ) {
        flagged.push({
          up,
          // The expression that ACTUALLY gated on failure, not whichever one
          // exists. Reporting `up.ifExpr ?? up.jobIf` sent the author to a step
          // condition that was merely present -- `hashFiles(...) != ''` -- and
          // told them it was a failure gate, which it is not.
          expr: stepGate ? up.ifExpr : up.jobIf,
          level: stepGate ? 'step' : 'job',
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
  for (const f of flagged) {
    const key = allowKey(f.up);
    // Two flagged uploads sharing a key -- same job, same step name, or both
    // unnamed and collapsed to '(unnamed step)' -- cannot be told apart by an
    // allowlist entry, so ONE entry would silently exempt BOTH, including one
    // nobody reviewed. Refuse the ambiguity rather than resolve it by
    // position: the design's whole claim is that each exception is a decision.
    if (perKey.get(key) > 1) {
      violations.push({
        rule: 'A3',
        kind: 'allowlist-ambiguous',
        file: f.up.file,
        job: f.up.job,
        step: f.up.step,
        detail: 'two or more failure-gated uploads in this job share the step name `' + f.up.step +
          '`, so no allowlist entry can name just one of them. Give each step a distinct name.',
      });
      continue;
    }
    const entry = allowlist.find((a) => allowKey(a) === key);
    if (entry) {
      allowedHit.add(key);
      continue;
    }
    violations.push({
      rule: 'A3',
      kind: 'schedule-failure-upload',
      file: f.up.file,
      job: f.up.job,
      step: f.up.step,
      detail: 'if: `' + f.expr + '` (' + f.level +
        ' level) gates this upload on failure, on a workflow that runs on a schedule. That bounds cost ONLY if the job sometimes succeeds -- on a never-green job it is an unconditional upload wearing a conditional. If this job really is ordinarily green, say so in SCHEDULE_FAILURE_ALLOWLIST with the reason.',
    });
  }

  for (const name of noUpload) {
    const wf = parsed.find((w) => w.name === name);
    if (!wf) continue; // absence is an INCLUSION failure, raised in assertInclusion
    for (const up of wf.uploads) {
      violations.push({
        rule: 'A4',
        kind: 'budget-guard-uploads',
        file: up.file,
        job: up.job,
        step: up.step,
        detail: name + ' must upload nothing: it reads the artifact pool it would be joining, and a guard that measures itself is the failure it exists to catch',
      });
    }
  }

  for (const entry of allowlist) {
    const key = allowKey(entry);
    if (allowedHit.has(key)) continue;
    violations.push({
      rule: 'A3',
      kind: 'allowlist-stale',
      file: entry.file,
      job: entry.job,
      step: entry.step,
      detail: 'allowlisted as "' + entry.reason + '", but no schedule+failure() upload matches it any more. Delete the entry -- and check the construct is GONE rather than renamed, because an entry that outlives its step transfers the exception to whatever takes the name.',
    });
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
 */
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
    ].join('\n'),
  },
  {
    name: 'ci-budget-guard.yml',
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
];

/**
 * EVERY kind the detector can emit. Fewer than all of them means blind.
 *
 * It listed four of the eight in its first draft while the docstring claimed
 * "one of each violation". The three retention kinds it omitted are the ones
 * whose regressions are quietest -- an expression re-classified as ok, say --
 * and they were missing from exactly the control that is meant to be the last
 * line of cover in a zero-upload repo. Adding a kind to findViolations without
 * adding it here re-opens that hole silently, so the canary asserts this list
 * against the fixture rather than trusting it.
 */
const SELF_PROBE_EXPECTS = [
  'retention-missing',
  'retention-over-cap',
  'retention-not-static',
  'retention-unreadable',
  'retention-invalid',
  'schedule-failure-upload',
  'budget-guard-uploads',
  'allowlist-stale',
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
  return probeVerdict(
    new Set(
      findViolations(parsed, { allowlist: SELF_PROBE_ALLOWLIST, noUploadWorkflows: ['ci-budget-guard.yml'] })
        .map((v) => v.kind),
    ),
  );
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
export function probeVerdict(kinds) {
  const missed = SELF_PROBE_EXPECTS.filter((k) => !kinds.has(k));
  if (missed.length === 0) return [];
  return [{
    kind: 'self-probe',
    detail: 'the detector did NOT flag its own fixture for: ' + missed.join(', ') +
      '. A rule that no longer matches reports every repo as clean, so this is exit 2 and not a pass.',
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
  const pairs = [
    ['workflowFiles', 'workflow files parsed'],
    ['jobs', 'jobs walked'],
    ['steps', 'steps walked'],
    ['uploadSteps', 'upload-artifact steps found'],
  ];

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
    uploadSteps: parsed.reduce((n, p) => n + p.uploads.length, 0),
    reusableJobs: parsed.reduce((n, p) => n + p.reusableJobs, 0),
    seenFiles: parsed.map((p) => p.name),
  };

  blockers.push(...assertInclusion(stats, cfg));

  if (blockers.length > 0) return { code: 2, blockers, violations: [], stats, parsed };

  const violations = findViolations(parsed, cfg);
  const allowlist = cfg.allowlist ?? SCHEDULE_FAILURE_ALLOWLIST;
  return { code: violations.length > 0 ? 1 : 0, blockers: [], violations, stats, parsed, allowlist };
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
  err('  A1/A2  every upload sets retention-days, and it is a literal <= ' + RETENTION_CAP_DAYS + '.');
  err('  A3     an if: failure() upload on a schedule: workflow needs an allowlist entry with a reason.');
  err('  A4     ci-budget-guard.yml uploads nothing; it reads the pool it would join.');
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
    'allowlist-ambiguous,allowlist-ambiguous',
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
  add(
    'triggers: propagation reaches a called workflow',
    () => [...(propagateTriggers(calledIncident.map((f) => parseWorkflow(f.name, f.text))).get('called.yml') ?? [])].sort().join(','),
    'schedule,workflow_call',
  );
  add(
    'triggers: a call CYCLE terminates instead of hanging the guard',
    () => {
      const cyc = [
        { name: 'a.yml', text: 'name: A\non:\n  schedule:\njobs:\n  j:\n    uses: ./.github/workflows/b.yml\n' },
        { name: 'b.yml', text: 'name: B\non:\n  workflow_call:\njobs:\n  j:\n    uses: ./.github/workflows/a.yml\n' },
      ].map((f) => parseWorkflow(f.name, f.text));
      return [...propagateTriggers(cyc).get('b.yml')].sort().join(',');
    },
    'schedule,workflow_call',
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

  // --- TRAP TWO: the guard must not be able to report clean on nothing ----
  const statsOf = (o) => ({ workflowFiles: 0, jobs: 0, steps: 0, uploadSteps: 0, seenFiles: [], ...o });
  const tinyFloors = { workflowFiles: 1, jobs: 1, steps: 1, uploadSteps: 1 };

  add(
    'inclusion: an empty scan is blocked on every floor at once',
    () => assertInclusion(statsOf({}), { floors: tinyFloors, noUploadWorkflows: [] }).length,
    4,
  );
  add(
    'inclusion: a scan that met every floor is not blocked',
    () => assertInclusion(statsOf({ workflowFiles: 1, jobs: 1, steps: 1, uploadSteps: 1 }), { floors: tinyFloors, noUploadWorkflows: [] }).length,
    0,
  );
  add(
    'inclusion: files parsed but ZERO steps walked is blocked -- the shape changed',
    () => assertInclusion(statsOf({ workflowFiles: 40, jobs: 40 }), { floors: tinyFloors, noUploadWorkflows: [] }).length,
    2,
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
  // The floors' HEADROOM, pinned as a measurement rather than a comment. The
  // step floor was 180 against a measured 221 until deleting one ordinary
  // workflow -- db-contract-check.yml, 76 steps on its own -- took the count to
  // 145 and reddened the guard on a perfectly normal change. These two cases
  // are what stop the next edit re-tightening it out of the same instinct.
  add('floors: the step floor leaves room to delete the largest workflow (221 - 76)', () => FLOORS.steps <= 145, true);
  add('floors: the file floor absorbs losing two workflows', () => FLOORS.workflowFiles <= 19, true);
  // The case that stood here asserted `FLOORS.steps > 90` and called it proof
  // that a first-job-only traversal bug is caught. MEASURED: that regression
  // leaves 190 steps in this repo, not 90 -- fourteen of the 21 workflows have
  // a single job -- so no step floor below 190 catches it, and this case was
  // certifying a property that is false. Deleted rather than re-tuned: raising
  // the floor to 190 would red on deleting one ordinary workflow, which is the
  // opposite mistake. The real invariant is declared-versus-walked, and it is
  // queued. A canary case that pins a wrong number is worse than no case: it
  // reads as coverage and argues against looking again.
  add('floors: no floor pretends to catch a per-file traversal bug (that is queued)', () => FLOORS.steps < 190, true);
  add(
    'inclusion: a MISSING floor key is a blocker, not a free pass',
    () =>
      assertInclusion(statsOf({ workflowFiles: 0, jobs: 0, steps: 0, uploadSteps: 0 }), {
        floors: { workflowFiles: 1, jobs: 1, steps: 1 },
        noUploadWorkflows: [],
      }).length,
    4,
  );
  add(
    'inclusion: a non-numeric floor is a blocker too',
    () =>
      assertInclusion(statsOf({ workflowFiles: 9, jobs: 9, steps: 9, uploadSteps: 9 }), {
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
  add(
    'self-probe: it covers every kind findViolations can emit',
    () => SELF_PROBE_EXPECTS.slice().sort().join(','),
    'allowlist-stale,budget-guard-uploads,retention-invalid,retention-missing,retention-not-static,retention-over-cap,retention-unreadable,schedule-failure-upload',
  );
  // This case used to be a byte-for-byte duplicate of the one above while its
  // NAME claimed a stronger property -- the same watchman-with-no-watchman
  // shape the probe split was meant to end. It now reads the kinds the fixture
  // actually produces and compares them to the list, so a kind listed but
  // unprovokable is a named FAIL rather than an invisible gap.
  add(
    'self-probe: every listed kind is one the fixture ACTUALLY provokes',
    () => {
      const parsedProbe = SELF_PROBE.map((f) => parseWorkflow(f.name, f.text));
      const produced = new Set(
        findViolations(parsedProbe, { allowlist: SELF_PROBE_ALLOWLIST, noUploadWorkflows: ['ci-budget-guard.yml'] })
          .map((v) => v.kind),
      );
      return SELF_PROBE_EXPECTS.filter((k) => !produced.has(k)).join(',');
    },
    '',
  );
  add(
    'self-probe: and the fixture provokes nothing the list omits',
    () => {
      const parsedProbe = SELF_PROBE.map((f) => parseWorkflow(f.name, f.text));
      const produced = [...new Set(
        findViolations(parsedProbe, { allowlist: SELF_PROBE_ALLOWLIST, noUploadWorkflows: ['ci-budget-guard.yml'] })
          .map((v) => v.kind),
      )];
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
const IS_CLI =
  process.argv[1] !== undefined && import.meta.url === pathToFileURL(process.argv[1]).href;

if (IS_CLI) {
  // process.exitCode, never process.exit(): process.exit() truncates stdout on
  // Linux, where 904 lines of a sibling guard's output arrived as 194 in CI.
  process.exitCode = main(process.argv.slice(2));
}

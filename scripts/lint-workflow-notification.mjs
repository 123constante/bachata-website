#!/usr/bin/env node
// Failure-notification tripwire for GitHub Actions workflows.
//
// WHY THIS EXISTS. Four probes -- prod-smoke, seo-check, og-image-check (prod
// arm), synthetic-ssr-monitor -- went red on schedule and stayed red for ~14h
// on 2026-08-21/22 (Vercel Bot Protection flipped to `challenge` in the
// dashboard). None of the four had a failure-notification step, so detection
// existed but had no audience. Three siblings of the same defect --
// gsc-health-check.yml, sourcemap-check.yml (both schedule-triggered probes
// of production with no notification step) and weekly-digest.yml (a
// scheduled job that silently fails to produce its report) -- were found by
// this guard's own real scan while it was being built, and repaired alongside
// the four (see those files' own diffs). This lint is what stops the omission
// from happening a NINTH time: it REFUSES a scheduled job that references
// production with no notification step, rather than relying on someone
// remembering to copy the pattern (see .github/workflows/prod-smoke.yml for a
// worked example of the pattern itself: db-contract-check.yml's "Announce
// failure" / "Close failure issue when green again" steps).
//
// THE RULE. For every job in every workflow file: if the job is reachable on
// a `schedule:` tick (per the file's `on:` triggers, narrowed by the job's own
// `if:`) AND the job references production -- either directly in its own YAML
// body, or by invoking a scripts/*.mjs check whose own source falls back to
// the production host -- the job must contain a step that (a) uses
// actions/github-script and (b) gates on a condition `conditionIsFailureGate`
// recognises as a failure gate. A pull_request-only job already has a human
// in the loop via the PR, which is exactly why og-image-check.yml's
// `og-preview` job (schedule+PR at the FILE level, gated to `pull_request`
// only at the job level, and probing a PREVIEW host, never prod) must NOT be
// flagged -- the negative case that proves this isn't "every workflow needs
// this".
//
// REAL YAML, REAL REUSE. This is a real parse (the `yaml` package), not a
// line scanner: scripts/check-workflow-artifact-policy.mjs's own header notes
// that a text scanner flags a workflow's comment EXPLAINING a rule as though
// it were a violation of that rule, and an earlier draft of this file hit
// exactly that class (three separate ways: a negated `!failure()` condition,
// a commented-out `uses: actions/github-script` line, and a `steps:`-shaped
// line inside an unrelated block-scalar value all fooled a regex scanner).
// `readTriggers`, `conditionIsFailureGate` and `scheduleCanReach` are imported
// rather than re-derived: the negation handling in `conditionIsFailureGate`
// and the disjunction/negation handling in `scheduleCanReach` were each hunted
// down over two review rounds against exactly this incident class, and
// reimplementing them here would only reintroduce round 1's bugs.
//
// Local:  node scripts/lint-workflow-notification.mjs
// CI:     .github/workflows/workflow-lint.yml, job `notification-check`.

import { readFileSync, readdirSync, mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { createRequire } from 'node:module';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { isEntryPoint } from './lib/entry-point.mjs';
import { readTriggers, conditionIsFailureGate, scheduleCanReach } from './check-workflow-artifact-policy.mjs';

const WORKFLOWS_DIR = '.github/workflows';
const PROD_HOST = /bachatacalendar\.co\.uk/i;
const RUN_SCRIPT_REF = /\bscripts\/[\w./-]+\.mjs\b/g;

// Lazy + memoised, same shape as check-workflow-artifact-policy.mjs's own
// loadYaml(): a missing `yaml` package must surface as a catchable error (exit
// 2, "could not run") rather than an uncaught module-resolution crash at
// import time, which is not a policy violation and must not be reported as
// one.
const requireFromHere = createRequire(import.meta.url);
let yamlModule = null;
let yamlError = null;
function loadYaml() {
  if (yamlModule) return yamlModule;
  if (yamlError) throw yamlError;
  try {
    yamlModule = requireFromHere('yaml');
  } catch (error) {
    yamlError = new Error(
      'the `yaml` package is not installed, so no workflow could be parsed. This is exit 2 '
        + '(the guard could not run), NOT a policy violation: run `npm install`. Original: '
        + (error && error.message ? error.message : String(error)),
    );
    throw yamlError;
  }
  return yamlModule;
}

/** An `uses:` naming actions/github-script, any fork or pinned SHA of it --
 * same matching shape as check-workflow-artifact-policy.mjs's own
 * isUploadArtifact, for the same reason: `@` (a tag) is not part of the
 * action's identity. */
export function isGithubScript(uses) {
  if (typeof uses !== 'string') return false;
  return /(?:^|\/)actions\/github-script$/.test(uses.split('@')[0].trim());
}

/** Does this step notify on failure: actions/github-script, gated on a
 * condition conditionIsFailureGate recognises? Both must live on the SAME
 * step -- a github-script step for something unrelated, or an unrelated
 * failure-gated step (e.g. "Upload traces on failure"), must not satisfy this
 * alone. */
export function isNotificationStep(step) {
  if (!step || typeof step !== 'object' || Array.isArray(step)) return false;
  if (!isGithubScript(step.uses)) return false;
  return conditionIsFailureGate(typeof step.if === 'string' ? step.if : '');
}

/** Every scripts/*.mjs path a step's `run:` text invokes, deduplicated. */
function stepScriptRefs(step) {
  if (!step || typeof step.run !== 'string') return [];
  return [...new Set(step.run.match(RUN_SCRIPT_REF) || [])];
}

/**
 * Does this job reference production -- directly in its own YAML (env/with/
 * run values), or indirectly, by invoking a scripts/*.mjs check whose own
 * source falls back to the production host when no override env var is set?
 *
 * The indirect half exists because two real workflows do exactly that:
 * gsc-health-check.yml's `gsc-check` job and sourcemap-check.yml's `check`
 * job both invoke a script (check-gsc.mjs, check-sourcemap-debugids.mjs) that
 * defaults to `https://www.bachatacalendar.co.uk` in its OWN source, never
 * spelling the domain in the workflow YAML at all -- so a scan of the job
 * body alone reports them clean while they are exactly the class this lint
 * exists to catch. `repoRoot` is threaded through (never `process.cwd()`
 * baked in here) so the canary can point it at a fixture directory.
 */
export function jobReferencesProd(job, repoRoot) {
  if (!job || typeof job !== 'object') return false;
  if (PROD_HOST.test(JSON.stringify(job))) return true;
  const steps = Array.isArray(job.steps) ? job.steps : [];
  for (const step of steps) {
    for (const ref of stepScriptRefs(step)) {
      let src;
      try {
        src = readFileSync(join(repoRoot, ref), 'utf8');
      } catch {
        continue; // a renamed/unreadable script is not this function's finding to make
      }
      if (PROD_HOST.test(src)) return true;
    }
  }
  return false;
}

/**
 * Every finding in one workflow file's text: `{kind: 'parse', detail}` if the
 * YAML itself will not parse (a file that cannot parse is the single most
 * interesting file in the directory and must not scan clean -- same rule
 * check-workflow-artifact-policy.mjs states for the same reason), or zero or
 * more `{kind: 'violation', job}` entries. `repoRoot` threads through to
 * jobReferencesProd; defaults to cwd for the CLI, overridden by the canary.
 */
export function analyzeWorkflow(text, { repoRoot = process.cwd() } = {}) {
  let doc;
  try {
    doc = loadYaml().parse(text);
  } catch (error) {
    return [{ kind: 'parse', detail: `YAML will not parse: ${error.message}` }];
  }
  if (!doc || typeof doc !== 'object' || Array.isArray(doc)) return [];

  const triggers = readTriggers(doc);
  if (!triggers.includes('schedule')) return [];

  const jobs = doc.jobs;
  if (!jobs || typeof jobs !== 'object' || Array.isArray(jobs)) return [];

  const findings = [];
  for (const [jobId, job] of Object.entries(jobs)) {
    if (!job || typeof job !== 'object' || Array.isArray(job)) continue;
    const jobIf = typeof job.if === 'string' ? job.if : null;
    if (!scheduleCanReach(jobIf, ['schedule'])) continue;
    if (!jobReferencesProd(job, repoRoot)) continue;
    const steps = Array.isArray(job.steps) ? job.steps : [];
    if (steps.some(isNotificationStep)) continue;
    findings.push({ kind: 'violation', job: jobId });
  }
  return findings;
}

/** Job names findViolations would refuse -- the shape the self-test's earlier
 * cases and the both-direction proof compare against; a thin projection over
 * analyzeWorkflow's fuller finding list. */
export function findViolations(text, opts) {
  return analyzeWorkflow(text, opts)
    .filter((f) => f.kind === 'violation')
    .map((f) => f.job);
}

/** `null` means the directory itself could not be read (infrastructure, not a
 * contract finding); an array (possibly empty) means it was read successfully.
 * Takes `dir` rather than closing over WORKFLOWS_DIR so the canary can drive
 * the missing-directory branch without touching the real repo tree. */
export function collectWorkflowFiles(dir = WORKFLOWS_DIR) {
  let entries;
  try {
    entries = readdirSync(dir);
  } catch {
    return null;
  }
  return entries
    .filter((f) => f.endsWith('.yml') || f.endsWith('.yaml'))
    .map((f) => join(dir, f));
}

/** The exit-code owner: every branch that reaches `process.exitCode` in the
 * CLI dispatch below returns from here, and the canary drives this function
 * directly (rule R5) rather than merely asserting the rules it encodes. */
export function runScan(dir = WORKFLOWS_DIR, repoRoot = process.cwd()) {
  try {
    loadYaml();
  } catch (error) {
    console.error(`lint-workflow-notification: ${error.message}`);
    return 2;
  }

  const files = collectWorkflowFiles(dir);
  if (files === null) {
    console.error(`lint-workflow-notification: could not read ${dir} -- infrastructure failure.`);
    return 2;
  }

  // POSITIVE ASSERTION (rule R1) -- 0 files scanned and 0 violations found are
  // otherwise indistinguishable, both exiting 0. A guard whose whole purpose is
  // to end a silent failure must not have one of its own.
  if (files.length === 0) {
    console.error(`lint-workflow-notification: scanned 0 files under ${dir} -- cannot verify.`);
    return 1;
  }

  const findings = [];
  for (const f of files) {
    let text;
    try {
      text = readFileSync(f, 'utf8');
    } catch (error) {
      // R2: an unreadable file is a FINDING, not a silent skip -- the exact
      // shape check-mojibake.mjs's own per-file catch was named against in
      // review. It contributes to the violation count and the exit code
      // rather than quietly narrowing what got scanned.
      findings.push(`${f}: could not read the file (${error.message}) -- treating as unverified, not clean`);
      continue;
    }
    for (const finding of analyzeWorkflow(text, { repoRoot })) {
      findings.push(finding.kind === 'parse'
        ? `${f}: ${finding.detail}`
        : `${f}: job "${finding.job}" has a schedule trigger, references production, `
          + 'and carries no failure-notification step');
    }
  }

  if (findings.length) {
    console.error(`\n${findings.length} finding(s):\n`);
    for (const f of findings) console.error(`  ${f}`);
    console.error('\nA check that goes red on a schedule and notifies nobody is the exact');
    console.error('failure this lint exists to close (edge-config-governance arc, P2 -- four');
    console.error('probes stayed red 14h with no audience). Copy db-contract-check.yml\'s');
    console.error('"Announce failure" + "Close failure issue when green again" steps; see');
    console.error('.github/workflows/prod-smoke.yml for a worked example.');
    return 1;
  }

  console.log(`lint-workflow-notification: ${files.length} workflow file(s) scanned, `
    + 'every scheduled prod probe carries a failure-notification step.');
  return 0;
}

// ---------------------------------------------------------------------------
// Canary (rule R4 -- a guard with no proof it can fail is not a guard).
// Fixtures are literal YAML text, real-parsed the same way the CLI parses a
// real file -- the detector must be provable with no repo filesystem
// dependency (beyond a throwaway temp dir for the script-fallback cases)
// before it is trusted against the real one.
// ---------------------------------------------------------------------------

const FIXTURE_BAD = `name: Fixture Bad
on:
  schedule:
    - cron: '0 6 * * *'
  workflow_dispatch:
jobs:
  probe:
    runs-on: ubuntu-latest
    steps:
      - name: Hit prod
        env:
          BASE_URL: https://www.bachatacalendar.co.uk
        run: node scripts/probe.mjs
`;

const FIXTURE_GOOD = `name: Fixture Good
on:
  schedule:
    - cron: '0 6 * * *'
  workflow_dispatch:
jobs:
  probe:
    runs-on: ubuntu-latest
    steps:
      - name: Hit prod
        env:
          BASE_URL: https://www.bachatacalendar.co.uk
        run: node scripts/probe.mjs
      - name: Announce failure
        if: failure() && github.event_name == 'schedule'
        uses: actions/github-script@v9
        with:
          script: |
            console.log('notify');
`;

// The negative case named in the P2 brief: a workflow that probes a
// prod-looking host but is reachable ONLY via pull_request. Must NOT be
// flagged -- push/PR failures already reach the author.
const FIXTURE_PR_ONLY = `name: Fixture PR Only
on:
  pull_request:
    branches: [main]
jobs:
  preview-probe:
    runs-on: ubuntu-latest
    steps:
      - name: Hit prod-looking host
        env:
          BASE_URL: https://www.bachatacalendar.co.uk
        run: node scripts/probe.mjs
`;

// The job-level narrowing case (og-image-check.yml's real shape): the FILE
// carries schedule, but one job is gated to pull_request only. Only the
// schedule-reachable job may be flagged.
const FIXTURE_MIXED = `name: Fixture Mixed
on:
  schedule:
    - cron: '0 6 * * *'
  workflow_dispatch:
  pull_request:
    branches: [main]
jobs:
  prod-job:
    if: github.event_name != 'pull_request'
    runs-on: ubuntu-latest
    steps:
      - name: Hit prod
        env:
          BASE_URL: https://www.bachatacalendar.co.uk
        run: node scripts/probe.mjs
  preview-job:
    if: github.event_name == 'pull_request'
    runs-on: ubuntu-latest
    steps:
      - name: Hit preview
        env:
          BASE_URL: \${{ steps.preview.outputs.url }}
        run: node scripts/probe.mjs
`;

// A NEGATED failure condition -- the exact class conditionIsFailureGate's own
// docstring names as the reason negation is checked first. Must still be
// flagged: this step never notifies on a REAL failure.
const FIXTURE_NEGATED_CONDITION = `name: Fixture Negated
on:
  schedule:
    - cron: '0 6 * * *'
jobs:
  probe:
    runs-on: ubuntu-latest
    steps:
      - name: Hit prod
        env:
          BASE_URL: https://www.bachatacalendar.co.uk
        run: node scripts/probe.mjs
      - name: Looks like a notifier but is not one
        if: "!failure() && github.event_name == 'schedule'"
        uses: actions/github-script@v9
        with:
          script: console.log('runs only on SUCCESS, not failure');
`;

// A commented-out uses: line. Real YAML parsing never sees a comment as a
// value, so this must still be flagged -- there is no live github-script step
// here, whatever the crossed-out one says.
const FIXTURE_COMMENTED_USES = `name: Fixture Commented
on:
  schedule:
    - cron: '0 6 * * *'
jobs:
  probe:
    runs-on: ubuntu-latest
    steps:
      - name: Hit prod
        env:
          BASE_URL: https://www.bachatacalendar.co.uk
        run: node scripts/probe.mjs
      - name: Upload debug logs
        if: failure()
        # uses: actions/github-script@v9 (old approach, replaced below)
        uses: actions/upload-artifact@v4
        with:
          name: debug
          path: debug.log
`;

// A block-scalar VALUE that happens to contain a line reading "steps:". Real
// YAML parsing keeps this a string under env.RUNBOOK; the job's actual
// jobs.probe.steps array, further down, is untouched -- so the real notify
// step in it must still be found.
const FIXTURE_BLOCK_SCALAR_DECOY = `name: Fixture Decoy
on:
  schedule:
    - cron: '0 6 * * *'
jobs:
  probe:
    runs-on: ubuntu-latest
    env:
      RUNBOOK: |
        steps:
          1. check the dashboard
          2. page oncall
    steps:
      - name: Hit prod
        env:
          BASE_URL: https://www.bachatacalendar.co.uk
        run: node scripts/probe.mjs
      - name: Announce failure
        if: failure() && github.event_name == 'schedule'
        uses: actions/github-script@v9
        with:
          script: console.log('notify');
`;

const REAL_PROD_PROBES = [
  'prod-smoke.yml',
  'seo-check.yml',
  'og-image-check.yml',
  'synthetic-ssr-monitor.yml',
  'gsc-health-check.yml',
  'sourcemap-check.yml',
  'weekly-digest.yml',
];

// The indirect-reference case: no literal prod host anywhere in the
// workflow's own YAML, but the invoked script defaults to it. Mirrors
// gsc-health-check.yml / sourcemap-check.yml's real shape exactly.
const FIXTURE_SCRIPT_DEFAULT = `name: Fixture Script Default
on:
  schedule:
    - cron: '0 6 * * *'
jobs:
  probe:
    runs-on: ubuntu-latest
    steps:
      - name: Run check
        run: node scripts/fixture-check.mjs
`;

const FIXTURE_SCRIPT_DEFAULT_NOTIFIED = FIXTURE_SCRIPT_DEFAULT.replace(
  '        run: node scripts/fixture-check.mjs\n',
  '        run: node scripts/fixture-check.mjs\n'
    + '      - name: Announce failure\n'
    + "        if: failure() && github.event_name == 'schedule'\n"
    + '        uses: actions/github-script@v9\n'
    + '        with:\n'
    + "          script: console.log('notify');\n",
);

/** Builds a throwaway `<tmp>/scripts/fixture-check.mjs` whose source falls
 * back to the production host, runs `fn(repoRoot)`, and removes the temp
 * directory whether `fn` throws or not -- so this case needs no real repo
 * file and leaves nothing behind. */
function withScriptFallbackFixture(fn) {
  const root = mkdtempSync(join(tmpdir(), 'lint-workflow-notification-selftest-'));
  try {
    mkdirSync(join(root, 'scripts'));
    writeFileSync(
      join(root, 'scripts', 'fixture-check.mjs'),
      "const BASE = process.env.BASE || 'https://www.bachatacalendar.co.uk';\n",
      'utf8',
    );
    return fn(root);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
}

function selfTest() {
  const cases = [
    [
      'a scheduled prod probe with no notification step is flagged',
      () => findViolations(FIXTURE_BAD),
      ['probe'],
    ],
    [
      'the same probe WITH a failure()-gated github-script step is clean',
      () => findViolations(FIXTURE_GOOD),
      [],
    ],
    [
      'a pull_request-only probe of a prod-looking host is NOT flagged',
      () => findViolations(FIXTURE_PR_ONLY),
      [],
    ],
    [
      'in a mixed file, only the schedule-reachable job is flagged',
      () => findViolations(FIXTURE_MIXED),
      ['prod-job'],
    ],
    [
      'a workflow with no schedule trigger at all short-circuits to no violations',
      () => findViolations('on:\n  pull_request:\njobs:\n  x:\n    steps:\n      - run: echo hi\n'),
      [],
    ],
    [
      'a NEGATED failure() condition does not count as a notifier',
      () => findViolations(FIXTURE_NEGATED_CONDITION),
      ['probe'],
    ],
    [
      'a commented-out uses: github-script line is invisible to a real parser',
      () => findViolations(FIXTURE_COMMENTED_USES),
      ['probe'],
    ],
    [
      'a "steps:"-shaped block-scalar VALUE does not hijack the real steps list',
      () => findViolations(FIXTURE_BLOCK_SCALAR_DECOY),
      [],
    ],
    [
      'invoking a script whose OWN source defaults to prod is caught with no literal URL in the YAML',
      () => withScriptFallbackFixture((root) => findViolations(FIXTURE_SCRIPT_DEFAULT, { repoRoot: root })),
      ['probe'],
    ],
    [
      'the same script-default job WITH a notifier is clean',
      () => withScriptFallbackFixture((root) => findViolations(FIXTURE_SCRIPT_DEFAULT_NOTIFIED, { repoRoot: root })),
      [],
    ],
    [
      'unparseable YAML is a named finding, never a silent clean scan',
      () => analyzeWorkflow('jobs:\n  x:\n    steps: [\n').map((f) => f.kind),
      ['parse'],
    ],
    ['non-vacuity: scanning a real directory finds more than 0 files', () => {
      const files = collectWorkflowFiles();
      return files !== null && files.length > 0;
    }, true],
    [
      'a missing workflows directory reads as infrastructure (2), not a pass',
      () => runScan('.github/definitely-not-a-real-dir'),
      2,
    ],
  ];

  // The six now-fixed probes must pass for real -- not a fixture standing in
  // for them. Reads the actual files this PR ships; if a later edit strips a
  // notify step from one of them, this case is what catches it.
  for (const name of REAL_PROD_PROBES) {
    cases.push([
      `${name} (real file, post-repair) carries no violation`,
      () => {
        let text;
        try {
          text = readFileSync(join(WORKFLOWS_DIR, name), 'utf8');
        } catch (err) {
          return `unreadable: ${err.message}`;
        }
        return findViolations(text, { repoRoot: process.cwd() });
      },
      [],
    ]);
  }

  let failed = 0;
  for (const [name, run, expected] of cases) {
    let actual;
    try {
      actual = run();
    } catch (err) {
      actual = `unexpected throw: ${err.message}`;
    }
    const ok = JSON.stringify(actual) === JSON.stringify(expected);
    if (!ok) failed++;
    console.log(`  ${ok ? 'ok  ' : 'FAIL'}  ${name}`);
    if (!ok) {
      console.log(`          expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`);
    }
  }
  if (failed) {
    console.error(`\nFAIL self-test -- ${failed} of ${cases.length} case(s).`);
    return 1;
  }
  console.log(`\nPASS self-test -- ${cases.length} cases, both directions.`);
  return 0;
}

// process.exitCode rather than process.exit(): on Linux an exit() straight
// after a large stdout write truncates it (see check-mojibake.mjs and
// check-script-conventions.mjs for the same guard against the same failure).
// Only act as a CLI when invoked as one -- isEntryPoint realpaths both sides
// (scripts/lib/entry-point.mjs), so this still fires through a junction or
// symlinked worktree, where the naive import.meta/argv[1] string compare
// would exit 0 having run nothing.
if (isEntryPoint(import.meta.url)) {
  const argv = process.argv.slice(2);
  const KNOWN_FLAGS = ['--self-test'];
  const unknown = argv.filter((a) => !KNOWN_FLAGS.includes(a));
  if (unknown.length) {
    console.error(
      `lint-workflow-notification: unknown flag(s) ${unknown.join(' ')}. Known: ${KNOWN_FLAGS.join(', ')}.`,
    );
    process.exitCode = 1;
  } else {
    process.exitCode = argv.includes('--self-test') ? selfTest() : runScan();
  }
}

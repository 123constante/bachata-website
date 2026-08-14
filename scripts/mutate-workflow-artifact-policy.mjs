#!/usr/bin/env node
/**
 * Mutation + scenario harness for check-workflow-artifact-policy.mjs.
 *
 * SHIPPED, and run from the repository:
 *   npm run mutate:workflow-artifact-policy
 *   node scripts/mutate-workflow-artifact-policy.mjs
 *
 * These two lines used to read "Scratch tool, not shipped. Run: node
 * C:/tmp/mutate-policy.mjs", which was false in both halves the moment the file
 * was committed to scripts/ -- and was contradicted twenty lines below by the
 * ROOT comment arguing that exact point. It is not decoration: this harness is
 * now the only thing standing behind several canary arms that no run in this
 * repository can reach, so a reader who is told it is scratch is being told to
 * ignore the proof.
 *
 * EXIT CODES, because it lives beside guards that hold the line on them:
 *   0  every mutant killed, control green, no refusals, no bad scenarios
 *   1  something SURVIVED, was REFUSED, broke the harness, or missed a scenario
 * A refusal is a harness fault, never a result.
 *
 * THE HARNESS IS PROVEN FIRST. A mutant that does not parse and a mutant that
 * hangs both produce zero FAIL lines, which reads exactly like a blind canary.
 * So each must be REFUSED -- and refused FOR THE STATED REASON. The first run
 * of this harness "passed" its hang probe while actually failing to find the
 * anchor at all: the right verdict for the wrong reason is not a measurement.
 *
 * The source is CRLF; anchors here are written with \n and matched against a
 * normalised copy, which is what that anchor miss was.
 */
import { readFileSync, writeFileSync, unlinkSync, readdirSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { isEntryPoint } from './lib/entry-point.mjs';

// ROOT is derived from THIS FILE's location, not written as a literal. It was a
// hardcoded absolute path while this lived in C:/tmp, which is fine for scratch
// and wrong the moment it is committed: the path named a worktree that ceases to
// exist once the branch merges, and a harness pointed at the wrong tree does not
// fail -- it reports a confident "N killed" about a file it never touched.
const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const TARGET = path.join(ROOT, 'scripts/check-workflow-artifact-policy.mjs');
const SOURCE = readFileSync(TARGET, 'utf8').split('\r\n').join('\n');

const MUTANTS = [
  ['gate1: declaredCounts always reports nothing', 'return { jobs: declared.length, steps };', 'return { jobs: 0, steps: 0 };'],
  ['gate1: the walk visits only the first job of each file', 'for (const [jobId, job] of Object.entries(jobs)) {', 'for (const [jobId, job] of Object.entries(jobs).slice(0, 1)) {'],
  ['gate1: traversalProblems never reports a mismatch', 'if (declared[dim] === walked[dim]) continue;', 'if (true) continue;'],
  ['gate1: only the job dimension is compared', "for (const dim of ['jobs', 'steps']) {", "for (const dim of ['jobs']) {"],
  ['gate1: over-counting is tolerated', 'if (declared[dim] === walked[dim]) continue;', 'if (declared[dim] <= walked[dim]) continue;'],
  ['gate1: the invariant is never called', 'result.problems.push(...traversalProblems(name, declared, { jobs: result.jobs, steps: result.steps }));', 'void traversalProblems;'],
  ['gate1: the declared-count seam is ignored', 'const countDeclared = deps.declaredCounts ?? declaredCounts;', 'const countDeclared = declaredCounts;'],
];
MUTANTS.push(
  ['A3: the negative-term strip is bypassed', 'test(positive);', 'test(expr);'],
  ['A3: the negative term short-circuits the whole condition again', 'test(positive);', 'test(positive) && !/!=/.test(expr);'],
  ['A3: a caller job condition is never a gate', 'const gate = conditionIsFailureGate(call.jobIf);', 'const gate = false;'],
  ['A3: caller reachability is ignored', 'if (!scheduleCanReach(call.jobIf, [...from.events])) continue;', 'if (false) continue;'],
  ['A3: gating does not propagate past the first edge', 'if ((from.gated || gate) && !to.gated) {', 'if (gate && !to.gated) {'],
  ['A3: the decision drops the caller gate', 'if (reachable && (callerGate || (arrivedBy.plain && (stepGate || jobGate)))) {', 'if (reachable && (arrivedBy.plain && (stepGate || jobGate))) {'],
  ['A3: a schedule trigger no longer seeds a plain arrival', "        plain: (w.triggers ?? []).includes('schedule'),", '        plain: false,'],
  ['A3: the caller job condition is dropped at parse time', 'result.calls.push({ target: calledWorkflowName(job.uses), job: jobId, jobIf, fanOut: legs });', 'result.calls.push({ target: calledWorkflowName(job.uses), job: jobId, jobIf: null, fanOut: legs });'],
  ['A3: the gatedBy edge is forgotten, so the message cannot name it', '? { file: wf.name, job: call.job, expr: call.jobIf }', '? null'],
  ['shape: uses+steps reverts to the old always-continue', '      if (job.steps === undefined) continue;', '      continue;'],
  ['shape: the both-keys message stops naming them', "` declares BOTH `uses:` and `steps:` -- GitHub rejects", '` is an odd shape -- GitHub rejects'],
  ['shape: an empty steps list is no longer refused', 'if (job.steps.length === 0) {', 'if (false) {'],
  ['A2: a list retention is coerced again', "if (typeof trimmed === 'object') {", 'if (false) {'],
  ['inclusion: an unasserted floor key is tolerated', 'if (known.includes(key)) continue;', 'continue;'],
  ['registry: an unregistered kind is emitted quietly', 'if (!VIOLATION_KINDS.includes(kind)) {', 'if (false) {'],
  ['A3: an ambiguous key still marks its entry stale', 'if (entry) allowedHit.add(key);', 'void entry;'],
  ['A3: ambiguity is reported once per upload again', 'if (ambiguousReported.has(key)) continue;', 'if (false) continue;'],
  ['probe: the ambiguous kind is dropped from the expectations', "  'allowlist-ambiguous::zz-self-probe.yml',", ''],
  ['probe: the verdict always reports the detector alive', 'const missed = SELF_PROBE_EXPECTS.filter((k) => !keys.has(k));', 'const missed = [];'],
  ['floors: the file floor is lowered to nothing', '  workflowFiles: 16,', '  workflowFiles: 1,'],
  ['floors: an unasserted floor key is put back', '  workflowFiles: 16,', '  workflowFiles: 16,  jobs: 20,'],
  ['report: the completed-walk line is removed', "    out('  walk was complete: '", "    if (false) out('  walk was complete: '"],
  ['report: the legend stops explaining the allowlist kinds', 'them. Rename the steps; do not add an entry', 'them. Do something about it'],
  ['reach: the leading anchor is dropped from the equality match', '.match(/^github', '.match(/github'],
);

// Deliberately broken mutants. Each must be REFUSED, and refused for the reason
// named -- the right verdict for the wrong reason measures nothing.
const HARNESS_PROBES = [
  ['a mutant that does not parse', 'const ROOT = ', 'const = ;\nconst ROOT = ', 'did not parse'],
  ['a mutant that hangs before its verdict', '  let failed = 0;\n  for (const c of cases) {', '  let failed = 0;\n  while (true) { /* hang */ }\n  for (const c of cases) {', 'timed out'],
  ['a mutant whose anchor is not in the source', 'THIS TEXT IS NOT IN THE FILE', 'x', 'anchor not found'],
];

MUTANTS.push(
  ['R1: the plain-arrival exemption is dropped (the false positive returns)', 'const callerGate = arrivedBy.gated && !arrivedBy.plain;', 'const callerGate = arrivedBy.gated;'],
  ['R1: a cross-repo call is treated as a local file again', "if (!target.startsWith('./')) return null;", 'if (false) return null;'],
  ['R1: the workflow_run edge is never walked', 'if (!watch || !watch.present) continue;', 'if (true) continue;'],
  ['R1: workflow_run watches are never read', 'result.watch = readWorkflowRunWatches(doc);', 'result.watch = { present: false, names: [], any: false };'],
  ['R1: an unreadable workflows: list watches nothing instead of everything', 'return { present: true, names, any: names.length === 0 };', 'return { present: true, names, any: false };'],
  ['R1: !success() is no longer a failure gate', String.raw`if (/!\s*success\s*\(\s*\)/.test(expr)) return true;`, 'if (false) return true;'],
  ['R1: != success is no longer a failure gate', String.raw`if (/!=\s*['"]success['"]/.test(expr)) return true;`, 'if (false) return true;'],
  ['R1: the merge sub-action stops counting as an upload', String.raw`(?:\/merge)?`, ''],
  ['R1: an unsettled propagation returns a partial map instead of throwing', 'if (!settled) {', 'if (false) {'],
  ['R2: the conjunct splitter stops respecting quotes', 'if (quote) {', 'if (false) {'],
  ['R1: the failure report stops printing the accepted exceptions', "err('  Already accepted, for comparison:');", 'void 0;'],
  ['R1: the probe stops covering the caller-gate route', "  'schedule-failure-upload::zz-probe-called.yml',", ''],
  ['R1: the probe stops covering the workflow_run route', "  'schedule-failure-upload::zz-probe-collector.yml',", ''],
  ['R1: the collapse floor is lowered below its measured band', '  steps: 100,', '  steps: 5,'],
  ['R1: the measurements are edited without the floors following', '  steps: 221,', '  steps: 2210,'],
);

MUTANTS.push(
  ['R2: the splitter ignores parentheses', "if (ch === '(') depth += 1;", 'void 0;'],
  ['R2: reachability is asked as schedule regardless of arrival', '!events.includes(eq[1])', "eq[1] !== 'schedule'"],
  ['R2: a collector no longer arrives as workflow_run', "to.events.add('workflow_run');", 'void 0;'],
  ['R2: negated failure tests count as failure gates again', String.raw`.replace(/!\s*failure\s*\(\s*\)/g, ' ')`, ''],
  ['R2: negated contains() counts as a failure gate again', String.raw`.replace(/!\s*contains\s*\([^)]*\)/g, ' ')`, ''],
  ['R2: a duplicated workflow name keeps only the first file', 'list.push(w.name);', 'if (list.length === 0) list.push(w.name);'],
  ['R2: an unresolvable watched name is dropped again', 'const upstreams = watch.any || unresolved', 'const upstreams = watch.any'],
  ['R2: a non-mapping step is silently counted again', "      if (!step || typeof step !== 'object' || Array.isArray(step)) {", '      if (false) {'],
  ['R2: the CLI dispatch stops realpathing at all', '      return realpath(p);', '      return p;'],
  // RE-ANCHORED when drifted() grew a fail-closed guard clause and became a
  // block. The old form appended `false || false &&` to the arrow head, which
  // was a valid expression body and is a syntax error in front of a brace -- so
  // this pre-existing mutant came back "did not parse or load", which the
  // harness refuses rather than scores. Worth stating plainly: a repair to the
  // subject silently disarmed one of the mutants watching it, and only running
  // the harness said so.
  ['R2: the MEASURED drift check is switched off',
    '  return Math.abs(live - recorded) > Math.max(1, recorded * 0.25);',
    '  return false;'],
  ['R2: the probe collector drops its event_name conjunct', "    if: github.event_name == 'workflow_run' && github.event.workflow_run.conclusion == 'failure'", "    if: github.event.workflow_run.conclusion == 'failure'"],
);

// A5, the fan-out rule. Every level the header's property table enumerates, in
// both the arithmetic and the wiring -- plus the two shapes that can only fail
// open (an unreadable matrix priced as one leg, and a cycle priced as one run).
MUTANTS.push(
  ['A5: a non-mapping strategy is one leg again', "  if (typeof strategy !== 'object' || strategy === null || Array.isArray(strategy)) return unreadable();", '  if (false) return unreadable();'],
  ['A5: a non-list or empty axis is priced as one leg', '    if (!Array.isArray(value) || value.length === 0) return unreadable();', '    if (!Array.isArray(value) || value.length === 0) return { legs: 1, why: null };'],
  ['R3: an unpriceable matrix shape is guessed at instead of declined', "  if ('exclude' in matrix || ('include' in matrix && axisKeys.length > 0)) {", '  if (false) {'],
  // NOT MUTATED, deliberately, and the reason is worth keeping so a future
  // session does not re-add these and read the survival as a finding:
  //   - `fanOut !== null &&` in the budget comparison
  //   - the `? null :` arm of the fanOut ternary
  // Both are EQUIVALENT under mutation. Every unpriced path degrades to silence
  // by more than one route -- the reasons branch catches unreadable and cycle
  // first, and null arithmetic makes the remaining comparison false anyway --
  // so removing either changes no observable behaviour. That is a robustness
  // property rather than a blind spot. What IS mutated is the thing that would
  // actually break: a declined shape acquiring a NUMBER, below.
  ['R3: a declined shape is given a leg count of one instead', 'const ownTerm = uploadSelectsLegs(up) ? { legs: 1, why: null } : up.fanOut;\n      const fanOut =', 'const ownTerm = uploadSelectsLegs(up) ? { legs: 1, why: null } : { legs: up.fanOut.legs ?? 1, why: null };\n      const fanOut ='],
  ['R3: an unreadable shape is declined instead of reported', "      if (reasons.includes('unreadable') || reasons.includes('cycle')) {\n        violations.push", '      if (false) {\n        violations.push'],
  ['R3: an include-only matrix stops being priced', '    return include.length > MATRIX_MAX_LEGS ? unreadable() : { legs: include.length, why: null };', '    return unreadable();'],
  ['A5: the job matrix never reaches the upload record', '        fanOut: legs,', '        fanOut: 1,'],
  ['A5: the call edge stops carrying its matrix', 'jobIf, fanOut: legs });', 'jobIf, fanOut: { legs: 1, why: null } });'],
  ['A5: a caller matrix stops multiplying down the chain', 'const contribution = up.count * edge.fanOut.legs;', 'const contribution = edge.fanOut.legs;'],
  ['R1: a job that is not a mapping is one leg again', "  if (!job || typeof job !== 'object' || Array.isArray(job)) return unreadable();", "  if (!job || typeof job !== 'object' || Array.isArray(job)) return { legs: 1, why: null };"],
  ['R1: the largest legal matrix is called unreadable again', 'return product > MATRIX_MAX_LEGS ? unreadable() : { legs: product, why: null };', 'return product >= MATRIX_MAX_LEGS ? unreadable() : { legs: product, why: null };'],
  // Aimed at the UNREADABLE-fixture case, not the live-disk one: this repo
  // reads fine, so loosening the live comparison changes nothing there. The
  // case that can tell an inclusion test from a loose one is the one whose
  // reading is null.
  ['R2: an unknown fan-out counts as under budget again', '      const live = fanOutOf(unreadableMatrixFiles);\n      return live.unreadable === 0', '      const live = fanOutOf(unreadableMatrixFiles);\n      return true'],
  ['R2: separate caller files are summed again', 'let count = name === start ? 1 : 0;', 'let count = 1;'],
  ['R2: a diamond counts only the largest path', 'count += contribution;', 'count = Math.max(count, contribution);'],
  ['R2: the blame is overwritten by the nearest edge again', 'from = up.count === null && up.from ? up.from : { file: edge.caller, job: edge.job };', 'from = { file: edge.caller, job: edge.job };'],
  ['R2: the driving edge is whichever came first', 'if (contribution > largest) {', 'if (contribution >= 0 && largest === 0) {'],
  ['R2: only independently-triggered files are tried as starts', 'const starts = parsed.map((w) => w.name).map((name) => executionsFrom(name));', "const starts = parsed.filter((w) => (w.triggers ?? []).some((t) => t !== 'workflow_call')).map((w) => executionsFrom(w.name));"],
  ['R2: a bare matrix: key is one leg again', "  if (typeof matrix !== 'object' || matrix === null || Array.isArray(matrix)) return unreadable();", "  if (matrix === null) return { legs: 1, why: null };\n  if (typeof matrix !== 'object' || Array.isArray(matrix)) return unreadable();"],
  ['R3: a leg-selected upload surrenders the calling path too', 'const ownTerm = uploadSelectsLegs(up) ? { legs: 1, why: null } : up.fanOut;\n      const fanOut =', 'const ownTerm = up.fanOut;\n      const fanOut = uploadSelectsLegs(up) ? null :'],
  ['R2: a leg-selected upload is skipped without being counted', '      if (uploadSelectsLegs(up)) legSelected += 1;', '      if (false) legSelected += 1;'],
  ['R3: the leg-selecting test matches a dotted property too', String.raw`/(^|[^.\w])matrix\./.test(up.ifExpr)`, String.raw`/\bmatrix\./.test(up.ifExpr)`],
  ['R3: the pass line claims a maximum of zero copies', '      if (stats.fanOut.max > 0) {', '      if (true) {'],
  ['R3: the declined shapes stop being named on the pass path', '      if (stats.fanOut.notPriced > 0) {', '      if (false) {'],
  ['R3: the failure path stops saying what it could not price', '  if (stats && stats.fanOut && (stats.fanOut.unreadable > 0 || stats.fanOut.notPriced > 0)) {', '  if (false) {'],
  ['R3: the blame calls a bare strategy a strategy.matrix again', "return 'job `' + up.job + '` carries a `strategy` this file cannot read as a leg count.' + pin;", "return 'job `' + up.job + '` carries a `strategy.matrix` that is not a readable leg count.' + pin;"],
  ['R2: the incident comparison is unconditional again', "(fanOut > INCIDENT_STEADY_STATE_COPIES ? ', and this holds more than that from a SINGLE run' : '')", "', and this holds more than that from a SINGLE run'"],
  ['R2: a file downstream of a cycle is told it sits on one', "return 'this workflow is reached through a `uses:` call CYCLE'", "return 'this workflow sits on a `uses:` call CYCLE'"],
  ['R2: the pass path stops printing the fan-out it measured', "      out('  fan-out: the largest upload here produces '", "      if (false) out('  fan-out: the largest upload here produces '"],
  ['R1: a cycle is told to pin a matrix it does not have', 'GitHub refuses the cycle outright. Break the cycle.', 'GitHub refuses the cycle outright. Pin the matrix to a literal list.'],
  ['R1: the watched upstream loses the trigger that makes the level exist', "      text: ['name: Upstream', 'on:', '  workflow_call:', '  schedule:',", "      text: ['name: Upstream', 'on:', '  workflow_call:',"],

  ['A5: the budget is compared inclusively, flagging a compliant matrix', '} else if (fanOut !== null && fanOut > fanOutCap) {', '} else if (fanOut !== null && fanOut >= fanOutCap) {'],
  ['A5: a call cycle is priced as a single run', "      if (onStack.has(name)) return { count: null, from: null, why: 'cycle' };", "      if (false) return { count: null, from: null, why: 'cycle' };"],
  ['A5: an uncalled workflow_call file is priced at zero runs', 'let count = name === start ? 1 : 0;', 'let count = 0;'],
  ['A5: the probe reads the live budget instead of its own', '    fanOutCap: PROBE_FANOUT_CAP,', '    fanOutCap: FANOUT_CAP_LEGS,'],
  ['A5: fan-out travels down the workflow_run edge too', "        to.events.add('workflow_run');", "        to.events.add('workflow_run');\n        to.legs = from.legs;"],
  ['A5: the over-cap message stops naming the calling job', "    ? arrivedBy.legs + ' run(s) of this file, driven by the calling job `' + from.job + '` in ' + from.file", "    ? arrivedBy.legs + ' run(s) of this file'"],
  ['A5: the legend drops the rule this diff added', "  err('  A5     one run may produce at most '", "  if (false) err('  A5     one run may produce at most '"],
  // Drives the rule against the REAL workflows rather than a fixture: with
  // every matrix unreadable, this repo's five uploads are all unbounded.
  ['A5: a matrix-less strategy reads as unbounded', '  if (matrix === undefined) return { legs: 1, why: null };', '  if (matrix === undefined) return unreadable();'],
  ['A5: every fan-out reads as unbounded', '  if (strategy === undefined) return { legs: 1, why: null };', '  if (strategy === undefined) return unreadable();'],
  ['A5: the fan-out budget is lowered to nothing', 'const FANOUT_CAP_LEGS = 7;', 'const FANOUT_CAP_LEGS = 0;'],

  ['A5: the incident count is read from the budget again', "held ' + INCIDENT_STEADY_STATE_COPIES +", "held ' + fanOutCap +"],
);

// ADDED WITH THE PORTABILITY BACKPORT, and the reason is that without them the
// backport ships nine new canary cases with no evidence any of them can fail.
// The repairs came from bachata-admin, where a zero-upload measurement makes
// each defect visible; here every one of them is either a no-op or an arm no
// local run reaches, so "the canary covers it" was a claim about cases nobody
// had tried to break. The four zeroes are what these have to preserve.
MUTANTS.push(
  // Item 3. Strip the floor off the drift band and it is relative again, so a
  // measurement of zero has a tolerance of zero: drifted(1, 0) goes true.
  ['measured: the drift band loses its floor and is relative again',
    '  return Math.abs(live - recorded) > Math.max(1, recorded * 0.25);',
    '  return Math.abs(live - recorded) > recorded * 0.25;'],
  // Item 4, both halves. Each was a MEASURED field that nothing re-read, so
  // each needs a mutant proving the new case actually consults the disk.
  ['measured: the guard stops counting jobs',
    '    jobs: parsed.reduce((n, p) => n + p.jobs, 0),',
    '    jobs: 0,'],
  // Math.min from a seed of 0 is always 0, which is what a silently loosened
  // upper edge looks like -- and the case is EXACT, so it has nowhere to hide.
  ['measured: the largest-workflow reading collapses to zero',
    '    largestWorkflowSteps: parsed.reduce((n, p) => Math.max(n, p.steps), 0),',
    '    largestWorkflowSteps: parsed.reduce((n, p) => Math.min(n, p.steps), 0),'],
  // Item 5. Force the non-empty arm and the empty-subject legend never prints.
  ['report: the A4 legend always takes its non-empty arm',
    '  err(a4Subjects.length > 0',
    '  err(true'],
  // Item 8. The zero-upload fan-out line is unreachable on this repository's
  // five uploads, so this mutant is the only thing standing behind it here.
  ['report: the zero-upload fan-out line is switched off',
    '    if (stats && stats.uploadSteps === 0) {',
    '    if (false) {'],
  // Item 2. Rethrowing restores the pre-repair behaviour exactly: the exception
  // escapes main() and the exit code stops being 2.
  // ANCHORED PAST THE ESCAPE, deliberately. Written to include the message's
  // leading newline, the anchor is a JS escape here and a literal backslash-n
  // in the target, so it matched nothing and the mutant came back REFUSED --
  // which scores as neither killed nor survived, and is a harness fault rather
  // than a result. The substring below contains no escape at all, so the two
  // files cannot disagree about it.
  ['exit: the canary wrapper rethrows instead of returning 2',
    "Workflow artifact policy: THE CANARY COULD NOT RUN (exit 2).');",
    "Workflow artifact policy: THE CANARY COULD NOT RUN (exit 2).'); throw error;"],
  // Carried over from the admin harness, where it is the mutant that repository
  // most needs: with no upload anywhere, a dead matcher is indistinguishable
  // from an honest zero. It is not redundant here -- this repo can catch it by
  // the inclusion floor as well -- but keeping the mutant LISTS identical
  // between the two copies is what makes a diff of them a review artefact.
  ['probe: the upload matcher never recognises an upload',
    "  if (typeof uses !== 'string') return false;",
    '  if (true) return false;'],
  // THE NEGATIVE HALVES. Each of the two arms above is asserted in both
  // directions by the canary, and the mutants first written for them only drove
  // the positive one -- so "0 SURVIVED" was silent about exactly the halves the
  // comments beside those cases insist on. Raising the floor rather than
  // removing it, and forcing the zero-upload arm ON rather than off, is what
  // makes the second case of each pair load-bearing.
  ['measured: the drift floor is raised instead of removed',
    'return Math.abs(live - recorded) > Math.max(1, recorded * 0.25);',
    'return Math.abs(live - recorded) > Math.max(3, recorded * 0.25);'],
  ['report: the zero-upload fan-out line is forced on',
    '    if (stats && stats.uploadSteps === 0) {',
    '    if (true) {'],
  // And the fail-closed branch this diff added to drifted(). Letting a
  // non-finite reading through restores the NaN comparison that made a missing
  // MEASURED key vacuously green.
  ['measured: a non-finite reading is let through again',
    'if (!Number.isFinite(live) || !Number.isFinite(recorded)) return true;',
    'if (false) return true;'],
);

const hasVerdict = (text, argv) => argv.includes('--self-test')
  ? /(PASS|FAIL) self-test/.test(text)
  : /(policy passed|policy FAILED|COULD NOT RUN)/.test(text);

// THE CODE IS RETURNED AS A NUMBER, not recovered later by regex from `why`.
// The scenario loop used to parse it back out of prose this same function
// writes, which caused two bugs before it was noticed as a shape: classify's
// own 'no verdict line printed -- exit 2' was read as a real verdict, and a
// Windows crash status of 3221225477 parsed as 3. Both were patched at the
// parser. Rewording any message here would have silently broken every scenario.
function classify(text, code, argv) {
  if (!hasVerdict(text, argv)) return { verdict: 'REFUSED', why: 'no verdict line printed -- exit ' + code, code };
  if (argv.includes('--self-test')) {
    return /PASS self-test/.test(text)
      ? { verdict: 'SURVIVED', why: 'canary still green', code }
      : { verdict: 'KILLED', why: 'canary went red', code };
  }
  return { verdict: code === 0 ? 'SURVIVED' : 'KILLED', why: 'repo run exit ' + code, code };
}

function hash(s) { let h = 0; for (const ch of s) h = (h * 31 + ch.charCodeAt(0)) | 0; return h; }

function runMutant(label, find, replace, argv) {
  if (!SOURCE.includes(find)) return { verdict: 'REFUSED', why: 'anchor not found in source' };
  if (SOURCE.split(find).length !== 2) return { verdict: 'REFUSED', why: 'anchor matches ' + (SOURCE.split(find).length - 1) + ' times, not once' };
  const file = path.join(ROOT, 'scripts', '.mutant-' + process.pid + '-' + Math.abs(hash(label)) + '.mjs');
  // A FUNCTION replacement, so the text is taken literally. String.replace reads
  // $&, $1 and $` out of a replacement string, so a mutant containing a dollar
  // sign would be WRITTEN differently from how it reads in the array above -- and
  // if the corrupted text still parsed, the harness would score a kill for a
  // mutation nobody authored. No current replacement contains one; this is the
  // cheap way to keep it that way regardless of what the next one holds.
  writeFileSync(file, SOURCE.replace(find, () => replace), 'utf8');
  try {
    // stderr is PIPED, not inherited. execFileSync forwards the child's stderr
    // to the parent by default, so every killed mutant dumped its own full
    // failure report around the one-line summary this function returns: 446
    // lines of output for a run whose product is a single count. maxBuffer is
    // raised past the 1 MB default for the same reason it is now diagnosed
    // separately below -- the guard's failure path is verbose.
    const stdout = execFileSync(process.execPath, [file, ...argv], {
      cwd: ROOT, timeout: 30000, encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe'], maxBuffer: 32 * 1024 * 1024,
    });
    return classify(stdout, 0, argv);
  } catch (error) {
    // DIAGNOSED SEPARATELY, because this file refuses a right verdict reached
    // for the wrong reason everywhere except, until now, in its own reporting.
    // execFileSync kills the child for a timeout AND for a maxBuffer overflow,
    // setting error.killed on both; reporting the second as "timed out" sends
    // the operator to raise a timeout that cannot fix it.
    if (error.code === 'ENOBUFS') {
      return { verdict: 'REFUSED', why: 'output exceeded maxBuffer before a verdict could be read' };
    }
    if (error.code === 'ETIMEDOUT' || error.killed || error.signal) {
      return { verdict: 'REFUSED', why: 'timed out before printing a verdict' };
    }
    const text = (error.stdout || '') + (error.stderr || '');
    if (!hasVerdict(text, argv) && /SyntaxError|ERR_/.test(text)) {
      return { verdict: 'REFUSED', why: 'mutant did not parse or load' };
    }
    return classify(text, error.status === undefined ? 1 : error.status, argv);
  } finally {
    try { unlinkSync(file); } catch (e) { /* already gone */ }
  }
}

/**
 * Remove any mutant left behind by an interrupted run, and say so.
 *
 * The .gitignore entry added beside this file keeps litter out of `git add -A`,
 * and a first draft of its comment claimed that was enough. It is not, and the
 * correction is measured: check-script-conventions.mjs walks the filesystem with
 * readdir and consults no gitignore, so a leftover `.mutant-*.mjs` still reds
 * `npm run lint` -- now under a filename `git status` does not show, which is
 * worse than before. HARNESS_PROBES writes a deliberately UNPARSEABLE mutant on
 * every run, so the window is real rather than theoretical.
 *
 * Sweeping at startup rather than trapping SIGINT: a trap cannot survive SIGKILL
 * or a CI runner tearing the job down, and the next run is the first moment
 * anything is guaranteed to look.
 */
function sweepStaleMutants() {
  const dir = path.join(ROOT, 'scripts');
  let names = [];
  try {
    // SCOPED TO THIS PROCESS. The temp name embeds a pid precisely so two
    // instances do not collide, and a sweep ignoring that pid re-introduced the
    // collision at startup: a second run would unlink the file a first had just
    // written, whose child then died ERR_MODULE_NOT_FOUND and was scored
    // REFUSED 'did not parse' -- a harness fault that never happened. Concurrent
    // runs are not hypothetical here; this repo's own memory records two
    // sessions live at once as the normal case.
    //
    // The cost is that litter from a DIFFERENT pid survives, so the message
    // below names it rather than quietly leaving it: a stale mutant reds
    // check:script-conventions, and the reader needs to know which file to
    // delete and why the sweep declined to.
    const own = '.mutant-' + process.pid + '-';
    const all = readdirSync(dir).filter((n) => /^\.mutant-.*\.mjs$/.test(n));
    for (const n of all.filter((f) => !f.startsWith(own))) {
      console.log('sweep: LEAVING ' + n + ' -- it belongs to another process. If no harness is running,');
      console.log('       delete it by hand: it will red check:script-conventions (R6:unparseable).');
    }
    names = all.filter((f) => f.startsWith(own));
  } catch (error) {
    console.log('sweep: could not read ' + dir + ' -- ' + error.message);
    return;
  }
  for (const n of names) {
    try {
      unlinkSync(path.join(dir, n));
      console.log('sweep: removed stale mutant ' + n + ' left by an interrupted run');
    } catch (error) {
      console.log('sweep: could NOT remove ' + n + ' -- ' + error.message + ' (it will red check:script-conventions)');
    }
  }
}
/**
 * The whole executable body, behind an entry-point guard.
 *
 * Unguarded, a bare `import()` of this module swept scripts/, spawned ~125 child
 * processes, wrote and unlinked files inside scripts/, and set an exit code --
 * measured, not feared. Any future test, doc generator or tool that walks
 * scripts/ would have triggered a multi-minute side-effecting run by touching
 * it.
 *
 * isEntryPoint() from scripts/lib/entry-point.mjs rather than a hand-rolled
 * comparison of import.meta.url against process.argv[1]: the ESM loader
 * realpaths one side and leaves the other as typed, so through a junction the
 * hand-rolled form is FALSE and the file exits 0 having run nothing. That is
 * R6 in CLAUDE.md, and eight of this repository's guards once shipped it.
 */
export function run() {
  sweepStaleMutants();

  let survived = 0, refused = 0, killed = 0, harnessBroken = 0;
  const quiet = (label, r, tag) => console.log(tag + label + ' -- ' + r.why);

  // A FLOOR ON HOW MANY MUTANTS THERE ARE, for the same reason the guard this
  // file mutates carries inclusion floors: every other number here counts things
  // that went right, and a count of things that went right is satisfied by doing
  // almost nothing. Drop a hundred entries from MUTANTS -- a bad merge, a rebase
  // that loses a push block, a tidy-up -- and the control still survives, the
  // probes still refuse for their stated reasons, the scenarios still find their
  // labels, and this prints '8 killed, 0 SURVIVED' and exits 0. The arms no live
  // run in this repository can reach would stop being proven, and the harness
  // would report success while doing it.
  //
  // MEASURED at 108 on 2026-08-14; the floor is 100, low enough that retiring a
  // mutant is ordinary work and high enough that losing a block is not.
  const MUTANT_FLOOR = 100;
  if (MUTANTS.length < MUTANT_FLOOR) {
  harnessBroken += 1;
  console.log('BROKEN mutant list: ' + MUTANTS.length + ' entries, floor is ' + MUTANT_FLOOR +
    ' -- entries have been lost, and every count below is measuring less than it claims.');
  }

  console.log('--- CONTROL: an unmutated copy must still pass ---');
  // ANCHORED ON STRUCTURE, not on a policy number. The control replaced
  // `const RETENTION_CAP_DAYS = 14;` with itself, so editing that constant --
  // an ordinary policy change, and the literal subject of rules A1 and A2 -- made
  // the anchor match nothing. The control then came back REFUSED and the harness
  // announced that an untouched copy had failed. main()'s signature is not
  // something a policy edit moves.
  const control = runMutant('control', 'export function main(argv = [], deps = {}) {', 'export function main(argv = [], deps = {}) {', ['--self-test']);
  console.log('control: ' + control.verdict + ' -- ' + control.why);
  // Counted, because it runs outside the loop that increments these. A refused
  // control used to print its own complaint beside a summary reading '0 refused'
  // -- one fact reported two contradictory ways.
  if (control.verdict === 'REFUSED') refused += 1;

  console.log('\n--- HARNESS SELF-TEST: refused, AND for the stated reason ---');
  for (const [label, find, replace, wantWhy] of HARNESS_PROBES) {
  const r = runMutant(label, find, replace, ['--self-test']);
  const ok = r.verdict === 'REFUSED' && r.why.includes(wantWhy);
  if (!ok) harnessBroken += 1;
  console.log((ok ? 'ok    ' : 'BROKEN ') + label + ': ' + r.verdict + ' -- ' + r.why + (ok ? '' : ' (wanted: ' + wantWhy + ')'));
  }

  console.log('\n--- MUTANTS, against the canary ---');
  for (const [label, find, replace] of MUTANTS) {
  const r = runMutant(label, find, replace, ['--self-test']);
  if (r.verdict === 'SURVIVED') survived += 1;
  else if (r.verdict === 'REFUSED') refused += 1;
  else killed += 1;
  quiet(label, r, r.verdict === 'KILLED' ? 'killed   ' : r.verdict === 'SURVIVED' ? 'SURVIVED ' : 'REFUSED  ');
  }

  console.log('\n--- SCENARIOS: mutants driven against the REAL .github/workflows ---');
  const SCENARIOS = [
  ['gate1: the walk visits only the first job of each file', 2],
  ['R1: the workflow_run edge is never walked', 2],
  ['R1: the probe stops covering the caller-gate route', 0],
  ['gate1: traversalProblems never reports a mismatch', 0],
  ['gate1: the invariant is never called', 0],
  ['A3: a caller job condition is never a gate', 2],
  ['floors: an unasserted floor key is put back', 2],
  ['floors: the file floor is lowered to nothing', 0],
  ['shape: an empty steps list is no longer refused', 0],
  // A5 has no live subject here, so these two are what prove the rule reaches
  // the real workflows rather than only its fixtures. Lowering the BUDGET
  // flags all five real uploads (exit 1); making every fan-out unreadable is
  // caught one stage earlier by the self-probe, which is the order contract
  // working -- a detector that cannot be shown alive reports nothing about the
  // repo at all.
  ['A5: the fan-out budget is lowered to nothing', 1],
  ['A5: every fan-out reads as unbounded', 2],
  // THE LIVE DRIFT BRANCH, which nothing else in this file reaches. Every
  // canary case for measuredDrift injects cfg.measured, so all of them take the
  // first arm of `cfg.measured ?? (listFiles ? null : MEASURED)` -- meaning the
  // arm that decides whether the REAL run is judged at all could be replaced
  // with a bare `?? null` and 393 cases, 108 mutants and the other twelve
  // scenarios would stay green while the guard silently stopped checking
  // MEASURED for ever.
  //
  // Driven here against the actual .github/workflows: with steps recorded as
  // 2210 against a real 221, the guard must reach its policy verdict and THEN
  // exit 1 for staleness. Exit 1 rather than 2 is the assertion carrying the
  // whole re-ordering -- before it, this same edit exited 2 from the canary and
  // the policy was never judged at all.
  ['R1: the measurements are edited without the floors following', 1],
  ];
  let scenarioBad = 0;
  for (const [label, want] of SCENARIOS) {
  const m = MUTANTS.find((x) => x[0] === label);
  // A scenario naming a mutant that no longer exists is a harness fault, not a
  // silently skipped line: `m[1]` on undefined would throw and take the summary
  // with it, and catching it would be worse.
  if (!m) {
    scenarioBad += 1;
    console.log('BAD ' + label + ' -> no mutant with this label');
    continue;
  }
  const r = runMutant(label, m[1], m[2], []);
  // THE VERDICT IS CHECKED BEFORE THE CODE IS BELIEVED. classify() writes
  // 'no verdict line printed -- exit 2' into `why` when a mutant runs and
  // prints nothing recognisable, so parsing a number straight out of that
  // string scored `ok` for a mutant that never reached a verdict -- the right
  // answer for the wrong reason, which is the exact failure the HARNESS_PROBES
  // block above exists to refuse. Five scenarios want 2 and every one of them
  // was exposed to it.
  //
  // `\d+`, not `\d`: a Windows crash status such as 3221225477 parsed as 3.
  // The number as returned, never re-read out of the message. A REFUSED mutant
  // is -1 rather than whatever its prose happens to contain, because a mutant
  // that reached no verdict has no exit code worth comparing.
  const code = r.verdict === 'REFUSED' ? -1 : (r.code ?? -1);
  const ok = code === want;
  if (!ok) scenarioBad += 1;
  console.log((ok ? 'ok  ' : 'BAD ') + label + ' -> ' +
    (r.verdict === 'REFUSED' ? 'REFUSED (' + r.why + ')' : 'exit ' + code) + ' (wanted ' + want + ')');
  }
  // The unmutated run is a CONTROL and is allowed to fail like one. execFileSync
  // throws on a non-zero exit, so an ordinary red in the real guard used to kill
  // the harness here -- taking the entire summary below it, survivor count
  // included, off the screen. A control that cannot report its own failure is the
  // same defect this file mutates other people's code to find.
  let baseOk = true;
  let baseLine = '';
  try {
  // BOUNDED like every other spawn in this file. Unbounded, a guard that hangs
  // -- the exact condition HARNESS_PROBES exists to catch in mutants -- hung the
  // harness for ever at the end of a three-minute run, with the summary below it
  // never printed; a failure report over the 1 MB default threw ENOBUFS; and
  // with stdio unspecified the child's stderr was echoed to the terminal as well
  // as captured.
  baseLine = execFileSync(process.execPath, [TARGET], {
    cwd: ROOT, encoding: 'utf8', timeout: 60000,
    stdio: ['ignore', 'pipe', 'pipe'], maxBuffer: 32 * 1024 * 1024,
  }).trim().split('\n')[0];
  } catch (error) {
  baseOk = false;
  baseLine = 'exit ' + (error.status === undefined ? '?' : error.status) + ' -- ' +
    ((error.stdout || '') + (error.stderr || '')).trim().split('\n').filter(Boolean).slice(-1)[0];
  }
  console.log((baseOk ? 'ok  ' : 'BAD ') + 'the UNMUTATED guard on the real repo -> exit ' + (baseOk ? '0' : 'non-zero'));
  console.log('    ' + baseLine);

  const controlBad = control.verdict !== 'SURVIVED';
  if (controlBad) console.log('BAD control: the unmutated copy did not pass -- nothing below is believable');

  console.log('\n' + killed + ' killed, ' + survived + ' SURVIVED, ' + refused + ' refused, ' +
  harnessBroken + ' harness fault(s), ' + scenarioBad + ' bad scenario(s).');

  // SET AN EXIT CODE. Reporting survivors in prose and exiting 0 is precisely the
  // green-that-measured-nothing this repository's guard doctrine is built
  // against. process.exitCode rather than process.exit(), because process.exit()
  // truncates stdout on Linux and the summary above is the point.
  //
  // NOTHING AUTOMATED READS IT YET, and that is a declared gap rather than an
  // oversight. `npm run mutate:workflow-artifact-policy` is the only caller;
  // it is in no workflow, not in `npm run lint`, and not in pre-ship. Wiring it
  // in would spawn ~125 node processes per run, each executing the full canary,
  // on every PR -- in an arc whose entire subject is CI spend that nobody is
  // watching. Paying minutes on every push to re-prove a static mutation result
  // is the wrong trade, so this is run BY HAND when the guard or its canary
  // changes, and the exit code is here so that a future caller -- or a person
  // reading `echo $?` -- gets the truth rather than an unconditional zero.
  //
  // The consequence, stated plainly because it is the cost: the arms this
  // harness is the sole proof of are proven when someone remembers to run it.
  // A mutant silently disarmed by an edit to the guard has no automated signal,
  // which already happened once -- see the R2 drift mutant's re-anchoring note.
  if (survived > 0 || refused > 0 || harnessBroken > 0 || scenarioBad > 0 || controlBad || !baseOk) {
    process.exitCode = 1;
  }
}

if (isEntryPoint(import.meta.url)) run();
// The control verdict is reported ONCE, above, beside the summary it qualifies.
// There were two lines for the identical condition, pointing in opposite
// directions -- one said nothing BELOW was believable, the other nothing ABOVE
// -- which is one fact wearing two contradictory scopes.

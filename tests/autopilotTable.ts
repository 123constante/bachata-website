// The autopilot decide() table, shared by tests/autopilot.test.ts and tests/autopilotMutants.test.ts.
import { STATE_LABELS } from '../scripts/lib/autopilot.mjs';

export const BASE = {
  number: 7, state: 'open', draft: false, fork: false, workerBranch: true, merge: 'clean', labels: [] as string[], head: 'a'.repeat(40),
  approvedAtHead: false, isMigration: false, pending: 0, redNew: [] as string[], redMain: [] as string[], rerunnable: [] as object[],
  ranCi: true, runCiLabelAgeMin: null as number | null, relabelledAtHead: false, ciRunsToday: 0, ciCap: 25,
  // r2 (review 1204-r1): author, branch kind, age, worker-done marker, hourly caps.
  ref: 'claude/feature-x', botAuthored: true, ageDays: 1, workerDone: true,
  updatesThisHour: 0, updateCap: 5, rerunsThisHour: 0, rerunCap: 5,
  // Website r5: Vercel build-budget facts (a non-docs PR, a final head, a branch that never deploys).
  files: ['src/lib/x.ts'] as string[] | null, headSubject: 'feat: x [worker-done dt_ab12]' as string | null, deployEnabled: false as boolean | null,
};

const KILL = [{ name: 'unit', jobId: 9, runId: 3, reason: 'runner memory kill' }];

// [name, overrides, action, label]
export const TABLE: [string, object, string, string | null][] = [
  // The reference table (orchestrator's local autopilot-step.mjs), ported.
  ['merged', { state: 'closed' }, 'none', null],
  ['conflict', { merge: 'dirty' }, 'stop', STATE_LABELS.stopped],
  ['queue-stopped', { labels: ['queue-stopped'] }, 'skip', null],
  ['behind, unapproved', { merge: 'behind' }, 'update-branch', STATE_LABELS.waiting],
  ['behind, approved at head', { merge: 'behind', approvedAtHead: true }, 'stop', STATE_LABELS.stopped],
  ['no proof run, no label', { ranCi: false }, 'run-ci', STATE_LABELS.waiting],
  ['no proof run, cap reached', { ranCi: false, ciRunsToday: 25 }, 'wait-cap', STATE_LABELS.stopped],
  ['run-ci added, not started', { ranCi: false, labels: ['run-ci'], runCiLabelAgeMin: 2 }, 'wait', STATE_LABELS.waiting],
  ['pending', { pending: 2 }, 'wait', STATE_LABELS.waiting],
  ['newly red', { redNew: ['unit'] }, 'stop', STATE_LABELS.stopped],
  ['red only where main is red', { redMain: ['contract-check'] }, 'ready', STATE_LABELS.ready],
  ['all green', {}, 'ready', STATE_LABELS.ready],
  // New states.
  ['draft', { draft: true }, 'none', null],
  ['fork', { fork: true }, 'none', null],
  ['not a worker branch', { workerBranch: false }, 'none', null],
  ['migration-queued', { labels: ['migration-queued'] }, 'skip', null],
  ['owner-approved migration (queue owns it)', { isMigration: true, approvedAtHead: true, merge: 'behind' }, 'skip', null],
  ['queue-stopped beats a conflict', { labels: ['queue-stopped'], merge: 'dirty' }, 'skip', null],
  ['mergeability unknown', { merge: 'unknown' }, 'wait', STATE_LABELS.waiting],
  ['stale run-ci label from an older head', { ranCi: false, labels: ['run-ci'], runCiLabelAgeMin: 45 }, 'relabel-ci', STATE_LABELS.waiting],
  ['stale label but cap reached', { ranCi: false, labels: ['run-ci'], runCiLabelAgeMin: 45, ciRunsToday: 25 }, 'wait-cap', STATE_LABELS.stopped],
  // Website r5 (brief requirement 4): Vercel-safe. run-ci never on docs-only / [skip preview] /
  // unread heads; update-branch only where vercel.json git.deploymentEnabled is false.
  ['r5 docs-only PR: no run-ci', { ranCi: false, files: ['docs/a.md', 'docs/b/c.md'] }, 'stop', STATE_LABELS.stopped],
  ['r5 [skip preview] head: no run-ci', { ranCi: false, headSubject: 'wip: checkpoint [skip preview]' }, 'stop', STATE_LABELS.stopped],
  ['r5 head subject not read: no run-ci', { ranCi: false, headSubject: null }, 'stop', STATE_LABELS.stopped],
  ['r5 file list not read: no run-ci', { ranCi: false, files: null }, 'stop', STATE_LABELS.stopped],
  ['r5 docs plus one test file still gets run-ci', { ranCi: false, files: ['docs/a.md', 'tests/a.test.ts'] }, 'run-ci', STATE_LABELS.waiting],
  ['r5 behind on a deploying branch: no update', { merge: 'behind', deployEnabled: true }, 'stop', STATE_LABELS.stopped],
  ['r5 behind, vercel.json not read: no update', { merge: 'behind', deployEnabled: null }, 'stop', STATE_LABELS.stopped],
  ['re-added once already, still nothing', { ranCi: false, labels: ['run-ci'], runCiLabelAgeMin: 45, relabelledAtHead: true }, 'stop', STATE_LABELS.stopped],
  ['runner memory kill', { rerunnable: [{ name: 'unit', jobId: 9, runId: 3, reason: 'runner memory kill' }], redNew: [] }, 'rerun', STATE_LABELS.waiting],
  ['rerun outranks a red beside it', { rerunnable: [{ name: 'unit', jobId: 9, runId: 3, reason: 'cancelled duplicate' }], redNew: ['lint'] }, 'rerun', STATE_LABELS.waiting],
  ['green migration PR waiting for owner', { isMigration: true }, 'ready', STATE_LABELS.ready],
  ['behind, cap reached: update still allowed', { merge: 'behind', ranCi: false, ciRunsToday: 25 }, 'update-branch', STATE_LABELS.waiting],
  // r2 -- B1: no worker-done marker at head = worker running: label it, touch nothing.
  ['B1 no marker: worker running', { workerDone: false }, 'worker-running', STATE_LABELS.running],
  ['B1 no marker beats behind (no update-branch)', { workerDone: false, merge: 'behind' }, 'worker-running', STATE_LABELS.running],
  ['B1 no marker beats no proof run (no run-ci)', { workerDone: false, ranCi: false }, 'worker-running', STATE_LABELS.running],
  ['B1 no marker beats a stale label (no relabel-ci)', { workerDone: false, ranCi: false, labels: ['run-ci'], runCiLabelAgeMin: 45 }, 'worker-running', STATE_LABELS.running],
  ['B1 no marker beats a runner kill (no rerun)', { workerDone: false, rerunnable: KILL }, 'worker-running', STATE_LABELS.running],
  ['B1 no marker, conflict: still nothing', { workerDone: false, merge: 'dirty' }, 'worker-running', STATE_LABELS.running],
  // r2 -- B2: review / walk / done-marker branches and PRs older than 14 days are never touched.
  ['B2 review branch', { ref: 'claude/review-1204-r1', ranCi: false }, 'none', null],
  ['B2 walk branch', { ref: 'claude/walk-1190', merge: 'behind' }, 'none', null],
  ['B2 done-marker branch', { ref: 'claude/done-dt_abc123', ranCi: false }, 'none', null],
  ['B2 15 days old', { ageDays: 15, ranCi: false }, 'none', null],
  ['B2 age unknown fails closed', { ageDays: NaN, ranCi: false }, 'none', null],
  ['B2 14 days old is still in', { ageDays: 14, ranCi: false }, 'run-ci', STATE_LABELS.waiting],
  // r2 -- B2: hourly caps on update-branch and re-runs (5 each); a re-run spends the daily CI cap too.
  ['B2 update cap used (5/h)', { merge: 'behind', updatesThisHour: 5 }, 'wait', STATE_LABELS.waiting],
  ['B2 update cap 4/5 still updates', { merge: 'behind', updatesThisHour: 4 }, 'update-branch', STATE_LABELS.waiting],
  ['B2 rerun cap used (5/h)', { rerunnable: KILL, rerunsThisHour: 5 }, 'wait', STATE_LABELS.waiting],
  ['M2 rerun spends the daily CI cap', { rerunnable: KILL, ciRunsToday: 25 }, 'wait-cap', STATE_LABELS.stopped],
  // r2 -- H1: only the bot's own PRs.
  ['H1 owner-authored claude/ PR', { botAuthored: false, merge: 'behind' }, 'none', null],
  ['H1 owner-authored, no proof run', { botAuthored: false, ranCi: false }, 'none', null],
  // r2 -- H2: autopilot-hold makes it skip the PR (and it beats every other state).
  ['H2 autopilot-hold', { labels: ['autopilot-hold'], ranCi: false }, 'none', null],
  ['H2 autopilot-hold beats behind', { labels: ['autopilot-hold'], merge: 'behind' }, 'none', null],
  ['H2 autopilot-hold beats no marker', { labels: ['autopilot-hold'], workerDone: false }, 'none', null],
];


/** r4: the ONE allowed merge call site in scripts/autopilot-step.mjs (pinned sha, AUTOMERGE_TOKEN's api). Any other merge call is forbidden. */
export const MERGE_SITE = "mergeApi.call('PUT', `/repos/${repo}/pulls/${f.number}/merge`, mergeCallBody(f.head))";

// r4b (review docs/review/1215-r1.md N1/N2/N3, brief docs/briefs/autopilot-loop-r4b.md): the merge-lane
// rows shared by tests/autopilotR4b.test.ts and the r4b mutants in tests/autopilotMutants.test.ts.
// [path, expected laneClass]: a string is the class, a RegExp is the NO reason it must match.
export const R4B_PATHS: [string, string | RegExp][] = [
  // N1: agent-instruction files at every depth and in every class.
  ['docs/AGENTS.md', /^agent-instruction path docs\/AGENTS\.md$/],
  ['docs/sub/CLAUDE.md', /^agent-instruction path docs\/sub\/CLAUDE\.md$/],
  ['docs/Sub/claude.MD', /^agent-instruction path docs\/Sub\/claude\.MD$/],
  ['docs/.claude/x.md', /^agent-instruction path docs\/\.claude\/x\.md$/],
  ['docs/skills/x/SKILL.md', /^agent-instruction path docs\/skills\/x\/SKILL\.md$/],
  ['lib/CLAUDE.md', /^agent-instruction path lib\/CLAUDE\.md$/],
  ['tests/AGENTS.md', /^agent-instruction path tests\/AGENTS\.md$/],
  ['.cursorrules', /^agent-instruction path \.cursorrules$/],
  ['docs/.cursor/rules/a.md', /^agent-instruction path docs\/\.cursor\/rules\/a\.md$/],
  ['docs/GEMINI.md', /^agent-instruction path/],
  ['docs/.windsurfrules', /^agent-instruction path/],
  ['docs/copilot-instructions.md', /^agent-instruction path/],
  ['docs/.Windsurf/a.md', /^agent-instruction path/],
  ['docs/.codex/a.md', /^agent-instruction path/],
  ['docs/.agents/a.md', /^agent-instruction path/],
  ['docs/.CLAUDE/a.md', /^agent-instruction path/],
  ['CLAUDE.md', /^agent-instruction path CLAUDE\.md$/],
  // N3b: the tests class stays out of the lane (content is not read).
  ['tests/a.test.ts', /^tests path tests\/a\.test\.ts: content is not read, owner-merged$/],
  ['tests/neutralName.test.ts', /^tests path tests\/neutralName\.test\.ts: content is not read/],
  ['e2e/smoke/a.spec.ts', /^tests path e2e\/smoke\/a\.spec\.ts: content is not read/],
  // Controls: ordinary docs and the soft-app allowlist are unchanged.
  ['docs/handover/x.md', 'docs'],
  ['docs/review/1.md', 'docs'],
  ['README.md', 'docs'],
  // r4c (review 1217-r1 N4) turns these two to NO: the instruction-name pattern over-blocks on purpose.
  ['docs/claude-notes.md', /^agent-instruction path docs\/claude-notes\.md$/],
  ['docs/agents-overview.md', /^agent-instruction path docs\/agents-overview\.md$/],
  // Website r5: SOFT_APP_ALLOW is empty, so the admin soft-app control is NO here.
  ['lib/csv.ts', /^forbidden path: lib\/csv\.ts is not on the Website docs\/tests allowlist$/],
  // Website review-scope isRiskyPath() holds all of src/: a screen is hard-tier before it is 'code'.
  ['src/components/A.tsx', /^hard-tier path src\/components\/A\.tsx$/],
  ['src/index.css', /^hard-tier path src\/index\.css$/],
  ['src/Components/A.TSX', /^hard-tier path src\/Components\/A\.TSX$/],
  ['components/A.tsx', /^screen \/ app path components\/A\.tsx/],
  ['docs/demo/Widget.tsx', /^screen \/ app path docs\/demo\/Widget\.tsx/],
  ['docs/testing-doctrine.md', /^forbidden path: docs\/testing-doctrine\.md is governance prose/],
];

// [Verified-line body, filled?]: each body also carries a filled Not verified line.
export const R4B_BODIES: [string, boolean][] = [
  ['Verified: -', false],
  ['Verified: --', false],
  ['Verified: **-**', false],
  ['Verified: ...', false],
  ['Verified: …', false],
  ['Verified: ?', false],
  ['- Verified: -', false],
  ['## Verified\n-', false],
  ['## Verified\n- n/a', false],
  ['Verified: N/A.', false],
  ['Verified: na', false],
  ['Verified: _TBD_', false],
  ['Verified: "todo"', false],
  ['Verified: nothing', false],
  ['Verified: none', false],
  ['Verified: — ', false],
  ['Verified: . . .', false],
  ['Verified: docs read', true],
  ['Verified by me', true],
  ['## Verified\n- unit suite green (12)', true],
];

// [labels on the PR, reason that must appear (RegExp) or must NOT appear (string)].
export const R4B_LABELS: [string[], RegExp | string][] = [
  [['Do-Not-Merge'], /^reserved label do-not-merge$/],
  [['NEEDS-OWNER'], /^reserved label needs-owner$/],
  [['Autopilot-Hold'], /^reserved label autopilot-hold$/],
  [['WIP'], /^reserved label wip$/],
  [['Migration-Queued'], /^migration-queued label$/],
  [['Queue-Stopped'], /^queue-stopped label$/],
  [['Review-Passed'], 'no review-passed label'],
];

// r4c (review docs/review/1217-r1.md N4, brief docs/briefs/autopilot-loop-r4c.md): instruction-file
// NAMES, not only the nine exact ones. Shared by tests/autopilotR4c.test.ts and the r4c mutants in
// tests/autopilotMutants.test.ts. [path, expected laneClass] as in R4B_PATHS.
const agent = (p: string) => new RegExp(`^agent-instruction path ${p.replace(/[.*+?^${}()|[\]\\/]/g, '\\$&')}$`);
export const R4C_PATHS: [string, string | RegExp][] = [
  // The four proofs: class docs on main at r4b (cc891b0).
  ...['CLAUDE.local.md', 'docs/CLAUDE.local.md', 'docs/AGENTS.override.md', 'docs/.gemini/x.md'].map((p): [string, RegExp] => [p, agent(p)]),
  // More names, depths and cases.
  ...['docs/.gemini/rules.md', '.gemini/settings.json', 'docs/CLAUDE.LOCAL.MD', 'docs/Sub/Agents.Override.md', 'lib/CLAUDE.local.md', 'tests/gemini-notes.md']
    .map((p): [string, RegExp] => [p, agent(p)]),
  // Deliberate over-block: owner-merged, a false NO costs one owner merge.
  ['docs/agents-overview.md', agent('docs/agents-overview.md')],
  ['docs/claude-code-notes.md', agent('docs/claude-code-notes.md')],
  // An exact name in upper case stays refused (keeps the r4b "basename case-sensitive" mutant red).
  ['docs/.CursorRules', agent('docs/.CursorRules')],
  // Still refused at r4b; must stay refused.
  ...['docs/CLAUDE.md', 'docs/Claude.md', 'docs/a/.CLAUDE/x.md', 'docs/.agents/x.md', 'docs/GEMINI.md', '.github/copilot-instructions.md']
    .map((p): [string, RegExp] => [p, agent(p)]),
  // Controls: still class docs (no bare prefix match: claudette is not claude[.-]...).
  ...['docs/handover/x.md', 'docs/review/1.md', 'README.md', 'docs/design/x.md', 'docs/claudette.md', 'docs/agent.md', 'docs/skills.md']
    .map((p): [string, string] => [p, 'docs']),
];

// Pause switch (slice 1): the ONE shared helper every fake-GitHub run() harness spreads into its
// opts, so the switch reads as running and no existing assertion changes (docs/automation-pause.md).
// Foundations (slice 2, docs/automation-foundations.md): the ONE shared helper that injects the
// required-jobs and money-set facts into every existing harness, so no existing assertion changes.
// `facts` spreads into a mergeVerdict() facts object; `opts` spreads into run() opts (NOT_PAUSED
// carries it, so every fake-GitHub run() harness that already spreads NOT_PAUSED gets it too).
// The new tests (tests/automationFoundations.test.ts, tests/automationMoney.test.ts) use the REAL
// readers and prove each wiring with a mutant.
const REQUIRED_OK = { ok: true, missing: [] as string[], notGreen: [] as string[], reason: '', reasons: [] as string[] };
const NOT_MONEY = { money: false, names: [] as string[], reason: '' };
export const FOUNDATIONS_OK = {
  facts: { requiredJobs: REQUIRED_OK, money: NOT_MONEY },
  opts: { foundations: { requiredJobs: async () => REQUIRED_OK, money: () => NOT_MONEY } },
};
export const NOT_PAUSED = { pauseReader: async () => ({ paused: false, reason: '', issue: 1 }), ...FOUNDATIONS_OK.opts };

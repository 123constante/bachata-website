// The hourly autopilot (.github/workflows/autopilot.yml, scripts/autopilot-step.mjs): the PURE
// pieces. deriveFacts() turns raw GitHub API reads of one PR into facts; decide() turns facts
// into ONE next action; the render helpers build the step-summary table and the single
// `autopilot status` comment (with the per-PR stop streak carried inside it).
// Tests: tests/autopilot.test.ts, tests/autopilotWorkflow.test.ts.
// Handover: docs/handover/autopilot-loop-r1.md, docs/handover/autopilot-loop-r2.md (review 1204-r1 fixes).
// r3 (docs/handover/autopilot-loop-r3.md): CI_CAP 25 counting only BOT_LOGIN's run-ci adds; a `ready`
// PR is also compared main...head (behindBy) because REST mergeable_state never says `behind` here;
// deriveFacts() also carries jobs / files / body / mainRed for the pack (scripts/lib/autopilot-pack.mjs).
//
// r2 GATES (in decide() order): only the bot's own PRs (BOT_LOGIN), never claude/review-*,
// claude/walk-*, claude/done-* branches, never a PR older than 14 days, never one labelled
// autopilot-hold (listGate: decided from the PR LIST alone, before any per-PR API call); then
// NOTHING but an ap:worker-running label until the head reaches its `[worker-done dt_...]`
// marker (markerGate). Caps: run-ci / relabel-ci / rerun share the daily CI cap (rolling 24 h);
// update-branch and rerun are also capped per hour (UPDATE_CAP, RERUN_CAP).
//
// SAFE ACTIONS ONLY: run-ci (add the label), relabel-ci (remove + re-add run-ci when the
// label sits on a head that never got a proof run), update-branch (BEHIND and NOT approved
// at head), rerun (a failed job ONCE, only on a runner memory kill or an all-cancelled
// duplicate). There is deliberately no merge, approve, close, or force-push action: ACTIONS
// below is the closed list and the executor refuses anything outside it.
// Website port (r5, docs/handover/autopilot-loop-r5.md): the admin repo's queue-dry-run.mjs is not
// here, so the runner-death signs live in this file (same three patterns).
export const RUNNER_DEATH_SIGNS = [
  /Worker exited unexpectedly/i,
  /Timeout terminating forks worker/i,
  /received a shutdown signal|shutdown signal/i,
];
/** @returns {string|null} the first matching log line, or null when no death sign is present. */
export function detectRunnerDeath(text) {
  for (const line of String(text ?? '').split(/\r?\n/)) {
    if (RUNNER_DEATH_SIGNS.some((re) => re.test(line))) return line.trim();
  }
  return null;
}

/**
 * Website r5: the Website's PR workflows run on every `pull_request` push (no run-ci label switch,
 * unlike admin), so ANY pull_request run at the head is a proof run on every branch.
 */
export const RUN_CI_GATED = false;

/**
 * Website r5 (Vercel build budget, ~100/day): vercel.json git.deploymentEnabled for one branch.
 * Keys are exact names or `prefix*` globs; the most specific (longest) matching key wins.
 * @returns {boolean|null} true/false as configured, null when no key matches (Vercel default: deploys).
 */
export function deploymentEnabledFor(ref, cfg) {
  const map = cfg && cfg.git && cfg.git.deploymentEnabled;
  if (!map || typeof map !== 'object') return null;
  const r0 = String(ref ?? '');
  let best = null;
  for (const [k, v] of Object.entries(map)) {
    const hit = k.endsWith('*') ? r0.startsWith(k.slice(0, -1)) : r0 === k;
    // An exact name beats any glob; among globs the longest prefix wins.
    const score = k.endsWith('*') ? k.length : Infinity;
    if (hit && (best == null || score > best[2])) best = [k, v, score];
  }
  return best ? best[1] !== false : null;
}

/**
 * Website r5 (brief requirement 5, "red also on main"): each failing check NAME at the PR head
 * compared with the same name on the latest main head (mainRed, read from main's check runs and
 * statuses). 'yes' = at least one failing check is red on main too; 'no' = none is (or nothing
 * is red); 'not read' = either list unknown.
 */
const RED_JOB = new Set(['failure', 'timed_out', 'startup_failure', 'action_required']);
export function redAlsoOnMain(jobs, mainRed) {
  if (!Array.isArray(jobs) || !Array.isArray(mainRed)) return 'not read';
  const main = new Set(mainRed);
  return jobs.some((j) => j && j.status === 'completed' && RED_JOB.has(j.conclusion) && main.has(j.name)) ? 'yes' : 'no';
}

/** Website r5: a head whose commit SUBJECT ends `[skip preview]` (a worker checkpoint). */
export const SKIP_PREVIEW_RE = /\[skip preview\]\s*$/i;
/**
 * Website r5 (brief requirement 4): run-ci is never added to a PR whose changed files are all
 * under docs/, or whose head subject ends `[skip preview]`. Unknown files or subject: refused.
 */
export function runCiRefusal(f) {
  if (!Array.isArray(f.files) || !f.files.length) return 'file list not read';
  if (f.files.every((p) => /^docs\//.test(String(p)))) return 'docs-only PR';
  if (typeof f.headSubject !== 'string') return 'head subject not read';
  if (SKIP_PREVIEW_RE.test(f.headSubject)) return 'head is [skip preview]';
  return null;
}

export const OWNER_LOGIN = '123constante';
/** The only author whose PRs autopilot acts on (H1). */
export const BOT_LOGIN = 'kiki-claude-bot';
/** The only author whose status issue/comment autopilot trusts (N2): the workflow's GITHUB_TOKEN. */
export const STATUS_AUTHOR = 'github-actions[bot]';
/** Owner decision 2026-11-04 (r3): 25 proof runs per rolling 24 h, counting only BOT_LOGIN's run-ci adds. */
export const CI_CAP = 25;
export const UPDATE_CAP = 5;
export const RERUN_CAP = 5;
export const MAX_AGE_DAYS = 14;
/** Owner escape hatch (H2): a PR with this label is never touched. */
export const HOLD_LABEL = 'autopilot-hold';
/** API request budget (B3): per run, and per rolling hour across every repo in REPOS (< 600). */
export const RUN_CALL_BUDGET = 250;
export const HOUR_CALL_BUDGET = 550;
export const STATE_LABELS = { waiting: 'ap:waiting-ci', ready: 'ap:ready', stopped: 'ap:stopped', running: 'ap:worker-running' };
/** r4 merge lane switch: the repo variable AUTOPILOT_MERGE_MODE. Anything but an exact mode = off. */
export const MERGE_MODES = ['docs-canary', 'soft'];
export const mergeMode = (env) => (MERGE_MODES.includes(env && env.AUTOPILOT_MERGE_MODE) ? env.AUTOPILOT_MERGE_MODE : 'off');
/** Website r5: the repo the loop defaults to. */
export const DEFAULT_REPOS = '123constante/bachata-website';
export const HANDS_OFF_LABELS = ['queue-stopped', 'migration-queued', HOLD_LABEL];
/** The worker's done signal; `PARTIAL [worker-done ...]` contains it too. Matched on the SUBJECT line only. */
export const WORKER_DONE_RE = /\[worker-done dt_[0-9a-f]+\]/;
const MERGE_MAIN_RE = /^Merge (remote-tracking )?branch '(origin\/)?main'/;
const EXCLUDED_BRANCH_RE = /^claude\/(review|walk|done)-/;
const DAY = 86400000;
export const STATUS_TITLE = 'autopilot status';
export const STUCK_HOURS = 3;
/** Minutes a run-ci label may sit on a head with no proof run before it is re-added once. */
export const RELABEL_AFTER_MIN = 20;

/** Every action decide() may return. The executor performs a write ONLY for WRITE_ACTIONS. */
// r3: 'pack' and 'owner-ping' are the two comment writes the executor makes AFTER a `ready`
// decision (packAndPing in scripts/autopilot-step.mjs); decide() never returns them.
// r4: `merge` is set by the executor ONLY after scripts/lib/autopilot-merge.mjs mergeVerdict()
// says merge on a `ready` PR; decide() never returns it and perform() never performs it.
export const ACTIONS = ['none', 'skip', 'stop', 'wait', 'wait-cap', 'worker-running', 'run-ci', 'relabel-ci', 'update-branch', 'rerun', 'ready', 'pack', 'owner-ping', 'merge'];
export const WRITE_ACTIONS = ['run-ci', 'relabel-ci', 'update-branch', 'rerun', 'pack', 'owner-ping'];

/** Statuses that never mean the PR is pending or red (the reference ignored this one too). */
const IGNORED_CONTEXTS = [/^migration-version-fresh$/];
const RED = new Set(['failure', 'timed_out', 'startup_failure', 'action_required']);

export const isWorkerBranch = (ref) => /^(claude\/|ccr-)/.test(String(ref ?? ''));
export const isExcludedBranch = (ref) => EXCLUDED_BRANCH_RE.test(String(ref ?? ''));

const r = (action, why, extra = {}) => ({ action, why, label: labelFor(action, extra), stop: action === 'stop' || action === 'wait-cap' || !!extra.ownerWait, ...extra });

/**
 * The part of decide() that needs only the PR LIST item (listFacts): a non-null result means
 * "no per-PR API call at all" (B3). Labels: null, so any ap:* label is removed (M1).
 */
export function listGate(f) {
  if (f.state !== 'open') return r('none', `PR is ${f.state}`);
  if (f.draft) return r('none', 'draft: never touched');
  if (f.fork) return r('none', 'fork PR: never touched');
  if (!f.workerBranch) return r('none', 'not a bot worker branch (claude/ or ccr-)');
  if (!f.botAuthored) return r('none', `not authored by ${BOT_LOGIN}: never touched`);
  if (isExcludedBranch(f.ref)) return r('none', 'review / walk / done-marker branch: never touched');
  if (!(f.ageDays <= MAX_AGE_DAYS)) return r('none', `older than ${MAX_AGE_DAYS} days (or age unknown): never touched`);
  if (f.labels.includes(HOLD_LABEL)) return r('none', `${HOLD_LABEL} label: the owner reserved this PR`);
  if (f.labels.includes('queue-stopped')) return r('skip', 'queue-stopped label: owned by migration-queue, a human reads the stop reason', { handsOff: true, ownerWait: true });
  if (f.labels.includes('migration-queued')) return r('skip', 'migration-queued label: owned by migration-queue', { handsOff: true });
  return null;
}

/** B1: until the head reaches its worker-done marker the worker may still push: touch nothing. */
export function markerGate(f) {
  if (!f.workerDone) return r('worker-running', 'no [worker-done ...] marker at head: the worker may still push, touch nothing');
  return null;
}

/**
 * @param {object} f facts (see deriveFacts)
 * @returns {{action:string, why:string, label:string|null, stop:boolean, jobs?:number[]}}
 */
export function decide(f) {
  const gated = listGate(f) ?? markerGate(f);
  if (gated) return gated;
  if (f.isMigration && f.approvedAtHead) return r('skip', 'owner-approved migration PR: migration-queue owns it', { handsOff: true });
  if (f.merge === 'dirty') return r('stop', 'merge conflict: CI never queues; resolve by hand (not automatic)');
  if (f.merge === 'unknown' || !f.merge) return r('wait', 'GitHub has not computed mergeability yet');
  // r3: REST mergeable_state is never `behind` here (no branch protection), so the executor also
  // compares main...head for a `ready` PR and re-decides with behindBy (> 0 = behind).
  const behind = f.merge === 'behind' || f.behindBy > 0;
  if (behind && !f.approvedAtHead && f.updatesThisHour >= f.updateCap) return r('wait', `behind main, but the hourly update-branch cap is used (${f.updatesThisHour}/${f.updateCap})`);
  if (behind && !f.approvedAtHead && f.deployEnabled !== false) return r('stop', `behind main, but an update-branch commit on ${f.ref ?? 'this branch'} would cost a Vercel build (vercel.json git.deploymentEnabled is not false): the owner updates it`);
  if (behind && !f.approvedAtHead) return r('update-branch', `behind main${f.behindBy > 0 ? ` by ${f.behindBy}` : ''} and not approved at head, so the update voids nothing`);
  if (behind) return r('stop', 'behind main but approved at head: updating would void the approval, ask the owner');
  if (!f.ranCi) {
    const fresh = !f.labels.includes('run-ci');
    const staleLabel = !fresh && f.runCiLabelAgeMin != null && f.runCiLabelAgeMin >= RELABEL_AFTER_MIN && !f.relabelledAtHead;
    if (fresh || staleLabel) {
      const vr = runCiRefusal(f);
      if (vr) return r('stop', `no proof run at this head, and run-ci is refused (Vercel budget): ${vr}`);
      if (f.ciRunsToday >= f.ciCap) return r('wait-cap', `CI proof cap reached (${f.ciRunsToday}/${f.ciCap} today)`);
      return fresh ? r('run-ci', 'no proof run at this head and no run-ci label')
        : r('relabel-ci', `run-ci label is ${f.runCiLabelAgeMin} min old but no proof run at this head (label predates the head): re-add once`);
    }
    if (f.relabelledAtHead) return r('stop', 'run-ci was re-added once at this head and still no proof run: a human looks');
    return r('wait', 'run-ci label added, proof run not started yet');
  }
  if (f.pending > 0) return r('wait', `${f.pending} check(s) pending`);
  if (f.rerunnable.length && f.rerunsThisHour >= f.rerunCap) return r('wait', `re-run wanted, but the hourly re-run cap is used (${f.rerunsThisHour}/${f.rerunCap})`);
  if (f.rerunnable.length && f.ciRunsToday >= f.ciCap) return r('wait-cap', `re-run wanted, but the CI proof cap is reached (${f.ciRunsToday}/${f.ciCap} in 24 h)`);
  if (f.rerunnable.length) return r('rerun', `re-run once: ${f.rerunnable.map((x) => `${x.name} (${x.reason})`).join(', ')}`, { jobs: f.rerunnable.map((x) => x.jobId) });
  if (f.redNew.length) return r('stop', `newly red vs main: ${f.redNew.join(', ')}`);
  const green = f.redMain.length ? `green except reds also on main (${f.redMain.join(', ')})` : 'all checks green';
  if (f.isMigration && !f.approvedAtHead) return r('ready', `${green}; migration PR waiting for the owner's Approve`, { ownerWait: true });
  return r('ready', green);
}

function labelFor(action, extra) {
  if (extra.handsOff) return null;
  if (action === 'none') return null;
  if (action === 'ready') return STATE_LABELS.ready;
  if (action === 'worker-running') return STATE_LABELS.running;
  if (action === 'stop' || action === 'wait-cap') return STATE_LABELS.stopped;
  return STATE_LABELS.waiting;
}

/** Label writes that move a PR to `want`: add it, remove the other ap:* labels. want = null removes every ap:* label (M1). Idempotent. */
export function labelPlan(labels, want) {
  const ours = Object.values(STATE_LABELS);
  if (!want) return { add: [], remove: labels.filter((l) => ours.includes(l)) };
  return { add: labels.includes(want) ? [] : [want], remove: labels.filter((l) => ours.includes(l) && l !== want) };
}

/** M1: a PR the run did not reach keeps an ap:* label only while its head is the one that label was set on. */
export function staleLabels(labels, recordedHead, head) {
  if (!recordedHead || recordedHead === head) return [];
  return labelPlan(labels, null).remove;
}

const ts = (s) => (s ? Date.parse(s) : NaN);

/** Facts from the PR LIST item alone (no per-PR call). */
export function listFacts(pr, now = Date.now()) {
  return {
    number: pr.number, state: pr.state, draft: !!pr.draft,
    fork: !!(pr.head.repo && pr.base.repo && pr.head.repo.full_name !== pr.base.repo.full_name) || !pr.head.repo,
    workerBranch: isWorkerBranch(pr.head.ref), ref: pr.head.ref, botAuthored: !!pr.user && pr.user.login === BOT_LOGIN,
    ageDays: (now - ts(pr.created_at)) / DAY, labels: (pr.labels || []).map((l) => l.name), head: pr.head.sha,
  };
}

/** Website r5: the head commit subject as GitHub reports it on a run at the head (null = not read). */
export function headSubjectOf(runs) {
  const m = (runs || []).map((x) => x && x.head_commit && x.head_commit.message).find((v) => typeof v === 'string');
  return typeof m === 'string' ? m.split(/\r?\n/)[0] : null;
}

/** B1: a head commit message -> 'done' (marker in the subject), 'merge-main' (look at its first parent), or 'running'. */
export function classifyHead(message) {
  const subject = String(message ?? '').split(/\r?\n/)[0];
  if (WORKER_DONE_RE.test(subject)) return 'done';
  if (MERGE_MAIN_RE.test(subject)) return 'merge-main';
  return 'running';
}

/** PRs in the order the caps are spent: newest first (B2). */
export const newestFirst = (prs) => [...prs].sort((a, b) => b.number - a.number);

/** Ledger entries {t, a, n} (kept in the status comment): sum n for action `a` in the last `minutes`. */
export function ledgerCount(ledger, a, now, minutes) {
  return (ledger || []).filter((e) => e && e.a === a && Number.isFinite(e.t) && e.t >= now - minutes * 60000).reduce((s, e) => s + (Number(e.n) || 0), 0);
}
export function pruneLedger(ledger, now) {
  return (ledger || []).filter((e) => e && typeof e.a === 'string' && Number.isFinite(e.t) && Number.isFinite(e.n) && e.t >= now - DAY);
}

/**
 * r3 (owner decision 2026-11-04): only run-ci adds whose actor is BOT_LOGIN count against the cap
 * (the orchestrator's own adds are reported as `foreign`, never counted).
 * M3/B2: proof runs in the rolling 24 h = run-ci adds across the repo (issue events, newest
 * first, PAGED until older than 24 h) + re-runs from the ledger. `exhausted` = the pager reached
 * the end of the event list. complete = false when the window was not fully read: the caller
 * then treats the cap as reached (fail closed).
 */
export function countCiProofs24h(events, exhausted, ledger, now) {
  const since = now - DAY;
  const t = (events || []).map((e) => ts(e.created_at)).filter(Number.isFinite);
  const complete = !!exhausted || (t.length > 0 && Math.min(...t) < since);
  const inWindow = (events || []).filter((e) => e.event === 'labeled' && e.label && e.label.name === 'run-ci' && ts(e.created_at) >= since);
  const adds = inWindow.filter((e) => e.actor && e.actor.login === BOT_LOGIN).length;
  return { count: adds + ledgerCount(ledger, 'rerun', now, 24 * 60), complete, foreign: inWindow.length - adds };
}

/** N2: the status comment is the one WE wrote; a marker planted by anyone else is ignored. */
export function findStatusComment(comments) {
  return (comments || []).find((c) => c.user && c.user.login === STATUS_AUTHOR && /<!-- autopilot-state /.test(c.body || '')) || null;
}

/**
 * Raw API reads -> facts. Pure; `now` is injected.
 * raw: { pr (REST pull), reviews[], files[] (filenames), checkRuns[] (head), statuses[] (combined, head),
 *        mainCheckRuns[], mainStatuses[], runsAtHead[] (actions runs, head_sha), labelEvents[] (issue
 *        events of this PR), repoRunCiAddsToday (number), jobLogs {jobId: text}, runAttempts {runId: n} }
 */
export function deriveFacts(raw, now = Date.now()) {
  const pr = raw.pr;
  const lf = listFacts(pr, now);
  const head = pr.head.sha;
  const labels = lf.labels;
  const approvedAtHead = (raw.reviews || []).some((v) => v.state === 'APPROVED' && v.commit_id === head && v.user && v.user.login === OWNER_LOGIN);
  const isMigration = (raw.files || []).some((n) => /^supabase\/migrations\//.test(n));
  const worker = isWorkerBranch(pr.head.ref);

  // A proof run: a pull_request run at THIS head created at/after the latest run-ci add.
  const adds = (raw.labelEvents || []).filter((e) => e.event === 'labeled' && e.label && e.label.name === 'run-ci').map((e) => ts(e.created_at)).filter(Number.isFinite).sort((a, b) => a - b);
  const lastAdd = adds.at(-1);
  const runs = (raw.runsAtHead || []).filter((x) => x.head_sha === head);
  const headSeen = runs.length ? Math.min(...runs.map((x) => ts(x.created_at))) : null;
  // On a worker branch the push run's jobs are skipped (the run-ci label switch), so a proof
  // run needs the LATEST add to belong to this head (after the head's first run) AND a run after it.
  const ranCi = !RUN_CI_GATED
    ? runs.some((x) => x.event === 'pull_request')
    : worker
    ? lastAdd != null && headSeen != null && lastAdd >= headSeen - 60000 && runs.some((x) => x.event === 'pull_request' && ts(x.created_at) >= lastAdd - 5000)
    : runs.length > 0;
  // The label "belongs" to this head if it was added after the head first appeared.
  const addsAtHead = headSeen == null ? adds.length : adds.filter((a) => a >= headSeen - 60000).length;
  // Two adds at this head = the original one AND our one re-add: never a third.
  const relabelledAtHead = addsAtHead >= 2;
  const runCiLabelAgeMin = labels.includes('run-ci') && lastAdd != null ? Math.floor((now - lastAdd) / 60000) : null;

  const ignored = (n) => IGNORED_CONTEXTS.some((re) => re.test(n));
  const checkRuns = (raw.checkRuns || []).filter((c) => !ignored(c.name));
  const statuses = (raw.statuses || []).filter((s) => !ignored(s.context));
  const pending = checkRuns.filter((c) => c.status !== 'completed').length + statuses.filter((s) => s.state === 'pending').length;

  const byName = new Map();
  for (const c of checkRuns) byName.set(c.name, [...(byName.get(c.name) || []), c]);
  const red = new Set();
  const rerunnable = [];
  for (const [name, list] of byName) {
    const done = list.filter((c) => c.status === 'completed');
    if (done.length !== list.length) continue;
    const latest = [...done].sort((a, b) => ts(b.completed_at || b.started_at) - ts(a.completed_at || a.started_at))[0];
    const anyOk = done.some((c) => c.conclusion === 'success');
    const allCancelled = done.every((c) => c.conclusion === 'cancelled');
    if (anyOk && !RED.has(latest.conclusion)) continue; // a cancelled duplicate beside a green one is not red
    if (!RED.has(latest.conclusion) && !allCancelled) continue;
    const ids = jobIds(latest.details_url);
    const attempt = ids ? (raw.runAttempts || {})[ids.runId] ?? 1 : 99;
    const death = ids ? detectRunnerDeath((raw.jobLogs || {})[ids.jobId]) : null;
    // M2: a cancellation is a duplicate ONLY when a newer run of the same workflow exists at this
    // head; otherwise a human (or the orchestrator) cancelled it on purpose: red, never re-run.
    const self = ids ? runs.find((x) => x.id === ids.runId) : null;
    const dup = !!self && runs.some((x) => x.id !== self.id && x.workflow_id === self.workflow_id && ts(x.created_at) > ts(self.created_at));
    const reason = allCancelled ? (dup ? 'cancelled duplicate' : null) : death ? 'runner memory kill' : null;
    if (reason && ids && attempt < 2) rerunnable.push({ name, jobId: ids.jobId, runId: ids.runId, reason });
    else red.add(name);
  }
  for (const s of statuses) if (s.state === 'failure' || s.state === 'error') red.add(s.context);

  const mainRed = new Set([
    ...(raw.mainCheckRuns || []).filter((c) => RED.has(c.conclusion)).map((c) => c.name),
    ...(raw.mainStatuses || []).filter((s) => s.state === 'failure' || s.state === 'error').map((s) => s.context),
  ]);
  const redAll = [...red].sort();
  // r3 pack: the LATEST run per job name as read (never inferred), plus the commit statuses.
  const jobs = raw.checkRuns == null ? null : [
    ...[...byName].map(([name, list]) => {
      const latest = [...list].sort((a, b) => ts(b.completed_at || b.started_at) - ts(a.completed_at || a.started_at))[0];
      return { name, status: latest.status, conclusion: latest.conclusion ?? null };
    }),
    ...statuses.map((s) => ({ name: s.context, status: s.state === 'pending' ? 'pending' : 'completed', conclusion: s.state === 'success' ? 'success' : s.state === 'pending' ? null : 'failure' })),
  ].sort((a, b) => a.name.localeCompare(b.name));
  const c = raw.counters || {};
  return {
    ...lf, merge: pr.mergeable_state, approvedAtHead, isMigration, files: raw.files ?? null, body: typeof pr.body === 'string' ? pr.body : pr.body === null ? '' : null, jobs, mainRed: [...mainRed].sort(),
    pending, redNew: redAll.filter((n) => !mainRed.has(n)), redMain: redAll.filter((n) => mainRed.has(n)),
    rerunnable, ranCi, runCiLabelAgeMin, relabelledAtHead, ciRunsToday: raw.repoRunCiAddsToday ?? 0, ciCap: CI_CAP,
    pushAnchorMs: headSeen, changedFiles: Number.isInteger(pr.changed_files) ? pr.changed_files : null, base: pr.base && pr.base.ref, labelEvents: raw.labelEvents ?? null,
    headSubject: headSubjectOf(runs), deployEnabled: deploymentEnabledFor(pr.head.ref, raw.vercelConfig),
    workerDone: !!raw.workerDone, updatesThisHour: c.updatesThisHour ?? 0, updateCap: UPDATE_CAP, rerunsThisHour: c.rerunsThisHour ?? 0, rerunCap: RERUN_CAP,
  };
}

/** `.../actions/runs/<run>/job/<job>` -> ids, else null (an external check is never re-run). */
export function jobIds(url) {
  const m = /\/actions\/runs\/(\d+)\/job\/(\d+)/.exec(String(url ?? ''));
  return m ? { runId: Number(m[1]), jobId: Number(m[2]) } : null;
}


const cell = (s) => String(s ?? '').replace(/\|/g, '\\|').replace(/\r?\n/g, ' ');

/** rows: {repo, pr, head, decision, why, did} -> step-summary markdown (one row per PR). */
export function renderSummary(rows, { dryRun, errors = [] }) {
  const out = [`## Autopilot ${dryRun ? '(DRY RUN: nothing written)' : '(live)'}`, ''];
  if (!rows.length && !errors.length) out.push('No open bot PRs.', '');
  out.push('| pr | head | decision | why | did |', '|---|---|---|---|---|');
  for (const r of rows) out.push(`| ${cell(`${r.repo}#${r.pr}`)} | ${cell(r.head)} | ${cell(r.decision)} | ${cell(r.why)} | ${cell(r.did)} |`);
  for (const e of errors) out.push(`| ${cell(e.where)} | | ERROR | ${cell(e.message)} | nothing |`);
  out.push('');
  return out.join('\n');
}

const MARK = /<!-- autopilot-state (\{[\s\S]*?\}) -->/;

/** The streak state carried inside the status comment; a missing/garbled marker reads as empty. */
export function parseState(body) {
  const m = MARK.exec(String(body ?? ''));
  if (!m) return {};
  try { const o = JSON.parse(m[1]); return o && typeof o === 'object' ? o : {}; } catch { return {}; }
}

/**
 * stops: [{key:'owner/repo#n', head, why}] for this run -> next streak state + who is newly stuck.
 * Same key + head + why as last run -> streak+1; anything else restarts at 1. Keys not stopped now drop.
 */
export function nextState(prev, stops) {
  const state = {};
  const newlyStuck = [];
  for (const s of stops) {
    const p = prev[s.key];
    const same = p && p.head === s.head && p.why === s.why;
    const streak = same ? p.streak + 1 : 1;
    const announced = same ? !!p.announced : false;
    const stuck = streak >= STUCK_HOURS;
    if (stuck && !announced) newlyStuck.push(s.key);
    state[s.key] = { head: s.head, why: s.why, streak, announced: announced || stuck };
  }
  return { state, newlyStuck };
}

/** The ONE status comment body (edited in place every run). */
export function renderStatus(stops, state, newlyStuck, runUrl, now = Date.now()) {
  const lines = ['## Autopilot: PRs that need a human', '', `Updated ${new Date(now).toISOString().slice(0, 16)}Z, run ${runUrl}`, ''];
  if (!stops.length) lines.push('Nothing is stopped. Every open bot PR is moving on its own.');
  else {
    lines.push('| PR | head | why | hours |', '|---|---|---|---|');
    for (const s of stops) {
      const st = state[s.key];
      const flag = newlyStuck.includes(s.key) ? ` **STUCK ${STUCK_HOURS}h (new)**` : st.streak >= STUCK_HOURS ? ' stuck' : '';
      lines.push(`| ${cell(s.key)} | ${cell(s.head)} | ${cell(s.why)} | ${st.streak}${flag} |`);
    }
  }
  const merges = Array.isArray(state._merges) ? state._merges : [];
  if (merges.length) {
    lines.push('', '### Merge log (autopilot merge lane, newest last)', '', '| time (UTC) | PR | head | class | mode | run |', '|---|---|---|---|---|---|');
    for (const m of merges.slice(-10)) lines.push(`| ${cell(new Date(Number(m.t)).toISOString().slice(0, 16))}Z | ${cell(m.key)} | ${cell(String(m.head).slice(0, 8))} | ${cell(m.cls)} | ${cell(m.mode)} | ${cell(m.run)} |`);
  }
  if (state._paused) lines.push('', `**${cell(state._paused)}**`);
  lines.push('', `<!-- autopilot-state ${JSON.stringify(state)} -->`);
  return lines.join('\n');
}

// autopilot-step.mjs -- the hourly autopilot (.github/workflows/autopilot.yml). For every open,
// non-draft bot PR (head branch claude/ or ccr-) in each repo: read facts through the REST API
// only, decide ONE next action (scripts/lib/autopilot.mjs decide()), perform it if it is one of
// the SAFE writes, set its ap:* state label, write one summary row, and keep ONE edited-in-place
// comment on the `autopilot status` issue listing what needs a human.
//
//   node scripts/autopilot-step.mjs                     # env-driven (the workflow)
//   node scripts/autopilot-step.mjs <owner/name> <pr>   # print one decision, never writes
//
// Env: REPOS (comma list, default GITHUB_REPOSITORY), DRY_RUN ('false' = live; anything else
// is a dry run that writes NOTHING), GH_TOKEN (state labels, re-run, status comment),
// BOT_TOKEN (run-ci label + update-branch: the bot credential, so the event fires CI; a
// GITHUB_TOKEN event would fire nothing), RUN_URL, GITHUB_STEP_SUMMARY.
// NEVER approves, closes, force-pushes, or checks out PR code. Tokens are never printed.
//
// r2 (review 1204-r1): PRs newest first; the list gate (author, branch kind, age, hold, queue
// labels) runs on the PR LIST before any per-PR call; a head without its worker-done marker gets
// only the ap:worker-running label (1-3 commit reads); every request is counted against
// RUN_CALL_BUDGET and the rolling-hour HOUR_CALL_BUDGET (ledger in the status comment); hourly
// update-branch / re-run caps and re-runs in the daily CI cap come from the same ledger.
// r3 (docs/handover/autopilot-loop-r3.md): a `ready` PR is compared main...head (REST
// mergeable_state never says `behind` here) and re-decided, so a behind, unapproved ready PR gets
// update-branch; a PR still `ready` after that gets ONE pack comment (edited in place, marker
// `autopilot-pack head=`) and, when hard-tier and not approved at head, ONE NEW owner-ping comment
// per head (a new comment, so GitHub notifies the owner). Both are authored by github-actions[bot].
// The CI cap counts only kiki-claude-bot's run-ci adds; anyone else's are reported, not counted.
// r4 MERGE LANE (docs/handover/autopilot-loop-r4.md): OFF unless the repo variable
// AUTOPILOT_MERGE_MODE is `docs-canary` or `soft`. For a PR still `ready` after the pack, the
// extra facts (comments, main's state after the last loop merge) are read and
// scripts/lib/autopilot-merge.mjs mergeVerdict() decides; the ONE merge call site (mergePr) is a
// pinned-sha squash with AUTOMERGE_TOKEN, never GITHUB_TOKEN. A refused merge (409 head moved,
// 405) is logged and not retried this run. Each merge writes a row in the status comment's log.
// Exit: 0 ok, 1 any PR or repo read/write errored (the workflow's announce-failure then fires).
import { appendFileSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  decide, deriveFacts, labelPlan, jobIds, renderSummary, parseState, nextState, renderStatus,
  listFacts, listGate, markerGate, classifyHead, countCiProofs24h, ledgerCount, pruneLedger, newestFirst, findStatusComment, staleLabels,
  WRITE_ACTIONS, STATE_LABELS, mergeMode, BOT_LOGIN, STATUS_TITLE, STATUS_AUTHOR, CI_CAP, RUN_CALL_BUDGET, HOUR_CALL_BUDGET,
} from './lib/autopilot.mjs';
import { buildPack, findPackComment, packHead, pingedAtHead, needsOwnerApprove, renderOwnerPing } from './lib/autopilot-pack.mjs';
import { mergeVerdict, mergeCallBody, merges24h, pruneMerges } from './lib/autopilot-merge.mjs';
import { isEntryPoint } from './lib/entry-point.mjs';
import { readPause, PausedError } from './lib/automation-pause.mjs';
import { parseRequiredJobs, checkRequiredJobs, REQUIRED_JOBS_PATH } from './lib/required-jobs.mjs';
import { isMoney, parseMoneySet, MONEY_SET_PATH } from './lib/is-money.mjs';

const API = 'https://api.github.com';
const LABEL_COLORS = { [STATE_LABELS.waiting]: 'fbca04', [STATE_LABELS.ready]: '0e8a16', [STATE_LABELS.stopped]: 'd93f0b', [STATE_LABELS.running]: 'c5def5' };
/** Requests one gated PR may still need (commit walk + PR + 6 reads + capped log reads + writes). */
const PER_PR_RESERVE = 18;
/** r3: requests a `ready` PR's behind check + pack + owner ping may still need (compare, comments, 2 writes). */
const PACK_RESERVE = 4;
/** Requests kept back for the status issue/comment at the end of each repo. */
const END_RESERVE = 8;
/** Stop reading when GitHub says fewer requests than this remain on the token. */
const RATE_FLOOR = 150;
/** Failed-job logs read per PR at most (runner-kill signature). */
const MAX_LOG_READS = 3;
/** Pages of repo issue events read for the 24 h cap count (100 each); past this the count fails closed. */
const MAX_EVENT_PAGES = 15;

/** counter: shared {calls, remaining} across every token so the budget is the run's total. */
export function makeApi(token, counter = { calls: 0, remaining: Infinity }, fetchImpl = fetch) {
  async function call(method, path, body, { raw = false } = {}) {
    counter.calls++;
    const res = await fetchImpl(path.startsWith('http') ? path : `${API}${path}`, {
      method,
      headers: { authorization: `Bearer ${token}`, accept: 'application/vnd.github+json', 'x-github-api-version': '2022-11-28', 'user-agent': 'bachata-autopilot' },
      body: body ? JSON.stringify(body) : undefined,
    });
    // r3: a response WITHOUT the header (a job-log read redirects to blob storage) is "unknown",
    // never 0: Number(null) is 0 and used to starve the rest of the run at the RATE_FLOOR.
    const hdr = res.headers && res.headers.get ? res.headers.get('x-ratelimit-remaining') : null;
    const rem = hdr == null || String(hdr).trim() === '' ? NaN : Number(hdr);
    if (Number.isFinite(rem)) counter.remaining = Math.min(counter.remaining, rem);
    if (!res.ok && !(raw && res.status === 404)) throw new Error(`${method} ${path.replace(/\?.*/, '')} -> HTTP ${res.status}`);
    if (raw) return res.ok ? res.text() : '';
    return res.status === 204 ? null : res.json();
  }
  async function all(path, key, max = 5) {
    const out = [];
    for (let page = 1; page <= max; page++) {
      const j = await call('GET', `${path}${path.includes('?') ? '&' : '?'}per_page=100&page=${page}`);
      const items = key ? j[key] : j;
      out.push(...items);
      if (items.length < 100) break;
    }
    return out;
  }
  /** Newest-first list paged until `done(items)` is true or the list ends. exhausted = the list ended. */
  async function until(path, done, max) {
    const out = [];
    for (let page = 1; page <= max; page++) {
      const items = await call('GET', `${path}${path.includes('?') ? '&' : '?'}per_page=100&page=${page}`);
      out.push(...items);
      if (items.length < 100) return { items: out, exhausted: true };
      if (done(out)) return { items: out, exhausted: false };
    }
    return { items: out, exhausted: false };
  }
  return { call, all, until, counter };
}

/** B1: walk the head back over merges of main (update-branch) to the worker's last own commit. */
async function headDone(api, repo, sha) {
  for (let hop = 0; hop < 3; hop++) {
    const c = await api.call('GET', `/repos/${repo}/commits/${sha}`);
    const k = classifyHead(c.commit && c.commit.message);
    if (k !== 'merge-main') return k === 'done';
    sha = c.parents && c.parents[0] && c.parents[0].sha;
    if (!sha) return false;
  }
  return false;
}

async function gather(api, repo, n, ctx, extra) {
  let pr = await api.call('GET', `/repos/${repo}/pulls/${n}`);
  // GitHub computes mergeability lazily: the first GET often answers `unknown`. Re-read once.
  if (pr.mergeable_state === 'unknown') {
    await new Promise((r) => setTimeout(r, 3000));
    pr = await api.call('GET', `/repos/${repo}/pulls/${n}`);
  }
  const head = pr.head.sha;
  const [reviews, files, checkRuns, combined, runsAtHead, labelEvents] = await Promise.all([
    api.all(`/repos/${repo}/pulls/${n}/reviews`),
    api.all(`/repos/${repo}/pulls/${n}/files`),
    api.all(`/repos/${repo}/commits/${head}/check-runs`, 'check_runs'),
    api.call('GET', `/repos/${repo}/commits/${head}/status`),
    api.all(`/repos/${repo}/actions/runs?head_sha=${head}`, 'workflow_runs', 2),
    api.all(`/repos/${repo}/issues/${n}/events`),
  ]);
  const raw = { pr, reviews, files: files.map((x) => x.filename), checkRuns, statuses: combined.statuses || [], mainCheckRuns: ctx.mainCheckRuns, mainStatuses: ctx.mainStatuses, vercelConfig: ctx.vercelConfig, runsAtHead, labelEvents, repoRunCiAddsToday: ctx.ciRunsToday, jobLogs: {}, runAttempts: {}, ...extra };
  let logs = 0;
  // Only a completed red job's log is read, and only to look for the runner-kill signature.
  for (const c of checkRuns) {
    const ids = jobIds(c.details_url);
    if (!ids || c.status !== 'completed' || !['failure', 'cancelled', 'timed_out'].includes(c.conclusion)) continue;
    if (!(ids.runId in raw.runAttempts)) raw.runAttempts[ids.runId] = (await api.call('GET', `/repos/${repo}/actions/runs/${ids.runId}`)).run_attempt;
    if (c.conclusion !== 'cancelled' && logs++ < MAX_LOG_READS) raw.jobLogs[ids.jobId] = (await api.call('GET', `/repos/${repo}/actions/jobs/${ids.jobId}/logs`, null, { raw: true })).slice(-200000);
  }
  const facts = deriveFacts(raw, ctx.now);
  facts.fileEntries = files; // slice 2: the pull-file objects WITH patches, for isMoney()
  return facts;
}

/** Performs ONE decided action. Anything outside WRITE_ACTIONS is a no-op by construction. */
async function perform(d, f, repo, apis) {
  if (!WRITE_ACTIONS.includes(d.action)) return 'nothing';
  if (d.action === 'run-ci') {
    await apis.bot.call('POST', `/repos/${repo}/issues/${f.number}/labels`, { labels: ['run-ci'] });
    return 'added run-ci';
  }
  if (d.action === 'relabel-ci') {
    await apis.bot.call('DELETE', `/repos/${repo}/issues/${f.number}/labels/run-ci`);
    await new Promise((r) => setTimeout(r, 5000));
    await apis.bot.call('POST', `/repos/${repo}/issues/${f.number}/labels`, { labels: ['run-ci'] });
    return 're-added run-ci';
  }
  if (d.action === 'update-branch') {
    // expected_head_sha: GitHub refuses if the head moved since we read it (no stale update).
    await apis.bot.call('PUT', `/repos/${repo}/pulls/${f.number}/update-branch`, { expected_head_sha: f.head });
    return 'updated branch (merge from main)';
  }
  if (d.action === 'rerun') {
    for (const id of d.jobs) await apis.gh.call('POST', `/repos/${repo}/actions/jobs/${id}/rerun`);
    return `re-ran ${d.jobs.length} job(s)`;
  }
  return 'nothing';
}

/** r3: main...head for a `ready` PR only (B3: never ~90 compares a run). */
/**
 * Website r5: the repo's vercel.json on its default branch (GET only). Any failure = null, and
 * deploymentEnabledFor(ref, null) is null, which decide() treats as "deploys": update-branch is
 * refused (fail closed on the Vercel build budget).
 */
async function readVercelConfig(api, repo) {
  try {
    const c = await api.call('GET', `/repos/${repo}/contents/vercel.json`);
    return c && typeof c.content === 'string' ? JSON.parse(Buffer.from(c.content, 'base64').toString('utf8')) : null;
  } catch {
    return null;
  }
}

async function behindBy(api, repo, mainSha, head) {
  const c = await api.call('GET', `/repos/${repo}/compare/${mainSha}...${head}`);
  return Number(c && c.behind_by) || 0;
}

/**
 * r3: the ONE pack comment (written or edited in place; skipped when its marker already carries
 * this head) and, when the pack says `Needs: owner Approve`, ONE NEW owner-ping comment per head.
 * Writes go through `api` (GH_TOKEN = github-actions[bot]). A failed ping is logged, never fatal.
 */
async function packAndPing(api, repo, f, d, ctx) {
  const comments = await api.all(`/repos/${repo}/issues/${f.number}/comments`, null, 3);
  const facts = { number: f.number, head: f.head, why: d.why, approvedAtHead: f.approvedAtHead, jobs: f.jobs, mainRed: f.mainRed, files: f.files, body: f.body };
  const body = buildPack(facts);
  const out = [];
  const existing = findPackComment(comments);
  let url = existing ? existing.html_url : null;
  if (existing && packHead(existing.body) === f.head) out.push('pack current');
  else if (ctx.dryRun) { out.push(`would: ${existing ? 'edit' : 'post'} pack`); ctx.log(`--- pack for ${repo}#${f.number} (dry run, not written) ---\n${body}\n---`); }
  else if (existing) { url = (await api.call('PATCH', `/repos/${repo}/issues/comments/${existing.id}`, { body }))?.html_url || url; out.push('pack edited'); }
  else { url = (await api.call('POST', `/repos/${repo}/issues/${f.number}/comments`, { body }))?.html_url || null; out.push('pack posted'); }
  if (needsOwnerApprove(facts)) {
    if (pingedAtHead(comments, f.head) || ctx.pings[f.number] === f.head) { ctx.nextPings[f.number] = f.head; out.push('owner already pinged at head'); }
    else if (ctx.dryRun) out.push('would: ping owner');
    else {
      try {
        await api.call('POST', `/repos/${repo}/issues/${f.number}/comments`, { body: renderOwnerPing(f.number, f.head, url) });
        ctx.nextPings[f.number] = f.head;
        out.push('owner pinged');
      } catch (e) {
        ctx.log(`::warning::${repo}#${f.number}: owner ping failed (${e.message}); the next run retries`);
        out.push('owner ping failed');
      }
    }
  }
  return out.join('; ');
}

/** r4: main's checks at the merge commit of the newest loop merge in this repo (the self-pause). */
async function mainAfterLastMerge(api, repo, log) {
  const last = log.filter((m) => m && String(m.key).startsWith(`${repo}#`)).at(-1);
  if (!last) return { state: 'none' };
  const pr = String(last.key).split('#')[1];
  if (!/^[0-9a-f]{40}$/.test(String(last.sha))) return { state: 'unread', pr };
  try {
    const runs = await api.all(`/repos/${repo}/commits/${last.sha}/check-runs`, 'check_runs', 2);
    const st = (await api.call('GET', `/repos/${repo}/commits/${last.sha}/status`)).statuses || [];
    if (runs.some((c) => ['failure', 'timed_out', 'startup_failure', 'action_required'].includes(c.conclusion)) || st.some((x) => x.state === 'failure' || x.state === 'error')) return { state: 'red', pr };
    if (runs.some((c) => c.status !== 'completed') || st.some((x) => x.state === 'pending')) return { state: 'pending', pr };
    return { state: 'green', pr };
  } catch {
    return { state: 'unread', pr };
  }
}

/**
 * r4: THE ONE merge call site. A squash pinned to the judged head sha, through AUTOMERGE_TOKEN
 * (a GITHUB_TOKEN merge fires no push workflows on main). Refused (409 head moved, 405) = logged,
 * returned, never retried in this run.
 */
async function mergePr(mergeApi, repo, f, pauseCheck, requiredCheck) {
  // PAUSE SWITCH: read AGAIN immediately before THE merge, every time (drill A15, docs/automation-pause.md).
  const switchWhy = await pauseCheck();
  if (switchWhy) return { ok: false, paused: true, why: `paused: ${switchWhy}` };
  // REQUIRED JOBS (slice 2, drill A17): RE-READ the pinned head's check-runs after the pause re-read
  // and immediately before the PUT; any required job missing / not green = no merge.
  const rj = await requiredCheck(f.head);
  if (!rj || rj.ok !== true) return { ok: false, refused: true, why: (rj && rj.reason) || 'required jobs not checked at the pinned head (fail closed)' };
  try {
    const res = await mergeApi.call('PUT', `/repos/${repo}/pulls/${f.number}/merge`, mergeCallBody(f.head));
    return res && res.merged && res.sha ? { ok: true, sha: res.sha } : { ok: false, why: 'merge answered without merged/sha' };
  } catch (e) {
    return { ok: false, why: e.message };
  }
}

/**
 * Slice 2 foundations (docs/automation-foundations.md): the REAL readers. Files come from the
 * checkout the workflow made (main; autopilot.yml checks out the default branch), never the PR.
 *   requiredJobs(api, repo, sha): GET /repos/{repo}/commits/{sha}/check-runs (paginated, per_page=100)
 *     judged against required-jobs.json; any read or parse failure is a refusal (fail closed).
 *   money(f): isMoney() over the PR's pull-file objects (with patches, read by gather() at the head)
 *     and money-set.json; an unreadable set or patch is money (fail closed).
 * run(opts.foundations) may replace a reader in tests only (the ONE shared helper in
 * tests/autopilotTable.ts); the new tests drive these defaults.
 */
export function defaultFoundations({ root = process.cwd(), readFile = (p) => readFileSync(p, 'utf8') } = {}) {
  let required = null;
  let requiredWhy = '';
  try { required = parseRequiredJobs(readFile(join(root, REQUIRED_JOBS_PATH))); } catch (e) { requiredWhy = e.message; }
  let moneySet = null;
  try { moneySet = parseMoneySet(readFile(join(root, MONEY_SET_PATH))); } catch { moneySet = null; } // null = isMoney fails closed
  const refuse = (why) => ({ ok: false, missing: [], notGreen: [], reason: why, reasons: [why] });
  return {
    requiredJobs: async (api, repo, sha) => {
      if (!required) return refuse(`required-jobs file unreadable on main (${requiredWhy})`);
      let checkRuns;
      try { checkRuns = await api.all(`/repos/${repo}/commits/${sha}/check-runs`, 'check_runs', 10); } catch (e) { return refuse(`check-runs not read at the pinned head (${e.message})`); }
      if (checkRuns.length >= 1000) return refuse('check-runs list may be truncated (1000+): fail closed');
      return checkRequiredJobs({ required, checkRuns, headSha: sha });
    },
    money: (f) => isMoney({ files: f && f.fileEntries, set: moneySet }),
  };
}

async function ensureLabels(api, repo) {
  const have = new Set((await api.all(`/repos/${repo}/labels`)).map((l) => l.name));
  for (const name of Object.values(STATE_LABELS)) {
    if (!have.has(name)) await api.call('POST', `/repos/${repo}/labels`, { name, color: LABEL_COLORS[name], description: 'autopilot state (scripts/autopilot-step.mjs)' });
  }
}

async function setStateLabel(api, repo, f, want) {
  const plan = labelPlan(f.labels, want);
  if (!want && !plan.remove.length) return '';
  for (const l of plan.remove) await api.call('DELETE', `/repos/${repo}/issues/${f.number}/labels/${encodeURIComponent(l)}`);
  if (plan.add.length) await api.call('POST', `/repos/${repo}/issues/${f.number}/labels`, { labels: plan.add });
  return plan.add.length || plan.remove.length ? (want ? `label ${want}` : `removed ${plan.remove.join(', ')}`) : '';
}

/** Reads (never writes) the status issue + OUR comment (N2: authored by STATUS_AUTHOR only). */
async function readStatus(api, repo) {
  const issues = await api.all(`/repos/${repo}/issues?state=open&labels=autopilot`, null, 1);
  const issue = issues.find((i) => i.title === STATUS_TITLE && !i.pull_request && i.user && i.user.login === STATUS_AUTHOR) || null;
  if (!issue) return { issue: null, comment: null };
  return { issue, comment: findStatusComment(await api.all(`/repos/${repo}/issues/${issue.number}/comments`, null, 2)) };
}

async function createStatusIssue(api, repo) {
  const issue = await api.call('POST', `/repos/${repo}/issues`, { title: STATUS_TITLE, labels: ['autopilot'], body: 'One list of open bot PRs the hourly autopilot cannot move by itself. The comment below is edited in place every run (.github/workflows/autopilot.yml).' });
  console.log(`created issue #${issue.number} "${STATUS_TITLE}"`);
  try {
    await api.call('POST', '/graphql', { query: 'mutation($id:ID!){pinIssue(input:{issueId:$id}){issue{number}}}', variables: { id: issue.node_id } });
  } catch (e) {
    console.log(`::warning::could not pin issue #${issue.number} (${e.message}); pin it once by hand`);
  }
  return issue;
}

export async function run(env = process.env, opts = {}) {
  const now = opts.now ?? Date.now();
  const log = opts.quiet ? () => {} : (...a) => console.log(...a);
  const dryRun = env.DRY_RUN !== 'false';
  const repos = String(env.REPOS || env.GITHUB_REPOSITORY || '').split(',').map((s) => s.trim()).filter(Boolean);
  const counter = { calls: 0, remaining: Infinity };
  // PAUSE SWITCH (docs/automation-pause.md). opts.pauseReader exists for tests; the default is the
  // REAL reader. Every non-GET call through gh/bot re-reads the switch first and throws PausedError
  // when paused; the merge call re-reads explicitly in mergePr(). A pause is not a failure (exit 0).
  const pauseReader = opts.pauseReader ?? ((r) => readPause({ repo: r, token: env.GH_TOKEN || '', fetch: opts.fetch ?? globalThis.fetch }));
  let pauseCheck = async () => null; // replaced per repo below, before that repo's first write
  const guarded = (api) => ({ ...api, call: async (method, p, body, o) => {
    if (method !== 'GET') { const why = await pauseCheck(); if (why) throw new PausedError(why); }
    return api.call(method, p, body, o);
  } });
  const pausedRepos = [];
  // Slice 2 foundations: required jobs (A17), money set (A16). Defaults are the real readers; see defaultFoundations().
  const foundations = { ...defaultFoundations(), ...(opts.foundations || {}) };
  const gh = guarded(makeApi(env.GH_TOKEN || '', counter, opts.fetch));
  const bot = env.BOT_TOKEN ? guarded(makeApi(env.BOT_TOKEN, counter, opts.fetch)) : null;
  // r4: the merge lane's own credential; absent = the lane cannot merge (mergeVerdict says so).
  const mode = mergeMode(env);
  const mergeApi = env.AUTOMERGE_TOKEN ? makeApi(env.AUTOMERGE_TOKEN, counter, opts.fetch) : null;
  let mergesRun = 0;
  const mergeLines = [];
  const rows = [];
  const errors = [];
  const foreign = [];
  if (!repos.length || !env.GH_TOKEN) errors.push({ where: 'config', message: 'REPOS/GITHUB_REPOSITORY and GH_TOKEN are required' });
  if (!dryRun && !bot) errors.push({ where: 'config', message: 'BOT_TOKEN missing: live run refused (a GITHUB_TOKEN label would fire no CI)' });
  for (const repo of errors.length ? [] : repos) if (!/^[\w.-]+\/[\w.-]+$/.test(repo)) errors.push({ where: repo, message: 'not owner/name' });

  // B3: read every repo's status comment FIRST, so the rolling-hour request budget is known
  // across all repos before any per-PR read.
  const status = {};
  for (const repo of errors.length ? [] : repos) {
    try { status[repo] = await readStatus(gh, repo); } catch (e) { errors.push({ where: repo, message: e.message }); }
  }
  const hourUsed = Object.values(status).reduce((s, st) => s + ledgerCount(parseState(st.comment && st.comment.body)._ledger, 'calls', now, 60), 0);
  const budget = Math.max(0, Math.min(RUN_CALL_BUDGET, HOUR_CALL_BUDGET - hourUsed));
  const left = () => (counter.remaining < RATE_FLOOR ? 0 : budget - counter.calls);

  for (const repo of Object.keys(status)) {
    const stops = [];
    const openNums = new Set();
    const before = counter.calls;
    const prev = parseState(status[repo].comment && status[repo].comment.body);
    const ledger = pruneLedger(prev._ledger, now);
    const heads = prev._heads && typeof prev._heads === 'object' ? prev._heads : {};
    const nextHeads = {};
    const pings = prev._pings && typeof prev._pings === 'object' ? prev._pings : {};
    const nextPings = {};
    const mergeLog = pruneMerges(prev._merges);
    let mainState = null;
    let paused = null;
    let switchPaused = null; // the PAUSE SWITCH; once seen it holds for the rest of this repo's run
    pauseCheck = async () => {
      if (switchPaused) return switchPaused;
      let r;
      try { r = await pauseReader(repo); } catch (e) { r = { paused: true, reason: `reader threw: ${e && e.message}` }; }
      if (!r || r.paused !== false) {
        switchPaused = String((r && r.reason) || 'paused');
        pausedRepos.push(`${repo}: ${switchPaused}`);
        log(`::notice::${repo}: automation pause switch: PAUSED (${switchPaused}); nothing more is written or merged this run`);
      }
      return switchPaused;
    };
    const row = (p, head, d, did) => {
      rows.push({ repo, pr: p, head: String(head).slice(0, 8), decision: d.action, why: d.why, did });
      log(JSON.stringify({ repo, pr: p, head: String(head).slice(0, 8), action: d.action, why: d.why, did }));
    };
    const labelOnly = async (f, want) => (dryRun ? `would: ${want ? `label ${want}` : `remove ${labelPlan(f.labels, null).remove.join(', ') || 'nothing'}`}` : (await setStateLabel(gh, repo, f, want)) || 'nothing');
    try {
      await pauseCheck(); // read FIRST, before anything for this repo
      if (left() < END_RESERVE + 10) throw new Error(`request budget used (${counter.calls}/${budget} this run, ${hourUsed} earlier this hour): repo not read`);
      const meta = await gh.call('GET', `/repos/${repo}`);
      const mainSha = (await gh.call('GET', `/repos/${repo}/commits/${meta.default_branch}`)).sha;
      const ev = await gh.until(`/repos/${repo}/issues/events`, (items) => items.some((e) => Date.parse(e.created_at) < now - 86400000), MAX_EVENT_PAGES);
      const proofs = countCiProofs24h(ev.items, ev.exhausted, ledger, now);
      if (proofs.foreign) log(`${repo}: ${proofs.foreign} run-ci add(s) by someone other than the bot in 24 h: reported, not counted against the cap`);
      foreign.push(`${repo}: ${proofs.foreign} run-ci add(s) in 24 h by someone other than the bot (not counted against the ${CI_CAP} cap)`);
      const ctx = {
        now, mainSha,
        mainCheckRuns: await gh.all(`/repos/${repo}/commits/${mainSha}/check-runs`, 'check_runs'),
        mainStatuses: (await gh.call('GET', `/repos/${repo}/commits/${mainSha}/status`)).statuses || [],
        vercelConfig: await readVercelConfig(gh, repo),
        // M3: an incomplete 24 h window fails CLOSED (cap treated as reached).
        ciRunsToday: proofs.complete ? proofs.count : Math.max(proofs.count, CI_CAP),
      };
      if (!proofs.complete) log(`::warning::${repo}: the 24 h run-ci window was not fully read; the CI cap fails closed this run`);
      if (!dryRun && !switchPaused) await ensureLabels(gh, repo);
      // B2: newest first, drafts included (only to clear their ap:* labels, M1).
      const open = newestFirst(await gh.all(`/repos/${repo}/pulls?state=open`));
      for (const p of open) openNums.add(p.number);
      for (const p of open) {
        try {
          const lf = listFacts(p, now);
          const gate = listGate(lf);
          if (gate) {
            const did = labelPlan(lf.labels, null).remove.length ? await labelOnly(lf, null) : 'nothing';
            if (gate.action !== 'none' || did !== 'nothing') row(p.number, lf.head, gate, did);
            if (gate.stop) stops.push({ key: `${repo}#${p.number}`, head: lf.head.slice(0, 8), why: gate.why });
            continue;
          }
          if (left() < PER_PR_RESERVE + END_RESERVE) {
            // Not reached this run (B3). M1: a label set on an older head is cleared (cheap, one call).
            const stale = staleLabels(lf.labels, heads[p.number], lf.head);
            let did = 'nothing';
            if (stale.length && left() > END_RESERVE) did = await labelOnly(lf, null);
            else if (lf.labels.some((l) => Object.values(STATE_LABELS).includes(l)) && heads[p.number]) nextHeads[p.number] = heads[p.number];
            row(p.number, lf.head, { action: 'not-reached', why: `request budget used (${counter.calls}/${budget})` }, did);
            continue;
          }
          const done = await headDone(gh, repo, lf.head);
          const mg = markerGate({ ...lf, workerDone: done });
          if (mg) {
            row(p.number, lf.head, mg, await labelOnly(lf, mg.label));
            nextHeads[p.number] = lf.head;
            continue;
          }
          const counters = { updatesThisHour: ledgerCount(ledger, 'update-branch', now, 60), rerunsThisHour: ledgerCount(ledger, 'rerun', now, 60) };
          const f = await gather(gh, repo, p.number, ctx, { workerDone: true, counters });
          let d = decide(f);
          // r3: the behind check runs for a `ready` PR ONLY, then decide() runs again with behindBy.
          if (d.action === 'ready') {
            // r4 N1: a deferred behind check never reads as ready: ap:waiting-ci until the next run.
            if (left() < PACK_RESERVE + END_RESERVE) d = { action: 'wait', why: 'behind check deferred (request budget)', label: STATE_LABELS.waiting, stop: false };
            else { f.behindBy = await behindBy(gh, repo, ctx.mainSha, f.head); d = decide(f); }
          }
          let did = dryRun ? `would: ${WRITE_ACTIONS.includes(d.action) ? d.action : 'nothing'}${d.label ? `, label ${d.label}` : ''}` : 'nothing';
          if (!dryRun) {
            const parts = [await perform(d, f, repo, { gh, bot })];
            parts.push(await setStateLabel(gh, repo, f, d.label));
            did = parts.filter((x) => x && x !== 'nothing').join('; ') || 'nothing';
          }
          // Counters move in a dry run too, so its summary shows where the caps would bite.
          if (d.action === 'run-ci' || d.action === 'relabel-ci') ctx.ciRunsToday++;
          if (d.action === 'update-branch') ledger.push({ t: now, a: 'update-branch', n: 1 });
          if (d.action === 'rerun') { ledger.push({ t: now, a: 'rerun', n: 1 }); ctx.ciRunsToday++; }
          if (d.label) nextHeads[p.number] = f.head;
          if (d.action === 'ready') {
            try {
              const pk = await packAndPing(gh, repo, f, d, { dryRun, log, pings, nextPings });
              did = [did, pk].filter((x) => x && x !== 'nothing').join('; ') || 'nothing';
            } catch (e) {
              errors.push({ where: `${repo}#${p.number} pack`, message: e.message });
            }
          }
          // r4: the merge lane, for a PR still `ready` and only when the mode is on (no extra reads otherwise).
          if (d.action === 'ready' && mode !== 'off') {
            if (!mainState) mainState = await mainAfterLastMerge(gh, repo, mergeLog);
            if (mainState.state === 'red') paused = `paused: main red after #${mainState.pr}`;
            const comments = left() > END_RESERVE + 2 ? await gh.all(`/repos/${repo}/issues/${f.number}/comments`, null, 3) : null;
            const requiredJobs = left() > END_RESERVE + 2 ? await foundations.requiredJobs(gh, repo, f.head) : null;
            const v = mergeVerdict({
              mode: env.AUTOPILOT_MERGE_MODE, dryRun, tokenOk: !!mergeApi, budgetOk: left() > END_RESERVE + 2,
              decision: d.action, workerDone: f.workerDone,
              pr: { state: f.state, draft: f.draft, fork: f.fork, base: f.base, author: f.botAuthored ? BOT_LOGIN : null, ref: f.ref, ageDays: f.ageDays, head: f.head, changedFiles: f.changedFiles },
              files: f.files, labels: f.labels, labelEvents: f.labelEvents, pushAnchorMs: f.pushAnchorMs, comments, body: f.body,
              jobs: f.jobs, redNew: f.redNew, redMain: f.redMain, pending: f.pending, behindBy: f.behindBy ?? null,
              mergesThisRun: mergesRun, merges24h: merges24h(mergeLog, now), mainAfterLastMerge: mainState,
              requiredJobs,
              money: foundations.money(f),
            });
            log(`${repo}#${p.number} merge verdict: ${v.merge ? 'MERGE' : `NO: ${v.reasons.join('; ')}`}`);
            if (!v.merge) did = [did, `merge: no (${v.reasons.slice(0, 4).join('; ')}${v.reasons.length > 4 ? `; +${v.reasons.length - 4} more` : ''})`].join('; ');
            else {
              const m = await mergePr(mergeApi, repo, f, pauseCheck, (sha) => foundations.requiredJobs(gh, repo, sha));
              if (m.paused) did = `${did}; ${m.why}`;
              else if (!m.ok) { log(`::warning::${repo}#${p.number}: merge refused (${m.why}); not retried this run`); did = `${did}; merge refused (${m.why})`; }
              else {
                mergesRun++;
                d = { action: 'merge', why: `merge lane (${v.mode}): ${v.classes.join(' + ')}`, label: null, stop: false };
                const cleared = await setStateLabel(gh, repo, { ...f, labels: [...new Set([...f.labels, STATE_LABELS.ready])] }, null).catch((e) => `ap:* removal failed (${e.message})`);
                mergeLog.push({ t: now, key: `${repo}#${p.number}`, head: f.head, sha: m.sha, cls: v.classes.join('+'), mode: v.mode, run: env.RUN_URL || '(local)' });
                mergeLines.push(`- merged ${repo}#${p.number} at ${f.head.slice(0, 8)} (${v.classes.join(' + ')}, mode ${v.mode}) -> ${m.sha.slice(0, 8)}`);
                did = ['merged (squash, pinned sha)', cleared].filter(Boolean).join('; ');
                ctx.mainSha = m.sha; // later PRs this run compare against the new main (behind -> no merge)
              }
            }
          }
          if (d.action !== 'none') row(p.number, f.head, d, did);
          if (d.stop) stops.push({ key: `${repo}#${p.number}`, head: f.head.slice(0, 8), why: d.why });
        } catch (e) {
          if (e instanceof PausedError) row(p.number, (p.head && p.head.sha) || '', { action: 'paused', why: 'automation pause switch' }, `paused: ${e.reason}`);
          else errors.push({ where: `${repo}#${p.number}`, message: e.message });
        }
      }
    } catch (e) {
      errors.push({ where: repo, message: e.message });
    }
    try {
      const { state, newlyStuck } = nextState(prev, stops);
      ledger.push({ t: now, a: 'calls', n: counter.calls - before + 2 });
      for (const [n, h] of Object.entries(pings)) if (!(n in nextPings) && openNums.has(Number(n))) nextPings[n] = h;
      const body = renderStatus(stops, { ...state, _ledger: pruneLedger(ledger, now), _heads: nextHeads, _pings: nextPings, _merges: pruneMerges(mergeLog), ...(paused ? { _paused: paused } : {}) }, newlyStuck, env.RUN_URL || '(local)', now);
      for (const k of newlyStuck) log(`::warning::${k} has been in the same stop state for 3 consecutive hourly runs`);
      let { issue, comment } = status[repo];
      if (!dryRun) {
        if (!issue) issue = await createStatusIssue(gh, repo);
        if (comment) await gh.call('PATCH', `/repos/${repo}/issues/comments/${comment.id}`, { body });
        else await gh.call('POST', `/repos/${repo}/issues/${issue.number}/comments`, { body });
      }
      if (env.GITHUB_STEP_SUMMARY) appendFileSync(env.GITHUB_STEP_SUMMARY, `\n### Status comment ${dryRun ? '(would write)' : `(issue #${issue.number})`}\n\n${body.replace(/<!--[\s\S]*?-->/, '')}\n`);
    } catch (e) {
      if (e instanceof PausedError) log(`${repo}: status comment not written (paused: ${e.reason})`);
      else errors.push({ where: `${repo} status`, message: e.message });
    }
  }
  const md = renderSummary(rows, { dryRun, errors }) + (foreign.length ? `\n${foreign.map((x) => `- ${x}`).join('\n')}\n` : '')
    + `\nMerge lane: mode ${mode}${mergeLines.length ? `\n${mergeLines.join('\n')}` : ' (no merge this run)'}\n`
    + (pausedRepos.length ? `\nAutomation pause switch: PAUSED (${pausedRepos.join('; ')}). Nothing was written or merged after the switch was seen (docs/automation-pause.md).\n` : '\nAutomation pause switch: running\n');
  log(md);
  log(`requests: ${counter.calls} (budget ${budget} this run; ${hourUsed} earlier this hour)`);
  if (env.GITHUB_STEP_SUMMARY) appendFileSync(env.GITHUB_STEP_SUMMARY, `${md}\nRequests: ${counter.calls} (budget ${budget})\n`);
  return errors.length ? 1 : 0;
}

async function single(repo, pr, env) {
  const gh = makeApi(env.GH_TOKEN || env.GITHUB_TOKEN || '');
  const meta = await gh.call('GET', `/repos/${repo}`);
  const mainSha = (await gh.call('GET', `/repos/${repo}/commits/${meta.default_branch}`)).sha;
  const now = Date.now();
  const ev = await gh.until(`/repos/${repo}/issues/events`, (items) => items.some((e) => Date.parse(e.created_at) < now - 86400000), MAX_EVENT_PAGES);
  const proofs = countCiProofs24h(ev.items, ev.exhausted, [], now);
  if (proofs.foreign) console.log(`${proofs.foreign} run-ci add(s) by someone other than the bot in 24 h: not counted`);
  const ctx = { now, mainSha, mainCheckRuns: await gh.all(`/repos/${repo}/commits/${mainSha}/check-runs`, 'check_runs'), mainStatuses: [], vercelConfig: await readVercelConfig(gh, repo), ciRunsToday: proofs.complete ? proofs.count : Math.max(proofs.count, CI_CAP) };
  const p = await gh.call('GET', `/repos/${repo}/pulls/${pr}`);
  const gate = listGate(listFacts(p, now)) ?? markerGate({ workerDone: await headDone(gh, repo, p.head.sha) });
  if (gate) { console.log(JSON.stringify({ repo, pr: Number(pr), head: p.head.sha.slice(0, 8), ...gate })); return; }
  const f = await gather(gh, repo, pr, ctx, { workerDone: true });
  let d = decide(f);
  if (d.action === 'ready') { f.behindBy = await behindBy(gh, repo, mainSha, f.head); d = decide(f); }
  console.log(JSON.stringify({ repo, pr: Number(pr), head: f.head.slice(0, 8), behindBy: f.behindBy, ...d }));
}

if (isEntryPoint(import.meta.url)) {
  const [repo, pr] = process.argv.slice(2);
  const p = repo ? (/^[\w.-]+\/[\w.-]+$/.test(repo) && /^\d+$/.test(pr || '') ? single(repo, pr, process.env).then(() => 0) : Promise.resolve((console.error('usage: autopilot-step.mjs [<owner/name> <pr>]'), 2))) : run();
  p.then((code) => process.exit(code), (e) => { console.error(`autopilot: ${e.message}`); process.exit(1); });
}

// The autopilot MERGE LANE (r4, docs/handover/autopilot-loop-r4.md; docs/automerge.md "Autopilot
// merge lane"). PURE, no network. mergeVerdict(facts) -> {merge, reasons}: merge is true only when
// EVERY condition below holds; each failing condition adds ONE reason string. Any missing,
// unreadable, truncated or ambiguous fact is a NO (fail closed).
//
// Owner decision 2026-11-04 (click): "I trust it, I need full automation now." The lane merges a
// no-screen, non-hard-tier bot PR only. Hard-tier Approve, migrations, prod writes, product
// choices, the real-phone check, credentials and live Stripe stay with the owner.
// The lane is OFF unless the repo variable AUTOPILOT_MERGE_MODE is exactly `docs-canary` or `soft`.
// Tests: tests/autopilotR4.test.ts.
import { BOT_LOGIN, MAX_AGE_DAYS, HOLD_LABEL, MERGE_MODES } from './autopilot.mjs';
import { classifyFile, classifySoft, findPackComment, packHead, PACK_AUTHOR } from './autopilot-pack.mjs';
import { pathProblem, pathClass as webPathClass } from '../automerge-classify.mjs';
import { isRiskyPath } from './review-scope.mjs';
import { guardRefusals } from './guard-paths.mjs';

/*
 * Website r5 adapter (docs/handover/autopilot-loop-r5.md). The Website's automerge-classify.mjs
 * has pathProblem() and a pathClass() that answers 'docs' | 'tests' | null (null = refused:
 * forbidden prefix, auth-ish name, or not on the allowlist). The admin lane's three names map:
 *   pathRefusal(p)     -> a reason string, or null when the Website classifier accepts p;
 *   pathClass(p)       -> 'code' for a screen-shaped path (.tsx/.jsx/.css/.scss anywhere), else the
 *                         classifier's class ('docs' | 'tests') or null;
 *   isDocsClassPath(p) -> refusal-free and docs.
 * Brief r5 requirement 1: anything under src/ with a screen is NOT mergeable by the lane (it needs
 * a walk), and the lane only ever considers docs-only and tests-only PRs (tests are still refused
 * below, r4b N3b: their content is not read).
 */
// Any screen-shaped file anywhere (src/ is also hard-tier via isRiskyPath; this catches the rest).
export const SCREEN_RE = /\.(tsx|jsx|css|scss)$/i;
/**
 * Ported from admin automerge-classify GOVERNANCE: prose that defines the gates and this lane.
 * A bot must not loosen its own rules without the owner reading the change: owner-merged.
 */
export const GOVERNANCE = new Set([
  'claude.md', 'agents.md', 'docs/agent-policy.md', 'docs/automerge.md', 'docs/pr-batching-policy.md',
  'docs/testing-doctrine.md', 'docs/ci-guard-notes.md', 'docs/claude-md-reference.md', 'docs/testing-gates.md',
  'docs/guards-and-review-doctrine.md',
]);
export function pathRefusal(p) {
  const prob = pathProblem(p);
  if (prob) return prob;
  if (GOVERNANCE.has(String(p).toLowerCase())) return `${p} is governance prose (owner-merged)`;
  return webPathClass(p) === null ? `${p} is not on the Website docs/tests allowlist` : null;
}
export function pathClass(p) {
  if (SCREEN_RE.test(String(p))) return 'code';
  return webPathClass(p);
}
/** As admin r4b: docs means a lowercase .md or image extension (`docs/x.sql`, `README.MD` -> not docs). */
export const DOC_EXT = /\.(md|png|jpe?g|webp|gif)$/;
export const isDocsClassPath = (p) => pathRefusal(p) === null && pathClass(p) === 'docs' && DOC_EXT.test(String(p));

export { MERGE_MODES };
export const REVIEW_LABEL = 'review-passed';
export const RESERVED_LABELS = ['do-not-merge', 'needs-owner', 'wip', 'owner-reserved', HOLD_LABEL];
export const QUEUE_LABELS = ['migration-queued', 'queue-stopped'];
export const MAX_MERGES_PER_RUN = 3;
export const MAX_MERGES_24H = 6;
/** A PR file list at/over this length may be truncated by GitHub: fail closed. */
export const FILE_LIST_CAP = 300;
const RED = new Set(['failure', 'timed_out', 'startup_failure', 'action_required', 'cancelled', 'stale']);
const OK = new Set(['success', 'skipped', 'neutral']);
const DAY = 86400000;

/** The repo variable as read from the workflow env: anything but an exact mode is `off`. */
export const parseMergeMode = (v) => (MERGE_MODES.includes(v) ? v : 'off');

/**
 * r4b N1 (review 1215-r1): files an agent loads as instructions when it works in that folder.
 * Refused at EVERY depth and in every class, compared lower-case: a "docs only" PR must not rewrite
 * agent instructions without an owner Approve.
 */
export const AGENT_BASENAMES = ['claude.md', 'agents.md', 'skill.md', 'gemini.md', '.cursorrules', '.windsurfrules', 'copilot-instructions.md'];
export const AGENT_SEGMENTS = ['.claude', '.cursor', '.windsurf', '.codex', '.agents', '.gemini'];
/**
 * r4c N4 (review 1217-r1): instruction-file NAMES, not only the exact ones: CLAUDE.local.md,
 * AGENTS.override.md, GEMINI-x.md, ... Tested on the lower-cased basename.
 */
// Over-blocks on purpose (docs/agents-overview.md, docs/claude-code-notes.md -> NO, owner-merged): a false NO costs one owner merge, a false MERGE rewrites agent instructions.
export const AGENT_NAME_RE = /^(claude|agents|gemini|skill)([.-][a-z0-9._-]+)?\.md$/i;
export function isAgentInstructionPath(p) {
  const segs = String(p).toLowerCase().split(/[\\/]+/);
  const base = segs[segs.length - 1];
  return AGENT_BASENAMES.includes(segs[segs.length - 1]) || AGENT_NAME_RE.test(base) || segs.some((s) => AGENT_SEGMENTS.includes(s));
}

/**
 * One path -> its merge-lane class: 'docs' | 'soft-app', or {no: reason}.
 * Order: agent-instruction paths first, then hard tier (pack HARD_RULES, review-scope isRiskyPath,
 * the classifier's FORBIDDEN prefixes via pathRefusal), then screen code, then the tests class
 * (r4b N3b, owner lead 2026-11-04: content is not read, so tests stay owner-merged in every mode),
 * then the positive classes.
 */
export function laneClass(p) {
  if (typeof p !== 'string' || !p) return { no: 'unreadable path' };
  if (isAgentInstructionPath(p)) return { no: `agent-instruction path ${p}` };
  if (classifyFile(p).group === 'hard' || isRiskyPath(p) || isRiskyPath(p.toLowerCase())) return { no: `hard-tier path ${p}` };
  const refusal = pathRefusal(p);
  if (pathClass(p) === 'code' && !classifySoft(p)) return { no: `screen / app path ${p} (not on SOFT_APP_ALLOW)` };
  if (pathClass(p) === 'tests' || pathClass(p.toLowerCase()) === 'tests') return { no: `tests path ${p}: content is not read, owner-merged` };
  if (refusal) return { no: `forbidden path: ${refusal}` };
  if (isDocsClassPath(p)) return { cls: 'docs' };
  if (classifySoft(p)) return { cls: 'soft-app' };
  return { no: `path ${p} is not positively docs or soft-app` };
}

/** The PR body's label line (Verified / Not verified) and whether it is filled. */
const LABEL_LINE = /^\s*(?:[-*>]\s*)*(?:#+\s*)?(?:\*\*|__)?\s*(not verified|verified)\s*(?:\*\*|__)?\s*:?\s*(?:\*\*|__)?\s*:?\s*(.*)$/i;
/**
 * r4b N2: a label value that says nothing. After stripping list markers, whitespace, markdown
 * emphasis, quotes and trailing punctuation: empty, only dashes / dots / ellipses, or a
 * placeholder word. `Verified: -` is NOT filled.
 */
const PLACEHOLDER_WORDS = ['n/a', 'na', 'tbd', 'todo', 'none', 'nothing', '?'];
export function isPlaceholder(text) {
  const t = String(text ?? '')
    .replace(/^(?:\s*[-*+>]\s+)+/, '')
    .replace(/[*_`~"'\u2018\u2019\u201c\u201d]/g, '')
    .trim()
    .replace(/[\s.!,;:]+$/, '')
    .trim();
  return !t || /^[-\u2010-\u2015.\u2026\s]*$/.test(t) || PLACEHOLDER_WORDS.includes(t.toLowerCase());
}
export function bodyFilled(body) {
  if (typeof body !== 'string') return { verified: false, notVerified: false, toFill: true };
  const lines = body.split(/\r?\n/);
  const seen = { verified: false, 'not verified': false };
  for (let i = 0; i < lines.length; i++) {
    const m = LABEL_LINE.exec(lines[i]);
    if (!m) continue;
    const key = m[1].toLowerCase();
    let text = m[2].trim();
    if (!text) { // heading-only: the next non-empty line that is not a heading or another label
      const n = lines.slice(i + 1).find((l) => l.trim());
      if (n && !/^\s*#/.test(n) && !LABEL_LINE.test(n)) text = n.trim();
    }
    if (!isPlaceholder(text)) seen[key] = true;
  }
  return { verified: seen.verified, notVerified: seen['not verified'], toFill: /TO FILL/i.test(body) };
}

/** The Verified block's text (label line + heading-only continuation), for the prod-write rule. */
function verifiedText(body) {
  const lines = String(body ?? '').split(/\r?\n/);
  const out = [];
  for (let i = 0; i < lines.length; i++) {
    const m = LABEL_LINE.exec(lines[i]);
    if (!m || m[1].toLowerCase() !== 'verified') continue;
    out.push(m[2]);
    for (let j = i + 1; j < lines.length && lines[j].trim() && !/^\s*#/.test(lines[j]) && !LABEL_LINE.test(lines[j]); j++) out.push(lines[j]);
  }
  return out.join('\n');
}

const ts = (s) => (s ? Date.parse(s) : NaN);
const lower = (l) => (typeof l === 'string' ? l.toLowerCase() : '');

/**
 * facts: {
 *   mode (raw AUTOPILOT_MERGE_MODE), dryRun, tokenOk (AUTOMERGE_TOKEN present), budgetOk,
 *   decision ('ready' = r2/r3 gates passed this run), workerDone,
 *   pr: {state, draft, fork, base, author, ref, ageDays, head, changedFiles},
 *   files: [path] | null, labels: [name], labelEvents: [issue event] | null, pushAnchorMs,
 *   comments: [issue comment] | null, body: string | null,
 *   jobs: [{name, status, conclusion}] | null, redNew: [name], redMain: [name], pending,
 *   behindBy: number | null, mergesThisRun, merges24h: number | null,
 *   mainAfterLastMerge: {state: 'none'|'green'|'red'|'pending'|'unread', pr?},
 *   requiredJobs: checkRequiredJobs() result at the pinned head (slice 2, A17); absent = NO,
 *   money: isMoney() result over the PR's files with patches (slice 2, A16); absent = NO
 * }
 */
export function mergeVerdict(facts) {
  const f = facts || {};
  const pr = f.pr || {};
  const reasons = [];
  const no = (s) => reasons.push(s);
  // 1. mode
  const mode = parseMergeMode(f.mode);
  if (mode === 'off') no(`mode off (AUTOPILOT_MERGE_MODE=${JSON.stringify(f.mode ?? null)})`);
  if (f.dryRun !== false) no('dry run: never merges');
  if (f.tokenOk !== true) no('AUTOMERGE_TOKEN missing: never merges with GITHUB_TOKEN');
  // 2. PR
  if (pr.state !== 'open') no('PR not open');
  if (pr.draft !== false) no('draft (or unknown)');
  if (pr.fork !== false) no('fork (or unknown)');
  if (pr.base !== 'main') no(`base is ${pr.base ?? 'unknown'}, not main`);
  if (pr.author !== BOT_LOGIN) no(`author ${pr.author ?? 'unknown'} is not ${BOT_LOGIN}`);
  if (!/^(claude\/|ccr-)/.test(String(pr.ref ?? ''))) no('head branch is not claude/ or ccr-');
  if (!(pr.ageDays <= MAX_AGE_DAYS)) no(`older than ${MAX_AGE_DAYS} days (or age unknown)`);
  if (f.workerDone !== true) no('no [worker-done dt_<hex>] marker at head');
  if (f.decision !== 'ready') no(`decision is ${f.decision ?? 'unknown'}, not ready`);
  if (typeof pr.head !== 'string' || !/^[0-9a-f]{40}$/.test(pr.head)) no('head sha unknown');
  // 3. paths
  const files = f.files;
  const classes = new Set();
  if (!Array.isArray(files) || !files.length) no('file list not read');
  else if (files.length >= FILE_LIST_CAP) no(`file list has ${files.length} entries (cap ${FILE_LIST_CAP}): may be truncated`);
  else if (!Number.isInteger(pr.changedFiles) || pr.changedFiles !== files.length) no(`file list incomplete (${files.length} read, PR says ${pr.changedFiles ?? 'unknown'})`);
  else {
    for (const p of files) {
      const c = laneClass(p);
      if (c.no) no(c.no);
      else classes.add(c.cls);
    }
    if (mode === 'docs-canary' && [...classes].some((c) => c !== 'docs')) no(`docs-canary accepts docs only (this PR has ${[...classes].filter((c) => c !== 'docs').join(', ')})`);
  }
  // 3a. guard paths (slice 2, drill A18; scripts/lib/guard-paths.mjs): the ONE shared check every
  // auto path calls, in addition to (never instead of) laneClass's refusals above.
  // A rename's OLD name counts too (facts.previousFiles; a rename out of a guard path is a touch).
  if (Array.isArray(files)) for (const r of guardRefusals([...files, ...(Array.isArray(f.previousFiles) ? f.previousFiles : [])])) no(r);
  // 3b. money set (slice 2, drill A16; scripts/lib/is-money.mjs): paths AND changed lines. A
  // path-only "docs" class is overridden by a content hit. Absent = refuse.
  const mv = f.money;
  if (!mv || typeof mv !== 'object') no('money set not checked (fail closed)');
  else if (mv.money !== false) no(mv.reason || 'money set: unreadable (no reason given)');
  // 4. migration
  // r4b N3a: GitHub label names are case-insensitive: compare lower-cased on both sides.
  const labels = Array.isArray(f.labels) ? f.labels.map(lower) : null;
  if (!labels) no('labels not read');
  if (Array.isArray(files) && files.some((p) => /^supabase\/migrations\//i.test(String(p)))) no('migration file in the PR');
  for (const l of QUEUE_LABELS) if (labels && labels.includes(l)) no(`${l} label`);
  // 5. reserved
  for (const l of RESERVED_LABELS) if (labels && labels.includes(l)) no(`reserved label ${l}`);
  const body = f.body;
  if (typeof body !== 'string') no('PR body not read');
  else if (/^.*\b(reserved|do[- ]not[- ]merge|don'?t merge|must not be merged|not to be merged|hold off merging)\b.*$/im.test(body)) no('PR body says it is reserved / must not be merged');
  // 6. CI
  const jobs = f.jobs;
  if (!Array.isArray(jobs) || !jobs.length) no('no checks read at head');
  else {
    const pend = jobs.filter((j) => !j || j.status !== 'completed').map((j) => (j && j.name) || '?');
    if (pend.length || f.pending !== 0) no(`check(s) pending: ${pend.join(', ') || f.pending}`);
    const notGreen = jobs.filter((j) => j && j.status === 'completed' && !OK.has(j.conclusion)).map((j) => j.name);
    const redNew = Array.isArray(f.redNew) ? f.redNew : null;
    if (!redNew) no('newly-red list not read');
    else if (redNew.length) no(`newly red vs main: ${redNew.join(', ')}`);
    const alsoMain = notGreen.filter((n) => !(redNew || []).includes(n));
    if (alsoMain.length) no(`not green (red also on main, or a billing/annotation red): ${alsoMain.join(', ')}`);
    if (jobs.some((j) => j && RED.has(j.conclusion)) && !notGreen.length) no('red check');
  }
  // 6b. required jobs at the pinned head (slice 2, drill A17; scripts/lib/required-jobs.mjs). The
  // checker result over .github/automation/required-jobs.json read from MAIN. Absent = refuse.
  const rj = f.requiredJobs;
  if (!rj || typeof rj !== 'object' || !Array.isArray(rj.reasons)) no('required jobs not checked at the pinned head (fail closed)');
  else if (rj.ok !== true || rj.reasons.length) for (const r of rj.reasons.length ? rj.reasons : ['required jobs refused (no reason given)']) no(r);
  // 7. behind
  if (f.behindBy !== 0) no(f.behindBy == null ? 'behind check not read' : `behind main by ${f.behindBy}`);
  // 8. review label by the bot after the latest push + our pack for THIS head
  const anchor = f.pushAnchorMs;
  if (!labels || !labels.includes(REVIEW_LABEL)) no(`no ${REVIEW_LABEL} label`);
  else if (!Number.isFinite(anchor) || !Array.isArray(f.labelEvents)) no(`${REVIEW_LABEL}: push time or label events not read`);
  else {
    const adds = f.labelEvents.filter((e) => e && e.event === 'labeled' && e.label && lower(e.label.name) === REVIEW_LABEL);
    if (!adds.some((e) => e.actor && e.actor.login === BOT_LOGIN)) no(`${REVIEW_LABEL} was not added by ${BOT_LOGIN}`);
    else if (!adds.some((e) => e.actor && e.actor.login === BOT_LOGIN && ts(e.created_at) > anchor)) no(`${REVIEW_LABEL} was added before the latest push`);
  }
  const pack = Array.isArray(f.comments) ? findPackComment(f.comments) : null;
  if (!Array.isArray(f.comments)) no('PR comments not read');
  else if (!pack || !pack.user || pack.user.login !== PACK_AUTHOR) no('no autopilot pack comment');
  else if (packHead(pack.body) !== pr.head) no('autopilot pack is for another head');
  else if (/not read/i.test(pack.body)) no('autopilot pack says "not read"');
  // 9. body filled
  if (typeof body === 'string') {
    const b = bodyFilled(body);
    if (b.toFill) no('PR body still has TO FILL');
    if (!b.verified) no('Verified line not filled');
    if (!b.notVerified) no('Not verified line not filled');
    // 10. no unnamed prod write
    if (/^\s*#+.*\bprod(uction)?\b.*\b(write|data)\b/im.test(body) || /^\s*(?:\*\*)?prod(uction)? (data )?write/im.test(body)) no('PR body announces a prod data write');
    if (/prod(uction)?[- ]write|\bapply\b|\bapplied\b/i.test(verifiedText(body))) no('Verified block mentions a prod write / apply');
  }
  // 11. rate and health
  if (!Number.isInteger(f.mergesThisRun) || f.mergesThisRun >= MAX_MERGES_PER_RUN) no(`per-run merge cap (${f.mergesThisRun ?? '?'}/${MAX_MERGES_PER_RUN})`);
  if (!Number.isInteger(f.merges24h) || f.merges24h >= MAX_MERGES_24H) no(`24 h merge cap (${f.merges24h ?? 'log not read'}/${MAX_MERGES_24H})`);
  if (f.budgetOk !== true) no('request budget spent');
  const m = f.mainAfterLastMerge || { state: 'unread' };
  if (m.state === 'red') no(`paused: main red after #${m.pr}`);
  else if (m.state === 'pending') no(`paused: main checks pending after #${m.pr}`);
  else if (m.state !== 'none' && m.state !== 'green') no('main state after the last loop merge not read');
  return { merge: reasons.length === 0, reasons, classes: [...classes].sort(), mode };
}

/** The ONE merge request body: a squash pinned to the sha that was judged. */
export function mergeCallBody(sha) {
  if (typeof sha !== 'string' || !/^[0-9a-f]{40}$/.test(sha)) throw new Error('mergeCallBody: a 40-hex head sha is required');
  return { sha, merge_method: 'squash' };
}

/** Merges counted from the status comment's merge log in the rolling 24 h. */
export const merges24h = (log, now) => (Array.isArray(log) ? log.filter((r) => r && now - Number(r.t) < DAY).length : null);
/** The merge log kept in the status state: newest 30 rows. */
export const pruneMerges = (log) => (Array.isArray(log) ? log.filter((r) => r && Number.isFinite(Number(r.t))).slice(-30) : []);

// Stale-bot-PR sweep: the PURE decision (docs/automation-pause.md, "Stale bot-PR sweep").
// Owner click 2026-11-04: review reports and "nothing to change" markers pile up as superseded
// PRs only the owner can close. scripts/sweep-stale-bot-prs.mjs feeds this from the REST API;
// tests/staleBotPr.test.ts drives it table-first. No I/O here.
import { BOT_LOGIN, HANDS_OFF_LABELS, STATE_LABELS, WORKER_DONE_RE } from './autopilot.mjs';
import { RESERVED_LABELS } from './autopilot-merge.mjs';

/** A PR carrying any of these is never swept, whatever else is true. */
export const PROTECTED_LABELS = Object.freeze(['automerge-ok', 'ap:hold', 'owner-reserved']);
/** At most this many closes per run, oldest first. */
export const MAX_CLOSES = 5;
/** Last activity must be STRICTLY older than this. */
export const STALE_DAYS = 3;
const DAY_MS = 86400000;

const ALREADY_ON_MAIN = /^chore: .*already on main/i;
/** Review reports and "nothing to change" markers: a report never supersedes real work. */
export const REPORT_BRANCH = /^claude\/(review|done)-/;
/** Autopilot's own hands-off labels are honoured too (never sweep what autopilot will not touch). */
const NEVER_LABELS = [...PROTECTED_LABELS, ...RESERVED_LABELS, ...HANDS_OFF_LABELS, STATE_LABELS.running];

/**
 * The ticket keys a PR belongs to: every `[worker-done <ticket>]` in its title / head subject, plus
 * its branch stem (claude/ and review-/done- prefixes and a trailing -rN stripped). Two PRs share a
 * ticket when ANY key matches, so a candidate whose subject names the ticket still meets a later
 * PR known only by title and branch.
 */
export function ticketKeys(pr) {
  const keys = new Set();
  const g = new RegExp(WORKER_DONE_RE.source, 'gi');
  for (const m of `${pr.title || ''}\n${pr.headSubject || ''}`.matchAll(g)) keys.add(m[0].replace(/^\[worker-done |\]$/gi, '').toLowerCase());
  const stem = String(pr.headRef || '').replace(/^claude\//, '').replace(/^(review|done)-/, '').replace(/-r\d+$/, '').toLowerCase();
  if (stem) keys.add(stem);
  return [...keys];
}

const ms = (t) => (t == null ? NaN : new Date(t).getTime());

/**
 * decide(pr, ctx, now) -> { close, reason }
 *   pr:  { number, author, headRef, labels[], draft, createdAt, lastActivity, title, headSubject, changedFiles }
 *        lastActivity = newest of the PR's updated_at, its comments and its commits (the runner computes it).
 *   ctx: { others: [{ number, createdAt, state: 'open'|'merged', keys: ticketKeys(), headRef }] } every open or merged PR.
 *   now: epoch ms.
 */
export function decide(pr, ctx = {}, now = Date.now()) {
  const keep = (reason) => ({ close: false, reason });
  if (pr.author !== BOT_LOGIN) return keep(`author ${pr.author} is not ${BOT_LOGIN}`);
  if (!String(pr.headRef || '').startsWith('claude/')) return keep(`head ${pr.headRef} is not claude/*`);
  if (pr.draft) return keep('draft');
  const labels = pr.labels || [];
  const prot = NEVER_LABELS.find((l) => labels.includes(l));
  if (prot) return keep(`protected label ${prot}`);
  const last = ms(pr.lastActivity);
  if (!Number.isFinite(last)) return keep('last activity unknown');
  const ageDays = (now - last) / DAY_MS;
  if (!(ageDays > STALE_DAYS)) return keep(`active ${ageDays.toFixed(1)}d ago (needs > ${STALE_DAYS}d)`);

  const keys = ticketKeys(pr);
  const mine = ms(pr.createdAt);
  const isReport = REPORT_BRANCH.test(pr.headRef);
  const later = (ctx.others || [])
    .filter((o) => o.number !== pr.number && (o.state === 'open' || o.state === 'merged') && ms(o.createdAt) > mine)
    .filter((o) => isReport || !REPORT_BRANCH.test(String(o.headRef || ''))) // a report never supersedes work
    .map((o) => ({ o, key: (o.keys || []).find((k) => keys.includes(k)) }))
    .filter((x) => x.key)
    .sort((a, b) => ms(a.o.createdAt) - ms(b.o.createdAt))[0];
  if (later) return { close: true, supersededBy: later.o.number, reason: `superseded: ticket ${later.key} has later ${later.o.state} PR #${later.o.number}` };
  if (ALREADY_ON_MAIN.test(String(pr.headSubject || ''))) return { close: true, reason: 'head commit says the change is already on main' };
  if (pr.changedFiles === 0) return { close: true, reason: 'zero changed files' };
  return keep('stale but no close rule fired');
}

/** Every decision plus the ones to close this run: the oldest MAX_CLOSES by createdAt. */
export function plan(prs, ctx = {}, now = Date.now()) {
  const decisions = prs.map((pr) => ({ pr, ...decide(pr, ctx, now) }));
  // Never close a PR as superseded by one this same run closes: the ticket must keep a survivor.
  const closing = new Set(decisions.filter((d) => d.close).map((d) => d.pr.number));
  for (const d of decisions) {
    if (d.close && d.supersededBy && closing.has(d.supersededBy)) {
      d.close = false;
      d.reason = `kept: its superseder #${d.supersededBy} is itself being swept`;
    }
  }
  const toClose = decisions
    .filter((d) => d.close)
    .sort((a, b) => ms(a.pr.createdAt) - ms(b.pr.createdAt))
    .slice(0, MAX_CLOSES);
  return { decisions, toClose };
}

export const closeComment = (reason) => `Closed by the stale-bot-PR sweep: ${reason}. Reopen if this was wrong.`;

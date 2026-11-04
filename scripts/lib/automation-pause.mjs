/**
 * The automation PAUSE SWITCH reader (slice 1). ONE implementation, fail closed.
 * Read docs/automation-pause.md before editing: this file is a GUARD path (owner Approve at head).
 *
 * PAUSED = the label `automation-paused` on the issue titled exactly `AUTOMATION PAUSE SWITCH`,
 * OR any doubt: no such issue, more than one, a closed one, or ANY read error. readPause() never
 * throws and returns paused:false ONLY after positively reading exactly one open issue without
 * the label. NO caching: every call hits the API, which is what makes "read again before each
 * merge" real. Node built-ins only (workflows call this without npm ci).
 *
 * Listing order: newest first (direction=desc), up to 5 pages of 100. This repo already has well
 * over 500 issues+PRs, so an oldest-first walk capped at 5 pages could never reach a NEW pinned
 * issue (it would read as "missing" = paused forever). Once 500 newer items exist the issue falls
 * off the window and the reader fails CLOSED ("pause issue missing"): loud, never silently running.
 */

export const PAUSE_ISSUE_TITLE = 'AUTOMATION PAUSE SWITCH';
export const PAUSE_LABEL = 'automation-paused';
const API = 'https://api.github.com';
const REPO_RE = /^[\w.-]+\/[\w.-]+$/;
const MAX_PAGES = 5;

export class PausedError extends Error {
  constructor(reason) {
    super(`automation paused: ${reason}`);
    this.name = 'PausedError';
    this.reason = reason;
  }
}

function headers(token) {
  return { authorization: `Bearer ${token}`, accept: 'application/vnd.github+json', 'x-github-api-version': '2022-11-28', 'user-agent': 'bachata-automation-pause' };
}

function nextLink(res) {
  const h = res && res.headers && typeof res.headers.get === 'function' ? res.headers.get('link') : null;
  const m = h ? /<([^>]+)>\s*;\s*rel="next"/.exec(h) : null;
  return m ? m[1] : null;
}

/** One request. Throws an Error whose message is the fail-closed reason. */
async function request(fetchImpl, url, token, { method = 'GET', body, timeoutMs = 10000 } = {}) {
  if (!url.startsWith(`${API}/`)) throw new Error(`refused url off ${API}`);
  const ac = new AbortController();
  const timer = setTimeout(() => ac.abort(), timeoutMs);
  let res;
  try {
    res = await fetchImpl(url, { method, headers: headers(token), body: body ? JSON.stringify(body) : undefined, signal: ac.signal });
  } catch (e) {
    throw new Error(ac.signal.aborted || (e && e.name === 'AbortError') ? `timeout after ${timeoutMs} ms` : `network: ${e && e.message ? e.message : String(e)}`);
  } finally {
    clearTimeout(timer);
  }
  if (!res || !res.ok) throw new Error(`HTTP ${res ? res.status : '?'} on ${method} ${url.replace(API, '').replace(/\?.*/, '')}`);
  const text = await res.text();
  let data = null;
  if (text !== '') {
    try { data = JSON.parse(text); } catch { throw new Error('response body is not JSON'); }
  }
  return { data, next: nextLink(res) };
}

function checkArgs(repo, token, fetchImpl) {
  if (typeof repo !== 'string' || !REPO_RE.test(repo)) return 'invalid repo (want owner/name from GITHUB_REPOSITORY)';
  if (!token) return 'no token (GH_TOKEN missing)';
  if (typeof fetchImpl !== 'function') return 'no fetch implementation';
  return null;
}

const labelNames = (labels) => labels.map((l) => (typeof l === 'string' ? l : l && typeof l.name === 'string' ? l.name : ''));

/** Finds THE pause issue. Throws (fail-closed reason) on any read error or odd shape. */
async function findPauseIssue({ repo, token, fetch: fetchImpl, timeoutMs }) {
  let url = `${API}/repos/${repo}/issues?state=all&per_page=100&sort=created&direction=desc`;
  const matches = [];
  for (let page = 1; url && page <= MAX_PAGES; page++) {
    const { data, next } = await request(fetchImpl, url, token, { timeoutMs });
    if (!Array.isArray(data)) throw new Error('issues response is not an array');
    for (const it of data) {
      if (!it || typeof it !== 'object') throw new Error('issues response has a non-object item');
      if (!Array.isArray(it.labels)) throw new Error(`item #${it.number} labels field missing or not an array`);
      if ('pull_request' in it) continue;
      if (typeof it.title === 'string' && it.title.trim() === PAUSE_ISSUE_TITLE) matches.push(it);
    }
    url = next;
  }
  return matches;
}

/**
 * -> { paused, reason, issue }. Never throws. reason '' only when running.
 */
export async function readPause({ repo, token, fetch: fetchImpl = globalThis.fetch, timeoutMs = 10000 } = {}) {
  try {
    const bad = checkArgs(repo, token, fetchImpl);
    if (bad) return { paused: true, reason: bad, issue: null };
    const matches = await findPauseIssue({ repo, token, fetch: fetchImpl, timeoutMs });
    if (matches.length === 0) return { paused: true, reason: `pause issue missing (no issue titled "${PAUSE_ISSUE_TITLE}")`, issue: null };
    if (matches.length > 1) return { paused: true, reason: `ambiguous: ${matches.length} issues titled "${PAUSE_ISSUE_TITLE}"`, issue: null };
    const it = matches[0];
    const num = Number.isInteger(it.number) ? it.number : null;
    if (labelNames(it.labels).includes(PAUSE_LABEL)) return { paused: true, reason: 'label', issue: num };
    if (it.state !== 'open') return { paused: true, reason: `pause issue #${num} is closed`, issue: num };
    if (num === null) return { paused: true, reason: 'pause issue has no number', issue: null };
    return { paused: false, reason: '', issue: num };
  } catch (e) {
    return { paused: true, reason: e && e.message ? e.message : String(e), issue: null };
  }
}

/** Throws PausedError when paused (or on any doubt). Returns the read when running. */
export async function assertNotPaused(args) {
  const r = await readPause(args);
  if (r.paused) throw new PausedError(r.reason);
  return r;
}

export const noticeMarker = (key) => `<!-- automation-pause-notice key=${key} -->`;

/**
 * THE INTERIM CHANNEL: one comment on the pinned issue per `key` (de-duplicated by marker).
 * -> { posted, skipped, error }. Never throws.
 */
export async function postPauseNotice({ repo, token, fetch: fetchImpl = globalThis.fetch, key, text, timeoutMs = 10000 } = {}) {
  try {
    const bad = checkArgs(repo, token, fetchImpl);
    if (bad) return { posted: false, skipped: false, error: bad };
    if (!key || /[\r\n>]/.test(String(key))) return { posted: false, skipped: false, error: 'invalid notice key' };
    const matches = await findPauseIssue({ repo, token, fetch: fetchImpl, timeoutMs });
    if (matches.length !== 1) return { posted: false, skipped: false, error: `pause issue not unique (${matches.length})` };
    const n = matches[0].number;
    const marker = noticeMarker(key);
    let url = `${API}/repos/${repo}/issues/${n}/comments?per_page=100`;
    for (let page = 1; url && page <= 3; page++) {
      const { data, next } = await request(fetchImpl, url, token, { timeoutMs });
      if (!Array.isArray(data)) throw new Error('comments response is not an array');
      if (data.some((c) => c && typeof c.body === 'string' && c.body.includes(marker))) return { posted: false, skipped: true, error: null };
      url = next;
    }
    await request(fetchImpl, `${API}/repos/${repo}/issues/${n}/comments`, token, { method: 'POST', body: { body: `${String(text)}\n\n${marker}` }, timeoutMs });
    return { posted: true, skipped: false, error: null };
  } catch (e) {
    return { posted: false, skipped: false, error: e && e.message ? e.message : String(e) };
  }
}

/**
 * A15b decision (pure). Re-assert when the label is ABSENT and the most recent label event for it
 * is an `unlabeled` by anyone other than the owner (bots included). The owner's removal is the
 * legitimate clear. Odd input -> { reassert:false, error } so the guard goes red, never green.
 */
export function decideReassert({ labelPresent, events, ownerLogin } = {}) {
  if (!ownerLogin || typeof ownerLogin !== 'string') return { reassert: false, eventId: null, actor: null, error: 'owner login missing' };
  if (!Array.isArray(events)) return { reassert: false, eventId: null, actor: null, error: 'events is not an array' };
  const mine = [];
  for (const e of events) {
    if (!e || typeof e !== 'object') return { reassert: false, eventId: null, actor: null, error: 'non-object event' };
    if (e.event !== 'labeled' && e.event !== 'unlabeled') continue;
    if (!e.label || e.label.name !== PAUSE_LABEL) continue;
    const t = Date.parse(e.created_at);
    if (!e.actor || typeof e.actor.login !== 'string' || !Number.isFinite(t)) return { reassert: false, eventId: null, actor: null, error: `label event ${e.id} has no actor or time` };
    mine.push({ ...e, t });
  }
  if (labelPresent || !mine.length) return { reassert: false, eventId: null, actor: null };
  mine.sort((a, b) => a.t - b.t || Number(a.id) - Number(b.id));
  const last = mine.at(-1);
  if (last.event === 'unlabeled' && last.actor.login !== ownerLogin) return { reassert: true, eventId: last.id, actor: last.actor.login };
  return { reassert: false, eventId: last.id, actor: last.actor.login };
}

/** Raw reads/writes for the --guard CLI path (exported for it only; the label is never removed). */
export async function readPauseIssueEvents({ repo, token, fetch: fetchImpl = globalThis.fetch, issue, timeoutMs = 10000 }) {
  const out = [];
  let url = `${API}/repos/${repo}/issues/${issue}/events?per_page=100`;
  for (let page = 1; url && page <= 10; page++) {
    const { data, next } = await request(fetchImpl, url, token, { timeoutMs });
    if (!Array.isArray(data)) throw new Error('events response is not an array');
    out.push(...data);
    url = next;
  }
  if (url) throw new Error('events list longer than 10 pages: not fully read');
  return out;
}

export async function findPause({ repo, token, fetch: fetchImpl = globalThis.fetch, timeoutMs = 10000 }) {
  const bad = checkArgs(repo, token, fetchImpl);
  if (bad) throw new Error(bad);
  const matches = await findPauseIssue({ repo, token, fetch: fetchImpl, timeoutMs });
  if (matches.length !== 1) throw new Error(`pause issue not unique (${matches.length} found)`);
  return { number: matches[0].number, labelPresent: labelNames(matches[0].labels).includes(PAUSE_LABEL), state: matches[0].state };
}

export { request as pauseRequest, API as PAUSE_API };

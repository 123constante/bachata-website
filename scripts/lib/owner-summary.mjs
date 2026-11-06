// Owner-summary: PURE text/keys for the owner's finish/stop/undelivered messages (slice 14, part A).
// No I/O. At-most-once per (arc, head, kind) -- never "exactly once".

export const KINDS = Object.freeze(['finish', 'stop']);
const ALL_KINDS = Object.freeze(['finish', 'stop', 'undelivered']);
export const MAX_MESSAGE = 600;
const ID_RE = /^[A-Za-z0-9._-]{1,64}$/;
export const MAX_LINK = 300;
// Each pattern matches the WHOLE secret so it can be replaced. A match redacts; it never drops the alert.
const SECRET_PATTERNS = [
  /\b(?:token|secret|passw(?:or)?d|api[_-]?key|authorization)\b\s*=\s*[^\s&]+/gi,
  /\b(?:token|secret|passw(?:or)?d|api[_-]?key|authorization)\b\s*:\s*(?=[^\s]*\d)[^\s]{8,}/gi,
  /\bbearer\b\s*[:=]?\s*[A-Za-z0-9._~+/-]{8,}=*/gi,
  /\b(?:ghp|gho|ghs|ghu|ghr|github_pat|sk|tk|xox[abp])[_-][A-Za-z0-9_-]{8,}/g,
  /\beyJ[A-Za-z0-9_-]{10,}(?:\.[A-Za-z0-9_-]+){0,2}/g,
  /\b[A-Fa-f0-9]{41,}\b/g,
  /[A-Za-z0-9+/=_-]{48,}/g,
];
// Allowed shapes masked before the scan: GitHub run/job/PR/commit/issue URLs (7-40 hex SHAs need no mask).
const ALLOWED_RE = /https:\/\/github\.com\/[A-Za-z0-9_.-]{1,39}\/[A-Za-z0-9_.-]{1,100}\/(?:actions\/runs\/\d+(?:\/job\/\d+)?(?:\/attempts\/\d+)?|pull\/\d+|commit\/[0-9a-f]{7,40}|issues\/\d+)(?![A-Za-z0-9_-])/g;

/** -> { text, redacted }. Secret-shaped spans become `[redacted]`. */
export function redactSecrets(text) {
  const kept = [];
  let s = String(text ?? '').replace(/\u0000/g, '').replace(ALLOWED_RE, (m) => `\u0000${kept.push(m) - 1}\u0000`);
  const before = s;
  for (const re of SECRET_PATTERNS) s = s.replace(re, '[redacted]');
  return { text: s.replace(/\u0000(\d+)\u0000/g, (_, i) => kept[Number(i)]), redacted: s !== before };
}

export function looksSecret(text) {
  return typeof text === 'string' && redactSecrets(text).redacted;
}

/** `arc:<id>|head:<sha>|kind:<kind>`. Throws on a malformed part so a bad key can never dedupe wrongly. */
export function makeKey({ arc, head, kind } = {}) {
  if (!ID_RE.test(String(arc ?? ''))) throw new Error('makeKey: bad arc id');
  if (!/^[0-9a-f]{7,40}$/i.test(String(head ?? ''))) throw new Error('makeKey: bad head sha');
  if (!ALL_KINDS.includes(kind)) throw new Error('makeKey: bad kind');
  return `arc:${arc}|head:${String(head).toLowerCase()}|kind:${kind}`;
}

// Strips HTML-comment delimiters (to a fixpoint) so no input can forge an issue-comment marker.
const noComment = (s) => { let p; do { p = s; s = s.replace(/<!--+|--+>/g, ''); } while (s !== p); return s; };
const clean = (v) => noComment(String(v ?? '').replace(/[\r\n\t]+/g, ' ')).replace(/\s+/g, ' ').trim();
const cap = (s, n) => (s.length > n ? `${s.slice(0, Math.max(0, n - 3))}...` : s);

/** -> { ok:true, text, redacted } | { ok:false, error }. Plain text, capped; secret-looking spans redacted. */
export function formatMessage({ kind, arc, pr, link, what, next, undone } = {}) {
  if (!ALL_KINDS.includes(kind)) return { ok: false, error: 'bad kind' };
  if (!ID_RE.test(String(arc ?? ''))) return { ok: false, error: 'missing arc' };
  if (typeof link !== 'string' || !/^https:\/\/[^\s<>]+$/.test(link)) return { ok: false, error: 'missing link' };
  const r = [link, clean(what), clean(next), clean(undone)].map(redactSecrets);
  const redacted = r.some((x) => x.redacted);
  const parts = r.slice(1).map((x) => x.text);
  const safeLink = cap(r[0].text, MAX_LINK);
  const head = { finish: 'FINISHED', stop: 'STOPPED', undelivered: 'UNDELIVERED' }[kind];
  const lines = [`${head}: arc ${arc}${pr ? ` PR #${clean(pr)}` : ''}`];
  if (parts[0]) lines.push(parts[0]);
  if (parts[1]) lines.push(`Next: ${parts[1]}`);
  if (parts[2]) lines.push(`Not done: ${parts[2]}`);
  const tail = `\n${safeLink}`;
  const body = cap(lines.join('\n'), MAX_MESSAGE - tail.length);
  return { ok: true, text: body + tail, redacted };
}

/** Open stops plus every marker not `sent`, sorted. Never a push: a comment body. */
export function buildDigest({ stops = [], markers = [], now } = {}) {
  const day = now instanceof Date ? now.toISOString().slice(0, 10) : clean(now);
  const s = [...stops].sort((a, b) => String(a.arc).localeCompare(String(b.arc)) || String(a.link).localeCompare(String(b.link)));
  const m = markers.filter((x) => x && x.state !== 'sent').sort((a, b) => String(a.key).localeCompare(String(b.key)));
  const lines = [`Daily digest ${day}`];
  if (!s.length && !m.length) return `${lines[0]}\nnothing open`;
  if (s.length) {
    lines.push('', `Open stops (${s.length}):`);
    for (const x of s) lines.push(`- arc ${clean(x.arc)}${x.pr ? ` PR #${clean(x.pr)}` : ''}: ${cap(clean(x.what), 120)} ${clean(x.link)}`.trimEnd());
  }
  if (m.length) {
    lines.push('', `Messages not confirmed sent (${m.length}):`);
    for (const x of m) lines.push(`- ${clean(x.key)} [${clean(x.state)}]${x.at ? ` since ${clean(x.at)}` : ''}`);
  }
  return lines.join('\n');
}

/** ONE body listing hard-tier PRs awaiting the owner's Approve at head. */
export function buildApprovalList({ prs = [] } = {}) {
  if (!prs.length) return 'Hard-tier approvals: nothing waiting';
  const rows = [...prs].sort((a, b) => Number(a.number) - Number(b.number))
    .map((p) => `- #${clean(p.number)} ${cap(clean(p.title), 100)} (head ${clean(p.head).slice(0, 7)}) ${clean(p.link)}`);
  return [`Hard-tier approvals waiting (${prs.length}):`, ...rows].join('\n');
}

// The autopilot's short review pack for a `ready` PR (r3, docs/handover/autopilot-loop-r3.md):
// PURE, no network. buildPack(facts) renders ONE comment the hourly loop keeps edited in place on
// the PR (marker `<!-- autopilot-pack head=<sha> -->`), and renderOwnerPing() the ONE new comment
// per head that tells the owner a hard-tier PR is ready for their Approve (a new comment, not an
// edit, so GitHub notifies the owner's phone). Never invents a check it did not read: a missing
// job list, file list or PR body is printed as "not read", never as green.
// Tests: tests/autopilotR3.test.ts.

import { redAlsoOnMain } from './autopilot.mjs';
export const PACK_AUTHOR = 'github-actions[bot]';
export const OWNER = '123constante';
// r4 F1 (review 1213-r1): both markers are matched ONLY on the LAST non-empty line of the body,
// end-anchored, no g flag. PR-controlled text quoted above it is escaped (escapeQuoted), so a
// marker planted in a PR body can neither suppress the owner ping nor spoof the pack head.
const PACK_RE = /^<!-- autopilot-pack head=([0-9a-f]{7,40}) -->$/;
const PING_RE = /^<!-- autopilot-owner-ping head=([0-9a-f]{7,40}) -->$/;
/** The last non-empty line of a comment body (CRLF-safe), trimmed. */
export const lastLine = (body) => String(body ?? '').split(/\r?\n/).map((l) => l.trim()).filter(Boolean).at(-1) || '';
/** r4 F1: PR-controlled text entering a comment: no HTML comment, tag or @mention survives. */
export const escapeQuoted = (s) => String(s ?? '').replace(/</g, '&lt;').replace(/@/g, '&#64;');
const RED = new Set(['failure', 'timed_out', 'startup_failure', 'action_required']);

/**
 * Hard tier: a path the owner Approves at head before anything merges. The first matching rule
 * is the reason printed. Mirrors scripts/lib/review-scope.mjs isRiskyPath() plus scripts/
 * (the brief's rule: `.github/` and `scripts/` are hard-tier), kept local so this file stays pure.
 */
export const HARD_RULES = [
  [/^supabase\/migrations\//, 'migration: the owner Approves, migration-queue applies'],
  [/^supabase\/functions\//, 'edge function: prod RPC surface'],
  // r4 N4: review-scope GATE_CRITICAL also holds supabase/encodings/*.json; any supabase/ path is prod config.
  [/^supabase\//, 'supabase/: prod config (encodings, allowlists)'],
  [/^\.github\//, '.github/: CI and workflow config'],
  [/^scripts\//, 'scripts/: gate and automation code'],
  [/^guards\.json$/, 'guards.json: guard config'],
  // Website r5 (brief requirement 1): deploy config and dependency manifests.
  [/^vercel\.json$/, 'vercel.json: deploy config (Vercel build budget)'],
  [/(^|\/)(package(-lock)?\.json|npm-shrinkwrap\.json|pnpm-lock\.yaml|yarn\.lock|bun\.lockb?)$/, 'package.json / lockfile: dependencies'],
];

/** One repo-relative path -> {group: 'docs'|'tests'|'app'|'hard', rule?}. */
export function classifyFile(name) {
  const p = String(name ?? '').replace(/\\/g, '/');
  for (const [re, rule] of HARD_RULES) if (re.test(p)) return { group: 'hard', rule };
  if (/^docs\//.test(p) || (/\.md$/i.test(p) && !p.includes('/'))) return { group: 'docs' };
  if (/^(tests|e2e)\//.test(p) || /\.(test|spec)\.[cm]?[jt]sx?$/.test(p)) return { group: 'tests' };
  return { group: 'app' };
}

/**
 * r4 F2: soft-app is a SHORT EXPLICIT ALLOWLIST, never "everything not hard-tier": non-UI
 * TypeScript helpers directly under lib/ (.ts only; no .tsx, no .css, no sub-folder, no React
 * hook `use*.ts`). SOFT_DENY always wins, and it also names the lib/ files that write prod
 * (save/delete services, gateways, kernels, commands, flags, generated encodings).
 */
// Website r5: EMPTY. The Website lane never merges app code (brief requirement 1: docs-only and
// tests-only PRs at most), so classifySoft() is false for every path.
export const SOFT_APP_ALLOW = [];
export const SOFT_DENY = /auth|payment|stripe|ticket|money|rls|rpc|guard|secret|token|webhook|middleware|vercel|package|lock|config|\.env|\.claude|supabase\/|\.github\/|scripts\/|app\/api\/|save|delete|service|gateway|kernel|command|contract|flag|generated|upload|write|mutat|persist|autopilot|automerge|gate|migrat|policy|review|approv|merge/i;
/** r4 F2: true only for an allowlisted path that no DENY pattern matches. */
export const classifySoft = (name) => {
  const p = String(name ?? '');
  return SOFT_APP_ALLOW.some((re) => re.test(p)) && !SOFT_DENY.test(p);
};

/** files null/undefined = not read: fail closed (treated as hard-tier, so the owner is asked). */
export function hardTier(files) {
  if (!Array.isArray(files)) return [{ file: '(file list not read)', rule: 'files not read: treated as hard-tier' }];
  return files.map((f) => ({ file: f, ...classifyFile(f) })).filter((x) => x.group === 'hard').map(({ file, rule }) => ({ file, rule }));
}

/** The owner's Approve is needed: any hard-tier file (or no file list) and not already approved at head. */
export const needsOwnerApprove = (facts) => hardTier(facts.files).length > 0 && !facts.approvedAtHead;

const LABEL_RE = /^\s*(?:[-*>]\s*)*(?:#+\s*)?(?:\*\*|__)?\s*(not verified|verified)\b/i;
const HEADING_ONLY_RE = /^\s*(?:#+\s*)?(?:\*\*|__)?\s*(not verified|verified)\s*:?\s*(?:\*\*|__)?\s*:?\s*$/i;
const MAX_QUOTED = 40;

/**
 * The PR body's `Verified` / `Not verified` lines (and mutant lines) VERBATIM. A heading-only
 * `Verified` line also quotes the lines under it up to the next blank line or heading.
 */
export function quoteBody(body) {
  if (typeof body !== 'string') return null;
  const lines = body.split(/\r?\n/);
  const out = [];
  for (let i = 0; i < lines.length && out.length < MAX_QUOTED; i++) {
    const l = lines[i];
    if (LABEL_RE.test(l) || /mutant/i.test(l)) out.push(l);
    if (HEADING_ONLY_RE.test(l)) {
      for (let j = i + 1; j < lines.length && out.length < MAX_QUOTED; j++) {
        const n = lines[j];
        if (!n.trim() || /^\s*#/.test(n) || LABEL_RE.test(n)) break;
        out.push(n);
        i = j;
      }
    }
  }
  return out;
}

const cell = (s) => escapeQuoted(s).replace(/\|/g, '\\|').replace(/\r?\n/g, ' ');

/** A job's conclusion as printed: only `success` is green; anything absent is "not read". */
function jobState(j) {
  if (!j || typeof j.name !== 'string') return 'not read';
  if (j.status && j.status !== 'completed') return `pending (${j.status})`;
  if (!j.conclusion) return 'not read';
  if (j.conclusion === 'success') return 'green';
  if (RED.has(j.conclusion)) return `red (${j.conclusion})`;
  return j.conclusion;
}

/**
 * facts: { number, head (40-sha), why (decide()'s reason), approvedAtHead, jobs: [{name, status,
 * conclusion}] | null, mainRed: [name] | null, files: [path] | null, body: string | null }
 * -> Markdown. Pure.
 */
export function buildPack(facts) {
  const head = String(facts.head ?? '');
  const hard = hardTier(facts.files);
  const needs = needsOwnerApprove(facts);
  const out = [`## Autopilot pack: #${facts.number} at \`${head.slice(0, 8)}\``, ''];
  out.push(`**Verdict: ready** at head \`${head}\`: ${cell(facts.why || 'decide() said ready')}.`, '');

  out.push('### CI per job');
  if (!Array.isArray(facts.jobs)) out.push('', 'Job list not read: CI state unknown.');
  else if (!facts.jobs.length) out.push('', 'No jobs read at this head.');
  else {
    const mainRed = Array.isArray(facts.mainRed) ? new Set(facts.mainRed) : null;
    out.push('', '| job | conclusion | also red on main? |', '|---|---|---|');
    for (const j of facts.jobs) out.push(`| ${cell(j && j.name ? j.name : '(unnamed)')} | ${jobState(j)} | ${mainRed ? (mainRed.has(j && j.name) ? 'yes' : 'no') : 'not read'} |`);
  }
  out.push('', `red also on main: ${redAlsoOnMain(facts.jobs, facts.mainRed)}`);
  out.push('');

  out.push('### Files');
  if (!Array.isArray(facts.files)) out.push('', 'File list not read: treated as hard-tier.');
  else {
    const groups = { docs: [], tests: [], soft: [], app: [], hard: [] };
    for (const f of facts.files) { const g = classifyFile(f).group; groups[g === 'app' && classifySoft(f) ? 'soft' : g].push(f); }
    out.push('');
    const code = (f) => `\`${escapeQuoted(String(f).replace(/`/g, "'"))}\``;
    for (const [g, title] of [['docs', 'docs'], ['tests', 'tests'], ['soft', 'soft-app (allowlist)'], ['app', 'app (not soft)']]) {
      out.push(`- **${title}** (${groups[g].length})${groups[g].length ? `: ${groups[g].map(code).join(', ')}` : ''}`);
    }
    out.push(`- **hard-tier** (${hard.length})${hard.length ? ':' : ''}`);
    for (const h of hard) out.push(`  - ${code(h.file)}: ${h.rule}`);
  }
  out.push('');

  out.push('### Verified / Not verified (quoted from the PR body)');
  const q = quoteBody(facts.body);
  if (q === null) out.push('', 'PR body not read.');
  else if (!q.length) out.push('', 'The PR body has no `Verified` / `Not verified` lines.');
  else out.push('', ...q.map((l) => `> ${escapeQuoted(l)}`));
  out.push('');

  if (needs) out.push(`**Needs: owner Approve at head \`${head}\`** (hard-tier: ${[...new Set(hard.map((h) => h.rule.split(':')[0]))].join(', ')}).`);
  else if (facts.approvedAtHead && hard.length) out.push(`**Needs: nothing from the owner** (approved at head \`${head}\`), but the loop does not merge.`);
  else out.push('**Needs: nothing from the owner, but the loop does not merge.**');
  out.push('', `<!-- autopilot-pack head=${head} -->`);
  return out.join('\n');
}

/** The ONE pack comment on a PR: ours (PACK_AUTHOR) and carrying the marker; anyone else's is ignored. */
export function findPackComment(comments) {
  return (comments || []).find((c) => c && c.user && c.user.login === PACK_AUTHOR && PACK_RE.test(lastLine(c.body))) || null;
}
export const packHead = (body) => (PACK_RE.exec(lastLine(body)) || [])[1] || null;

/** True when WE already pinged the owner for this head (a marker planted by anyone else does not count). */
export function pingedAtHead(comments, head) {
  return (comments || []).some((c) => c && c.user && c.user.login === PACK_AUTHOR && (PING_RE.exec(lastLine(c.body)) || [])[1] === head);
}

/** The ONE new owner-notification comment for this head. */
export function renderOwnerPing(number, head, packUrl) {
  return [
    `@${OWNER} #${number} is ready for Approve at head \`${head}\`. Pack: ${packUrl || '(pack comment above)'}`,
    '',
    'The autopilot never approves or merges; it posts this once per head.',
    '',
    `<!-- autopilot-owner-ping head=${head} -->`,
  ].join('\n');
}

// scripts/lib/merge-tier.mjs -- merge tiers by blast radius (brief merge-tiers, owner click 2026-11-15).
//
//   classifyTier(files) -> 'A' | 'B' | 'C'   (the HIGHEST tier of any file wins)
//
//   A  owner Approve: any guard path (isGuardPath), anything under supabase/migrations or any *.sql,
//      secrets (.env/.env.*/.envrc/env.* basenames, a secret(s) segment or stem), money (isMoney on the path, money-set.json).
//   B  merge on green CI + a worker self-review in the PR body: any other HARD-tier path
//      (review-scope.mjs riskTier). .github/, .claude/ and .githooks/ are guarded today, so in
//      practice B is the unguarded files under scripts/ and bin/.
//   C  auto-merge on green: everything else.
//
// No second path list: guard paths and the hard tier come from their one owner each. PURE apart from
// reading money-set.json once at load. FAIL CLOSED: no files, a non-string path, or an unreadable
// money set is tier A. Behind repo variable MERGE_TIERS_ENABLED (default off): nothing calls this
// unless the flag is 'true' (scripts/owner-approval-audit.mjs, docs/proposals/*.yml).
import { readFileSync } from 'node:fs';
import { isGuardPath } from './guard-paths.mjs';
import { riskTier } from './review-scope.mjs';
import { isMoney, parseMoneySet } from './is-money.mjs';

let MONEY_SET = null;
try {
  MONEY_SET = parseMoneySet(readFileSync(new URL('../../.github/automation/money-set.json', import.meta.url), 'utf8'));
} catch {
  MONEY_SET = null; // isMoney then reports money: true for every file (fail closed -> tier A)
}

const SQL = /(^|\/)supabase\/migrations\/|\.sql$/i;
// Secrets by BASENAME: .env, .env.<x>, .envrc, env.<x> (env.production); and the word secret(s)
// only as a whole path segment or a whole file stem (secrets/x.json, config/secret.ts), never inside a
// prose name (docs/secret-santa.md, scripts/rotate-secret.mjs).
const ENV_BASENAME = /^(\.env(\..+)?|\.envrc|env\.[a-z0-9_-]+)$/i;
const SECRET_WORD = /^secrets?$/i;
function isSecretPath(q) {
  const segs = q.split('/');
  const base = segs[segs.length - 1];
  if (ENV_BASENAME.test(base)) return true;
  if (segs.slice(0, -1).some((d) => SECRET_WORD.test(d))) return true;
  return SECRET_WORD.test(base.replace(/\..*$/, ''));
}

/** Tier of ONE file: a path string, or a GitHub pull-file object ({filename|path, patch, changes,
 *  previous_filename}). A string is money-checked by PATH only; an object is handed to isMoney whole,
 *  so its added/removed lines are scanned too (a missing patch fails closed -> A).
 *  `deps` lets tests swap the shared checks (never a second list). */
export function fileTier(f, deps = {}) {
  const guard = deps.isGuardPath || isGuardPath;
  const tier = deps.riskTier || riskTier;
  const set = deps.moneySet === undefined ? MONEY_SET : deps.moneySet;
  const money = deps.isMoney || ((file) => isMoney({ files: [file], set }).money);
  const obj = f && typeof f === 'object';
  const p = obj ? (f.filename ?? f.path) : f;
  if (typeof p !== 'string' || p === '') return 'A';
  const prev = obj && typeof f.previous_filename === 'string' && f.previous_filename ? [f.previous_filename] : [];
  for (const q of [p, ...prev]) if (guard(q) || SQL.test(q) || isSecretPath(q)) return 'A';
  if (money(obj ? f : { path: p, changes: 0 })) return 'A';
  if ([p, ...prev].some((q) => tier(q) === 'hard')) return 'B';
  return 'C';
}

const RANK = { C: 0, B: 1, A: 2 };

/** Highest tier of any file. No files at all = 'A' (cannot prove the blast radius). */
export function classifyTier(files, deps = {}) {
  if (!Array.isArray(files) || files.length === 0) return 'A';
  let worst = 'C';
  for (const f of files) {
    const t = fileTier(f, deps);
    if (RANK[t] > RANK[worst]) worst = t;
    if (worst === 'A') break;
  }
  return worst;
}

/** The flag as the workflows pass it: env MERGE_TIERS_ENABLED from vars.MERGE_TIERS_ENABLED. Only the exact string 'true' is on. */
export function mergeTiersEnabled(env = process.env) {
  return Boolean(env) && env.MERGE_TIERS_ENABLED === 'true';
}

/** Placeholder lines that never count as a self-review. */
const PLACEHOLDER = /^(-|todo|n\/a|none|tbd)$/i;

/** The PR body records the worker's self-review: a `## Self-review` heading followed, before the next
 *  heading, by at least one REAL line: not blank, not an HTML comment, not a placeholder (-, TODO,
 *  n/a, none, tbd) and carrying at least 12 letters/digits. Placeholder bodies fail. */
export function hasSelfReview(body) {
  const text = String(body ?? '').replace(/<!--[\s\S]*?(-->|$)/g, '');
  const lines = text.split(/\r?\n/);
  const i = lines.findIndex((l) => /^## Self-review\s*$/i.test(l));
  if (i < 0) return false;
  for (const l of lines.slice(i + 1)) {
    if (/^#{1,2} /.test(l)) return false;
    const t = l.trim();
    if (t === '' || PLACEHOLDER.test(t)) continue;
    const item = t.replace(/^([-*]|\d+\.)\s+/, '');
    if (PLACEHOLDER.test(item)) continue;
    if ((item.match(/[A-Za-z0-9]/g) || []).length >= 12) return true;
  }
  return false;
}

// scripts/lib/merge-tier.mjs -- merge tiers by blast radius (brief merge-tiers, owner click 2026-11-15).
//
//   classifyTier(files) -> 'A' | 'B' | 'C'   (the HIGHEST tier of any file wins)
//
//   A  owner Approve: any guard path (isGuardPath), anything under supabase/migrations or any *.sql,
//      secrets (.env*, a path naming "secret"), money (isMoney on the path, money-set.json).
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
const SECRET = /(^|\/)\.env(\.|$)|secret/i;

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
  for (const q of [p, ...prev]) if (guard(q) || SQL.test(q) || SECRET.test(q)) return 'A';
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

/** The PR body records the worker's self-review: a `## Self-review` heading followed by at least
 *  one non-blank line before the next heading (an empty heading does not count). */
export function hasSelfReview(body) {
  const lines = String(body ?? '').split(/\r?\n/);
  const i = lines.findIndex((l) => /^## Self-review\s*$/i.test(l));
  if (i < 0) return false;
  for (const l of lines.slice(i + 1)) {
    if (/^#{1,2} /.test(l)) return false;
    if (l.trim() !== '') return true;
  }
  return false;
}

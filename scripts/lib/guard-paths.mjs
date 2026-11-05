// scripts/lib/guard-paths.mjs -- the ONE shared guard-path check (slice 2, drill A18; section 14.1;
// docs/automation-foundations.md). Read before editing: this file is itself a GUARD path.
//
// isGuardPath(p) is true for a path no auto path may merge without the owner: the globs in
// .github/automation/guard-paths.json PLUS the lists the merge lane already owns, IMPORTED from
// scripts/lib/autopilot-merge.mjs (GOVERNANCE prose, isAgentInstructionPath), never copied here.
// Every auto path (the lane's mergeVerdict, bot-automerge's classify(), the Dependabot lane's
// scripts/automation-money-check.mjs) calls guardRefusals() immediately before acting and refuses
// with `guard-path refused: <path>`.
//
// PURE apart from reading the list once at load (Node built-ins only). FAIL CLOSED: an unreadable
// list guards EVERY path; an empty, absolute, backslash or ./.. path is guarded; matching is
// case-insensitive (a Windows checkout is), so the check can only over-block.
import { readFileSync } from 'node:fs';
import { GOVERNANCE, isAgentInstructionPath } from './autopilot-merge.mjs';

export const GUARD_PATHS_PATH = '.github/automation/guard-paths.json';

/** `**` = any depth (including none), `*` = within one segment. Anchored, case-insensitive. */
export function globToRegExp(glob) {
  let re = '';
  const g = String(glob);
  for (let i = 0; i < g.length; i++) {
    const c = g[i];
    if (c === '*' && g[i + 1] === '*') { re += '.*'; i++; } else if (c === '*') re += '[^/]*';
    else re += c.replace(/[.+?^${}()|[\]\\]/g, '\\$&');
  }
  return new RegExp(`^${re}$`, 'i');
}

/** -> { globs, res }. Throws on anything but a version-1 object with a non-empty string array. */
export function parseGuardPaths(text) {
  const doc = JSON.parse(text);
  if (!doc || typeof doc !== 'object' || Array.isArray(doc) || doc.version !== 1) throw new Error('guard-paths.json: not a version 1 object');
  if (!Array.isArray(doc.globs) || !doc.globs.length || !doc.globs.every((g) => typeof g === 'string' && g.trim() === g && g !== '')) throw new Error('guard-paths.json: globs must be a non-empty list of strings');
  return { globs: doc.globs, res: doc.globs.map(globToRegExp) };
}

let LOADED = null;
let LOAD_ERROR = '';
try {
  LOADED = parseGuardPaths(readFileSync(new URL('../../.github/automation/guard-paths.json', import.meta.url), 'utf8'));
} catch (e) {
  LOADED = null; // isGuardPath() then guards everything (fail closed); the reason is exported for logs
  LOAD_ERROR = e && e.message ? e.message : String(e);
}
export const guardListError = () => LOAD_ERROR;

/** True = the automation may never merge a PR touching `p`. `list` = parseGuardPaths() result (null = unreadable). */
export function isGuardPath(p, list = LOADED) {
  if (!list || !Array.isArray(list.res)) return true;
  if (typeof p !== 'string' || p === '') return true;
  if (/[\\\0]/.test(p) || p.startsWith('/') || p.split('/').some((s) => s === '' || s === '.' || s === '..')) return true;
  if (GOVERNANCE.has(p.toLowerCase()) || isAgentInstructionPath(p)) return true;
  return list.res.some((re) => re.test(p));
}

/** One `guard-path refused: <path>` per distinct guarded path, in input order. */
export function guardRefusals(paths, list = LOADED) {
  const out = [];
  for (const p of Array.isArray(paths) ? paths : [null]) {
    const r = `guard-path refused: ${p}`;
    if (isGuardPath(p, list) && !out.includes(r)) out.push(r);
  }
  return out;
}

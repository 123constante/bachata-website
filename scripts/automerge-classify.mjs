#!/usr/bin/env node
/**
 * automerge-classify.mjs -- decides whether a PR may be AUTO-merged by
 * .github/workflows/bot-automerge.yml. Behaviour, settings and the survey that
 * sized it: docs/automerge.md.
 *
 * FAIL CLOSED. The answer is "qualifies" only when EVERY rule below holds; any
 * missing field, unexpected shape or unknown path is a refusal, never a pass.
 *
 *   1. author is the bot (BOT_LOGIN); not draft; base is main
 *   2. no 'needs-owner' label
 *   3. the file list is complete (listed count == the PR's changed_files) and
 *      non-empty
 *   4. EVERY path -- for a rename, BOTH the old and the new name -- is on the
 *      ALLOWLIST (docs, markdown, test files) and on NONE of the BLOCKLIST
 *      (shipped code, deploy/build config, CI, guards, auth). Block wins.
 *   5. no test file is DELETED (deleting a test is a gate change, not a test change)
 *   6. additions + deletions < LINE_CAP
 *   7. when the real-data-verified check (PR #658) exists on the base branch, the
 *      body must pass ITS parser -- this file never re-implements or loosens it
 *
 * classify() is PURE (no I/O) so tests/automergeClassify.test.ts can drive it.
 * The CLI reads the PR and its file list as JSON fetched by the workflow through
 * the GitHub API; it never reads the PR's checkout (there is none).
 *
 * Exit codes: 0 qualifies, 1 does not qualify, 2 cannot run (bad/missing input).
 *
 *   node scripts/automerge-classify.mjs --pr pr.json --files files.json [--real-data-parser path]
 */
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { isEntryPoint } from './lib/entry-point.mjs';

export const BOT_LOGIN = 'kiki-claude-bot';
export const BASE_BRANCH = 'main';
export const HOLD_LABEL = 'needs-owner';
export const LINE_CAP = 400;

// Matched case-insensitively against the WHOLE posix path. A path on this list
// never qualifies, whatever else it matches.
export const BLOCKLIST = [
  [/^(src|app|api|server|public|supabase|scripts|bin)\//i, 'shipped code / guard surface'],
  [/^\.(github|githooks|claude|husky|vercel)\//i, 'CI, hooks or agent config'],
  [/(^|\/)middleware\.[cm]?[jt]sx?$/i, 'middleware'],
  [/(^|\/)(package(-lock)?\.json|npm-shrinkwrap\.json|\.npmrc|\.nvmrc|yarn\.lock|pnpm-lock\.yaml)$/i, 'dependency manifest'],
  [/(^|\/)vercel[^/]*\.json$/i, 'Vercel config'],
  [/(^|\/)(vite|vitest|react-router|playwright|tailwind|postcss|eslint)\.config\.[^/]+$/i, 'build/test config'],
  [/(^|\/)tsconfig[^/]*\.json$/i, 'TypeScript config'],
  [/(^|\/)\.env[^/]*$/i, 'environment file'],
  [/(^|\/)(CLAUDE|AGENTS)\.md$/i, 'agent operating rules (owner decision, see docs/automerge.md)'],
  // Any non-markdown path naming login/auth. A .md ABOUT auth is prose, not a login file.
  [/^(?!.*\.md$).*(auth|login|logout|signin|sign-in|signup|otp|session|password|magic-?link)/i, 'login/auth file'],
  [/^tests\/(helpers|fixtures|client|setup)\//i, 'test support module (may be imported outside tests)'],
];

const TEST_FILE = /\.(test|spec)\.(ts|tsx|mts|cts|js|mjs|cjs)$/i;

// The allowlist. Each entry is [class, predicate]; first match names the class.
export const ALLOWLIST = [
  ['docs', (p) => /^docs\//.test(p)],
  ['markdown', (p) => /\.md$/i.test(p)],
  ['test', (p) => /^(tests|e2e)\//.test(p) && (TEST_FILE.test(p) || /\/__snapshots__\/[^/]+\.snap$/.test(p))],
  ['test', (p) => /(^|\/)__tests__\//.test(p) && TEST_FILE.test(p)],
  ['test', (p) => TEST_FILE.test(p)],
];

/** A path is only judged if it is already in canonical form. Anything that needs
 *  normalising (.., ., //, backslash, leading /, control chars) is refused, so
 *  "docs/../src/x.ts" can never be read as a docs path. */
export function malformed(p) {
  if (typeof p !== 'string' || p === '') return 'empty or non-string path';
  if (/[\x00-\x1f\x7f\\]/.test(p)) return 'control character or backslash';
  if (p.startsWith('/')) return 'absolute path';
  if (p.split('/').some((seg) => seg === '' || seg === '.' || seg === '..')) return 'non-canonical segment';
  return null;
}

/** @returns {{ok: true, cls: string} | {ok: false, why: string}} */
export function judgePath(p) {
  const bad = malformed(p);
  if (bad) return { ok: false, why: bad };
  for (const [re, why] of BLOCKLIST) if (re.test(p)) return { ok: false, why };
  for (const [cls, test] of ALLOWLIST) if (test(p)) return { ok: true, cls };
  return { ok: false, why: 'not on the allowlist' };
}

/**
 * @param {object} pr GitHub REST pull object (user.login, draft, base.ref, labels, body, changed_files)
 * @param {Array<object>} files GitHub REST pulls/{n}/files entries
 * @param {{realDataParse?: (body: string) => {ok: boolean, problems?: string[]}}} [opts]
 * @returns {{qualifies: boolean, reasons: string[], classes: string[], lines: number}}
 */
export function classify(pr, files, opts = {}) {
  const reasons = [];
  const classes = new Set();
  let lines = 0;
  if (!pr || typeof pr !== 'object') return { qualifies: false, reasons: ['no PR object'], classes: [], lines };
  const author = pr.user && pr.user.login;
  if (author !== BOT_LOGIN) reasons.push(`author is ${JSON.stringify(author)}, not ${BOT_LOGIN}`);
  if (pr.draft !== false) reasons.push('draft (or draft state unknown)');
  if (!pr.base || pr.base.ref !== BASE_BRANCH) reasons.push(`base is not ${BASE_BRANCH}`);
  if (!Array.isArray(pr.labels)) reasons.push('labels unknown');
  else if (pr.labels.some((l) => (l && l.name || '').toLowerCase() === HOLD_LABEL)) reasons.push(`labelled ${HOLD_LABEL}`);

  if (!Array.isArray(files) || files.length === 0) {
    reasons.push('no changed files listed');
  } else {
    if (pr.changed_files !== files.length) {
      reasons.push(`file list incomplete (${files.length} listed, PR reports ${pr.changed_files})`);
    }
    for (const f of files) {
      const names = [f && f.filename];
      if (f && (f.status === 'renamed' || f.previous_filename != null)) names.push(f.previous_filename);
      for (const n of names) {
        const v = judgePath(n);
        if (v.ok) classes.add(v.cls);
        else reasons.push(`${JSON.stringify(n)}: ${v.why}`);
      }
      if (f && f.status === 'removed' && TEST_FILE.test(String(f.filename))) {
        reasons.push(`${JSON.stringify(f.filename)}: deletes a test file`);
      }
      const a = f && f.additions, d = f && f.deletions;
      if (!Number.isInteger(a) || !Number.isInteger(d) || a < 0 || d < 0) {
        reasons.push(`${JSON.stringify(f && f.filename)}: line counts missing`);
      } else {
        lines += a + d;
      }
    }
    if (lines >= LINE_CAP) reasons.push(`${lines} changed lines (cap is under ${LINE_CAP})`);
  }

  if (opts.realDataParse) {
    let verdict;
    try {
      verdict = opts.realDataParse(typeof pr.body === 'string' ? pr.body : '');
    } catch (e) {
      verdict = { ok: false, problems: [`real-data parser threw: ${e.message}`] };
    }
    if (!verdict || verdict.ok !== true) {
      reasons.push(`"## Verified on real data" section fails the real-data-verified check: ${(verdict && verdict.problems || []).join('; ')}`);
    }
  }

  return { qualifies: reasons.length === 0, reasons, classes: [...classes].sort(), lines };
}

function readJson(file, what) {
  if (!file) throw new Error(`--${what} <file> is required`);
  return JSON.parse(fs.readFileSync(file, 'utf8'));
}

async function main(argv) {
  const arg = (name) => {
    const i = argv.indexOf(`--${name}`);
    return i >= 0 ? argv[i + 1] : undefined;
  };
  let pr, files, realDataParse;
  try {
    pr = readJson(arg('pr'), 'pr');
    files = readJson(arg('files'), 'files');
    // gh api --paginate --slurp yields an array of pages; flatten one level.
    if (Array.isArray(files) && files.every(Array.isArray)) files = files.flat();
    const parserPath = arg('real-data-parser');
    if (parserPath && fs.existsSync(parserPath)) {
      const mod = await import(pathToFileURL(path.resolve(parserPath)).href);
      if (typeof mod.parse !== 'function') throw new Error(`${parserPath} exports no parse()`);
      realDataParse = mod.parse;
    }
  } catch (e) {
    console.error(`automerge-classify: cannot run: ${e.message}`);
    return 2;
  }
  const v = classify(pr, files, { realDataParse });
  console.log(`PR #${pr.number}: ${v.qualifies ? 'QUALIFIES' : 'does not qualify'} (classes: ${v.classes.join(', ') || 'none'}; ${v.lines} lines; real-data check ${realDataParse ? 'enforced' : 'not on base'})`);
  for (const r of v.reasons) console.log(`  - ${r}`);
  return v.qualifies ? 0 : 1;
}

if (isEntryPoint(import.meta.url)) {
  main(process.argv.slice(2)).then(
    (code) => { process.exitCode = code; },
    (e) => { console.error(`automerge-classify: cannot run: ${e.stack || e}`); process.exitCode = 2; },
  );
}

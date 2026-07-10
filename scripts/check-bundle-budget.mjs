#!/usr/bin/env node
// First-load JS budget guard (perf programme, Pillar D — "stays fast").
//
// Reads the CLIENT build manifest (build/client/.vite/manifest.json — emitted
// because vite.config.ts sets build.manifest for the client build only), walks
// the STATIC import graph from each budgeted route's entry modules (dynamic
// imports are lazy-loaded, so they are not first-load bytes), gzips every
// reached JS chunk, and compares each route's total against the committed
// budgets in perf-budgets.json.
//
// Budgets are calibrated to measured post-Phase-1 reality plus ~10% headroom.
// If this trips, either a heavy dependency crept into the first-load graph
// (fix the import) or the growth is deliberate (raise the budget in the same
// PR and justify it in the PR description).
//
//   npm run build          # must run first — the manifest is a build artifact
//   npm run check:bundle-budget
//
// Exit 1 if any route is over budget. The perf-budget workflow runs this
// WARN-ONLY (continue-on-error) until Phase 4 flips it to blocking.

import { readFileSync, existsSync, appendFileSync } from 'node:fs';
import { gzipSync } from 'node:zlib';
import path from 'node:path';

const ROOT = process.cwd();
const CLIENT_DIR = path.join(ROOT, 'build', 'client');
const MANIFEST_PATH = path.join(CLIENT_DIR, '.vite', 'manifest.json');
const BUDGETS_PATH = path.join(ROOT, 'perf-budgets.json');

// React Router's Vite plugin registers each route module under a querystring
// variant of its source path. perf-budgets.json lists plain source paths;
// resolve both forms here so the JSON stays readable.
const RR_ROUTE_SUFFIX = '?__react-router-build-client-route';

const fail = (msg) => {
  console.error(`\nbundle-budget check FAILED\n  ${msg}\n`);
  process.exit(1);
};

if (!existsSync(MANIFEST_PATH)) {
  fail(
    `No client manifest at ${path.relative(ROOT, MANIFEST_PATH)}. ` +
      'Run `npm run build` first (vite.config.ts emits the manifest for the client build).',
  );
}

const manifest = JSON.parse(readFileSync(MANIFEST_PATH, 'utf8'));
const budgets = JSON.parse(readFileSync(BUDGETS_PATH, 'utf8'));

function resolveKey(entry) {
  if (manifest[entry]) return entry;
  const rrKey = `${entry}${RR_ROUTE_SUFFIX}`;
  if (manifest[rrKey]) return rrKey;
  const near = Object.keys(manifest).filter((k) =>
    k.includes(path.posix.basename(entry)),
  );
  fail(
    `perf-budgets.json entry "${entry}" is not in the client manifest. ` +
      'Was the file renamed/moved? Update perf-budgets.json to match.' +
      (near.length ? `\n  Near-matches: ${near.join(', ')}` : ''),
  );
}

/** All manifest nodes reachable from the given entries via STATIC imports. */
function reachable(entries) {
  const seen = new Set();
  const queue = entries.map(resolveKey);
  while (queue.length) {
    const key = queue.pop();
    if (seen.has(key)) continue;
    seen.add(key);
    for (const imp of manifest[key].imports ?? []) queue.push(imp);
  }
  return seen;
}

const gzCache = new Map();
function gzipBytes(file) {
  if (!gzCache.has(file)) {
    gzCache.set(file, gzipSync(readFileSync(path.join(CLIENT_DIR, file))).length);
  }
  return gzCache.get(file);
}

const kb = (bytes) => bytes / 1024;
const fmtKB = (bytes) => `${kb(bytes).toFixed(1)} KB`;

let anyOver = false;
const summaryLines = [
  '## First-load JS budgets',
  '',
  '| Route | First-load JS (gzip) | Budget | Status |',
  '|---|---|---|---|',
];

for (const [route, { entries, maxFirstLoadGzipKB }] of Object.entries(budgets.routes)) {
  const files = [...new Set([...reachable(entries)].map((k) => manifest[k].file))].filter(
    (f) => f.endsWith('.js'),
  );
  const sized = files
    .map((f) => ({ file: f, bytes: gzipBytes(f) }))
    .sort((a, b) => b.bytes - a.bytes);
  const total = sized.reduce((sum, s) => sum + s.bytes, 0);
  const over = kb(total) > maxFirstLoadGzipKB;
  anyOver ||= over;

  const status = over ? 'OVER BUDGET' : 'ok';
  console.log(
    `\n[${status}] ${route}: ${fmtKB(total)} first-load JS across ${sized.length} files ` +
      `(budget ${maxFirstLoadGzipKB} KB)`,
  );
  console.log('  largest chunks:');
  for (const { file, bytes } of sized.slice(0, 10)) {
    console.log(`    ${fmtKB(bytes).padStart(9)}  ${file}`);
  }

  summaryLines.push(
    `| ${route} | ${fmtKB(total)} (${sized.length} files) | ${maxFirstLoadGzipKB} KB | ${
      over ? 'OVER' : 'ok'
    } |`,
  );
}

if (process.env.GITHUB_STEP_SUMMARY) {
  appendFileSync(process.env.GITHUB_STEP_SUMMARY, summaryLines.join('\n') + '\n');
}

if (anyOver) {
  console.error(
    '\nOne or more routes exceed their first-load JS budget (perf-budgets.json). ' +
      'Either remove the weight from the static import graph or raise the budget ' +
      'deliberately in this PR with justification.',
  );
  process.exit(1);
}
console.log('\nAll first-load JS budgets respected.');

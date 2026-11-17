#!/usr/bin/env node
// Pick PWTEST_SHARD_WEIGHTS for the Phone QA suite from a real profile.
//   CI=1 npx playwright test --config playwright.phone.config.ts --list > list.txt
//   CI=1 PLAYWRIGHT_JSON_OUTPUT_NAME=phone.json npx playwright test --config playwright.phone.config.ts --workers=3 --reporter=json
//   node scripts/ci/phone-shard-weights.mjs list.txt phone.json <shards>
// Shards are contiguous slices of the list order (project-major, file order). Slice i gets
// floor(w_i * n / sum(w)) tests, the remainder goes to the first shards. The script searches
// small integer weights for the split with the smallest slowest shard and prints it.
import { readFileSync } from 'node:fs';

const [listPath, jsonPath, shardsArg] = process.argv.slice(2);
const k = Number(shardsArg);
if (!listPath || !jsonPath || !Number.isInteger(k) || k < 2) {
  console.error('usage: phone-shard-weights.mjs <list.txt> <phone.json> <shards>');
  process.exit(2);
}

// list order: "  [project] › path/file.ts:LINE:COL › title"
const keys = [];
for (const line of readFileSync(listPath, 'utf8').split(/\r?\n/)) {
  const m = line.match(/^\s*\[([^\]]+)\]\s+›\s+(\S+?):(\d+):\d+\s+›/);
  if (m) keys.push(`${m[1]}|${m[2]}:${m[3]}`);
}

// durations by the same key, queued in occurrence order (parameterised tests share a line)
const queues = new Map();
const walk = (suite) => {
  for (const spec of suite.specs ?? []) {
    for (const t of spec.tests ?? []) {
      const key = `${t.projectName}|${spec.file}:${spec.line}`;
      const ms = (t.results ?? []).reduce((a, r) => a + (r.duration ?? 0), 0);
      if (!queues.has(key)) queues.set(key, []);
      queues.get(key).push(ms / 1000);
    }
  }
  for (const s of suite.suites ?? []) walk(s);
};
for (const s of JSON.parse(readFileSync(jsonPath, 'utf8')).suites ?? []) walk(s);

const dur = keys.map((key) => (queues.get(key) ?? []).shift() ?? 0);
const n = dur.length;
const prefix = [0];
for (const d of dur) prefix.push(prefix[prefix.length - 1] + d);
const total = prefix[n];
const unmatched = [...queues.values()].reduce((a, q) => a + q.length, 0);
console.log(`tests=${n} test-seconds=${Math.round(total)} unmatched-json-tests=${unmatched}`);

const slices = (w) => {
  const sum = w.reduce((a, b) => a + b, 0);
  const sizes = w.map((x) => Math.floor((x * n) / sum));
  let rest = n - sizes.reduce((a, b) => a + b, 0);
  for (let i = 0; rest > 0; i = (i + 1) % k, rest--) sizes[i]++;
  return sizes;
};
const cost = (w) => {
  let at = 0;
  let worst = 0;
  const out = [];
  for (const s of slices(w)) {
    const t = prefix[at + s] - prefix[at];
    out.push(Math.round(t));
    worst = Math.max(worst, t);
    at += s;
  }
  return { worst, out };
};

let best = null;
const w = new Array(k).fill(1);
const MAX = k <= 5 ? 24 : 12;
const rec = (i) => {
  if (i === k) {
    const c = cost(w);
    if (!best || c.worst < best.worst - 1e-9) best = { ...c, w: [...w] };
    return;
  }
  for (let v = 1; v <= MAX; v++) {
    w[i] = v;
    rec(i + 1);
  }
};
rec(0);
console.log(`PWTEST_SHARD_WEIGHTS: '${best.w.join(':')}'`);
console.log(`slice test-seconds: ${best.out.join('/')} (equal-split ideal ${Math.round(total / k)})`);
console.log(`equal weights: ${cost(new Array(k).fill(1)).out.join('/')}`);

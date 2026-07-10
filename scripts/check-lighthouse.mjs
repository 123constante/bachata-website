#!/usr/bin/env node
// Lighthouse mobile budget guard (perf programme, Pillar D — "stays fast").
//
// Runs Lighthouse (mobile emulation, simulated 4G) against a deployed base URL
// for the three representative surfaces — the homepage, a landing page, and one
// event-detail page — and asserts the field-quality metrics that matter for the
// ~95%-mobile audience:
//
//   LCP <= 2500 ms   TBT <= 200 ms   CLS <= 0.10
//
// The event URL is discovered from the deployed sitemap so the check self-heals
// when individual events are retired; if none is found the event audit is
// skipped with a warning rather than failing.
//
//   LH_BASE_URL   base URL to audit (Vercel preview URL in CI)
//
// Runs WARN-ONLY in the perf-budget workflow (continue-on-error) until Phase 4
// flips it to blocking, so a breach here surfaces as a PR annotation, not a red
// check. Exit 1 on any breach so the blocking flip is a one-line workflow edit.

import { execFileSync } from 'node:child_process';
import { appendFileSync } from 'node:fs';
import { createRequire } from 'node:module';

const BASE = (process.env.LH_BASE_URL ?? '').replace(/\/$/, '');
if (!BASE) {
  console.error('LH_BASE_URL is not set (need the deployed base URL to audit).');
  process.exit(1);
}

// [label, path] — homepage redirects "/" -> "/city/london-gb" (vercel.json), so
// audit the real destination to avoid measuring the redirect hop.
const FIXED_TARGETS = [
  ['homepage', '/city/london-gb'],
  ['landing', '/london-bachata-guide'],
];

// gz-thresholds are in the units Lighthouse reports (ms for timings, unitless
// for CLS). Keep in sync with the header comment.
const BUDGETS = {
  'largest-contentful-paint': { label: 'LCP', max: 2500, unit: 'ms' },
  'total-blocking-time': { label: 'TBT', max: 200, unit: 'ms' },
  'cumulative-layout-shift': { label: 'CLS', max: 0.1, unit: '' },
};

// Resolve Lighthouse's CLI entry and run it with the current node binary rather
// than the node_modules/.bin shim. The shim is a .cmd on Windows, and since the
// Node fix for CVE-2024-27980, spawning a .cmd via execFile WITHOUT a shell
// throws EINVAL — which the per-target try/catch below would swallow, silently
// skipping every audit and reporting a false pass on a local Windows run.
// `node cli/index.js` is spawn-safe and identical on Linux CI and Windows, and
// (unlike shell:true) preserves the space-containing --chrome-flags argument.
const LH_CLI = createRequire(import.meta.url).resolve('lighthouse/cli/index.js');

async function discoverEventUrl() {
  try {
    const res = await fetch(`${BASE}/sitemap.xml`, { redirect: 'follow' });
    if (!res.ok) return null;
    const xml = await res.text();
    const locs = [...xml.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1]);
    const ev = locs.find((u) => u.includes('/event/'));
    return ev ? ev.replace(/^https?:\/\/[^/]+/, '') : null;
  } catch {
    return null;
  }
}

function runLighthouse(url) {
  const out = execFileSync(
    process.execPath,
    [
      LH_CLI,
      url,
      '--only-categories=performance',
      '--form-factor=mobile',
      '--screenEmulation.mobile',
      '--throttling-method=simulate',
      '--chrome-flags=--headless=new --no-sandbox --disable-gpu',
      '--output=json',
      '--output-path=stdout',
      '--quiet',
    ],
    { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 },
  );
  return JSON.parse(out);
}

function auditTarget(label, pathname) {
  const url = `${BASE}${pathname}`;
  console.log(`\n[${label}] Lighthouse mobile: ${url}`);
  let report;
  try {
    report = runLighthouse(url);
  } catch (e) {
    console.log(`  warn: lighthouse run failed (${e?.message ?? e}) — skipping`);
    return { label, url, breaches: [], rows: [], skipped: true };
  }

  const breaches = [];
  const rows = [];
  for (const [auditId, { label: metric, max, unit }] of Object.entries(BUDGETS)) {
    const value = report.audits?.[auditId]?.numericValue;
    if (value == null) {
      console.log(`  warn: ${metric} missing from report`);
      continue;
    }
    const shown = unit === 'ms' ? `${Math.round(value)} ms` : value.toFixed(3);
    const budget = unit === 'ms' ? `${max} ms` : max.toFixed(2);
    const over = value > max;
    if (over) breaches.push(`${metric} ${shown} > ${budget}`);
    console.log(`  ${over ? 'OVER' : 'ok  '} ${metric}: ${shown} (budget ${budget})`);
    rows.push({ metric, shown, budget, over });
  }
  return { label, url, breaches, rows, skipped: false };
}

async function main() {
  const targets = [...FIXED_TARGETS];
  const eventPath = await discoverEventUrl();
  if (eventPath) targets.push(['event', eventPath]);
  else console.log('note: no /event/ URL found in sitemap — event audit skipped');

  const results = targets.map(([label, p]) => auditTarget(label, p));

  const summary = ['## Lighthouse mobile budgets', '', '| Page | Metric | Value | Budget | Status |', '|---|---|---|---|---|'];
  for (const r of results) {
    if (r.skipped) {
      summary.push(`| ${r.label} | — | — | — | skipped |`);
      continue;
    }
    for (const row of r.rows) {
      summary.push(`| ${r.label} | ${row.metric} | ${row.shown} | ${row.budget} | ${row.over ? 'OVER' : 'ok'} |`);
    }
  }
  if (process.env.GITHUB_STEP_SUMMARY) {
    appendFileSync(process.env.GITHUB_STEP_SUMMARY, summary.join('\n') + '\n');
  }

  // Never let a wholesale failure masquerade as a pass: if not a single target
  // actually produced a report (e.g. the binary couldn't spawn), report failure
  // rather than the reassuring "all budgets respected".
  const ranCount = results.filter((r) => !r.skipped).length;
  if (ranCount === 0) {
    console.error('\nLighthouse produced no results — every target was skipped (binary failed to run?). Not reporting a pass.');
    process.exit(1);
  }

  const totalBreaches = results.flatMap((r) => r.breaches);
  if (totalBreaches.length) {
    console.error(`\n${totalBreaches.length} Lighthouse budget breach(es):`);
    for (const b of totalBreaches) console.error(`  - ${b}`);
    process.exit(1);
  }
  console.log(`\nAll Lighthouse mobile budgets respected (${ranCount} page(s) audited).`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

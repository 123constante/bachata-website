#!/usr/bin/env node
// Lighthouse mobile budget guard (perf programme, Pillar D -- "stays fast").
//
// Runs Lighthouse (mobile emulation, simulated 4G) against a deployed base URL
// for the three representative surfaces -- the homepage, a landing page, and one
// event-detail page -- and asserts the field-quality metrics that matter for the
// ~95%-mobile audience:
//
//   LCP <= 2500 ms   TBT <= 200 ms   CLS <= 0.10
//
// The event URL is discovered from the deployed sitemap so the check self-heals
// when individual events are retired; if none is found the event audit is
// skipped with a warning rather than failing.
//
// Base URL: LH_BASE_URL if set (explicit target, e.g. prod for a local run),
// otherwise the PR's Vercel preview is resolved first-party via the GitHub
// Deployments API (previewProbe) — no third-party wait action. Protected previews
// are reached with the Vercel Protection-Bypass headers, applied to Lighthouse's
// requests via --extra-headers (CDP Network.setExtraHTTPHeaders → document AND
// every subresource) and to the sitemap fetch.
//
// Anti-masking: two distinct failure classes.
//   - INFRA ("couldn't measure a mandatory target"): ALWAYS a hard failure
//     (exit 1). This is what the dead-Lighthouse era hid behind continue-on-error.
//     ONE narrow exception: a positively-PROVEN Deployment Protection wall on the
//     self-resolved PR preview (401/403 or parked on Vercel's login surface)
//     skips green with a ::warning:: — no code change can open that wall, and
//     the warning states plainly that zero perf was measured. Timeouts, DNS
//     death, and broken previews are NOT the exception; they stay hard red.
//   - BUDGET ("measured, but over budget"): warn-only until LH_ENFORCE=1 flips it
//     to blocking (that flip is Phase 4 — a deliberate env switch, not the
//     accident of removing the job's infra-health guard).

import { execFileSync } from 'node:child_process';
import { appendFileSync, writeFileSync, mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createRequire } from 'node:module';
import {
  resolvePreviewUrl,
  bypassHeaders,
  assertMeasured,
  isPreviewHost,
  previewIsWalled,
} from './lib/previewProbe.mjs';

const EXPLICIT_BASE = (process.env.LH_BASE_URL ?? '').replace(/\/$/, '');
// Resolved in main(): the explicit base, or the PR preview. The bypass headers
// and their temp-file path (for --extra-headers) are set alongside it.
let BASE = EXPLICIT_BASE;
let BYPASS = null;
let extraHeadersPath = null;

// [label, path] -- homepage redirects "/" -> "/city/london-gb" (vercel.json), so
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
// throws EINVAL -- which the per-target try/catch below would swallow, silently
// skipping every audit and reporting a false pass on a local Windows run.
// `node cli/index.js` is spawn-safe and identical on Linux CI and Windows, and
// (unlike shell:true) preserves the space-containing --chrome-flags argument.
const LH_CLI = createRequire(import.meta.url).resolve('lighthouse/cli/index.js');

async function discoverEventUrl() {
  try {
    const res = await fetch(`${BASE}/sitemap.xml`, { redirect: 'follow', headers: BYPASS ?? undefined });
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
      // Bypass Vercel Deployment Protection on ALL requests. A file PATH (not
      // inline JSON) keeps the secret off argv, which execFileSync echoes in
      // thrown errors the per-target catch logs.
      ...(extraHeadersPath ? [`--extra-headers=${extraHeadersPath}`] : []),
      '--chrome-flags=--headless=new --no-sandbox --disable-gpu',
      '--output=json',
      '--output-path=stdout',
      '--quiet',
    ],
    // timeout: a hung Lighthouse run must fail this target (caught by the
    // per-target try/catch) instead of blocking to the job timeout and
    // starving the remaining audits.
    { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024, timeout: 120_000 },
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
    console.log(`  warn: lighthouse run failed (${e?.message ?? e}) -- skipping`);
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
  // Resolve the target base URL and the protection bypass. When no explicit
  // LH_BASE_URL is given we resolve the PR preview first-party; a protected
  // preview then REQUIRES the bypass secret (previewProbe throws in CI if absent),
  // so a MISSING secret fails loudly. A present-but-genuinely-rejected secret is
  // the walled-preview skip's job, below.
  BASE = EXPLICIT_BASE || (await resolvePreviewUrl());
  BYPASS = bypassHeaders({ required: !EXPLICIT_BASE });
  console.log(`Lighthouse base: ${BASE}${BYPASS ? ' (protection bypass active)' : ''}`);

  // A PROVEN Deployment Protection wall (401/403 or parked on Vercel's login
  // surface — see previewIsWalled) is an AUTH failure, not a perf failure. Skip
  // green with a warning rather than audit the SSO login page. Only for the
  // self-resolved PR preview: an EXPLICIT base was deliberately requested, so a
  // wall there must stay loud. Transients/broken previews are NOT walled and
  // fail loud via assertMeasured. NOTE: nothing else measures perf — there is no
  // scheduled production Lighthouse run — so this skip means zero perf coverage
  // for the PR; the warning says so.
  if (!EXPLICIT_BASE && isPreviewHost(BASE) && (await previewIsWalled(BASE, { bypass: BYPASS }))) {
    console.log(
      '::warning title=Lighthouse preview skipped::The Vercel preview is behind ' +
        'Deployment Protection and the automation bypass did not open it, so NO ' +
        'performance metrics were collected for this PR (no scheduled production ' +
        'perf run exists to fall back on). Fix the bypass to restore coverage: ' +
        'Vercel -> Settings -> Deployment Protection -> Protection Bypass for Automation, ' +
        'and mirror the value into the VERCEL_AUTOMATION_BYPASS_SECRET Actions secret.',
    );
    console.log('Skipped: preview behind Deployment Protection (proven wall).');
    return;
  }

  // Written only once we know we'll audit — the skip path must not leave an
  // unused secret-bearing temp file behind.
  if (BYPASS) {
    extraHeadersPath = join(mkdtempSync(join(tmpdir(), 'lh-hdr-')), 'headers.json');
    writeFileSync(extraHeadersPath, JSON.stringify(BYPASS));
  }

  const targets = [...FIXED_TARGETS];
  const eventPath = await discoverEventUrl();
  if (eventPath) targets.push(['event', eventPath]);
  else console.log('note: no /event/ URL found in sitemap -- event audit skipped');

  const results = targets.map(([label, p]) => auditTarget(label, p));

  const summary = ['## Lighthouse mobile budgets', '', '| Page | Metric | Value | Budget | Status |', '|---|---|---|---|---|'];
  for (const r of results) {
    if (r.skipped) {
      summary.push(`| ${r.label} | -- | -- | -- | skipped |`);
      continue;
    }
    for (const row of r.rows) {
      summary.push(`| ${r.label} | ${row.metric} | ${row.shown} | ${row.budget} | ${row.over ? 'OVER' : 'ok'} |`);
    }
  }
  if (process.env.GITHUB_STEP_SUMMARY) {
    appendFileSync(process.env.GITHUB_STEP_SUMMARY, summary.join('\n') + '\n');
  }

  // INFRA guard (fail-loud, always): the mandatory targets MUST have produced
  // real metrics. A skipped/empty mandatory target means we measured nothing --
  // exactly the dead-Lighthouse failure that continue-on-error used to hide.
  // assertMeasured throws -> main().catch -> exit 1, regardless of LH_ENFORCE.
  const MANDATORY = new Set(['homepage', 'landing']);
  const measuredMandatory = results.filter(
    (r) => MANDATORY.has(r.label) && !r.skipped && r.rows.length > 0,
  ).length;
  assertMeasured(measuredMandatory, MANDATORY.size, 'mandatory Lighthouse targets');

  // BUDGET guard: warn-only until LH_ENFORCE=1 (Phase 4) makes it blocking.
  const ENFORCE = process.env.LH_ENFORCE === '1';
  const totalBreaches = results.flatMap((r) => r.breaches);
  if (totalBreaches.length) {
    const lines = totalBreaches.map((b) => `  - ${b}`).join('\n');
    if (ENFORCE) {
      console.error(`\n${totalBreaches.length} Lighthouse budget breach(es):\n${lines}`);
      process.exit(1);
    }
    console.warn(
      `\nWARN: ${totalBreaches.length} Lighthouse budget breach(es) (warn-only until LH_ENFORCE=1):\n${lines}`,
    );
  }
  console.log(
    `\nLighthouse measured ${measuredMandatory}/${MANDATORY.size} mandatory targets` +
      `${totalBreaches.length ? ` with ${totalBreaches.length} budget warning(s)` : ' — all budgets respected'}.`,
  );
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

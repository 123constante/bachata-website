#!/usr/bin/env node
// scripts/perf-ab.mjs -- 3-run Lighthouse mobile medians against the local
// production build (PR 0.0 of the site-performance arc). `npm run perf:ab`.
//
// Builds (unless --skip-build), serves build/ via _serve-build.mjs, then runs
// Lighthouse (mobile emulation, simulated 4G -- the exact flag set CI's
// check-lighthouse.mjs uses) N times per surface and reports the per-metric
// MEDIAN. Single runs are direction, not data: the 2026-07-27 sweep's two CLS
// figures were the noisiest metrics in the set, which is why this exists.
//
// Every invocation writes:
//   perf/ab/<label>.json        medians + per-run values (committable)
//   perf/ab/raw/<label>/*.json  full Lighthouse reports (gitignored; cleared
//                               per invocation; keep for waterfall/LCP-element
//                               verification per PR)
//
// A/B usage: run once per build with distinct labels, then compare:
//   node scripts/perf-ab.mjs --label main
//   node scripts/perf-ab.mjs --label my-branch --against main
//
// Flags:
//   --runs N          runs per surface (default 3)
//   --label NAME      result label (default <branch>-<shortsha>)
//   --against NAME    print a delta table vs perf/ab/<NAME>.json
//   --skip-build      reuse the existing build/ output
//   --base URL        audit a deployed origin instead of the local build
//                     (implies --skip-build; e.g. prod with LH_BASE_URL parity)
//   --event-path P    /event/<slug> to audit (default: first /event/ in the
//                     sitemap; with --against and no explicit path, the
//                     before-run's event page is reused so the delta compares
//                     like with like)
//   --routes CSV      override the surface list (paths; keys derived)
//   --port N          preferred local port (default 4173)
//
// Caveat carried from PR #143: Lighthouse absolutes are machine-dependent.
// Only same-machine comparisons are valid deltas; the medians here are for
// A/B on this box and for direction vs CI, not for quoting against prod RUM.

import { spawn, execSync } from 'node:child_process';
import { mkdirSync, readFileSync, rmSync, writeFileSync, existsSync } from 'node:fs';
import { join, resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';

// Re-exec under the production export condition BEFORE anything else runs
// (including the ./_serve-build.mjs import below): react-router resolves
// dist/development/ under plain `node`, and react/react-dom pick dev/prod off
// NODE_ENV -- without this the "production build" SSRs through dev-mode React
// and every timing this whole harness exists to measure is skewed.
if (!process.execArgv.includes('--conditions=production')) {
  const { spawnSync } = await import('node:child_process');
  const r = spawnSync(
    process.execPath,
    ['--conditions=production', ...process.argv.slice(1)],
    { stdio: 'inherit', cwd: process.cwd(), env: { ...process.env, NODE_ENV: 'production' } },
  );
  process.exit(r.status ?? 1);
}

const { startServer } = await import('./_serve-build.mjs');

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const OUT_DIR = join(ROOT, 'perf', 'ab');
const RUN_TIMEOUT_MS = 300_000;

// Same rationale as check-lighthouse.mjs: spawn the CLI entry with the current
// node binary -- the node_modules/.bin shim is a .cmd on Windows and EINVALs
// under execFile without a shell.
const LH_CLI = createRequire(import.meta.url).resolve('lighthouse/cli/index.js');

// The Phase 0 baseline surfaces (plan PR 0.0). `event` is resolved at runtime
// from the sitemap so the harness self-heals as events are retired.
const DEFAULT_SURFACES = [
  ['home', '/city/london-gb'],
  ['calendar', '/city/london-gb/calendar'],
  ['parties', '/parties'],
  ['festivals', '/festivals'],
  ['landing', '/london-bachata-guide'],
];

const METRICS = [
  ['score', null, (r) => (r.categories?.performance?.score ?? null) !== null ? Math.round(r.categories.performance.score * 100) : null],
  ['lcp', 'largest-contentful-paint'],
  ['fcp', 'first-contentful-paint'],
  ['tbt', 'total-blocking-time'],
  ['cls', 'cumulative-layout-shift'],
  ['si', 'speed-index'],
  ['ttfb', 'server-response-time'],
];

function parseArgs(argv) {
  const args = { runs: 3, port: 4173 };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--runs') args.runs = Number.parseInt(argv[++i], 10);
    else if (a === '--label') args.label = argv[++i];
    else if (a === '--against') args.against = argv[++i];
    else if (a === '--skip-build') args.skipBuild = true;
    else if (a === '--base') args.base = String(argv[++i]).replace(/\/$/, '');
    else if (a === '--event-path') args.eventPath = argv[++i];
    else if (a === '--routes') args.routes = argv[++i].split(',').map((s) => s.trim()).filter(Boolean);
    else if (a === '--port') args.port = Number.parseInt(argv[++i], 10);
    else throw new Error(`unknown flag: ${a}`);
  }
  if (!Number.isFinite(args.runs) || args.runs < 1) throw new Error('--runs must be >= 1');
  return args;
}

// Labels become file/dir names (perf/ab/<label>.json, perf/ab/raw/<label>/).
// A slash-bearing label (branch names!) would otherwise survive the whole
// sweep via mkdirSync({recursive}) and only crash at the summary write.
function sanitizeLabel(label) {
  return String(label).replace(/[^A-Za-z0-9._-]+/g, '-');
}

function defaultLabel() {
  try {
    const branch = execSync('git rev-parse --abbrev-ref HEAD', { cwd: ROOT, encoding: 'utf8' }).trim();
    const sha = execSync('git rev-parse --short HEAD', { cwd: ROOT, encoding: 'utf8' }).trim();
    return `${branch}-${sha}`;
  } catch {
    return `run-${Date.now()}`;
  }
}

async function discoverEventPath(base) {
  const ATTEMPTS = 4;
  let lastErr = 'unknown';
  for (let i = 1; i <= ATTEMPTS; i++) {
    try {
      const res = await fetch(`${base}/sitemap.xml`, { redirect: 'follow' });
      if (res.ok) {
        const xml = await res.text();
        const locs = [...xml.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1]);
        const ev = locs.find((u) => u.includes('/event/'));
        if (ev) return ev.replace(/^https?:\/\/[^/]+/, '');
        throw new Error('sitemap has no /event/ URLs');
      }
      lastErr = `HTTP ${res.status}`;
    } catch (e) {
      lastErr = e?.message ?? String(e);
    }
    if (i < ATTEMPTS) {
      console.log(`  sitemap attempt ${i}/${ATTEMPTS} failed (${lastErr}) -- retrying in 5s`);
      await new Promise((r) => setTimeout(r, 5000));
    }
  }
  throw new Error(`could not discover an /event/ path from ${base}/sitemap.xml: ${lastErr}`);
}

// Spawn (not execFileSync): execFileSync's own timeout TerminateProcess-kills
// only the direct node child on Windows -- no job object -- so the headless
// Chrome grandchild survives, holding its temp profile and an in-flight socket
// to our server. The self-managed timer kills the whole tree while it's alive.
function runLighthouse(url, rawPath) {
  return new Promise((resolveRun, rejectRun) => {
    const child = spawn(
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
        `--output-path=${rawPath}`,
        '--quiet',
      ],
      {
        cwd: ROOT,
        stdio: ['ignore', 'ignore', 'pipe'],
        detached: process.platform !== 'win32',
      },
    );
    let stderr = '';
    child.stderr.on('data', (d) => {
      stderr += d;
      if (stderr.length > 65536) stderr = stderr.slice(-32768);
    });
    let timedOut = false;
    const timer = setTimeout(() => {
      timedOut = true;
      try {
        if (process.platform === 'win32') {
          execSync(`taskkill /pid ${child.pid} /T /F`, { stdio: 'ignore' });
        } else {
          process.kill(-child.pid, 'SIGKILL');
        }
      } catch {
        /* tree already gone */
      }
    }, RUN_TIMEOUT_MS);
    child.on('error', (e) => {
      clearTimeout(timer);
      rejectRun(e);
    });
    child.on('close', (code) => {
      clearTimeout(timer);
      // The report file is the source of truth, not the exit code. Lighthouse
      // can complete a full, valid audit and STILL exit non-zero from a
      // post-audit failure in chrome-launcher's temp-profile cleanup
      // (destroyTmp) -- a Windows/Node-24 EBUSY-class race, empirically
      // confirmed here: runs that "failed" by exit code had complete reports
      // on disk with real metrics. Treating exit code as the pass/fail signal
      // silently discarded 15 of 18 runs in the first baseline sweep.
      let report = null;
      try {
        report = JSON.parse(readFileSync(rawPath, 'utf8'));
      } catch {
        /* no valid report -- fall through to the code/timeout error below */
      }
      const valid = report && report.categories?.performance != null && report.audits?.['largest-contentful-paint'];
      if (valid) {
        if (code !== 0) {
          console.log(`  (lighthouse exited ${code} after a complete audit -- chrome-launcher cleanup race, report kept)`);
        }
        return resolveRun(report);
      }
      if (timedOut) return rejectRun(new Error(`lighthouse timed out after ${RUN_TIMEOUT_MS / 1000}s (process tree killed)`));
      rejectRun(new Error(`lighthouse exited ${code} with no valid report: ${stderr.trim().slice(-500) || 'no stderr'}`));
    });
  });
}

function metricsOf(report) {
  const out = {};
  for (const [key, auditId, custom] of METRICS) {
    out[key] = custom ? custom(report) : report.audits?.[auditId]?.numericValue ?? null;
  }
  return out;
}

function lcpElementOf(report) {
  // Lighthouse 13 dropped the `largest-contentful-paint-element` audit for a
  // performance-only run; the LCP element node now lives in the "Insights"
  // audits (`lcp-breakdown-insight` primary, `lcp-discovery-insight` fallback)
  // as a flat `{type: 'node', selector, snippet}` item in details.items. The
  // old audit id is kept as a last-resort fallback for other Lighthouse
  // versions/configs that might still emit it.
  for (const auditId of ['lcp-breakdown-insight', 'lcp-discovery-insight', 'largest-contentful-paint-element']) {
    const items = report.audits?.[auditId]?.details?.items ?? [];
    const node = items.find((it) => it?.type === 'node') ?? items?.[0]?.items?.find?.((it) => it?.type === 'node');
    if (node) return node.selector || node.snippet || null;
  }
  return null;
}

function median(values) {
  const s = values.filter((v) => v != null && Number.isFinite(v)).sort((a, b) => a - b);
  if (!s.length) return null;
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
}

function fmt(key, value) {
  if (value == null) return '--';
  if (key === 'cls') return value.toFixed(3);
  if (key === 'score') return String(Math.round(value));
  return `${Math.round(value)} ms`;
}

function fmtDelta(key, before, after) {
  if (before == null || after == null) return '--';
  const d = after - before;
  if (key === 'cls') return `${d >= 0 ? '+' : ''}${d.toFixed(3)}`;
  if (key === 'score') return `${d >= 0 ? '+' : ''}${Math.round(d)}`;
  const pct = before !== 0 ? ` (${d >= 0 ? '+' : ''}${Math.round((d / before) * 100)}%)` : '';
  return `${d >= 0 ? '+' : ''}${Math.round(d)} ms${pct}`;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const label = sanitizeLabel(args.label ?? defaultLabel());
  const rawDir = join(OUT_DIR, 'raw', label);
  // Clear stale raw reports: a prior same-label invocation (or a bigger
  // --runs) would otherwise leave old-build runs mixed into the set that
  // PR verification reads.
  rmSync(rawDir, { recursive: true, force: true });
  mkdirSync(rawDir, { recursive: true });

  // Load the --against baseline BEFORE the sweep: its event path pins the
  // event surface (below), and a typo'd label should fail in seconds, not
  // after 20 minutes of Lighthouse runs.
  let before = null;
  if (args.against) {
    const againstPath = existsSync(args.against) ? args.against : join(OUT_DIR, `${sanitizeLabel(args.against)}.json`);
    if (!existsSync(againstPath)) throw new Error(`--against target not found: ${againstPath}`);
    before = JSON.parse(readFileSync(againstPath, 'utf8'));
  }

  if (!args.skipBuild && !args.base) {
    console.log('building production bundle (npm run build)...');
    execSync('npm run build', { cwd: ROOT, stdio: 'inherit' });
  }

  let server = null;
  let base = args.base;
  if (!base) {
    server = await startServer({ port: args.port });
    base = server.origin;
    console.log(`local production build serving at ${base}`);
  } else {
    console.log(`auditing deployed origin ${base}`);
  }

  try {
    let surfaces;
    if (args.routes) {
      surfaces = args.routes.map((p) => [p.replace(/^\//, '').replace(/[^A-Za-z0-9-]+/g, '_') || 'root', p]);
    } else {
      // Pin the event page to the --against run's when not explicitly given:
      // the sitemap's first event drifts as events retire, and a delta table
      // comparing two different pages is worse than useless.
      const eventPath =
        args.eventPath ?? before?.surfaces?.event?.path ?? (await discoverEventPath(base));
      surfaces = [...DEFAULT_SURFACES, ['event', eventPath]];
    }

    const results = {};
    for (const [key, path] of surfaces) {
      const url = `${base}${path}`;
      console.log(`\n[${key}] ${url} x${args.runs}`);
      // The first pass against a fresh local server pays cold costs the CDN
      // never shows (synchronous brotli of every asset, cold sharp/R2 image
      // work). 3+ runs reject the cold run via the median; fewer need a
      // discarded warm-up pass.
      if (!args.base && args.runs < 3) {
        process.stdout.write('  warm-up (discarded)... ');
        try {
          await runLighthouse(url, join(rawDir, `${key}-warmup.json`));
          console.log('done');
        } catch (e) {
          console.log(`failed (${e?.message ?? e}) -- continuing`);
        }
      }
      const runs = [];
      for (let i = 1; i <= args.runs; i++) {
        const rawPath = join(rawDir, `${key}-run${i}.json`);
        process.stdout.write(`  run ${i}/${args.runs}... `);
        const started = Date.now();
        let report;
        try {
          report = await runLighthouse(url, rawPath);
        } catch (e) {
          // One flaky run must not torch a 20-minute sweep; medians tolerate
          // a short run set. Zero successful runs is surfaced at the end.
          console.log(`failed (${e?.message ?? e}) -- continuing with remaining runs`);
          continue;
        }
        const m = metricsOf(report);
        m.lcpElement = lcpElementOf(report);
        runs.push(m);
        console.log(
          `score ${fmt('score', m.score)}, LCP ${fmt('lcp', m.lcp)}, TBT ${fmt('tbt', m.tbt)}, ` +
            `CLS ${fmt('cls', m.cls)} (${Math.round((Date.now() - started) / 1000)}s)`,
        );
      }
      const medians = {};
      for (const [key2] of METRICS) medians[key2] = median(runs.map((r) => r[key2]));
      // Report the LCP element from the run whose LCP sits closest to the
      // median, so element and number come from the same observed page load.
      const closest = runs
        .filter((r) => r.lcp != null)
        .sort((a, b) => Math.abs(a.lcp - medians.lcp) - Math.abs(b.lcp - medians.lcp))[0];
      results[key] = {
        path,
        medians,
        lcpElement: closest?.lcpElement ?? null,
        runs,
        ...(runs.length === 0 ? { error: 'all runs failed' } : {}),
      };
    }

    const summary = {
      label,
      base,
      date: new Date().toISOString(),
      commit: (() => {
        try {
          return execSync('git rev-parse HEAD', { cwd: ROOT, encoding: 'utf8' }).trim();
        } catch {
          return null;
        }
      })(),
      runsPerSurface: args.runs,
      method: 'lighthouse mobile, simulated 4G (check-lighthouse.mjs flag parity), per-metric median',
      surfaces: results,
    };
    const summaryPath = join(OUT_DIR, `${label}.json`);
    writeFileSync(summaryPath, JSON.stringify(summary, null, 2) + '\n');

    const header = ['surface', 'score', 'LCP', 'FCP', 'TBT', 'CLS', 'SI', 'TTFB(doc)'];
    const lines = [
      `\n## perf:ab medians -- ${label} (${args.runs} runs/surface)`,
      '',
      `| ${header.join(' | ')} |`,
      `|${header.map(() => '---').join('|')}|`,
    ];
    for (const [key, r] of Object.entries(results)) {
      const m = r.medians;
      lines.push(
        `| ${key} \`${r.path}\`${r.error ? ' (FAILED)' : ''} | ${fmt('score', m.score)} | ${fmt('lcp', m.lcp)} | ${fmt('fcp', m.fcp)} | ` +
          `${fmt('tbt', m.tbt)} | ${fmt('cls', m.cls)} | ${fmt('si', m.si)} | ${fmt('ttfb', m.ttfb)} |`,
      );
    }
    lines.push('');
    for (const [key, r] of Object.entries(results)) {
      lines.push(`- ${key} LCP element: ${r.lcpElement ?? 'n/a'}`);
    }
    console.log(lines.join('\n'));

    if (before) {
      const mismatches = [];
      const dLines = [
        `\n## delta vs ${before.label} (${before.date})`,
        '',
        '| surface | metric | before | after | delta |',
        '|---|---|---|---|---|',
      ];
      for (const [key, r] of Object.entries(results)) {
        const bs = before.surfaces?.[key];
        const b = bs?.medians;
        if (!b) continue;
        const mismatch = bs.path !== r.path;
        if (mismatch) mismatches.push([key, bs.path, r.path]);
        for (const [mk] of METRICS) {
          dLines.push(
            `| ${key}${mismatch ? '*' : ''} | ${mk} | ${fmt(mk, b[mk])} | ${fmt(mk, r.medians[mk])} | ${fmtDelta(mk, b[mk], r.medians[mk])} |`,
          );
        }
      }
      for (const [key, bPath, aPath] of mismatches) {
        const warning = `* ${key} compares DIFFERENT pages: before \`${bPath}\`, after \`${aPath}\` -- delta not comparable (pin with --event-path)`;
        dLines.push('', warning);
        console.warn(warning);
      }
      console.log(dLines.join('\n'));
    }

    console.log(`\nsummary: ${summaryPath}`);
    console.log(`raw reports: ${rawDir}`);

    // Deferred failure, mirroring check-lighthouse.mjs's INFRA pattern:
    // partial data is persisted and printed above, but a surface with zero
    // successful runs still exits red.
    const failedSurfaces = Object.entries(results).filter(([, r]) => r.error);
    if (failedSurfaces.length) {
      throw new Error(`${failedSurfaces.length} surface(s) had zero successful runs: ${failedSurfaces.map(([k]) => k).join(', ')}`);
    }
  } finally {
    if (server) await server.close();
  }
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });

#!/usr/bin/env node
// Document-weight budget (perf programme, Pillar D -- "stays fast").
//
// The FIRST CI check that measures a real rendered page's ON-THE-WIRE bytes.
// scripts/check-bundle-budget.mjs only sizes local, gzipped first-load JS from
// the Vite manifest -- it cannot see the rendered HTML document, so it never
// caught the ~221 KB of inlined dehydrated JSON that dominates the homepage.
// This closes that gap: fetch the deployed homepage with brotli and assert the
// actual transferred bytes stay under budget, so the payload cannot silently
// re-inflate.
//
// Base URL: DOC_WEIGHT_BASE_URL if set, else the PR's Vercel preview resolved
// first-party (previewProbe) and reached with the protection-bypass header.
//
// Anti-masking, same two classes as check-lighthouse:
//   - INFRA ("couldn't measure"): always a hard failure (exit 1).
//   - BUDGET ("measured, over budget"): warn-only until DOC_WEIGHT_ENFORCE=1.
//
//   DOC_WEIGHT_BUDGET_KB   brotli budget per page (default 120; generous while
//                          this bakes -- re-baseline once WS14 lands)

import { execFileSync } from 'node:child_process';
import { appendFileSync, mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { resolvePreviewUrl, bypassHeaders, assertMeasured } from './lib/previewProbe.mjs';

const EXPLICIT_BASE = (process.env.DOC_WEIGHT_BASE_URL ?? '').replace(/\/$/, '');
const BUDGET_KB = Number(process.env.DOC_WEIGHT_BUDGET_KB ?? 120);
const ENFORCE = process.env.DOC_WEIGHT_ENFORCE === '1';

// The pages whose document weight we guard. Homepage is the heavy one (dehydrated
// map-events JSON); add more as needed.
const TARGETS = [['homepage', '/city/london-gb']];

/**
 * True compressed transfer size via curl (curl does NOT decompress without
 * --compressed, so size_download IS the on-the-wire byte count). execFileSync
 * spawns curl directly (no shell), so the URL is passed through unmangled.
 */
function measureWire(url, bypassSecret) {
  const bodyTmp = join(mkdtempSync(join(tmpdir(), 'docw-')), 'body');
  const args = ['-sS', '-H', 'Accept-Encoding: br', '-H', 'User-Agent: perf-doc-weight'];
  if (bypassSecret) args.push('-H', `x-vercel-protection-bypass: ${bypassSecret}`);
  args.push('-D', '-', '-o', bodyTmp, '-w', 'DOCW=%{size_download}|%{http_code}', url);
  const out = execFileSync('curl', args, { encoding: 'utf8', maxBuffer: 32 * 1024 * 1024 });
  const m = /DOCW=(\d+)\|(\d+)/.exec(out);
  const enc = /content-encoding:\s*([^\r\n]+)/i.exec(out)?.[1]?.trim() ?? 'identity';
  if (!m) return null;
  return { bytes: Number(m[1]), status: Number(m[2]), enc };
}

async function main() {
  const base = EXPLICIT_BASE || (await resolvePreviewUrl());
  const headers = bypassHeaders({ required: !EXPLICIT_BASE });
  const bypassSecret = headers?.['x-vercel-protection-bypass'];
  console.log(`Doc-weight base: ${base}${bypassSecret ? ' (protection bypass active)' : ''}`);

  const budgetBytes = BUDGET_KB * 1024;
  const summary = ['## Document weight (brotli, on the wire)', '', '| Page | Size | Budget | Status |', '|---|---|---|---|'];
  let measured = 0;
  const breaches = [];

  for (const [label, pathname] of TARGETS) {
    const url = `${base}${pathname}`;
    let r;
    try {
      r = measureWire(url, bypassSecret);
    } catch (e) {
      console.log(`  [${label}] measure failed: ${e?.message ?? e}`);
      r = null;
    }
    // A non-2xx (incl. a 401 that slipped past the bypass) or a null means we did
    // not measure this page -- do not count it as a pass.
    if (!r || r.status < 200 || r.status >= 300) {
      console.log(`  [${label}] not measured (status ${r?.status ?? 'n/a'})`);
      summary.push(`| ${label} | -- | ${BUDGET_KB} KB | not measured |`);
      continue;
    }
    measured += 1;
    const kb = (r.bytes / 1024).toFixed(1);
    const over = r.bytes > budgetBytes;
    if (r.enc !== 'br') console.log(`  [${label}] note: content-encoding=${r.enc} (expected br)`);
    if (over) breaches.push(`${label} ${kb} KB > ${BUDGET_KB} KB`);
    console.log(`  ${over ? 'OVER' : 'ok  '} [${label}] ${kb} KB (budget ${BUDGET_KB} KB, ${r.enc})`);
    summary.push(`| ${label} | ${kb} KB | ${BUDGET_KB} KB | ${over ? 'OVER' : 'ok'} |`);
  }

  if (process.env.GITHUB_STEP_SUMMARY) {
    appendFileSync(process.env.GITHUB_STEP_SUMMARY, summary.join('\n') + '\n');
  }

  // INFRA guard (fail-loud): we must have measured every target.
  assertMeasured(measured, TARGETS.length, 'document-weight targets');

  // BUDGET guard: warn-only until DOC_WEIGHT_ENFORCE=1.
  if (breaches.length) {
    const lines = breaches.map((b) => `  - ${b}`).join('\n');
    if (ENFORCE) {
      console.error(`\n${breaches.length} document-weight breach(es):\n${lines}`);
      process.exit(1);
    }
    console.warn(`\nWARN: ${breaches.length} document-weight breach(es) (warn-only until DOC_WEIGHT_ENFORCE=1):\n${lines}`);
  }
  console.log(`\nDocument weight measured ${measured}/${TARGETS.length} target(s)${breaches.length ? ` with ${breaches.length} warning(s)` : ' — within budget'}.`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

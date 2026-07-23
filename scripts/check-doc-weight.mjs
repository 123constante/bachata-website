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
// Also guards IMAGE OPTIMIZATION: any <img> in the rendered document whose src
// hits an R2 public bucket directly (pub-*.r2.dev) instead of /_vercel/image is
// a breach (same warn-until-enforce class). This is the failure mode that let
// imageCdn.ts silently no-op for months: 5.94 MB of full-size originals into
// <=92px thumbnails, and nothing red anywhere.
//
//   DOC_WEIGHT_BUDGET_KB   brotli budget per page (default 120; generous while
//                          this bakes -- re-baseline once WS14 lands)

import { execFileSync } from 'node:child_process';
import { appendFileSync, mkdtempSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { brotliDecompressSync, gunzipSync } from 'node:zlib';
import { resolvePreviewUrl, bypassHeaders, assertMeasured } from './lib/previewProbe.mjs';

const EXPLICIT_BASE = (process.env.DOC_WEIGHT_BASE_URL ?? '').replace(/\/$/, '');
const BUDGET_KB = Number(process.env.DOC_WEIGHT_BUDGET_KB ?? 120);
const ENFORCE = process.env.DOC_WEIGHT_ENFORCE === '1';

// The hosts that MUST be optimized, read from vercel.json's images.remotePatterns
// -- the list Vercel itself enforces -- rather than a hardcoded copy that can
// drift out of sync with the thing it is guarding. imageCdn.ts's OPTIMIZABLE_HOSTS
// must equal this set; a mismatch is exactly how the original bug survived.
const REMOTE_HOSTS = JSON.parse(readFileSync(new URL('../vercel.json', import.meta.url), 'utf8'))
  .images.remotePatterns.map((p) => p.hostname);
const RAW_R2_SRC = new RegExp(`^https://(?:${REMOTE_HOSTS.map((h) => h.replace(/\./g, '\\.')).join('|')})/`, 'i');

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
  return { bytes: Number(m[1]), status: Number(m[2]), enc, bodyTmp };
}

/**
 * Unoptimised-image guard. Scans the rendered document's <img> tags for src
 * attributes that hit an R2 public bucket DIRECTLY instead of going through
 * /_vercel/image. This is the exact failure mode that shipped 5.94 MB of
 * full-size originals into <=92px homepage thumbnails while imageCdn.ts
 * silently no-op'd on a hostname mismatch: the helper was wired into every
 * call site and never rewrote a single URL, and nothing noticed. og:image
 * <meta> tags are deliberately out of scope (baked OG images are served raw
 * to scrapers by design) -- only <img> tags count.
 */
function scanUnoptimizedImages(bodyPath, enc) {
  let html;
  try {
    const raw = readFileSync(bodyPath);
    if (enc === 'br') html = brotliDecompressSync(raw).toString('utf8');
    else if (enc === 'gzip') html = gunzipSync(raw).toString('utf8');
    else if (enc === 'identity' || !enc) html = raw.toString('utf8');
    // Any other encoding (zstd, or a proxy rewriting the header over a still
    // compressed body) would decode to mojibake. raw.toString() never throws, so
    // without this the scan would find 0 <img> and report a vacuous PASS.
    else return { failed: `unsupported content-encoding: ${enc}` };
  } catch (e) {
    return { failed: `decode failed (${enc}): ${e?.message ?? e}` };
  }

  const offenders = new Set();
  let imgCount = 0;
  for (const tag of html.match(/<img\b[^>]*>/gi) ?? []) {
    imgCount += 1;
    // (^|\s)src= so we do not match data-src / data-lazy-src, which can legitimately
    // hold the raw original while the real src is optimized.
    const src = /(?:^|\s)src\s*=\s*["']([^"']+)["']/i.exec(tag)?.[1];
    if (src && RAW_R2_SRC.test(src)) offenders.add(src);
  }

  // POSITIVE ASSERTION. "Found no offenders" and "never saw an <img> at all" are
  // otherwise indistinguishable, both returning a green tick. A guard whose whole
  // purpose is to end a silent no-op must not have one: if the page stops SSR-ing
  // covers (client-only render, markup change, mojibake body), that is a scan
  // failure, not a pass.
  if (imgCount === 0) return { failed: 'scanned document contains zero <img> tags -- cannot verify' };

  return { offenders: [...offenders], imgCount };
}

async function main() {
  const base = EXPLICIT_BASE || (await resolvePreviewUrl());
  const headers = bypassHeaders({ required: !EXPLICIT_BASE });
  const bypassSecret = headers?.['x-vercel-protection-bypass'];
  console.log(`Doc-weight base: ${base}${bypassSecret ? ' (protection bypass active)' : ''}`);

  const budgetBytes = BUDGET_KB * 1024;
  const summary = ['## Document weight (brotli, on the wire)', '', '| Page | Size | Budget | Raw R2 imgs | Status |', '|---|---|---|---|---|'];
  let measured = 0;
  let scanFailures = 0;
  const breaches = [];
  const rawImageFailures = [];

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
      summary.push(`| ${label} | -- | ${BUDGET_KB} KB | -- | not measured |`);
      continue;
    }
    measured += 1;
    const kb = (r.bytes / 1024).toFixed(1);
    const over = r.bytes > budgetBytes;
    if (r.enc !== 'br') console.log(`  [${label}] note: content-encoding=${r.enc} (expected br)`);
    if (over) breaches.push(`${label} ${kb} KB > ${BUDGET_KB} KB`);

    // Unoptimised-image guard: no <img> in the rendered document may fetch an
    // R2 bucket directly -- covers must go through /_vercel/image.
    const scan = scanUnoptimizedImages(r.bodyTmp, r.enc);
    let imgCell;
    if (scan.failed) {
      scanFailures += 1;
      imgCell = 'scan failed';
      console.log(`  [${label}] image scan failed: ${scan.failed}`);
    } else {
      imgCell = String(scan.offenders.length);
      if (scan.offenders.length) {
        // NOT a `breaches` entry: those are warn-only until DOC_WEIGHT_ENFORCE=1,
        // which perf-budget.yml never sets -- so routing offenders there would make
        // the guard against "nothing red anywhere" incapable of ever being red.
        // An unoptimised image is a correctness bug, not a budget overrun: always hard.
        rawImageFailures.push(
          `${label}: ${scan.offenders.length} <img> src(s) straight from R2 (unoptimised)\n` +
            scan.offenders.slice(0, 5).map((u) => `      ${u}`).join('\n') +
            (scan.offenders.length > 5 ? `\n      ... and ${scan.offenders.length - 5} more` : ''),
        );
      }
    }

    // Single source of truth for this row's verdict, so console and step summary
    // cannot disagree and a scan failure can never render as "ok".
    const status = scan.failed ? 'scan failed' : over || scan.offenders.length ? 'OVER' : 'ok';
    console.log(
      `  ${status === 'ok' ? 'ok  ' : status === 'OVER' ? 'OVER' : 'FAIL'} [${label}] ${kb} KB ` +
        `(budget ${BUDGET_KB} KB, ${r.enc})` +
        (scan.failed ? '' : `, ${scan.imgCount} <img>, ${scan.offenders.length} unoptimised`),
    );
    summary.push(`| ${label} | ${kb} KB | ${BUDGET_KB} KB | ${imgCell} | ${status} |`);
  }

  if (process.env.GITHUB_STEP_SUMMARY) {
    appendFileSync(process.env.GITHUB_STEP_SUMMARY, summary.join('\n') + '\n');
  }

  // INFRA guard (fail-loud): we must have measured every target, and every
  // measured body must have been scannable. Reuse assertMeasured for both rather
  // than hand-rolling a second exit path next to it.
  assertMeasured(measured, TARGETS.length, 'document-weight targets');
  assertMeasured(measured - scanFailures, TARGETS.length, 'scannable document bodies');

  // CORRECTNESS guard (always hard, never warn-only): an <img> pulling a raw R2
  // original is a bug, not a budget overrun.
  if (rawImageFailures.length) {
    console.error(
      `\nUnoptimised images found -- every <img> must go through /_vercel/image ` +
        `(see src/lib/imageCdn.ts):\n${rawImageFailures.map((f) => `  - ${f}`).join('\n')}`,
    );
    process.exit(1);
  }

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

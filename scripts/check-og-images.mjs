#!/usr/bin/env node
// OG image guardrail. Fetches a sample of live pages with a WhatsApp user-agent
// and asserts each Open Graph image will actually render as a link preview:
//   - og:image present + absolute https
//   - og:image:width / og:image:height present
//   - the image resolves to JPEG or PNG (NOT WebP — WhatsApp won't render WebP)
//   - the image is under ~300KB (WhatsApp's practical budget)
//
// Targets the DEPLOYED site (middleware + the /api/og/card endpoint only exist
// post-deploy), so this runs as a scheduled job, not a PR gate.
//
//   OG_CHECK_BASE    base URL (default https://www.bachatacalendar.co.uk)
//   OG_CHECK_STRICT  '1' => transient network errors fail instead of warn
//
// Exit 1 if any sampled page would show no preview.

import { assertMeasured, bypassHeaders, isPreviewHost, skipIfWalledPreview } from './lib/previewProbe.mjs';

const BASE = (process.env.OG_CHECK_BASE ?? 'https://www.bachatacalendar.co.uk').replace(/\/$/, '');
const STRICT = process.env.OG_CHECK_STRICT === '1';
// Floor for the sitemap sample. PREFIX_SAMPLE asks for 8 URLs across 7 prefixes;
// individual entity types legitimately come and go, so this is a "the sitemap
// clearly worked" floor, not a per-prefix assertion.
const MIN_OG_PAGES = 4;
// When pointed at a protected Vercel preview (PR coverage), send the bypass
// headers; null (no secret) against public prod, where they are not needed.
// REQUIRED on a *.vercel.app base: with no secret the run is unauthenticated,
// which is either a green skip that measured nothing or a misleading redirect
// death. The demand throws IN CI ONLY (bypassHeaders is deliberately lax
// without process.env.CI, so local no-secret runs still go unauthenticated).
// Full rationale at check-seo.mjs's BYPASS; same split as
// check-lighthouse.mjs (required: !EXPLICIT_BASE). A present-but-rejected
// secret is normally skipIfWalledPreview's case, not this one.
const BYPASS = bypassHeaders({ required: isPreviewHost(BASE) });
const WHATSAPP_UA = 'WhatsApp/2.23.20.0 A';
const MAX_BYTES = 300 * 1024;

// A few URLs per page type so a regression in any fetcher gets caught.
//
// EVENTS GET THE WIDEST SAMPLE because they are the page people actually share
// and the only type with a per-row image pipeline. It was 2, taken as the FIRST
// two <loc> entries -- i.e. sitemap ORDER decided coverage, and 63 of the 65
// event URLs were never looked at. That is not a sampling strategy, it is a
// lottery: creating one event on 2026-07-31 made it entry #1, pushed a stale
// 2026-05-09 row into entry #2, and reddened og-preview on every PR from
// 2026-08-01 with an UNCHANGED codebase. Coverage must not re-roll when the
// sitemap reorders.
//
// HONEST LIMIT, measured against prod 2026-08-03: only /event/, /dancers/ and
// /organisers/ actually appear in sitemap.xml, so the other four keys below
// contribute NOTHING and this samples three page types, not seven. Some of that
// is deliberate (PR #140 stopped emitting /teachers/ URLs for non-teacher
// profiles); /festival/ and /city/ are worth a look. Left declared rather than
// deleted so the keys reactivate if those URLs return -- but do not read the
// list as coverage it does not have.
const PREFIX_SAMPLE = { '/event/': 6, '/festival/': 2, '/city/': 1, '/teachers/': 1, '/djs/': 1, '/dancers/': 1, '/organisers/': 1 };
// How long after an event ends its link preview still matters. Past events stay
// published on purpose (the organiser past-events surface, CI check #41), so
// they stay in the sitemap and can be sampled -- but nobody shares last May's
// flyer, so a stale image on one must WARN, not red the build.
const PAST_EVENT_GRACE_HOURS = 24;

// The bypass secret is a credential for the PREVIEW host only. og:image URLs can
// resolve to third-party hosts (R2, any absolute URL a page carries) — sending
// the header there would put the secret in someone else's access logs.
function bypassFor(url) {
  try {
    return new URL(url, BASE).origin === new URL(BASE).origin ? BYPASS : null;
  } catch {
    return null;
  }
}

async function fetchText(url, opts = {}) {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), 12000);
  try {
    const r = await fetch(url, { ...opts, headers: { ...(bypassFor(url) ?? {}), ...(opts.headers ?? {}) }, signal: ctrl.signal });
    return { ok: r.ok, status: r.status, text: r.ok ? await r.text() : '' };
  } finally {
    clearTimeout(t);
  }
}

async function headImage(url) {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), 12000);
  try {
    // GET (not HEAD): the card endpoint streams a generated image; HEAD may skip Content-Length.
    const r = await fetch(url, { signal: ctrl.signal, redirect: 'follow', headers: bypassFor(url) ?? undefined });
    const ct = (r.headers.get('content-type') || '').toLowerCase();
    let bytes = Number(r.headers.get('content-length') || 0);
    if (!bytes && r.ok) bytes = (await r.arrayBuffer()).byteLength;
    return { ok: r.ok, status: r.status, contentType: ct, bytes };
  } finally {
    clearTimeout(t);
  }
}

function pick(html, re) {
  const m = html.match(re);
  return m ? m[1] : null;
}

// og:image content is an HTML attribute, so ampersands are entity-encoded
// (`...&amp;v=...`). A real client (WhatsApp, browsers) decodes entities before
// fetching, so decode here too — otherwise the query-param assertions below see
// `;v=` instead of `&v=` and false-fail, and the image fetch would request a
// literally-wrong URL. Covers the ampersand forms that appear in these URLs.
function decodeEntities(s) {
  return s
    .replace(/&amp;/g, '&')
    .replace(/&#(?:38|x26);/gi, '&');
}

async function sampleUrls() {
  const { ok, text } = await fetchText(`${BASE}/sitemap.xml`, { redirect: 'follow' });
  const urls = ['/'];
  if (ok) {
    const locs = [...text.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1]);
    for (const [prefix, n] of Object.entries(PREFIX_SAMPLE)) {
      const matches = locs.filter((u) => u.includes(prefix)).slice(0, n);
      for (const u of matches) urls.push(u.replace(/^https?:\/\/[^/]+/, ''));
    }
  }
  // Fixed sample: an event shared with a specific occurrence — the case that
  // regressed (preview showed the series flyer, not the per-date flyer).
  urls.push('/event/makondo?occurrenceId=03f492d3-1663-4c4e-a753-2be0f7bdcb2b');
  return urls;
}

/**
 * Has this event/festival already finished?
 *
 * Read from the page's own Event JSON-LD, which both surfaces already emit, so
 * no extra request and no DB credentials are needed -- the sitemap carries no
 * date, which is why the sample could not be filtered before fetching. Falls
 * back to startDate when endDate is absent. Unparseable or missing dates answer
 * false, so an unknown page is treated as LIVE and still fails hard: the
 * scoping may only ever narrow what is forgiven, never what is checked.
 */
function eventHasEnded(html, nowMs = Date.now()) {
  const raw = pick(html, /"endDate"\s*:\s*"([^"]+)"/) || pick(html, /"startDate"\s*:\s*"([^"]+)"/);
  if (!raw) return false;
  const t = Date.parse(raw);
  return Number.isFinite(t) && t < nowMs - PAST_EVENT_GRACE_HOURS * 60 * 60 * 1000;
}

async function checkPage(pathOrUrl) {
  const url = pathOrUrl.startsWith('http') ? pathOrUrl : `${BASE}${pathOrUrl}`;
  const failures = [];
  let res;
  try {
    res = await fetchText(url, { headers: { 'user-agent': WHATSAPP_UA }, redirect: 'follow' });
  } catch (e) {
    return { url, soft: true, failures: [`page fetch error: ${e.message}`] };
  }
  if (!res.ok) return { url, failures: [`page HTTP ${res.status}`] };

  const html = res.text;
  const ogImageRaw = pick(html, /<meta[^>]+property=["']og:image["'][^>]+content=["']([^"']+)["']/i)
    || pick(html, /<meta[^>]+content=["']([^"']+)["'][^>]+property=["']og:image["']/i);
  if (!ogImageRaw) { failures.push('no og:image'); return { url, failures }; }
  const ogImage = decodeEntities(ogImageRaw);
  if (!/^https:\/\//i.test(ogImage)) failures.push(`og:image not absolute https: ${ogImage}`);
  if (!/og:image:width/i.test(html)) failures.push('missing og:image:width');
  if (!/og:image:height/i.test(html)) failures.push('missing og:image:height');

  // Durability guards for the link-preview pipeline. An event/festival preview must
  // be either a pre-baked immutable R2 image, or a live card carrying a cover
  // version (v=) so a cover change always busts the cache. Occurrence URLs must
  // carry the occurrence into a live card (occ=); a baked R2 image encodes it in
  // the object key, so it needs no query param.
  if (/\/(event|festival)\//.test(url)) {
    const isCard = /\/api\/og\/card\?/i.test(ogImage);
    const isBaked = /\.r2\.dev\//i.test(ogImage) || /\/og\/(event|festival)\//i.test(ogImage);
    if (isCard && !/[?&]v=/.test(ogImage)) failures.push(`og:image card missing cover version (v=): ${ogImage}`);
    if (/[?&]occurrenceId=/i.test(url) && isCard && !/[?&]occ=/.test(ogImage)) {
      failures.push(`occurrence URL but og:image card drops occ=: ${ogImage}`);
    }
    if (!isCard && !isBaked && !/\/api\/og\//i.test(ogImage)) {
      failures.push(`event/festival og:image is neither a baked R2 image nor an og card: ${ogImage}`);
    }
  }

  try {
    const img = await headImage(ogImage);
    if (!img.ok) failures.push(`og:image HTTP ${img.status}`);
    else {
      if (/webp/.test(img.contentType)) failures.push(`og:image is WebP (${img.contentType}) — WhatsApp won't render`);
      else if (!/jpeg|jpg|png/.test(img.contentType)) failures.push(`og:image unexpected type: ${img.contentType}`);
      if (img.bytes > MAX_BYTES) failures.push(`og:image ${Math.round(img.bytes / 1024)}KB > 300KB`);
    }
  } catch (e) {
    return { url, soft: true, failures: [`og:image fetch error: ${e.message}`] };
  }
  // Scope the VERDICT, not the check: a finished event is still fetched and
  // still asserted, but its failures warn instead of redding. Deliberately
  // applied at the end so it downgrades every failure kind uniformly (a 404
  // image on a past page is as harmless as a fallback one) rather than
  // special-casing the one shape rule that happened to fire first.
  if (failures.length > 0 && /\/(event|festival)\//.test(url) && eventHasEnded(html)) {
    return { url, soft: true, failures: [...failures, '(event already ended -- warning, not a failure)'] };
  }
  return { url, failures };
}

async function main() {
  console.log(`OG image guard — base: ${BASE}`);

  // A PROVEN Deployment Protection wall (401/403 or parked on Vercel's login
  // surface) is an AUTH failure, not an OG failure: skip green with a warning.
  // Anything else (timeout, DNS, broken preview) is NOT walled and the real
  // check runs and fails loud. The isPreviewHost gate is inside the helper, so
  // this never short-circuits the public production run.
  if (await skipIfWalledPreview(BASE, { bypass: BYPASS, label: 'OG preview skipped', subject: 'OG cards could not be checked' })) {
    return;
  }

  const urls = await sampleUrls();
  // Fail-loud measurement contract: a silently-shrunk sitemap sample (or a
  // sitemap that parsed to nothing) must not report a 0-page green pass.
  assertMeasured(urls.length, MIN_OG_PAGES, 'OG sample pages');
  console.log(`Checking ${urls.length} pages...\n`);

  let hardFailures = 0;
  let softFailures = 0;
  for (const u of urls) {
    const r = await checkPage(u);
    if (r.failures.length === 0) {
      console.log(`  PASS  ${r.url}`);
    } else if (r.soft && !STRICT) {
      console.log(`  WARN  ${r.url}`);
      r.failures.forEach((f) => console.log(`        - ${f}`));
      softFailures += 1;
    } else {
      console.log(`  FAIL  ${r.url}`);
      r.failures.forEach((f) => console.log(`        - ${f}`));
      hardFailures += 1;
    }
  }

  console.log(`\n${hardFailures} failed, ${softFailures} warned, ${urls.length} checked.`);
  if (hardFailures > 0) process.exit(1);
}

// A CRASH is always a hard failure -- the same strict form check-seo.mjs,
// check-lighthouse.mjs and check-doc-weight.mjs already use. It previously exited
// 0 unless OG_CHECK_STRICT=1, which NO workflow sets, so a throw in sampleUrls()
// (sitemap 500, HTML instead of XML, a parse change) made the daily production
// og-check report SUCCESS having checked zero pages -- byte-for-byte the
// dead-Lighthouse "green but measured nothing" failure this repo exists to kill.
// OG_CHECK_STRICT keeps its original, narrower meaning: escalating per-page SOFT
// failures (see the `r.soft && !STRICT` branch above).
// process.exitCode, NOT process.exit(1). Measured on Windows 2026-08-03: the
// bare exit() discards the in-flight stderr pipe write of the error object and
// libuv aborts -- "Assertion failed: !(handle->flags & UV_HANDLE_CLOSING),
// src\win\async.c" -- so the run ends 127 with a libuv assertion where the real
// cause should be. Non-zero either way, so CI still reds, but the operator
// reads a crash in node instead of the sitemap failure that caused it. This is
// rule (1) of the arc-close check-script-conventions.mjs candidate, and
// pre-ship.mjs already documents the class.
main().catch((err) => { console.error(err); process.exitCode = 1; });

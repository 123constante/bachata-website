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

import { bypassHeaders } from './lib/previewProbe.mjs';

const BASE = (process.env.OG_CHECK_BASE ?? 'https://www.bachatacalendar.co.uk').replace(/\/$/, '');
const STRICT = process.env.OG_CHECK_STRICT === '1';
// When pointed at a protected Vercel preview (PR coverage), send the bypass
// headers; null (no secret) against public prod, where they are not needed.
const BYPASS = bypassHeaders({ required: false });
const WHATSAPP_UA = 'WhatsApp/2.23.20.0 A';
const MAX_BYTES = 300 * 1024;

// One or two URLs per page type so a regression in any fetcher gets caught.
const PREFIX_SAMPLE = { '/event/': 2, '/festival/': 1, '/city/': 1, '/teachers/': 1, '/djs/': 1, '/dancers/': 1, '/organisers/': 1 };

async function fetchText(url, opts = {}) {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), 12000);
  try {
    const r = await fetch(url, { ...opts, headers: { ...(BYPASS ?? {}), ...(opts.headers ?? {}) }, signal: ctrl.signal });
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
    const r = await fetch(url, { signal: ctrl.signal, redirect: 'follow', headers: BYPASS ?? undefined });
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
  return { url, failures };
}

async function main() {
  console.log(`OG image guard — base: ${BASE}`);
  const urls = await sampleUrls();
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

main().catch((e) => { console.error('check-og-images crashed:', e); process.exit(STRICT ? 1 : 0); });

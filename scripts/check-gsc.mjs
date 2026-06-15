#!/usr/bin/env node
/**
 * Google Search Console health check for bachatacalendar.co.uk
 * (GSC DOMAIN property: sc-domain:bachatacalendar.co.uk).
 *
 * Zero-dependency: service-account JWT-bearer auth via node:crypto, native
 * fetch. No googleapis / google-auth-library (keeps the CI job install-free,
 * matching the OG-image guard precedent).
 *
 * Sections:
 *   1. Sitemap health      - sitemaps.list; canonical present + error-free,
 *                            www variant noted, junk HTML submissions flagged.
 *   2. Search analytics    - 28-day totals + top queries (informational).
 *   3. URL inspections     - key routes + a few entity samples; noindex /
 *                            robots-blocked / verdict-FAIL on an indexable
 *                            route is a hard fail.
 *   4. Sitemap-vs-live diff- GET every sitemap URL; 404/5xx surfaced before
 *                            Google finds them.
 *
 * Auth (order matters): the OAuth scope is decided from --delete-junk BEFORE
 * the JWT is minted, so a default (CI) run holds a readonly token that is
 * cryptographically incapable of mutating anything.
 *
 * Env (one of the first two required):
 *   GSC_SERVICE_ACCOUNT_KEY        raw service-account JSON (CI secret)
 *   GSC_SERVICE_ACCOUNT_KEY_FILE   path to the JSON key file (local)
 *   GSC_SITE_URL                   override property (default sc-domain:bachatacalendar.co.uk)
 *   GSC_CHECK_BASE                 override site base (default https://www.bachatacalendar.co.uk)
 *   STRICT=1                       escalate WARNs (junk sitemaps, sitemap 404s,
 *                                  redirects, timeouts) to hard FAILs
 *
 * Flags:
 *   --skip-live-diff   skip the full sitemap-URL crawl (fast mode)
 *   --json <path>      write a machine-readable report (aggregated data only)
 *   --delete-junk      DELETE the error-bearing HTML sitemap submissions
 *                      (requests the full webmasters scope; needs the SA at
 *                      delegated Owner in GSC - Full returns 403)
 *
 * Exit: 0 = clean, 1 = a hard FAIL, 2 = config/transport error (bad key,
 *       token failure, sitemap unreachable, Google API outage).
 *
 *   Local:  node scripts/check-gsc.mjs            (reads .env)
 *   CI:     node scripts/check-gsc.mjs --json gsc-report.json
 */
import fs from 'node:fs';
import crypto from 'node:crypto';

// env loading (house pattern, check-fk-indexes.mjs:19-34)
function loadEnv() {
  const env = { ...process.env };
  if (fs.existsSync('.env')) {
    const file = fs.readFileSync('.env', 'utf8');
    for (const raw of file.split(/\r?\n/)) {
      const ln = raw.trim();
      if (!ln || ln.startsWith('#')) continue;
      const idx = ln.indexOf('=');
      if (idx < 0) continue;
      const k = ln.slice(0, idx).trim();
      const v = ln.slice(idx + 1).replace(/^"|"$/g, '');
      if (env[k] === undefined) env[k] = v;
    }
  }
  return env;
}

const ENV = loadEnv();
const ARGV = process.argv.slice(2);
const FLAGS = {
  deleteJunk: ARGV.includes('--delete-junk'),
  submitCanonical: ARGV.includes('--submit-canonical'),
  digest: ARGV.includes('--digest'),
  digestOut: (() => { const i = ARGV.indexOf('--digest-out'); return i >= 0 ? ARGV[i + 1] : null; })(),
  skipLiveDiff: ARGV.includes('--skip-live-diff'),
  jsonPath: (() => { const i = ARGV.indexOf('--json'); return i >= 0 ? ARGV[i + 1] : null; })(),
};
const STRICT = ENV.STRICT === '1';

const SITE_URL = ENV.GSC_SITE_URL || 'sc-domain:bachatacalendar.co.uk';
const BASE = (ENV.GSC_CHECK_BASE || 'https://www.bachatacalendar.co.uk').replace(/\/$/, '');
const CANONICAL_SITEMAP = `${BASE}/sitemap.xml`;
const WWW_SITEMAP = CANONICAL_SITEMAP.replace('://', '://www.');

// Routes that intentionally client-side redirect to /city/:slug/... - kept in
// lockstep with the exclusion list in generate-sitemap.mjs:57-59. These serve a
// prerendered 200 then redirect in React, so GSC may report "Page with
// redirect"; that is expected ONLY for these paths. Any OTHER route reporting a
// redirect is a regression and fails.
const INTENTIONAL_REDIRECTS = new Set([
  '/', '/parties', '/classes', '/tonight', '/venues',
  '/discounts', '/practice-partners', '/cities', '/videographers',
]);

// Indexable routes we spot-check every run (the full prerender set).
const INSPECT_ROUTES = [
  '/', '/faq', '/london-bachata-guide',
  '/bachata-london-monday', '/bachata-london-tuesday', '/bachata-london-wednesday',
  '/bachata-london-thursday', '/bachata-london-friday', '/bachata-london-saturday',
  '/bachata-london-sunday',
  '/parties', '/classes', '/tonight', '/festivals', '/venues', '/teachers',
  '/djs', '/organisers', '/dancers', '/discounts', '/cities',
  '/practice-partners', '/videographers', '/vendors', '/choreography',
];

// One or two entity URLs per detail-page type, sampled from the live sitemap.
const ENTITY_SAMPLE = {
  '/event/': 2, '/festival/': 1, '/city/': 1, '/venue-entity/': 1,
  '/teachers/': 1, '/djs/': 1, '/dancers/': 1, '/organisers/': 1,
};

const TIMEOUT_MS = 12000;
const LIVE_CONCURRENCY = 8;
const INSPECT_DELAY_MS = 500;

const SCOPE_READONLY = 'https://www.googleapis.com/auth/webmasters.readonly';
const SCOPE_FULL = 'https://www.googleapis.com/auth/webmasters';
const TOKEN_ENDPOINT = 'https://oauth2.googleapis.com/token';
const WMT = 'https://www.googleapis.com/webmasters/v3';
const INSPECT_ENDPOINT = 'https://searchconsole.googleapis.com/v1/urlInspection/index:inspect';
const JWT_GRANT = 'urn:ietf:params:oauth:grant-type:jwt-bearer';

// tiny report accumulator
const report = { generatedAt: null, siteUrl: SITE_URL, base: BASE, sections: {}, summary: { pass: 0, warn: 0, fail: 0 } };
function emit(level, msg, detail) {
  console.log(`  ${level.padEnd(4)}  ${msg}`);
  if (detail) for (const d of [].concat(detail)) console.log(`        - ${d}`);
}
function pass(msg, detail) { report.summary.pass++; emit('PASS', msg, detail); }
function info(msg, detail) { emit('INFO', msg, detail); }
function warn(msg, detail) {
  if (STRICT) { report.summary.fail++; emit('FAIL', msg, detail); }
  else { report.summary.warn++; emit('WARN', msg, detail); }
}
function fail(msg, detail) { report.summary.fail++; emit('FAIL', msg, detail); }

// service-account auth
function b64url(input) {
  return Buffer.from(input).toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function loadServiceAccountKey() {
  let raw = null;
  if (ENV.GSC_SERVICE_ACCOUNT_KEY) {
    raw = ENV.GSC_SERVICE_ACCOUNT_KEY;
  } else if (ENV.GSC_SERVICE_ACCOUNT_KEY_FILE) {
    if (!fs.existsSync(ENV.GSC_SERVICE_ACCOUNT_KEY_FILE)) {
      configError(`GSC_SERVICE_ACCOUNT_KEY_FILE points at a missing file: ${ENV.GSC_SERVICE_ACCOUNT_KEY_FILE}`);
    }
    raw = fs.readFileSync(ENV.GSC_SERVICE_ACCOUNT_KEY_FILE, 'utf8');
  } else {
    configError('Set GSC_SERVICE_ACCOUNT_KEY (CI) or GSC_SERVICE_ACCOUNT_KEY_FILE (local) to the service-account JSON.');
  }
  let key;
  try { key = JSON.parse(raw); } catch { configError('Service-account key is not valid JSON.'); }
  if (!key.client_email || !key.private_key) configError('Service-account key is missing client_email or private_key.');
  return key;
}

async function getAccessToken(key, scope) {
  const now = Math.floor(Date.now() / 1000);
  const header = b64url(JSON.stringify({ alg: 'RS256', typ: 'JWT' }));
  const claims = b64url(JSON.stringify({ iss: key.client_email, scope, aud: TOKEN_ENDPOINT, iat: now, exp: now + 3600 }));
  const signingInput = `${header}.${claims}`;
  const signature = b64url(crypto.createSign('RSA-SHA256').update(signingInput).sign(key.private_key));
  const assertion = `${signingInput}.${signature}`;

  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), TIMEOUT_MS);
  let res;
  try {
    res = await fetch(TOKEN_ENDPOINT, {
      method: 'POST',
      headers: { 'content-type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ grant_type: JWT_GRANT, assertion }),
      signal: ctrl.signal,
    });
  } catch (e) {
    configError(`Token request failed: ${e.name === 'AbortError' ? 'timeout' : e.message}`);
  } finally {
    clearTimeout(t);
  }
  let body = {};
  try { body = await res.json(); } catch { /* keep {} */ }
  if (!res.ok || !body.access_token) {
    // Redact: surface only the OAuth error fields, never the assertion or body dump.
    configError(`Token grant rejected (HTTP ${res.status}): ${body.error || 'unknown'}${body.error_description ? ' - ' + body.error_description : ''}`);
  }
  return body.access_token;
}

// API helper (redacted errors only)
async function api(token, method, url, jsonBody) {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), TIMEOUT_MS);
  try {
    const opts = { method, headers: { authorization: `Bearer ${token}` }, signal: ctrl.signal };
    if (jsonBody !== undefined) {
      opts.headers['content-type'] = 'application/json';
      opts.body = JSON.stringify(jsonBody);
    }
    const res = await fetch(url, opts);
    let body = null;
    if (res.status !== 204) { try { body = await res.json(); } catch { body = null; } }
    return { ok: res.ok, status: res.status, body, errMsg: body?.error?.message || null };
  } catch (e) {
    return { ok: false, status: 0, body: null, errMsg: e.name === 'AbortError' ? 'timeout' : e.message };
  } finally {
    clearTimeout(t);
  }
}

const encSite = encodeURIComponent(SITE_URL);

// section 1: sitemaps
async function checkSitemaps(token) {
  console.log('\nSitemap health');
  const res = await api(token, 'GET', `${WMT}/sites/${encSite}/sitemaps`);
  if (!res.ok) {
    if (res.status === 403) configError('sitemaps.list returned 403 - is the service account added as a user on the GSC property?');
    configError(`sitemaps.list failed (HTTP ${res.status})${res.errMsg ? ': ' + res.errMsg : ''}`);
  }
  const entries = res.body?.sitemap || [];
  const junk = [];
  let canonicalSeen = false;

  for (const s of entries) {
    const pathStr = s.path || '';
    const errors = Number(s.errors || 0);
    const warnings = Number(s.warnings || 0);
    const isCanonical = pathStr === CANONICAL_SITEMAP;
    const isWww = pathStr === WWW_SITEMAP;
    const isXml = /\.xml($|\?)/i.test(pathStr);

    if (isCanonical) {
      canonicalSeen = true;
      if (errors > 0) fail(`canonical sitemap has ${errors} error(s)`, [pathStr]);
      else pass('canonical sitemap.xml present, error-free', [`${s.contents?.[0]?.submitted ?? '?'} submitted URLs, last read ${s.lastDownloaded || 'never'}`]);
      if (warnings > 0) warn(`canonical sitemap has ${warnings} warning(s)`, [pathStr]);
      if (s.isPending) warn('canonical sitemap is still pending (not yet processed)');
      if (s.lastDownloaded && isStale(s.lastDownloaded, 30)) warn('canonical sitemap last read >30 days ago', [s.lastDownloaded]);
    } else if (isWww) {
      info('www-variant sitemap also submitted (harmless duplicate of canonical)', [pathStr]);
    } else if (isXml && errors === 0) {
      info('additional .xml sitemap submitted', [pathStr]);
    } else {
      junk.push({ path: pathStr, errors, isHtml: !isXml });
      warn(`junk sitemap submission (${!isXml ? 'HTML page, not XML' : errors + ' error(s)'})`, [pathStr]);
    }
  }
  if (!canonicalSeen) fail('canonical sitemap.xml is NOT among submitted sitemaps', [CANONICAL_SITEMAP]);

  report.sections.sitemaps = { total: entries.length, junk: junk.map((j) => j.path), canonicalSeen };
  return junk;
}

function isStale(dateStr, days) {
  const then = Date.parse(dateStr);
  if (Number.isNaN(then)) return false;
  return (Date.now() - then) > days * 86400000;
}

// allowlist-guarded deletion: never the canonical, never any .xml, only
// error-bearing HTML submissions.
async function deleteJunkSitemaps(token, junk) {
  console.log('\nDelete junk sitemaps (--delete-junk)');
  const deletable = junk.filter((j) => j.path !== CANONICAL_SITEMAP && j.isHtml && j.errors > 0);
  if (deletable.length === 0) { info('nothing to delete (no error-bearing HTML submissions).'); return; }
  for (const j of deletable) {
    // feedpath is itself a URL - encode it so its slashes/colon do not break the path segment.
    const res = await api(token, 'DELETE', `${WMT}/sites/${encSite}/sitemaps/${encodeURIComponent(j.path)}`);
    if (res.ok) pass(`deleted ${j.path}`);
    else if (res.status === 403) configError(`DELETE 403 on ${j.path} - the SA needs delegated Owner permission (Full cannot delete sitemaps).`);
    else fail(`DELETE failed (HTTP ${res.status}) on ${j.path}`, res.errMsg ? [res.errMsg] : undefined);
  }
}

// section 2: search analytics
function isoDate(d) { return new Date(d).toISOString().slice(0, 10); }

async function checkSearchAnalytics(token) {
  console.log('\nSearch analytics (last 28 days)');
  const end = Date.now() - 3 * 86400000;        // GSC data lags 2-3 days
  const start = end - 27 * 86400000;
  const range = { startDate: isoDate(start), endDate: isoDate(end) };

  const totalsRes = await api(token, 'POST', `${WMT}/sites/${encSite}/searchAnalytics/query`, { ...range, dimensions: [] });
  if (!totalsRes.ok) { warn(`searchAnalytics.query failed (HTTP ${totalsRes.status})`, totalsRes.errMsg ? [totalsRes.errMsg] : undefined); return; }
  const row = totalsRes.body?.rows?.[0];
  if (!row) { warn('no search-analytics data in window (property may be new or mis-scoped)', [`${range.startDate} -> ${range.endDate}`]); return; }
  const ctr = (row.ctr * 100).toFixed(1);
  info(`${range.startDate} -> ${range.endDate}`, [
    `clicks ${row.clicks}  impressions ${row.impressions}  CTR ${ctr}%  avg position ${row.position.toFixed(1)}`,
  ]);

  const topRes = await api(token, 'POST', `${WMT}/sites/${encSite}/searchAnalytics/query`, { ...range, dimensions: ['query'], rowLimit: 5 });
  const top = (topRes.body?.rows || []).map((r) => `${r.keys[0]} - ${r.clicks} clicks, ${r.impressions} impr`);
  if (top.length) info('top queries', top);
  report.sections.analytics = { range, totals: { clicks: row.clicks, impressions: row.impressions, ctr: row.ctr, position: row.position }, topQueries: top };
}

// section 3: URL inspection
async function fetchSitemapLocs() {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), TIMEOUT_MS);
  try {
    const r = await fetch(CANONICAL_SITEMAP, { redirect: 'follow', signal: ctrl.signal });
    if (!r.ok) return null;
    const text = await r.text();
    return [...text.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1]);
  } catch { return null; } finally { clearTimeout(t); }
}

function sampleEntities(locs) {
  const out = [];
  for (const [prefix, n] of Object.entries(ENTITY_SAMPLE)) {
    out.push(...locs.filter((u) => u.includes(prefix)).slice(0, n));
  }
  return out;
}

async function inspectUrls(token, locs) {
  console.log('\nURL inspection (key routes + entity samples)');
  const urls = [...INSPECT_ROUTES.map((p) => `${BASE}${p}`)];
  if (locs) urls.push(...sampleEntities(locs));

  const inspected = [];
  for (const url of urls) {
    const res = await api(token, 'POST', INSPECT_ENDPOINT, { inspectionUrl: url, siteUrl: SITE_URL });
    if (!res.ok) {
      warn(`inspect failed (HTTP ${res.status})`, [url, res.errMsg].filter(Boolean));
      await sleep(INSPECT_DELAY_MS);
      continue;
    }
    const idx = res.body?.inspectionResult?.indexStatusResult || {};
    const verdict = idx.verdict || 'UNKNOWN';
    const coverage = idx.coverageState || '';
    const robots = idx.robotsTxtState || '';
    const indexingState = idx.indexingState || '';
    const pathStr = url.startsWith(BASE) ? (url.slice(BASE.length) || '/') : url;
    const expectedRedirect = INTENTIONAL_REDIRECTS.has(pathStr);
    inspected.push({ url, verdict, coverage, robots, indexingState });

    const robotsBlocked = robots === 'DISALLOWED';
    const metaBlocked = indexingState === 'BLOCKED_BY_META_TAG' || indexingState === 'BLOCKED_BY_HTTP_HEADER';
    const redirectish = /redirect/i.test(coverage);

    if (robotsBlocked && !expectedRedirect) {
      fail(`blocked from indexing by robots.txt: ${pathStr}`, [`robots=${robots}`]);
    } else if (metaBlocked && !expectedRedirect) {
      warn(`noindex meta/header on: ${pathStr}`, [`indexing=${indexingState}`]);
    } else if (redirectish && expectedRedirect) {
      pass(`${pathStr} (intentional client-side redirect)`, [coverage]);
    } else if (redirectish && !expectedRedirect) {
      warn(`unexpected redirect coverage: ${pathStr}`, [coverage]);
    } else if (verdict === 'PASS') {
      pass(`${pathStr}`, coverage ? [coverage] : undefined);
    } else if (/not indexed/i.test(coverage)) {
      info(`${pathStr}`, [coverage]);   // "Discovered/Crawled - currently not indexed"
    } else {
      warn(`${pathStr} verdict ${verdict}`, [coverage].filter(Boolean));
    }
    await sleep(INSPECT_DELAY_MS);
  }
  report.sections.inspections = inspected;
}

function sleep(ms) { return new Promise((r) => setTimeout(r, ms)); }

// section 4: sitemap-vs-live diff
async function fetchStatus(url) {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), TIMEOUT_MS);
  try {
    const r = await fetch(url, { method: 'GET', redirect: 'manual', signal: ctrl.signal });
    try { r.body?.cancel?.(); } catch { /* ignore */ }
    return { status: r.status, location: r.headers.get('location') || null };
  } catch (e) {
    return { status: 0, location: null, err: e.name === 'AbortError' ? 'timeout' : e.message };
  } finally {
    clearTimeout(t);
  }
}

async function pool(items, n, worker) {
  const out = new Array(items.length);
  let i = 0;
  await Promise.all(Array.from({ length: Math.min(n, items.length) }, async () => {
    while (i < items.length) { const idx = i++; out[idx] = await worker(items[idx], idx); }
  }));
  return out;
}

async function liveDiff(locs) {
  console.log('\nSitemap-vs-live diff');
  if (!locs) { warn('could not fetch live sitemap.xml - skipping diff'); return; }
  console.log(`  checking ${locs.length} URLs (concurrency ${LIVE_CONCURRENCY})...`);
  const results = await pool(locs, LIVE_CONCURRENCY, fetchStatus);
  const missing = [], server = [], redirects = [], errors = [];
  results.forEach((r, i) => {
    const u = locs[i];
    if (r.status === 404 || r.status === 410) missing.push(`${u} -> ${r.status}`);
    else if (r.status >= 500) server.push(`${u} -> ${r.status}`);
    else if (r.status >= 300 && r.status < 400) redirects.push(`${u} -> ${r.status} ${r.location || ''}`.trim());
    else if (r.status === 0) errors.push(`${u} -> ${r.err}`);
  });

  if (missing.length) warn(`${missing.length} sitemap URL(s) return 404/410`, missing.slice(0, 25).concat(missing.length > 25 ? [`... +${missing.length - 25} more`] : []));
  if (server.length) warn(`${server.length} sitemap URL(s) return 5xx`, server.slice(0, 25));
  if (redirects.length) warn(`${redirects.length} sitemap URL(s) redirect (sitemap should be canonical-only)`, redirects.slice(0, 15));
  if (errors.length) warn(`${errors.length} sitemap URL(s) errored/timed out`, errors.slice(0, 15));
  const okCount = results.length - missing.length - server.length - redirects.length - errors.length;
  if (!missing.length && !server.length && !redirects.length && !errors.length) pass(`all ${results.length} sitemap URLs return 2xx`);
  else info(`${okCount}/${results.length} sitemap URLs are 2xx`);
  report.sections.liveDiff = { total: results.length, ok: okCount, missing, server, redirects, errors: errors.length };
}

// exit helpers
function configError(msg) {
  console.error(`\ncheck-gsc: config/transport error - ${msg}`);
  writeReport(2);
  process.exit(2);
}
function writeReport(exitCode) {
  if (!FLAGS.jsonPath) return;
  report.generatedAt = new Date().toISOString();
  report.exitCode = exitCode;
  try { fs.writeFileSync(FLAGS.jsonPath, JSON.stringify(report, null, 2)); } catch (e) { console.error(`could not write ${FLAGS.jsonPath}: ${e.message}`); }
}

// section 5: sitemap submit (notify Google to re-crawl after a deploy)
async function submitSitemap(token) {
  console.log('\nSitemap submit');
  const feedpath = encodeURIComponent(CANONICAL_SITEMAP);
  const res = await api(token, 'PUT', `${WMT}/sites/${encSite}/sitemaps/${feedpath}`);
  if (res.ok) {
    pass('sitemap submitted to Google', [CANONICAL_SITEMAP]);
  } else if (res.status === 403) {
    configError('sitemaps.submit returned 403 - SA needs Full or Owner permission on the GSC property.');
  } else {
    fail(`sitemaps.submit failed (HTTP ${res.status})`, res.errMsg ? [res.errMsg] : undefined);
  }
}

// section 5b: weekly digest (markdown) - analytics WoW delta, top queries, sitemap health
async function analyticsTotals(token, startDate, endDate) {
  const res = await api(token, 'POST', `${WMT}/sites/${encSite}/searchAnalytics/query`, { startDate, endDate, dimensions: [] });
  return res.ok ? (res.body?.rows?.[0] || null) : null;
}
async function analyticsTopQueries(token, startDate, endDate, n) {
  const res = await api(token, 'POST', `${WMT}/sites/${encSite}/searchAnalytics/query`, { startDate, endDate, dimensions: ['query'], rowLimit: n });
  return res.ok ? (res.body?.rows || []) : [];
}
function deltaPct(cur, prev) {
  if (prev == null || prev === 0) return cur > 0 ? 'new' : 'flat';
  const d = ((cur - prev) / prev) * 100;
  return `${d >= 0 ? '+' : ''}${d.toFixed(0)}%`;
}
async function buildDigest(token) {
  const day = 86400000;
  const curEnd = Date.now() - 3 * day;            // GSC data lags ~3 days
  const curStart = curEnd - 27 * day;
  const prevEnd = curStart - day;
  const prevStart = prevEnd - 27 * day;
  const [cur, prev, top] = await Promise.all([
    analyticsTotals(token, isoDate(curStart), isoDate(curEnd)),
    analyticsTotals(token, isoDate(prevStart), isoDate(prevEnd)),
    analyticsTopQueries(token, isoDate(curStart), isoDate(curEnd), 10),
  ]);

  const L = [];
  L.push(`# Search digest - ${isoDate(curStart)} to ${isoDate(curEnd)}`);
  L.push('');
  L.push(`Property: \`${SITE_URL}\`  (delta vs previous 28 days ${isoDate(prevStart)} to ${isoDate(prevEnd)})`);
  L.push('');
  if (cur) {
    const c = cur; const p = prev || {};
    const posDelta = (p.position != null) ? `${c.position - p.position >= 0 ? '+' : ''}${(c.position - p.position).toFixed(1)}` : 'n/a';
    L.push('| Metric | This 28d | vs prev |');
    L.push('|---|---|---|');
    L.push(`| Clicks | **${c.clicks}** | ${deltaPct(c.clicks, p.clicks)} |`);
    L.push(`| Impressions | ${c.impressions} | ${deltaPct(c.impressions, p.impressions)} |`);
    L.push(`| CTR | ${(c.ctr * 100).toFixed(1)}% | ${deltaPct(c.ctr, p.ctr)} |`);
    L.push(`| Avg position | ${c.position.toFixed(1)} | ${posDelta} (lower is better) |`);
  } else {
    L.push('_No search-analytics data in window (property new or mis-scoped)._');
  }
  L.push('');
  if (top.length) {
    L.push('### Top queries');
    L.push('');
    L.push('| Query | Clicks | Impr | CTR | Pos |');
    L.push('|---|---|---|---|---|');
    for (const r of top) L.push(`| ${r.keys[0]} | ${r.clicks} | ${r.impressions} | ${(r.ctr * 100).toFixed(1)}% | ${r.position.toFixed(1)} |`);
    L.push('');
  }
  const smRes = await api(token, 'GET', `${WMT}/sites/${encSite}/sitemaps`);
  if (smRes.ok) {
    const entries = smRes.body?.sitemap || [];
    const canonical = entries.find((s) => s.path === CANONICAL_SITEMAP);
    const junkN = entries.filter((s) => s.path !== CANONICAL_SITEMAP && s.path !== WWW_SITEMAP && !/\.xml($|\?)/i.test(s.path || '')).length;
    L.push('### Sitemap');
    L.push('');
    L.push(`- Canonical: ${canonical ? `${canonical.contents?.[0]?.submitted ?? '?'} URLs, last read ${canonical.lastDownloaded || 'never'}` : '**MISSING**'}`);
    if (junkN) L.push(`- ${junkN} junk HTML submission(s) still present (clear with \`--delete-junk\`)`);
    L.push('');
  }
  return L.join('\n');
}

// main
async function main() {
  const scope = (FLAGS.deleteJunk || FLAGS.submitCanonical) ? SCOPE_FULL : SCOPE_READONLY;   // decided BEFORE the token is minted (digest is readonly)
  const key = loadServiceAccountKey();
  const token = await getAccessToken(key, scope);

  if (FLAGS.digest) {
    const md = await buildDigest(token);
    if (FLAGS.digestOut) { fs.writeFileSync(FLAGS.digestOut, md); console.error(`digest written to ${FLAGS.digestOut}`); }
    else process.stdout.write(md);
    process.exit(0);
  }

  console.log(`check-gsc - ${SITE_URL}`);

  if (FLAGS.submitCanonical) {
    await submitSitemap(token);
    const { pass: p, warn: w, fail: f } = report.summary;
    console.log(`\n${f} failed, ${w} warned, ${p} passed.`);
    const exitCode = f > 0 ? 1 : 0;
    writeReport(exitCode);
    process.exit(exitCode);
  }

  const junk = await checkSitemaps(token);
  if (FLAGS.deleteJunk) await deleteJunkSitemaps(token, junk);

  await checkSearchAnalytics(token);

  const locs = await fetchSitemapLocs();
  await inspectUrls(token, locs);

  if (!FLAGS.skipLiveDiff) await liveDiff(locs);
  else info('\nlive-diff skipped (--skip-live-diff)');

  const { pass: p, warn: w, fail: f } = report.summary;
  console.log(`\n${f} failed, ${w} warned, ${p} passed.`);
  const exitCode = f > 0 ? 1 : 0;
  writeReport(exitCode);
  process.exit(exitCode);
}

main().catch((e) => { console.error('check-gsc crashed:', e?.message || e); writeReport(2); process.exit(2); });

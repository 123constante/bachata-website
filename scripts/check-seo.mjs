#!/usr/bin/env node
// SEO guardrail. Fetches a sample of live pages and asserts the head + body
// carry the crawlable SEO surface the June arc shipped:
//   - HTTP 200
//   - exactly one canonical, on the www host
//   - page-specific <title> (not the generic site fallback)
//   - non-empty meta description
//   - at least one <h1> (this assertion alone catches the festival-skeleton bug)
//   - parseable JSON-LD; event pages must carry an Event node with
//     name/startDate/location/eventStatus/offers (missing offer price = WARN)
//   - no unexpected noindex
//   - homepage: at least 5 crawlable /event/ links in the server HTML
//
// Targets the DEPLOYED site (SSR/prerender output only exists post-deploy), so
// this runs as a scheduled/post-deploy job, not a PR gate - same reasoning as
// check-og-images.mjs, which this is modelled on. Zero dependencies.
//
//   SEO_CHECK_BASE    base URL (default https://www.bachatacalendar.co.uk)
//   SEO_CHECK_STRICT  '1' => transient network errors fail instead of warn
//
// Exit 1 if any sampled page fails a hard assertion.

import { bypassHeaders, isPreviewHost, previewIsWalled } from './lib/previewProbe.mjs';

const BASE = (process.env.SEO_CHECK_BASE ?? 'https://www.bachatacalendar.co.uk').replace(/\/$/, '');
const STRICT = process.env.SEO_CHECK_STRICT === '1';
// Preview PR coverage: send the Vercel protection-bypass headers when pointed at
// a protected preview; null against public prod (default).
const BYPASS = bypassHeaders({ required: false });
// A *.vercel.app target is a protected preview; prod is public.
const IS_PREVIEW = isPreviewHost(BASE);
const UA = 'Mozilla/5.0 (compatible; BachataCalendarSeoCheck/1.0)';
const GENERIC_TITLE = 'Bachata London'; // root fallback title prefix - landing pages must NOT use it

// Sampled per prefix from the live sitemap. Event pages get 3 samples so a
// festival-format event (which regressed to a skeleton in July 2026) is likely
// in the pool even without type information in the sitemap.
const PREFIX_SAMPLE = { '/event/': 3, '/dancers/': 1, '/organisers/': 1 };

// Fixed probes, checked when they still 200 (skipped once retired):
//   - a festival-format event at its /event/ canonical (the July 2026 skeleton
//     regression - zero h1, zero JSON-LD)
const FIXED_EVENT_PROBES = ['/event/london-sensual-days-summer-edition'];

// Static pages: [path, requiresEventNode, minEventLinks]
const STATIC_PAGES = [
  ['/', false, 5],
  ['/parties', false, 0],
  ['/london-bachata-guide', false, 0],
  ['/faq', false, 0],
];

async function fetchText(url) {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), 15000);
  try {
    const r = await fetch(url, { headers: { 'user-agent': UA, ...(BYPASS ?? {}) }, redirect: 'follow', signal: ctrl.signal });
    return { ok: r.ok, status: r.status, text: r.ok ? await r.text() : '' };
  } finally {
    clearTimeout(t);
  }
}

async function sampleUrls() {
  const urls = STATIC_PAGES.map(([p]) => p);
  const { ok, text } = await fetchText(`${BASE}/sitemap.xml`);
  if (!ok) {
    console.error('  could not fetch sitemap.xml - static sample only');
  } else {
    const locs = [...text.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1]);
    for (const [prefix, n] of Object.entries(PREFIX_SAMPLE)) {
      for (const u of locs.filter((x) => x.includes(prefix)).slice(0, n)) {
        urls.push(u.replace(/^https?:\/\/[^/]+/, ''));
      }
    }
  }
  for (const probe of FIXED_EVENT_PROBES) {
    if (!urls.includes(probe)) urls.push(probe);
  }
  return urls;
}

function extractJsonLd(html) {
  const blocks = [];
  const re = /<script[^>]*type="application\/ld\+json"[^>]*>([\s\S]*?)<\/script>/gi;
  let m;
  while ((m = re.exec(html))) {
    try {
      blocks.push(JSON.parse(m[1]));
    } catch {
      blocks.push({ __parseError: true });
    }
  }
  return blocks;
}

function findEventNode(blocks) {
  const flat = [];
  const walk = (n) => {
    if (!n || typeof n !== 'object') return;
    if (Array.isArray(n)) return n.forEach(walk);
    flat.push(n);
    if (Array.isArray(n['@graph'])) n['@graph'].forEach(walk);
  };
  blocks.forEach(walk);
  return flat.find((n) => n['@type'] === 'Event' || n['@type'] === 'DanceEvent') ?? null;
}

async function checkPage(path, { isEvent = false, isFixedProbe = false, minEventLinks = 0 } = {}) {
  const url = `${BASE}${path}`;
  const failures = [];
  const warns = [];

  let res;
  try {
    res = await fetchText(url);
  } catch (e) {
    const msg = `fetch failed: ${e?.message ?? e}`;
    return STRICT ? { path, failures: [msg], warns } : { path, failures: [], warns: [msg] };
  }

  if (!res.ok) {
    if (isFixedProbe && res.status === 404) {
      return { path, failures: [], warns: ['fixed probe now 404s - retire it from FIXED_EVENT_PROBES'] };
    }
    return { path, failures: [`HTTP ${res.status}`], warns };
  }
  const html = res.text;

  // canonical: exactly one, on the www host
  const canonicals = [...html.matchAll(/<link[^>]+rel="canonical"[^>]*>/g)].map((m) => m[0]);
  if (canonicals.length !== 1) {
    failures.push(`expected exactly 1 canonical, found ${canonicals.length}`);
  } else {
    const href = canonicals[0].match(/href="([^"]+)"/)?.[1] ?? '';
    if (!href.startsWith('https://www.bachatacalendar.co.uk')) {
      failures.push(`canonical not on www host: ${href}`);
    }
  }

  // title: present and page-specific (homepage legitimately uses the site title)
  const title = html.match(/<title[^>]*>([^<]*)<\/title>/)?.[1]?.trim() ?? '';
  if (!title) failures.push('missing <title>');
  else if (path !== '/' && title.startsWith(GENERIC_TITLE)) {
    failures.push(`generic fallback title ("${title}") - page-specific head tags missing`);
  }

  // meta description: present and non-empty
  const desc = html.match(/<meta[^>]+name="description"[^>]+content="([^"]*)"/)?.[1]
    ?? html.match(/<meta[^>]+content="([^"]*)"[^>]+name="description"/)?.[1] ?? '';
  if (!desc.trim()) failures.push('missing/empty meta description');

  // h1: the assertion that catches skeleton SSR
  const h1Count = (html.match(/<h1[\s>]/g) ?? []).length;
  if (h1Count < 1) failures.push('no <h1> in server HTML (skeleton/shell render?)');

  // noindex: never expected on sampled pages
  if (/<meta[^>]+name="robots"[^>]+noindex/i.test(html)) failures.push('unexpected noindex');

  // JSON-LD
  const blocks = extractJsonLd(html);
  if (blocks.some((b) => b.__parseError)) failures.push('unparseable JSON-LD block');
  if (isEvent) {
    const ev = findEventNode(blocks);
    if (!ev) {
      failures.push('no Event JSON-LD node');
    } else {
      for (const field of ['name', 'startDate', 'location', 'eventStatus', 'offers']) {
        if (ev[field] == null) failures.push(`Event JSON-LD missing ${field}`);
      }
      const offers = Array.isArray(ev.offers) ? ev.offers : [ev.offers];
      if (ev.offers != null && !offers.some((o) => o && o.price != null)) {
        warns.push('no offer carries a price (organiser data gap, not a code failure)');
      }
    }
  }

  // homepage: crawlable event links restored (July 2026 regression: 0 links)
  if (minEventLinks > 0) {
    const n = (html.match(/href="\/event\//g) ?? []).length;
    if (n < minEventLinks) failures.push(`only ${n} /event/ links in server HTML (expected >= ${minEventLinks})`);
  }

  return { path, failures, warns };
}

async function main() {
  console.log(`SEO guard against ${BASE}`);

  // A protected preview we cannot reach is not an SEO failure. Skip (green with a
  // GitHub warning annotation) rather than crash on the SSO redirect loop. Prod is
  // public, so IS_PREVIEW is false there and this never short-circuits the real run.
  if (IS_PREVIEW && (await previewIsWalled(BASE, { bypass: BYPASS, ua: UA }))) {
    console.log(
      '::warning title=SEO preview skipped::The Vercel preview is behind Deployment ' +
        'Protection and the automation bypass was absent or rejected, so preview SEO ' +
        'could not be checked. Production SEO is still covered by the scheduled run. ' +
        'To enable preview coverage, set a working VERCEL_AUTOMATION_BYPASS_SECRET ' +
        '(Vercel -> Settings -> Deployment Protection -> Protection Bypass for Automation).',
    );
    console.log('Skipped: preview unreachable behind Deployment Protection.');
    return;
  }

  const urls = await sampleUrls();
  let hardFailures = 0;

  for (const path of urls) {
    const staticEntry = STATIC_PAGES.find(([p]) => p === path);
    const result = await checkPage(path, {
      isEvent: path.startsWith('/event/'),
      isFixedProbe: FIXED_EVENT_PROBES.includes(path),
      minEventLinks: staticEntry ? staticEntry[2] : 0,
    });
    const status = result.failures.length ? 'FAIL' : 'ok';
    console.log(`  [${status}] ${path}`);
    for (const f of result.failures) console.log(`      FAIL: ${f}`);
    for (const w of result.warns) console.log(`      warn: ${w}`);
    hardFailures += result.failures.length;
  }

  if (hardFailures > 0) {
    console.error(`\n${hardFailures} SEO assertion(s) failed.`);
    process.exit(1);
  }
  console.log('\nAll SEO assertions passed.');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

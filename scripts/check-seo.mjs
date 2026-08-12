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
//   - homepage + the 9 event-bearing SEO landing pages: a minimum number of
//     crawlable /event/ links in the server HTML (see STATIC_PAGES)
//
// Measurement floors (previewProbe.assertMeasured -- the fail-loud contract),
// all evaluated AFTER the page loop so a shortfall never cancels assertions
// that could still have run. Per-page fetch failures stay WARNS on purpose (a
// transient blip must never decide hard-vs-warn); the floors are what red a
// run that warned its way through the sample and measured (next to) nothing:
//   1. sitemap-derived sample pages -- a failed sitemap fetch silently dropped
//      ALL PREFIX_SAMPLE coverage and still passed green on the static list.
//   2. pages fetched and measured -- the blanket coverage floor.
//   3. link-bearing pages measured -- floors 1+2 are satisfiable while every
//      page carrying a minEventLinks assertion went unfetched, i.e. while the
//      July 2026 zero-links homepage and the prerender-era "(0 events)" body
//      go unmeasured. A floor on the CLASS is what actually guards them.
//   4. event pages asserted -- likewise for the Event JSON-LD assertions;
//      greening on one hand-picked probe URL is the sampling lottery
//      check-og-images.mjs was widened to kill.
//
// Targets the DEPLOYED site (SSR/prerender output only exists post-deploy), so
// this runs as a scheduled/post-deploy job, not a PR gate - same reasoning as
// check-og-images.mjs, which this is modelled on. Zero dependencies.
//
//   SEO_CHECK_BASE    base URL (default https://www.bachatacalendar.co.uk)
//   SEO_CHECK_STRICT  '1' => transient network errors fail instead of warn.
//                     Local escalation only -- no workflow sets it, and CI
//                     honesty deliberately comes from the floors above, not
//                     from escalating individual blips.
//
// Exit 1 if any sampled page fails a hard assertion or a floor is missed.
// --self-test runs the network-free canary (see selfTest at the bottom).

import { assertMeasured, bypassHeaders, isPreviewHost, skipIfWalledPreview } from './lib/previewProbe.mjs';
import { isEntryPoint } from './lib/entry-point.mjs';

const BASE = (process.env.SEO_CHECK_BASE ?? 'https://www.bachatacalendar.co.uk').replace(/\/$/, '');
const STRICT = process.env.SEO_CHECK_STRICT === '1';
const UA = 'Mozilla/5.0 (compatible; BachataCalendarSeoCheck/1.0)';
const GENERIC_TITLE = 'Bachata London'; // root fallback title prefix - landing pages must NOT use it

// Preview PR coverage: the Vercel protection-bypass headers when pointed at a
// protected preview; null against public prod (default).
//
// Resolved INSIDE main(), not at module scope, for two measured reasons. (1) A
// module-eval throw fires before the banner, so the run dies without ever
// printing which base it was aimed at -- check-lighthouse.mjs computes it in
// main() for exactly this. (2) It keeps --self-test genuinely network-free
// under refactoring: with the demand at module scope, the canary's freedom
// depends on the WORKFLOW never setting SEO_CHECK_BASE on that step, so
// hoisting the env to job level (the natural tidy-up) would kill a
// network-free self-test with an unrelated bypass-secret error.
//
// REQUIRED when the base is a *.vercel.app preview. With no secret at all the
// run is unauthenticated: at best skipIfWalledPreview proves the wall and
// green-skips, at worst the wall bounces /sso-api -> /login until fetch dies
// with "redirect count exceeded" -- an error naming neither SEO nor the bypass,
// which once sent a real investigation chasing the wrong cause. The demand
// throws IN CI ONLY (bypassHeaders is deliberately lax without process.env.CI,
// so a local run against a preview with no secret still goes unauthenticated).
// A PRESENT-but-rejected secret normally lands on skipIfWalledPreview's proven
// wall instead -- though a protection mode that loops rather than parks on
// vercel.com is indistinguishable from a missing header on the wire, so a
// redirect death does not prove which. Prod stays bypass-free: it is public.
let BYPASS = null;

// Sampled per prefix from the live sitemap. Event pages get 3 samples so a
// festival-format event (which regressed to a skeleton in July 2026) is likely
// in the pool even without type information in the sitemap.
const PREFIX_SAMPLE = { '/event/': 3, '/dancers/': 1, '/organisers/': 1 };

// Static pages: [path, minEventLinks]
//
// The 9 event-bearing SEO landing pages carry a NON-ZERO minEventLinks: they
// moved from build-time prerender (which indexed "(0 events)" and zero /event/
// links) to SSR + ISR that dehydrates a real list, and this is the guardrail
// that keeps them that way. Thresholds sit well below the counts measured on the
// 2026-07-28 build (guide 10, learn 12, weekdays 2-7), so a quiet week is not a
// red build -- the failure they exist to catch is the section regressing to
// EMPTY, not a thin one. Monday is the quietest weekday in the data, hence 1.
//
// The three all-prose landing pages (/bachata-parties-london + the two style
// pages) stay prerendered and carry no event list, so they check 0 links and are
// listed only for their h1/canonical/title/description assertions.
//
// A third `requiresEventNode` element used to sit in the middle of every row,
// read by nothing (isEvent is derived from the path). Dropped: a dead
// POSITIONAL field is a trap, because deleting it later silently shifts
// minEventLinks to undefined, which reads as 0 and disables every link floor.
const STATIC_PAGES = [
  ['/', 5],
  ['/parties', 0],
  ['/faq', 0],
  // SSR + ISR, real event lists
  ['/london-bachata-guide', 3],
  ['/learn-bachata-london', 3],
  ['/bachata-london-monday', 1],
  ['/bachata-london-tuesday', 1],
  ['/bachata-london-wednesday', 1],
  ['/bachata-london-thursday', 1],
  ['/bachata-london-friday', 1],
  ['/bachata-london-saturday', 1],
  ['/bachata-london-sunday', 1],
  // Prerendered prose, no event list
  ['/bachata-parties-london', 0],
  ['/bachata-london-sensual-parties', 0],
  ['/bachata-london-dominican-parties', 0],
];

// Fixed probes, checked when they still 200 (skipped once retired):
//   - a festival-format event at its /event/ canonical (the July 2026 skeleton
//     regression - zero h1, zero JSON-LD)
const FIXED_EVENT_PROBES = ['/event/london-sensual-days-summer-edition'];

// Floor values, ABSOLUTE promises rather than fractions of the run: a floor
// derived from what the run happened to collect shrinks exactly when coverage
// shrinks, which is the failure these exist to catch. Measured against prod
// 2026-08-10: 15 static + 5 sitemap + 1 probe = 21 pages, of which 10 carry a
// minEventLinks assertion and 4 are event pages. They are NOT self-maintaining
// -- growing STATIC_PAGES means raising these deliberately.
const MIN_SITEMAP_PAGES = 3;   // "the sitemap clearly worked", not a per-prefix assertion:
                               // entity types legitimately come and go (same rationale as
                               // check-og-images' MIN_OG_PAGES). Still reds a sitemap that
                               // fetched but parsed to nothing.
const MIN_PAGES_MEASURED = 10; // blanket coverage: under half of today's 21 answering is an
                               // outage, not a blip. On its own it is weak (see the class
                               // floors below, which is why they exist).
const MIN_LINK_PAGES = 8;      // of the 10 pages carrying minEventLinks > 0
const MIN_EVENT_PAGES = 3;     // of the 4 event pages a healthy run asserts. >1 on purpose:
                               // at 1, three of four could time out and the run would green
                               // on the single hand-picked probe URL. NOTE the slack this
                               // floor has depends on the fixed probe still resolving: once
                               // it 404s and is retired, the 3 sitemap-derived event pages
                               // are the whole supply and a single blip reds the run. Retire
                               // the probe and this floor together -- either replace the
                               // probe or drop this to 2.

// The floors as DATA, so the canary can prove all four exist and fire. A
// missing counter key reads as 0 -- a typo in main() fails CLOSED (red), never
// silently unguarded.
const FLOORS = [
  { key: 'fromSitemap', min: MIN_SITEMAP_PAGES, label: 'sitemap-derived sample pages' },
  { key: 'measured', min: MIN_PAGES_MEASURED, label: 'pages fetched and measured' },
  { key: 'linkPagesChecked', min: MIN_LINK_PAGES, label: 'link-bearing pages measured' },
  { key: 'eventsAsserted', min: MIN_EVENT_PAGES, label: 'event pages with Event JSON-LD asserted' },
];

function floorShortfalls(counts) {
  return FLOORS.filter((f) => (counts[f.key] ?? 0) < f.min);
}

async function fetchText(url) {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), 15000);
  try {
    const r = await fetch(url, { headers: { 'user-agent': UA, ...(BYPASS ?? {}) }, redirect: 'follow', signal: ctrl.signal });
    if (!r.ok) {
      // Unconsumed undici bodies keep the event loop alive for minutes
      // (measured -- see previewProbe.mjs); the !ok arm never reads the text.
      // This became load-bearing when the tail moved to process.exitCode: the
      // old process.exit(1) killed the process outright and MASKED the leak.
      // A/B measured 2026-08-10 against a local 404 server, 15 pages: 0.129s
      // with this cancel, 6.123s without -- and that is localhost, where the
      // repo's "minutes" figure came from a real CDN.
      await r.body?.cancel();
      return { ok: false, status: r.status, text: '' };
    }
    return { ok: true, status: r.status, text: await r.text() };
  } finally {
    clearTimeout(t);
  }
}

// Pure: sitemap XML in, sampled PATHS out. Deduped against itself and against
// anything already sampled (the static list), because a duplicated <loc> --
// a slug/id collision in the sitemap route, a paginated regeneration bug --
// would otherwise present ONE distinct page as several units of coverage in
// both the sitemap floor and the measured floor. The COUNT is deliberately not
// returned alongside: paths.length is the count, and a second field that can
// never diverge only manufactures the look of an independent measurement.
function parseSitemapSample(text, alreadySampled = []) {
  const seen = new Set(alreadySampled);
  const locs = [...text.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1]);
  const paths = [];
  for (const [prefix, n] of Object.entries(PREFIX_SAMPLE)) {
    // slice BEFORE dedupe on purpose: the per-prefix budget is "look at the
    // first n entries", so a duplicate inside that window costs coverage and
    // must be visible as a lower count, not silently backfilled.
    for (const u of locs.filter((x) => x.includes(prefix)).slice(0, n)) {
      const p = u.replace(/^https?:\/\/[^/]+/, '');
      if (seen.has(p)) continue;
      seen.add(p);
      paths.push(p);
    }
  }
  return paths;
}

async function sampleUrls() {
  const urls = STATIC_PAGES.map(([p]) => p);
  let sitemapPaths = [];
  // A sitemap death (non-200 OR a thrown fetch) no longer decides the exit on
  // its own -- it empties the sitemap sample, every static page is still
  // fetched and asserted, and the MIN_SITEMAP_PAGES floor at the END of the
  // run reds it with an error naming what was not measured.
  let sitemap = { ok: false, text: '' };
  try {
    sitemap = await fetchText(`${BASE}/sitemap.xml`);
  } catch (e) {
    console.error(`  sitemap.xml fetch threw: ${e?.message ?? e}`);
  }
  if (!sitemap.ok) {
    console.error('  could not fetch sitemap.xml - the sitemap-sample floor will fail this run');
  } else {
    sitemapPaths = parseSitemapSample(sitemap.text, urls);
    urls.push(...sitemapPaths);
  }
  for (const probe of FIXED_EVENT_PROBES) {
    if (!urls.includes(probe)) urls.push(probe);
  }
  return { urls, sitemapPaths };
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

// The whole per-page assertion surface, PURE (path + server HTML in, failures
// and warns out) so the canary can prove the assertions without a network.
// checkPage owns the fetch and the status-code handling.
function auditHtml(path, html, { isEvent = false, minEventLinks = 0 } = {}) {
  const failures = [];
  const warns = [];

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

  // noindex: never expected on sampled pages. Deliberately the ORIGINAL loose
  // form -- it matches "noindex" anywhere after name="robots", so it catches
  // content='noindex' and bare content=noindex as well as the quoted case.
  // A rewrite into a name/content attribute-order pair looked like a widening
  // and was in fact a NARROWING (it required content="), measured in review:
  // the two forms above started passing green. Reverted. The real gaps --
  // reversed attribute order, content="none", name="googlebot", and the
  // X-Robots-Tag response header, which fetchText discards entirely -- are
  // queued as one widening in plans/queued-seo-og-guard-review-findings.md
  // rather than patched in piecemeal here.
  if (/<meta[^>]+name="robots"[^>]+noindex/i.test(html)) failures.push('unexpected noindex');

  // JSON-LD. `b &&` is load-bearing: a block of literal `null` parses to null,
  // and reading .__parseError off it threw a TypeError that killed the whole
  // run -- before the receipt and before every floor -- with a stack naming
  // neither the page nor SEO.
  const blocks = extractJsonLd(html);
  if (blocks.some((b) => b && b.__parseError)) failures.push('unparseable JSON-LD block');
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

  // Crawlable event links in the SERVER HTML. Homepage: the July 2026 regression
  // (0 links). SEO landing pages: the prerender-era "(0 events)" indexed body.
  if (minEventLinks > 0) {
    const n = (html.match(/href="\/event\//g) ?? []).length;
    if (n < minEventLinks) failures.push(`only ${n} /event/ links in server HTML (expected >= ${minEventLinks})`);
  }

  return { failures, warns };
}

// `measured` means ASSERTIONS RAN on this page -- it is set on the auditHtml
// path and nowhere else. A non-200 (including the fixed probe's forgiven 404)
// returns measured:false: nothing about that page's SEO surface was checked,
// so counting it toward the floors would certify coverage that does not
// exist. Today a 503 is also a hard failure, but the floors must not depend on
// that coincidence -- add one more forgiven status and a counter that counted
// FETCHES would start passing on pages nothing was measured on.
//
// The fetcher is injectable so the canary can drive this mapping -- the single
// assignment every floor rests on -- through all four outcomes without a
// network. Nothing else passes the third argument.
async function checkPage(path, { isEvent = false, isFixedProbe = false, minEventLinks = 0 } = {}, fetcher = fetchText) {
  const url = `${BASE}${path}`;
  const unmeasured = { path, measured: false, eventAsserted: false, linkPageChecked: false };

  let res;
  try {
    res = await fetcher(url);
  } catch (e) {
    const msg = `fetch failed: ${e?.message ?? e}`;
    return STRICT
      ? { ...unmeasured, failures: [msg], warns: [] }
      : { ...unmeasured, failures: [], warns: [msg] };
  }

  if (!res.ok) {
    if (isFixedProbe && res.status === 404) {
      return { ...unmeasured, failures: [], warns: ['fixed probe now 404s - retire it from FIXED_EVENT_PROBES'] };
    }
    return { ...unmeasured, failures: [`HTTP ${res.status}`], warns: [] };
  }

  const { failures, warns } = auditHtml(path, res.text, { isEvent, minEventLinks });
  return { path, measured: true, eventAsserted: isEvent, linkPageChecked: minEventLinks > 0, failures, warns };
}

// Pure counters over the per-page results, so the canary can prove what the
// floors are fed rather than only that assertMeasured throws.
function tally(results) {
  return {
    measured: results.filter((r) => r.measured).length,
    linkPagesChecked: results.filter((r) => r.linkPageChecked).length,
    eventsAsserted: results.filter((r) => r.eventAsserted).length,
  };
}

async function main() {
  console.log(`SEO guard against ${BASE}`);
  // After the banner, before any I/O: a missing bypass secret on a preview
  // base throws here, with the base already printed.
  BYPASS = bypassHeaders({ required: isPreviewHost(BASE) });

  // A PROVEN Deployment Protection wall (401/403 or parked on Vercel's login
  // surface) is not an SEO failure: skip green with a warning. Anything else
  // (timeout, DNS, broken preview) is NOT walled and the real check runs and
  // fails loud. The isPreviewHost gate is inside the helper, so this never
  // short-circuits the public production run.
  if (await skipIfWalledPreview(BASE, { bypass: BYPASS, ua: UA, label: 'SEO preview skipped', subject: 'preview SEO could not be checked' })) {
    return;
  }

  const { urls, sitemapPaths } = await sampleUrls();
  const fromSitemap = new Set(sitemapPaths);
  const results = [];

  for (const path of urls) {
    const staticEntry = STATIC_PAGES.find(([p]) => p === path);
    const result = await checkPage(path, {
      isEvent: path.startsWith('/event/'),
      // Provenance, not membership: a probe path the LIVE sitemap is
      // advertising is not a retired probe, so its 404 must stay a hard
      // failure -- the sitemap is serving Google a dead URL.
      isFixedProbe: FIXED_EVENT_PROBES.includes(path) && !fromSitemap.has(path),
      minEventLinks: staticEntry ? staticEntry[1] : 0,
    });
    results.push(result);
    const status = result.failures.length ? 'FAIL' : 'ok';
    console.log(`  [${status}] ${path}`);
    for (const f of result.failures) console.log(`      FAIL: ${f}`);
    for (const w of result.warns) console.log(`      warn: ${w}`);
  }

  const hardFailures = results.reduce((n, r) => n + r.failures.length, 0);
  const counts = { fromSitemap: sitemapPaths.length, ...tally(results) };
  // The measurement receipt, printed BEFORE any verdict so it is present on
  // every path -- a red run is exactly when "how much did this actually
  // measure?" needs answering, and the floors below throw.
  console.log(
    `\nMeasured ${counts.measured}/${urls.length} pages`
      + ` (${counts.linkPagesChecked} link-bearing, ${counts.eventsAsserted} event page(s) asserted,`
      + ` ${counts.fromSitemap} sampled from the sitemap).`,
  );

  // Verdicts last, and BOTH of them: the hard-failure summary prints before
  // any floor throws, so a run that is short on coverage AND carries real SEO
  // defects reports both rather than losing the defect count to the throw.
  if (hardFailures > 0) {
    console.error(`\n${hardFailures} SEO assertion(s) failed.`);
    process.exitCode = 1;
  }

  const shortfalls = floorShortfalls(counts);
  if (shortfalls.length > 0) {
    // Every shortfall is listed before the throw -- assertMeasured can only
    // report the one it is given, and a total outage misses all four.
    for (const f of shortfalls) {
      console.error(`  FLOOR SHORT: measured ${counts[f.key] ?? 0}/${f.min} ${f.label}`);
    }
    const first = shortfalls[0];
    const extra = shortfalls.length > 1 ? ` (+${shortfalls.length - 1} more floor(s) short, listed above)` : '';
    assertMeasured(counts[first.key] ?? 0, first.min, `${first.label}${extra}`);
  }

  if (hardFailures === 0) console.log('All SEO assertions passed.');
}

// ---------------------------------------------------------------------------
// Canary (conventions rule R4): proof this guard can fail. Network-free -- it
// drives the pure functions this file owns, in BOTH directions, with cases ON
// the boundaries:
//   - auditHtml: the assertions it makes, each proven to fire on the broken
//     shape and stay silent on the healthy one
//   - parseSitemapSample: the coverage the sitemap floor is fed
//   - checkPage: the outcome -> measured/eventAsserted/linkPageChecked
//     mapping every floor rests on, driven through 200 / forgiven 404 /
//     hard 404 / throw via an injected fetcher
//   - tally + floorShortfalls: all four floors present and firing, so DELETING
//     one is a canary failure rather than a silent loss of the guard
// HONEST SCOPE: main() owns the network, so the canary cannot prove main
// CALLS these. That last link is covered by the live run, which prints
// "Measured N/M pages (...)" on every path -- read those numbers, they are the
// measurement receipt. Nor does a green canary mean the ASSERTIONS are
// complete: noindex, for one, is knowingly blind to several de-index forms
// (see its comment) -- proven-in-both-directions is a claim about the rules
// that exist, never about the ones missing.
// ---------------------------------------------------------------------------
async function selfTest() {
  const HOST = 'https://www.bachatacalendar.co.uk';
  const page = ({ canonical = `${HOST}/x`, title = 'Salsa Night at Pulse', desc = 'A page about bachata.', descTag = null, h1 = '<h1>Heading</h1>', jsonLd = '', links = 0 } = {}) => [
    canonical === null ? '' : `<link rel="canonical" href="${canonical}">`,
    title === null ? '' : `<title>${title}</title>`,
    descTag ?? (desc === null ? '' : `<meta name="description" content="${desc}">`),
    h1,
    jsonLd,
    Array.from({ length: links }, (_, i) => `<a href="/event/e${i}">event</a>`).join('\n'),
  ].join('\n');
  const eventLd = (overrides = {}) => {
    const node = {
      '@context': 'https://schema.org',
      '@type': 'Event',
      name: 'X',
      startDate: '2026-09-01T20:00',
      location: { '@type': 'Place', name: 'Y' },
      eventStatus: 'https://schema.org/EventScheduled',
      offers: { '@type': 'Offer', price: '10' },
      ...overrides,
    };
    for (const k of Object.keys(node)) if (node[k] === undefined) delete node[k];
    return `<script type="application/ld+json">${JSON.stringify(node)}</script>`;
  };
  const sitemap = (...locs) => `<urlset>${locs.map((l) => `<loc>${l}</loc>`).join('')}</urlset>`;
  const fails = (html, opts, needle) => auditHtml('/x', html, opts).failures.some((f) => f.includes(needle));
  const clean = (html, opts) => auditHtml('/x', html, opts).failures.length === 0;
  const throws = (fn) => { try { fn(); return false; } catch { return true; } };
  const res = (measured, eventAsserted, linkPageChecked = false) => ({ measured, eventAsserted, linkPageChecked });
  const serve = (r) => async () => r;

  // checkPage's four outcomes, driven through the injected fetcher.
  const okEvent = await checkPage('/event/x', { isEvent: true }, serve({ ok: true, status: 200, text: page({ jsonLd: eventLd() }) }));
  const okStatic = await checkPage('/parties', { minEventLinks: 3 }, serve({ ok: true, status: 200, text: page({ links: 3 }) }));
  const probe404 = await checkPage('/event/p', { isEvent: true, isFixedProbe: true }, serve({ ok: false, status: 404, text: '' }));
  const hard404 = await checkPage('/event/q', { isEvent: true }, serve({ ok: false, status: 404, text: '' }));
  const threw = await checkPage('/faq', {}, async () => { throw new Error('socket hang up'); });

  const cases = [
    // --- auditHtml: the regressions this guard exists for ---
    ['fires: skeleton render with no h1 (the July 2026 festival regression)',
      fails(page({ h1: '' }), {}, 'no <h1>')],
    ['fires: generic fallback title on a non-home page',
      auditHtml('/parties', page({ title: `${GENERIC_TITLE} | all events` }), {}).failures.some((f) => f.includes('generic fallback title'))],
    ['silent boundary: the homepage legitimately uses the site title',
      auditHtml('/', page({ title: `${GENERIC_TITLE} | all events`, links: 5 }), { minEventLinks: 5 }).failures.length === 0],
    ['fires: no <title> at all',
      fails(page({ title: null }), {}, 'missing <title>')],
    ['fires: no meta description',
      fails(page({ desc: null }), {}, 'missing/empty meta description')],
    ['fires: a whitespace-only meta description',
      fails(page({ desc: '   ' }), {}, 'missing/empty meta description')],
    ['silent boundary: description with content BEFORE name (reversed attribute order)',
      clean(page({ descTag: '<meta content="A page about bachata." name="description">' }), {})],
    ['fires: canonical off the www host',
      fails(page({ canonical: 'https://bachatacalendar.co.uk/x' }), {}, 'canonical not on www host')],
    ['fires: no canonical at all',
      fails(page({ canonical: null }), {}, 'expected exactly 1 canonical, found 0')],
    ['fires: a second canonical',
      fails(`<link rel="canonical" href="${HOST}/x">` + page(), {}, 'expected exactly 1 canonical')],
    ['fires: noindex, double-quoted content',
      fails(page() + '<meta name="robots" content="noindex, nofollow">', {}, 'unexpected noindex')],
    ['fires: noindex, single-quoted content (the form the rewrite broke)',
      fails(page() + "<meta name=\"robots\" content='noindex'>", {}, 'unexpected noindex')],
    ['fires: noindex, unquoted content (likewise)',
      fails(page() + '<meta name="robots" content=noindex>', {}, 'unexpected noindex')],
    ['silent boundary: an explicit index,follow robots tag',
      clean(page() + '<meta name="robots" content="index, follow">', {})],
    ['fires: event page with no Event JSON-LD node',
      fails(page(), { isEvent: true }, 'no Event JSON-LD node')],
    ['silent: a non-event page needs no Event node',
      clean(page(), {})],
    ['fires: Event JSON-LD missing name',
      fails(page({ jsonLd: eventLd({ name: undefined }) }), { isEvent: true }, 'Event JSON-LD missing name')],
    ['fires: Event JSON-LD missing startDate',
      fails(page({ jsonLd: eventLd({ startDate: undefined }) }), { isEvent: true }, 'Event JSON-LD missing startDate')],
    ['fires: Event JSON-LD missing location',
      fails(page({ jsonLd: eventLd({ location: undefined }) }), { isEvent: true }, 'Event JSON-LD missing location')],
    ['fires: Event JSON-LD missing eventStatus',
      fails(page({ jsonLd: eventLd({ eventStatus: undefined }) }), { isEvent: true }, 'Event JSON-LD missing eventStatus')],
    ['fires: Event JSON-LD missing offers',
      fails(page({ jsonLd: eventLd({ offers: undefined }) }), { isEvent: true }, 'Event JSON-LD missing offers')],
    ['fires: unparseable JSON-LD block',
      fails(page({ jsonLd: '<script type="application/ld+json">{nope</script>' }), {}, 'unparseable JSON-LD')],
    ['survives: a JSON-LD block of literal null does not throw (it once killed the run)',
      (() => { try { return clean(page({ jsonLd: '<script type="application/ld+json">null</script>' }), {}); } catch { return false; } })()],
    ['silent: a complete healthy event page',
      clean(page({ jsonLd: eventLd() }), { isEvent: true })],
    ['warn boundary: an offer without a price warns, never fails (organiser data gap)',
      (() => {
        const r = auditHtml('/event/x', page({ jsonLd: eventLd({ offers: { '@type': 'Offer' } }) }), { isEvent: true });
        return r.failures.length === 0 && r.warns.length === 1;
      })()],
    ['fires: one /event/ link short of the floor (the indexed "(0 events)" body)',
      fails(page({ links: 4 }), { minEventLinks: 5 }, '/event/ links in server HTML')],
    ['silent boundary: exactly the required /event/ links',
      clean(page({ links: 5 }), { minEventLinks: 5 })],

    // --- checkPage: the outcome -> counter mapping every floor rests on ---
    ['checkPage: a 200 event page counts as measured AND as an event assertion, but not as link-bearing',
      okEvent.measured === true && okEvent.eventAsserted === true
        && okEvent.linkPageChecked === false && okEvent.failures.length === 0],
    ['checkPage: a 200 link-bearing static page counts as measured and link-bearing, not as an event',
      okStatic.measured === true && okStatic.linkPageChecked === true && okStatic.eventAsserted === false],
    ['checkPage: a forgiven fixed-probe 404 is NOT measured (nothing was asserted) and warns',
      probe404.measured === false && probe404.eventAsserted === false
        && probe404.failures.length === 0 && probe404.warns.length === 1],
    ['checkPage: a hard 404 is NOT measured and fails loud',
      hard404.measured === false && hard404.failures.some((f) => f.includes('HTTP 404'))],
    ['checkPage: a fetch that throws is NOT measured and reports exactly once',
      threw.measured === false && threw.linkPageChecked === false
        && threw.failures.length + threw.warns.length === 1],

    // --- parseSitemapSample: the coverage the sitemap floor is fed ---
    ['sitemap: samples per prefix, returning what it actually took',
      parseSitemapSample(sitemap(`${HOST}/event/a`, `${HOST}/event/b`, `${HOST}/dancers/d`)).join(',') === '/event/a,/event/b,/dancers/d'],
    ['sitemap boundary: an empty/unparseable sitemap yields nothing, it does not throw',
      parseSitemapSample('<html>not xml</html>').length === 0],
    ['sitemap: a duplicated <loc> counts ONCE, not as extra coverage',
      parseSitemapSample(sitemap(`${HOST}/event/a`, `${HOST}/event/a`)).length === 1],
    ['sitemap: a URL already in the static sample is not re-counted',
      parseSitemapSample(sitemap(`${HOST}/event/a`), ['/event/a']).length === 0],

    // --- tally: the counters the measured/link/event floors are fed ---
    ['tally: an unfetched page does not count as measured',
      tally([res(true, false), res(false, false), res(true, true)]).measured === 2],
    ['tally: only pages whose Event assertions RAN count as event pages',
      tally([res(true, true), res(false, false), res(true, false)]).eventsAsserted === 1],
    ['tally: only measured link-bearing pages count toward the link floor',
      tally([res(true, false, true), res(false, false, false), res(true, false, true)]).linkPagesChecked === 2],

    // --- floorShortfalls: all four floors present, firing, and on-boundary ---
    ['floors: a clean run exactly at every boundary reports no shortfall',
      floorShortfalls({ fromSitemap: MIN_SITEMAP_PAGES, measured: MIN_PAGES_MEASURED, linkPagesChecked: MIN_LINK_PAGES, eventsAsserted: MIN_EVENT_PAGES }).length === 0],
    ['floors: all four fire on a run that measured nothing',
      floorShortfalls({ fromSitemap: 0, measured: 0, linkPagesChecked: 0, eventsAsserted: 0 }).length === 4],
    ['floors: a dead sitemap fires the sitemap floor ALONE (static pages still measured)',
      (() => {
        const s = floorShortfalls({ fromSitemap: 0, measured: 16, linkPagesChecked: 10, eventsAsserted: 3 });
        return s.length === 1 && s[0].key === 'fromSitemap';
      })()],
    ['floors: one page short of the measured floor fires it',
      floorShortfalls({ fromSitemap: 5, measured: MIN_PAGES_MEASURED - 1, linkPagesChecked: 10, eventsAsserted: 3 }).some((f) => f.key === 'measured')],
    ['floors: losing the link-bearing CLASS fires, even with the blanket floor satisfied',
      (() => {
        // 11 of 21 pages gone, all of them link-bearing: measured clears 10.
        const s = floorShortfalls({ fromSitemap: 5, measured: 10, linkPagesChecked: 0, eventsAsserted: 3 });
        return s.length === 1 && s[0].key === 'linkPagesChecked';
      })()],
    ['floors: greening on a single hand-picked event page fires the event floor',
      floorShortfalls({ fromSitemap: 5, measured: 20, linkPagesChecked: 10, eventsAsserted: 1 }).some((f) => f.key === 'eventsAsserted')],
    ['floors: a missing counter key reads as 0 and fires (a typo fails CLOSED)',
      floorShortfalls({ measured: 20, linkPagesChecked: 10, eventsAsserted: 3 }).some((f) => f.key === 'fromSitemap')],
    ['floor helper: assertMeasured throws below the floor, is silent at it',
      throws(() => assertMeasured(MIN_PAGES_MEASURED - 1, MIN_PAGES_MEASURED, 'pages fetched and measured'))
        && !throws(() => assertMeasured(MIN_PAGES_MEASURED, MIN_PAGES_MEASURED, 'pages fetched and measured'))],
  ];
  let failed = 0;
  for (const [name, ok] of cases) {
    if (!ok) failed += 1;
    console.log(`${ok ? 'ok  ' : 'FAIL'}  ${name}`);
  }
  if (failed > 0) {
    console.error(`\nFAIL self-test -- ${failed} of ${cases.length} case(s).`);
    return 1;
  }
  console.log(`\nPASS self-test -- ${cases.length} cases: auditHtml, checkPage's counter mapping, the sitemap sample and all four floors, proven in both directions.`);
  return 0;
}

// A CRASH -- including a missed measurement floor, which assertMeasured
// reports by throwing -- is always a hard failure. process.exitCode, NOT
// process.exit(1): the bare exit truncates piped stdout in Linux CI
// (repo-measured: 904 printed lines became 194) and on Windows discards the
// in-flight stderr write of this very error object, ending the run in a libuv
// assertion instead of the cause (measured 2026-08-03 -- full notes at
// check-og-images.mjs's tail). It also makes fetchText's body.cancel()
// load-bearing rather than merely tidy: nothing kills the process early now.
// The guard is back, and realpath-aware. It was removed from here because the
// argv[1]-vs-import.meta.url compare was measured failing OPEN in
// check-og-images.mjs -- through a junction (mklink /J) the script exited 0
// having run NOTHING. Bare top-level dispatch fixed that by making the file
// unimportable, which is a different defect wearing the same coat.
//
// isEntryPoint() compares REALPATH to REALPATH (scripts/lib/entry-point.mjs);
// scripts/prove-entry-point-dispatch.mjs invokes this file through a junction
// and asserts it still runs, and R6 in check-script-conventions.mjs refuses the
// raw compare at author time.
//
// What that buys, stated exactly rather than aspirationally: `await import()`
// from node is safe, and the harness's import arm proves it on every run. A
// VITEST spec would additionally need an `export` here (there are none) and no
// shebang -- check-rpc-typing.mjs records that a `#!/usr/bin/env node` line
// makes a file unparseable when vitest inlines it.
if (isEntryPoint(import.meta.url)) {
  const argv = process.argv.slice(2);
  const KNOWN_FLAGS = ['--self-test'];
  const unknownFlags = argv.filter((a) => !KNOWN_FLAGS.includes(a));
  if (unknownFlags.length > 0) {
    console.error(`Unknown flag(s): ${unknownFlags.join(', ')}. Known: ${KNOWN_FLAGS.join(', ')}`);
    process.exitCode = 2;
  } else if (argv.includes('--self-test')) {
    process.exitCode = await selfTest();
  } else {
    main().catch((err) => { console.error(err); process.exitCode = 1; });
  }
}

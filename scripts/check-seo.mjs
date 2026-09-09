#!/usr/bin/env node
// SEO guardrail. Fetches a sample of live pages and asserts the head + body
// carry the crawlable SEO surface the June arc shipped:
//   - HTTP 200
//   - exactly one canonical, on the www host
//   - page-specific <title> (not the generic site fallback)
//   - non-empty meta description
//   - at least one <h1> (this assertion alone catches the festival-skeleton bug)
//   - parseable JSON-LD; event pages must carry an Event node with
//     name/startDate/eventStatus (location and offers are RECOMMENDED, not
//     required: a missing node, an addressless Place, and a priceless offer
//     are all WARNs)
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
//   4. event pages asserted -- likewise for the Event JSON-LD assertions. It
//      was once joined by a hand-picked probe URL, whose sampling lottery
//      check-og-images.mjs was widened to kill; that probe is deleted and the
//      sitemap sample is the whole supply now.
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

// Sampled per prefix from the live sitemap. Event pages get 4 samples, one more
// than MIN_EVENT_PAGES, so that a run does not sit exactly on its floor.
//
// What that slack does and does NOT buy, stated exactly, because the loose
// version of this sentence was wrong in review: a THROWN fetch (timeout, DNS,
// socket) on one event page is a warn in the default non-STRICT mode, so the
// run now measures 3 of 4, clears the floor and stays green where it used to
// red. A 404 or any other non-200 is a hard failure in checkPage and reds the
// run whatever the slack is; so does any auditHtml failure. The slack covers
// the transient class ONLY.
//
// That the transient class is real is observed: on 2026-09-08 a run lost
// /organisers/cumbaye to "This operation was aborted". That it reaches THIS
// floor is projected from the mechanism, not observed -- cumbaye is not an
// event page, so it cost the blanket `measured` floor (which has ~11 pages of
// headroom) and touched eventsAsserted not at all. No recorded run has lost an
// /event/ page this way. Said plainly because the loose version of this
// paragraph was wrong in review once already.
//
// It also keeps a festival-format event (which regressed to a skeleton in July
// 2026) likely in the pool without type information in the sitemap. "Likely" is
// the honest word and always was: the sample is the most recently edited events
// out of 68 live on 2026-09-08, so a run can legitimately contain none. A fixed
// probe URL used to promise that coverage; it had been 404ing for weeks and is
// deleted, and nothing here replaces the promise, because this guard reads
// rendered HTML and cannot tell a festival from a weekly social. Queued rather
// than invented: plans/queued-seo-guard-event-page-slack.md.
//
// WHICH pages these are is NOT stable between runs, and the mechanism is worth
// knowing before you chase a gate that went green and red on identical code
// (2026-09-08 cost a triage). parseSitemapSample takes `slice(0, n)` in sitemap
// DOCUMENT ORDER, and app/routes/sitemap.tsx:98 orders events
// `updated_at DESC`. So these are always "the most recently edited events" --
// any organiser edit in the admin rotates the sample, with no deploy and no
// code change. Established by reading both ends, not inferred: on 2026-09-08
// the first three /event/ <loc> entries were exactly the three the run sampled.
//
// This is left ROTATING on purpose. Pinning a fixed set would trade the
// guard's best property -- it looks at whatever was touched most recently,
// which is where fresh data defects actually are -- for a quieter board. What
// made the rotation feel like a flake was a hard assertion that shipped code
// legitimately did not satisfy (see the offers block in auditHtml); that is
// fixed at the assertion, which is where it belonged.
const PREFIX_SAMPLE = { '/event/': 4, '/dancers/': 1, '/organisers/': 1 };

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

// Floor values, ABSOLUTE promises rather than fractions of the run: a floor
// derived from what the run happened to collect shrinks exactly when coverage
// shrinks, which is the failure these exist to catch. Measured against prod
// 2026-09-08: 15 static + 6 sitemap = 21 pages, of which 10 carry a
// minEventLinks assertion and 4 are event pages -- and all 4 now ASSERT, where
// the retired fixed probe made up the fourth and asserted nothing. They are NOT
// self-maintaining -- growing STATIC_PAGES means raising these deliberately.
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
                               // on whichever single page happened to answer. It sits one
                               // BELOW PREFIX_SAMPLE['/event/'] so a full run is not on its
                               // floor; the canary asserts that pairing, so change either
                               // constant and the self-test says so at author time.

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
  // The origin is stripped BEFORE bucketing, so a prefix is matched against the
  // PATH and anchored at its start. This used to be `fullUrl.includes(prefix)`,
  // which is a different rule from the one main() applies -- main derives
  // isEvent with `path.startsWith('/event/')`. A <loc> whose path merely
  // CONTAINED /event/ (say /guide/event/x, or any future nested route) was
  // therefore bucketed as an event page, spent one of the four /event/ budget
  // slots, got fetched and audited as a plain page, and never counted toward
  // eventsAsserted -- silently spending the page of slack this sample size
  // exists to provide. Producer and consumer now apply the same rule.
  const locPaths = [...text.matchAll(/<loc>([^<]+)<\/loc>/g)]
    .map((m) => m[1].replace(/^https?:\/\/[^/]+/, ''));
  const paths = [];
  for (const [prefix, n] of Object.entries(PREFIX_SAMPLE)) {
    // slice BEFORE dedupe on purpose: the per-prefix budget is "look at the
    // first n entries", so a duplicate inside that window costs coverage and
    // must be visible as a lower count, not silently backfilled.
    for (const p of locPaths.filter((x) => x.startsWith(prefix)).slice(0, n)) {
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
      // HARD-REQUIRED here. eventStatus is Recommended and is kept hard
      // anyway, which is safe for a reason worth stating: buildEventJsonLd
      // emits it unconditionally, from no organiser data, so it cannot red on
      // a data gap. That is exactly what `offers` could not promise, and the
      // distinction -- not the required/recommended label -- is why offers
      // moved to a warn below and this did not.
      for (const field of ['name', 'startDate', 'eventStatus']) {
        if (ev[field] == null) failures.push(`Event JSON-LD missing ${field}`);
      }
      // location: WARN, never a hard failure -- the same demotion `offers`
      // already has, for the same reason. buildEventJsonLd can now omit
      // `location` entirely (no name, no street, no postcode, no city all
      // failed to resolve) and can emit a Place with a name but no `address`;
      // both are organiser-data gaps, not code defects, and this guard reads
      // a rotating sitemap sample -- reding the merge gate on one is the exact
      // coupling P5b removed for offers. See queued-seo-location-address-
      // assertion.md, which this replaces.
      //
      // The content test is truthiness-plus-trim, checked per address
      // property with `@type` excluded, so `addressLocality: ''` does NOT
      // count as content -- round 1's hard version used `addr[k] != null` and
      // would have accepted exactly that empty-but-present shape.
      if (ev.location == null) {
        warns.push('no location node (recommended, not required -- an event with no venue data omits it)');
      } else {
        const addr = ev.location.address;
        const hasAddressContent = !!addr && typeof addr === 'object'
          && Object.entries(addr).some(([k, v]) => k !== '@type' && typeof v === 'string' && v.trim() !== '');
        if (!hasAddressContent) {
          warns.push('location.address missing, or carrying no non-empty address property');
        }
      }
      // offers: WARN, never a failure (honest-claims P5b).
      //
      // This was a hard failure, and that made the guard a merge gate INSISTING
      // on a claim the site could not evidence. buildEventJsonLd satisfied it by
      // emitting a fabricated Offer -- `{ url: <the event's own page>,
      // availability: InStock }` -- on every event with no ticket rows, which is
      // most of them. The guard pinned the fabrication as contract exactly the
      // way the stress test's own performer case did, and
      // deleting the fabrication would have red the gate on nearly every
      // /event/ page sampled.
      //
      // It was ALSO wrong on its own terms before this phase touched anything:
      // an ENDED series omits offers by design (arc P4b), so the gate had been
      // failing on main whenever the sitemap sample happened to include one --
      // 2026-09-08, /event/event-26e15b85, from code nobody had changed.
      //
      // Google lists offers under RECOMMENDED properties, so a missing node
      // costs a rich-result warning and nothing more. A warn is the honest
      // strength: it stays visible without blocking a merge, and without
      // pressuring the next author to invent a node to clear it.
      if (ev.offers == null) {
        warns.push('no offers node (recommended, not required -- an event with no ticket data omits it)');
      } else {
        const offers = Array.isArray(ev.offers) ? ev.offers : [ev.offers];
        if (!offers.some((o) => o && o.price != null)) {
          warns.push('no offer carries a price (organiser data gap, not a code failure)');
        }
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
// path and nowhere else. A non-200 returns measured:false: nothing about that
// page's SEO surface was checked, so counting it toward the floors would
// certify coverage that does not exist. EVERY non-200 is also a hard failure
// today, but the floors must not depend on that coincidence -- add a single
// forgiven status and a counter that counted FETCHES would start passing on
// pages nothing was measured on.
//
// There is no forgiven status any more. A fixed probe URL used to have its 404
// downgraded to a warn once retired; the probe is deleted, so the arm went with
// it rather than sitting unreachable. Note what that means for the sample's
// slack: only a THROWN fetch becomes a warn (and only in non-STRICT mode), so
// slack absorbs transients, never a 404.
//
// The fetcher is injectable so the canary can drive this mapping -- the single
// assignment every floor rests on -- through all three outcomes without a
// network. Nothing else passes the third argument.
async function checkPage(path, { isEvent = false, minEventLinks = 0 } = {}, fetcher = fetchText) {
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
  const results = [];

  for (const path of urls) {
    const staticEntry = STATIC_PAGES.find(([p]) => p === path);
    const result = await checkPage(path, {
      isEvent: path.startsWith('/event/'),
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
//     mapping every floor rests on, driven through 200 / hard non-200 / throw
//     via an injected fetcher
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
      // A REAL Place: name plus an address that carries something. The old
      // fixture had no address at all, so every case in this battery treated an
      // addressless Place as healthy and the guard's blindness to it was
      // invisible here too.
      location: {
        '@type': 'Place',
        name: 'Y',
        address: { '@type': 'PostalAddress', addressLocality: 'London' },
      },
      eventStatus: 'https://schema.org/EventScheduled',
      offers: { '@type': 'Offer', price: '10' },
      ...overrides,
    };
    for (const k of Object.keys(node)) if (node[k] === undefined) delete node[k];
    return `<script type="application/ld+json">${JSON.stringify(node)}</script>`;
  };
  const sitemap = (...locs) => `<urlset>${locs.map((l) => `<loc>${l}</loc>`).join('')}</urlset>`;
  const fails = (html, opts, needle) => auditHtml('/x', html, opts).failures.some((f) => f.includes(needle));
  // The offers-rule warns, isolated from any other warn auditHtml may grow.
  const offerWarns = (r) => r.warns.filter((w) => w.includes('offer'));
  // Likewise for location. Neither substring collides with the other's warn
  // text (checked: no 'offer' string mentions location, no 'location' string
  // mentions offer).
  const locationWarns = (r) => r.warns.filter((w) => w.includes('location'));
  const clean = (html, opts) => auditHtml('/x', html, opts).failures.length === 0;
  const throws = (fn) => { try { fn(); return false; } catch { return true; } };
  const res = (measured, eventAsserted, linkPageChecked = false) => ({ measured, eventAsserted, linkPageChecked });
  const serve = (r) => async () => r;

  // checkPage's three outcomes, driven through the injected fetcher.
  const okEvent = await checkPage('/event/x', { isEvent: true }, serve({ ok: true, status: 200, text: page({ jsonLd: eventLd() }) }));
  const okStatic = await checkPage('/parties', { minEventLinks: 3 }, serve({ ok: true, status: 200, text: page({ links: 3 }) }));
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
    ['fires: Event JSON-LD missing eventStatus',
      fails(page({ jsonLd: eventLd({ eventStatus: undefined }) }), { isEvent: true }, 'Event JSON-LD missing eventStatus')],
    // location moved from hard-required to WARN here (queued-seo-location-
    // address-assertion.md): buildEventJsonLd can legitimately omit it, or emit
    // a Place with no address, on organiser-data gaps rather than code defects.
    // Same discrimination discipline as the offers battery below: assert the
    // WARN, assert failures stays empty, and count only LOCATION warns so an
    // unrelated future warn can't make these cases look broken.
    ['warn boundary: a missing location node warns and does NOT fail',
      (() => {
        const r = auditHtml('/event/x', page({ jsonLd: eventLd({ location: undefined }) }), { isEvent: true });
        return r.failures.length === 0
          && locationWarns(r).length === 1
          && locationWarns(r)[0].includes('no location node');
      })()],
    // null boundary, mirroring the offers null case found in review round 3: an
    // explicit JSON `"location": null` must read as MISSING (ev.location ==
    // null), not fall through to the addressless-Place branch and report the
    // wrong warn.
    ['null boundary: an explicit null location reads as MISSING, not addressless',
      (() => {
        const r = auditHtml('/event/x', page({ jsonLd: eventLd({ location: null }) }), { isEvent: true });
        return locationWarns(r).length === 1 && locationWarns(r)[0].includes('no location node');
      })()],
    ['warn boundary: a Place with a name and no address warns about the address, not fails',
      (() => {
        const r = auditHtml('/event/x', page({ jsonLd: eventLd({ location: { '@type': 'Place', name: 'Y' } }) }), { isEvent: true });
        return r.failures.length === 0
          && locationWarns(r).length === 1
          && locationWarns(r)[0].includes('location.address missing');
      })()],
    // The content test's actual defect target: round 1's hard version used
    // `addr[k] != null`, which counts an address object carrying only its own
    // `@type` (or a blank string on any real property) as "content". Both must
    // still warn under the WARN version, or the demotion just moved the same
    // false claim from a failure to a silent pass.
    ['warn boundary: an address object carrying only @type warns (no real content)',
      (() => {
        const r = auditHtml('/event/x', page({ jsonLd: eventLd({ location: { '@type': 'Place', name: 'Y', address: { '@type': 'PostalAddress' } } }) }), { isEvent: true });
        return r.failures.length === 0
          && locationWarns(r).length === 1
          && locationWarns(r)[0].includes('location.address missing');
      })()],
    ['warn boundary: an address whose only property is whitespace warns (trim, not just truthiness)',
      (() => {
        const r = auditHtml('/event/x', page({ jsonLd: eventLd({ location: { '@type': 'Place', name: 'Y', address: { '@type': 'PostalAddress', addressLocality: '   ' } } }) }), { isEvent: true });
        return r.failures.length === 0
          && locationWarns(r).length === 1
          && locationWarns(r)[0].includes('location.address missing');
      })()],
    ['silent boundary: a Place with real address content warns about nothing',
      (() => {
        const r = auditHtml('/event/x', page({ jsonLd: eventLd() }), { isEvent: true });
        return r.failures.length === 0 && locationWarns(r).length === 0;
      })()],
    // Parallel to the offers "PRESENT but priceless is not reported as MISSING"
    // case: an addressless Place must not be lumped into the "no location node"
    // message, or the two organiser-data gaps become indistinguishable in CI
    // output the way the offers ones were before that case existed.
    ['warn boundary: a PRESENT but addressless location is not reported as a MISSING one',
      (() => {
        const r = auditHtml('/event/x', page({ jsonLd: eventLd({ location: { '@type': 'Place', name: 'Y' } }) }), { isEvent: true });
        return !r.warns.some((w) => w.includes('no location node'));
      })()],
    // offers is RECOMMENDED, not required (honest-claims P5b). These three
    // cases are the whole rule, and the first two are the ones that matter:
    // the old canary asserted the hard failure, which is how a guard came to
    // pin a fabricated Offer as contract. Assert the WARN and assert that
    // nothing fails -- checking only the warn would stay green if a future
    // edit put 'offers' back in the required list AND left the warn in place.
    // These count OFFERS warns, not TOTAL warns. Pinning the total made three
    // cases hostage to any unrelated warn a future author adds to auditHtml --
    // they would red on ordinary work while reading as "the offers rule is
    // broken", which is the failure mode a canary is supposed to prevent, not
    // cause. Counting the matching subset keeps the discrimination (exactly one
    // offers warn, and the right one) without the coupling.
    ['warn boundary: a missing offers node warns and does NOT fail',
      (() => {
        const r = auditHtml('/event/x', page({ jsonLd: eventLd({ offers: undefined }) }), { isEvent: true });
        return r.failures.length === 0
          && offerWarns(r).length === 1
          && offerWarns(r)[0].includes('no offers node');
      })()],
    // Two cases were removed here rather than kept, both unkillable:
    //   - `!fails(..., 'Event JSON-LD missing offers')` was a NEGATIVE assertion
    //     mislabelled `fires:`. It passes whenever fails() returns false --
    //     including if fails() broke, or if auditHtml stopped producing any
    //     failure at all -- and the case above already asserts the stronger
    //     `failures.length === 0` on identical input.
    //   - an `endDate`-carrying variant billed as covering the ended-series red
    //     on /event/event-26e15b85. auditHtml never reads endDate, so it was
    //     byte-equivalent to the case above and asserted nothing whatever about
    //     endedness -- a false sense of coverage sitting exactly where this
    //     phase's motivating defect was. The ended-series behaviour lives in
    //     buildEventJsonLd and is covered by its stress test; this guard reads
    //     rendered HTML and genuinely cannot see it. Saying so beats a case
    //     that looks like it can.
    // The old `clean(...)` case pinned here ("a Place with a name and no
    // address is NOT failed") is superseded, not merely restated, by the
    // location warn battery above: `clean()` only asserts failures.length ===
    // 0, which the stronger "warn boundary: a Place with a name and no address
    // warns about the address, not fails" case already asserts plus the warn
    // itself. Keeping both would leave a weaker duplicate nobody re-derives.
    ['fires: unparseable JSON-LD block',
      fails(page({ jsonLd: '<script type="application/ld+json">{nope</script>' }), {}, 'unparseable JSON-LD')],
    ['survives: a JSON-LD block of literal null does not throw (it once killed the run)',
      (() => { try { return clean(page({ jsonLd: '<script type="application/ld+json">null</script>' }), {}); } catch { return false; } })()],
    ['silent: a complete healthy event page',
      clean(page({ jsonLd: eventLd() }), { isEvent: true })],
    // The MESSAGE, not just the count. Counting alone let a mutant survive the
    // battery on 2026-09-08: collapsing `if (ev.offers == null)` to `if (true)`
    // makes the price branch unreachable, so a priced-offer gap reports "no
    // offers node" instead -- still exactly one warn, still zero failures, and
    // every case here stayed green. Two warns that mean different things have
    // to be told apart, or the guard can silently stop distinguishing them.
    ['warn boundary: an offer without a price warns, never fails (organiser data gap)',
      (() => {
        const r = auditHtml('/event/x', page({ jsonLd: eventLd({ offers: { '@type': 'Offer' } }) }), { isEvent: true });
        return r.failures.length === 0
          && offerWarns(r).length === 1
          && offerWarns(r)[0].includes('no offer carries a price');
      })()],
    ['warn boundary: a PRESENT but priceless offers node is not reported as a MISSING one',
      (() => {
        const r = auditHtml('/event/x', page({ jsonLd: eventLd({ offers: { '@type': 'Offer' } }) }), { isEvent: true });
        return !r.warns.some((w) => w.includes('no offers node'));
      })()],
    ['warn boundary: a priced offer warns about nothing at all',
      (() => {
        const r = auditHtml('/event/x', page({ jsonLd: eventLd() }), { isEvent: true });
        return r.failures.length === 0 && offerWarns(r).length === 0;
      })()],
    // ARRAY-shaped offers -- the ONLY shape production ever emits.
    // buildEventJsonLd assigns `node.offers = realOffers.map(...)`, always an
    // array, while every case above feeds a single object. So the
    // `Array.isArray(...) ? ... : [ev.offers]` branch that runs on every real
    // page had zero coverage: collapsing it to `[ev.offers]` survived the whole
    // battery with zero fail lines, while making every live page report "no
    // offer carries a price" regardless of its offers, and go blind to a
    // genuinely priceless one. (No total is quoted: nothing maintains a count
    // written into prose, and this battery has grown since.)
    ['array boundary: a priced offer in an ARRAY warns about nothing',
      (() => {
        const r = auditHtml('/event/x', page({ jsonLd: eventLd({ offers: [{ '@type': 'Offer', price: '10' }] }) }), { isEvent: true });
        return r.failures.length === 0 && offerWarns(r).length === 0;
      })()],
    ['array boundary: a priceless offer in an ARRAY warns',
      (() => {
        const r = auditHtml('/event/x', page({ jsonLd: eventLd({ offers: [{ '@type': 'Offer' }] }) }), { isEvent: true });
        return r.failures.length === 0
          && offerWarns(r).length === 1
          && offerWarns(r)[0].includes('no offer carries a price');
      })()],
    ['array boundary: ONE priced offer among several priceless ones is enough',
      (() => {
        const r = auditHtml('/event/x', page({ jsonLd: eventLd({ offers: [{ '@type': 'Offer' }, { '@type': 'Offer', price: '10' }] }) }), { isEvent: true });
        return offerWarns(r).length === 0;
      })()],
    ['array boundary: an EMPTY offers array carries no price and warns',
      (() => {
        const r = auditHtml('/event/x', page({ jsonLd: eventLd({ offers: [] }) }), { isEvent: true });
        return offerWarns(r).length === 1 && offerWarns(r)[0].includes('no offer carries a price');
      })()],
    // An explicit JSON `"offers": null` is the MISSING case, not the priceless
    // one. Every other case here reaches auditHtml with offers either absent or
    // holding a real value, because the fixture strips only `undefined` -- so
    // narrowing `ev.offers == null` to `=== undefined` survived the whole
    // battery with zero fail lines (review round 3, mutation-run against this
    // file). The mutant falls through to `[null].some(o => o && ...)`, reports
    // "no offer carries a price", and names the wrong defect -- exactly the
    // confusion the two message-checking cases above exist to prevent.
    ['null boundary: an explicit null offers node reads as MISSING, not priceless',
      (() => {
        const r = auditHtml('/event/x', page({ jsonLd: eventLd({ offers: null }) }), { isEvent: true });
        return offerWarns(r).length === 1 && offerWarns(r)[0].includes('no offers node');
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
    ['checkPage: a hard 404 is NOT measured and fails loud',
      hard404.measured === false && hard404.failures.some((f) => f.includes('HTTP 404'))],
    ['checkPage: a fetch that throws is NOT measured and reports exactly once',
      threw.measured === false && threw.linkPageChecked === false
        && threw.failures.length + threw.warns.length === 1],
    // WHICH side it reports on, not just that it reports once. The case above
    // counts failures+warns and so passes under EITHER arm of checkPage's catch;
    // the arm matters, because "a thrown fetch is a WARN" is the entire reason
    // the event sample was raised to 4. Deleting the retired probe's case took
    // with it the only case that asserted an unmeasured page can be non-fatal.
    //
    // STRICT is read once at module scope, so a fixture cannot flip it. This
    // asserts whichever arm is live rather than short-circuiting on it: a case
    // that passes vacuously under STRICT would be unkillable, which is why two
    // such cases were deleted from this battery already. Driving BOTH arms needs
    // STRICT injectable on checkPage -- queued, not done here.
    ['checkPage: a thrown fetch is a WARN by default and a FAILURE under STRICT -- the warn arm is what the sample slack rests on',
      STRICT
        ? (threw.failures.length === 1 && threw.warns.length === 0)
        : (threw.failures.length === 0 && threw.warns.length === 1)],

    // --- parseSitemapSample: the coverage the sitemap floor is fed ---
    ['sitemap: samples per prefix, returning what it actually took',
      parseSitemapSample(sitemap(`${HOST}/event/a`, `${HOST}/event/b`, `${HOST}/dancers/d`)).join(',') === '/event/a,/event/b,/dancers/d'],
    ['sitemap boundary: an empty/unparseable sitemap yields nothing, it does not throw',
      parseSitemapSample('<html>not xml</html>').length === 0],
    ['sitemap: a duplicated <loc> counts ONCE, not as extra coverage',
      parseSitemapSample(sitemap(`${HOST}/event/a`, `${HOST}/event/a`)).length === 1],
    ['sitemap: a URL already in the static sample is not re-counted',
      parseSitemapSample(sitemap(`${HOST}/event/a`), ['/event/a']).length === 0],
    // Producer/consumer agreement, the mechanical version. main() derives
    // isEvent with path.startsWith('/event/'); the sampler must bucket by the
    // same rule or it spends /event/ budget slots on pages that will never be
    // asserted as events -- silently costing the slack PREFIX_SAMPLE provides.
    // The first case is the defect (an unanchored includes() bucketed it); the
    // second is the control, so a fix that simply matched nothing would fail.
    ['sitemap boundary: a path merely CONTAINING /event/ does not spend an /event/ slot',
      parseSitemapSample(sitemap(`${HOST}/guide/event/x`)).length === 0],
    ['sitemap control: a genuine /event/ path is still sampled',
      parseSitemapSample(sitemap(`${HOST}/event/x`)).join(',') === '/event/x'],

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

    // The CONFIG pairing, and nothing more than that. Read the label exactly:
    // it says the two constants are written with a gap between them, which is
    // arithmetic over two module values -- network-free, deterministic, and the
    // one mechanical thing standing between this file and the way the slack was
    // lost last time (a comment saying to keep it, which nobody read).
    //
    // It does NOT say a run HAS slack, and an earlier draft that claimed so was
    // struck: real supply is min(distinct /event/ locs in the sampled window,
    // PREFIX_SAMPLE['/event/']), so this is a ceiling on supply, asserted from
    // the producer side only. A run can satisfy this case and still measure 3.
    //
    // Deliberately over live constants, against the rule that a canary stays on
    // fixtures: the only edit that reds it -- closing the gap -- is the
    // violation itself. Know the blast radius before relying on that: this
    // canary is step 1 of BOTH jobs in seo-check.yml, ahead of "Run SEO guard",
    // so reding it stops the guard running at all. That is the intended trade
    // (the pairing is cheap to restore, silent decay is not), not an oversight.
    ['config pairing: the event sample is written LARGER than the floor, so a full run is not on its floor',
      PREFIX_SAMPLE['/event/'] > MIN_EVENT_PAGES],
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

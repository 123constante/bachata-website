#!/usr/bin/env node
// OG image guardrail. Fetches a sample of live pages with a WhatsApp user-agent
// and asserts each Open Graph image will actually render as a link preview:
//   - og:image present + absolute https
//   - og:image:width / og:image:height present
//   - the image resolves to JPEG or PNG (NOT WebP — WhatsApp won't render WebP)
//   - the image is under ~300KB (WhatsApp's practical budget)
//   - an /api/og/ card is served INLINE and is the card that was asked for:
//     neither redirected (cardRedirectFailure) nor carrying api.og.card.tsx's
//     X-OG-Fallback degrade marker (cardFallbackFailure). Both shapes answer
//     200 image/jpeg under 300KB, so every assertion above passes while every
//     share shows the wrong picture.
//
// Targets the DEPLOYED site (middleware + the /api/og/card endpoint only exist
// post-deploy), so this runs as a scheduled job, not a PR gate.
//
//   OG_CHECK_BASE    base URL (default https://www.bachatacalendar.co.uk)
//   OG_CHECK_STRICT  '1' => transient network errors fail instead of warn
//
// Exit 1 if any sampled page would show no preview.
// --self-test runs the network-free canary (see selfTest at the bottom).

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
// Scope predicate for "this og:image is served by our /api/og/ pipeline",
// used by the dead-card rule and the neither-baked-nor-card shape clause.
// checkPage's isCard stays separate ON PURPOSE: it asserts the narrower
// /api/og/card?query FORM that the v= and occ= assertions key off.
const OG_API_RE = /\/api\/og\//i;

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
    if (!r.ok) {
      // Unconsumed undici bodies keep the event loop alive for minutes
      // (measured -- see previewProbe.mjs); the !ok arm never reads the text.
      await r.body?.cancel();
      return { ok: false, status: r.status, text: '' };
    }
    return { ok: true, status: r.status, text: await r.text() };
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
    // content-length trusted / !ok: the body is never read -- cancel it, same
    // event-loop leak note as fetchText.
    else await r.body?.cancel();
    // r.redirected / r.url expose WHERE the bytes came from. Without them a
    // 302 is invisible: the card fallback serves a perfectly valid 200
    // image/jpeg from production and every size/type assertion passes.
    //
    // x-og-fallback is api.og.card.tsx's degrade marker, set on whatever
    // response ACTUALLY served these bytes. Under redirect:'follow' these are
    // the FINAL response's headers, so a marker set on a 302 is not readable
    // here -- by design, because that shape already has a tell (r.redirected).
    // What this reads is the INLINE degrade, which has no other tell at all.
    return {
      ok: r.ok, status: r.status, contentType: ct, bytes,
      redirected: r.redirected, finalUrl: r.url,
      fallbackReason: r.headers.get('x-og-fallback'),
    };
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

/**
 * A card og:image must be served INLINE: a crawler that meets a redirect on
 * og:image shows no preview, and every redirect answering an /api/og/ request
 * is one of the endpoint's degrade paths (api.og.card.tsx 302s to prod's
 * static og-image.jpg for a renderer error, a missing/unresolvable id, or a
 * missing/unfetchable source image). Without this rule the response still
 * reads 200 image/jpeg under 300KB, because headImage measured the REDIRECT
 * TARGET, and both og-preview and the daily prod run stay green. The meta-tag
 * shape assertions in checkPage cannot catch it: the og:image URL still looks
 * like a healthy card.
 *
 * ONE message, naming what was OBSERVED and listing the possible causes
 * rather than diagnosing one: from response metadata alone a dead renderer,
 * a stale id and a dead source image are indistinguishable (every degrade
 * path shares the same 302) -- though api.og.card.tsx now names the cause in
 * X-OG-Fallback, which is why cardFallbackFailure below can be specific where
 * this one cannot: under redirect:'follow' the marker on a 302 is not
 * readable, so this rule still sees only the shape.
 *
 * SCOPE: /api/og/ URLs only, and only the redirect-shaped death. The inline
 * 200 generic fallback -- the OTHER half, and the likelier one -- is
 * cardFallbackFailure below (queued finding 1a, shipped). A redirected BAKED
 * image (R2 or /og/event/) also breaks previews and remains queued in
 * ~/.claude/plans/queued-seo-og-guard-review-findings.md, not silently
 * claimed (that path is outside this repo -- see the note at 1f below). Pure
 * (URL + response metadata in, failure string or null out) so --self-test
 * proves it without a network.
 */
function cardRedirectFailure(ogImage, img) {
  if (!OG_API_RE.test(ogImage)) return null;
  if (!img.redirected) return null;
  return `og card redirected instead of serving inline -- crawlers show no preview: ${ogImage} -> ${img.finalUrl || '(final URL unknown)'} (possible causes: renderer error, stale/unresolvable id, dead source image -- see api.og.card.tsx)`;
}

// Reasons this guard deliberately does not red on.
//
// The criterion is NOT "the card still reads correctly" -- cover-absent
// satisfies that word for word and is still failed. It is: does the reason
// point at a defect ANOTHER owner is better placed to name, and would redding
// it here be noise? Only cover-unfetchable qualifies, and only partly:
//
//   PARTLY, and the limit is stated rather than claimed. The live-image
//   reference guard (CI check #65) owns dead cover URLs. It does NOT own the
//   other two ways fetchImageBytes returns null -- a >5s origin and a >12MB
//   body -- because it probes with HEAD and a 1-byte range GET, which both of
//   those answer instantly. A cover that is merely slow or huge therefore
//   degrades every share of that entity with NO guard watching. Queued as
//   finding 1i; do not read this set as "covered elsewhere" across the board.
//
// Inclusion-shaped FORGIVENESS, on purpose. The failure direction is the
// default: any reason not named here -- including one added to
// api.og.card.tsx after this line was written -- fails. A forgiveness set
// defined by exclusion ("fail only these known-bad reasons") is exactly how a
// guard goes quiet on the case nobody anticipated.
const FALLBACK_STILL_A_REAL_CARD = new Set(['cover-unfetchable']);

/**
 * The INLINE half of the dead-card pipeline, and the likelier half.
 *
 * cardRedirectFailure above catches a card that 302s. It cannot see the death
 * that never redirects: when event_view_p5 fails, api.og.card.tsx serves an
 * inline 200 image/jpeg of the GENERIC branded card (no title, no date, no
 * venue). Content-type, size and og:image shape all pass; the guard was green
 * while every event share carried a blank card. api.og.card.tsx now marks that
 * response `X-OG-Fallback: card-data-unavailable`, and this rule is what makes
 * the marker load-bearing rather than decorative.
 *
 * Keyed on the HEADER ALONE, deliberately not scoped to /api/og/ URLs the way
 * the redirect rule is: this header is our own marker and no other host emits
 * it, so a URL scope could only add a blind spot (a baked or proxied card that
 * carries the marker through would be forgiven for the shape of its path).
 *
 * SCOPE, stated because it is narrower than it looks: this only observes
 * entities whose og:image is still the LIVE card. api.og.bake.tsx renders the
 * same degraded fallback through the same helpers, uploads it to R2 under a
 * cover-keyed immutable object name and records status 'ready'; once that has
 * happened resolveOgCardImage prefers the baked URL, /api/og/card is never
 * fetched for that entity, and no marker exists on an R2 object to read. A
 * poisoned bake is therefore invisible here BY CONSTRUCTION -- queued as
 * finding 1f in ~/.claude/plans/queued-seo-og-guard-review-findings.md (NOT a
 * path in this repo -- there is no plans/ directory here), because fixing
 * it means changing what bake persists and re-baking what it already did.
 *
 * Pure -- response metadata in, failure string or null out -- so --self-test
 * proves it in both directions without a network.
 */
function cardFallbackFailure(img) {
  const reason = (img.fallbackReason ?? '').trim();
  if (!reason) return null;
  if (FALLBACK_STILL_A_REAL_CARD.has(reason)) return null;
  return `og card served a DEGRADED fallback inline (X-OG-Fallback: ${reason}) -- a valid 200 JPEG, but not this entity's card: shares show a generic image (see api.og.card.tsx)`;
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
    if (!isCard && !isBaked && !OG_API_RE.test(ogImage)) {
      failures.push(`event/festival og:image is neither a baked R2 image nor an og card: ${ogImage}`);
    }
  }

  try {
    const img = await headImage(ogImage);
    const deadCard = cardRedirectFailure(ogImage, img);
    if (deadCard) failures.push(deadCard);
    // Independent of deadCard, NOT nested under it. Usually only one fires --
    // a followed redirect lands on the static asset, which carries no marker.
    // They are NOT disjoint though: an og:image on the apex host (or a preview
    // alias) 30x's to the www card, so the FINAL response can be redirected
    // AND marked. Both are then true of the same response and both get named.
    const degradedCard = cardFallbackFailure(img);
    if (degradedCard) failures.push(degradedCard);
    // Did the bytes we measured describe the object under test? A redirect
    // that ended on the static fallback: no. A redirect that ended on a real
    // (if degraded) card: yes. Keying this on deadCard ALONE silently dropped
    // the type and size assertions for that second case -- a redirect chain
    // ending in a marked card would have skipped a WebP or a 400KB body.
    // Keyed on the raw header, NOT on degradedCard. The verdict is null both
    // when there is no marker AND when the reason is forgiven, so keying on it
    // still skipped the assertions for a redirect chain ending on a
    // cover-unfetchable card -- the exact class the comment above claims to
    // repair. The question here is only "do these bytes belong to the object
    // under test", which the marker's PRESENCE answers and its verdict does not.
    const measuredTheWrongObject = Boolean(deadCard) && !img.fallbackReason;
    if (!img.ok) failures.push(`og:image HTTP ${img.status}`);
    else if (!measuredTheWrongObject) {
      // Skipped only when the numbers describe the FALLBACK asset rather than
      // the card, where they would read as facts about the wrong object. A
      // degraded INLINE card is still measured: those bytes ARE the bytes
      // crawlers receive, so a second, independent defect still gets named.
      if (/webp/.test(img.contentType)) failures.push(`og:image is WebP (${img.contentType}) — WhatsApp won't render`);
      else if (!/jpeg|jpg|png/.test(img.contentType)) failures.push(`og:image unexpected type: ${img.contentType}`);
      if (img.bytes > MAX_BYTES) failures.push(`og:image ${Math.round(img.bytes / 1024)}KB > 300KB`);
    }
  } catch (e) {
    // APPEND rather than replace, so failures found before the throw stay
    // visible in the warn. The page itself stays soft: a transient fetch
    // error must not decide hard-vs-warn (an early hard return here would
    // preempt the past-event downgrade below and escalate on a network blip).
    return { url, soft: true, failures: [...failures, `og:image fetch error: ${e.message}`] };
  }
  // Scope the VERDICT, not the check: a finished event is still fetched and
  // still asserted, but its failures warn instead of redding. Deliberately
  // applied at the end so it downgrades every failure kind uniformly (a 404
  // image on a past page is as harmless as a fallback one) rather than
  // special-casing the one shape rule that happened to fire first. That
  // includes BOTH card verdicts -- the redirect one and the X-OG-Fallback one:
  // a pipeline death sampled ONLY on past events warns rather than reds. Known
  // residual (finding 1e), queued rather than patched with a verdict-class
  // split that round-2 review showed misclassifies -- a stale id and a dead
  // renderer shared one response SHAPE. The marker now tells those two apart
  // by NAME, which is the precondition 1e was waiting on; splitting the
  // downgrade is its own change, not a silent rider on this one.
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
  // process.exitCode, not process.exit(1): the bare exit truncates piped
  // stdout in Linux CI (repo-measured: 904 printed lines became 194), which
  // would eat exactly the FAIL lines above that name the cause.
  if (hardFailures > 0) process.exitCode = 1;
}

// ---------------------------------------------------------------------------
// Canary (conventions rule R4): proof this guard can fail. Network-free -- it
// exercises BOTH pure dead-card rules in BOTH directions, with cases ON the
// boundary.
//
// cardRedirectFailure: the live failure shape (a card 302ing to the static
// fallback) must fire, while a healthy inline card and a baked image -- whose
// path contains /og/event/ but not /api/og/ -- must stay silent.
//
// cardFallbackFailure: the inline degrade must fire, INCLUDING for a reason
// this file has never seen (the fail-closed direction is the whole point of
// the forgiveness set being inclusion-shaped), while an unmarked response and
// the one forgiven reason must stay silent.
// ---------------------------------------------------------------------------
function selfTest() {
  const PROD = 'https://www.bachatacalendar.co.uk';
  const STATIC_FALLBACK = `${PROD}/og-image.jpg`;
  const served = (finalUrl) => ({ redirected: true, finalUrl });
  const inline = (finalUrl) => ({ redirected: false, finalUrl });
  // An inline 200 carrying the degrade marker. `served`/`inline` deliberately
  // omit fallbackReason, so every redirect-rule case above doubles as proof
  // that an unmarked response leaves the fallback rule silent.
  const marked = (reason) => ({ ...inline(`${PROD}/api/og/card?kind=event&id=x&v=1`), fallbackReason: reason });
  const cases = [
    ['fires: a card 302 to the static fallback, message naming the final URL',
      (cardRedirectFailure(`${PROD}/api/og/card?kind=event&id=x&v=1`, served(STATIC_FALLBACK)) ?? '').includes(STATIC_FALLBACK)],
    ['fires: any /api/og/ endpoint, matched case-insensitively',
      cardRedirectFailure(`${PROD}/API/OG/bake?kind=event&id=x`, served(STATIC_FALLBACK)) !== null],
    ['fires: a missing final URL reported as unknown, not interpolated as undefined',
      (cardRedirectFailure(`${PROD}/api/og/card?kind=event&id=x`, { redirected: true, finalUrl: undefined }) ?? '').includes('(final URL unknown)')],
    ['silent: a healthy card served inline',
      cardRedirectFailure(`${PROD}/api/og/card?kind=event&id=x&v=1`, inline(`${PROD}/api/og/card?kind=event&id=x&v=1`)) === null],
    ['silent BY DESIGN: a redirected baked image (/og/event/, not /api/og/) is a queued separate rule',
      cardRedirectFailure('https://pub-abc.r2.dev/og/event/abc-v3.jpg', served('https://cdn.example/og/event/abc-v3.jpg')) === null],
    ['silent BY DESIGN: a redirected non-og image is outside this rule (queued widening)',
      cardRedirectFailure('https://images.example.com/flyer.jpg', served('https://cdn.example.com/flyer.jpg')) === null],
    ['silent: a baked same-origin /og/event/ path served inline',
      cardRedirectFailure(`${PROD}/og/event/abc-v3.jpg`, inline(`${PROD}/og/event/abc-v3.jpg`)) === null],

    // --- cardFallbackFailure: the inline degrade the redirect rule cannot see.
    ['fires: the RPC-death case -- an inline 200 marked card-data-unavailable',
      (cardFallbackFailure(marked('card-data-unavailable')) ?? '').includes('card-data-unavailable')],
    ['fires: a reason this guard has never heard of (an unknown marker must not sail through)',
      cardFallbackFailure(marked('some-degrade-invented-later')) !== null],
    ['silent: whitespace padding does not turn a forgiven reason into an unknown one',
      cardFallbackFailure(marked('  cover-unfetchable  ')) === null],
    ['fires regardless of URL: the rule is keyed on OUR header, never on the path',
      cardFallbackFailure({ ...inline('https://pub-abc.r2.dev/og/event/abc-v3.jpg'), fallbackReason: 'render-error' }) !== null],
    ['silent: no marker at all -- the healthy card, and the only shape that is',
      cardFallbackFailure(inline(`${PROD}/api/og/card?kind=event&id=x&v=1`)) === null],
    ['silent: an absent header reads as null, not as the string "null"',
      cardFallbackFailure({ fallbackReason: null }) === null],
    ['silent: an empty header value is not a reason',
      cardFallbackFailure(marked('   ')) === null],
    ['silent BY DESIGN: cover-unfetchable still carries the real title/date/venue (CI #65 owns that gap)',
      cardFallbackFailure(marked('cover-unfetchable')) === null],
    // The rules OVERLAP, they are not disjoint. Replaced a case that claimed
    // disjointness by passing served() -- which omits fallbackReason, so it
    // was a duplicate of the no-marker case above and asserted nothing. A
    // redirect chain ending on a marked card (apex -> www) makes both true.
    ['both fire on a redirect chain that ENDS on a marked card',
      cardRedirectFailure(`${PROD}/api/og/card?kind=event&id=x&v=1`, { ...served(`${PROD}/api/og/card?kind=event&id=x&v=1`), fallbackReason: 'card-data-unavailable' }) !== null
      && cardFallbackFailure({ ...served(`${PROD}/api/og/card?kind=event&id=x&v=1`), fallbackReason: 'card-data-unavailable' }) !== null],
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
  console.log(`\nPASS self-test -- ${cases.length} cases, the rule proven in both directions.`);
  return 0;
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
// No IS_CLI guard, deliberately: nothing imports this file, and the guard was
// measured failing OPEN here -- invoked through a junction (mklink /J), the
// argv[1]-vs-import.meta.url compare mispredicts and the script exits 0
// having run NOTHING, a vacuous green of the OG guard itself. If a spec ever
// needs cardRedirectFailure, extract it to scripts/lib/ instead.
const argv = process.argv.slice(2);
const KNOWN_FLAGS = ['--self-test'];
const unknownFlags = argv.filter((a) => !KNOWN_FLAGS.includes(a));
if (unknownFlags.length > 0) {
  console.error(`Unknown flag(s): ${unknownFlags.join(', ')}. Known: ${KNOWN_FLAGS.join(', ')}`);
  process.exitCode = 2;
} else if (argv.includes('--self-test')) {
  process.exitCode = selfTest();
} else {
  main().catch((err) => { console.error(err); process.exitCode = 1; });
}

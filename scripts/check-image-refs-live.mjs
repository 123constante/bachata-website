#!/usr/bin/env node
/**
 * CI contract check #65 -- live image references (2026-07-29).
 *
 * Calls public.list_public_image_refs_v1() and probes every URL it returns. The
 * RPC scopes itself to surfaces a reader can actually reach (live + slugged event
 * series, their in-view occurrence overrides, venue_is_public venues, cities), so
 * a dead image on an archived or draft record cannot red-light CI.
 *
 * WHY IT IS BOUNDED. This is the ONLY step in the suite that makes outbound CDN
 * requests. The job is timeout-minutes: 5 for the whole suite, and undici defaults
 * headersTimeout and bodyTimeout to 300s each, so one edge that accepts a
 * connection and never answers could burn the entire budget -- killing every check
 * queued behind it with a bare job timeout and no named failure. `if: always()` is
 * no help: it guards a step FAILING, not the job timing out. So the RPC is capped
 * (20s), every probe is capped (10s), the whole sweep is capped (120s) by a signal
 * folded into each request so tripping it aborts work already in flight, and the
 * workflow step carries timeout-minutes: 3 as the one backstop that cannot be
 * defeated from inside this file.
 *
 * HEADROOM. Measured against prod 2026-08-10: 321 rows, 227 distinct URLs, sweep
 * 3.4s. That is ~35x headroom against the 120s budget at CONCURRENCY=10. sweep_ms
 * is reported on every run and a warning fires past half the budget -- on EVERY
 * run, not just green ones, since the runs under budget pressure are the ones that
 * fail. So the bound cannot quietly become tight as the inventory grows.
 *
 * THREE OUTCOMES, KEPT APART. A probe answers one of: the object is genuinely
 * missing (dead -- fix the row), the object could not be judged (indeterminate or
 * unprobed -- a stall, a rate limit, a 5xx, a budget cut-off), or it is fine.
 * Collapsing the middle case into "dead" is the defect this file guards hardest
 * against: it tells an operator to edit or delete live rows to satisfy a probe
 * that never actually reached the object.
 *
 * NO process.exit(). main() returns the code and the module sets process.exitCode,
 * so queued stdout survives: a bare exit discards in-flight pipe writes on POSIX
 * (measured in this repo at 904 lines arriving as 194 in Linux CI) and aborts under
 * libuv on Windows. Measured 2026-08-10: after 40 live HTTPS probes the process
 * still exited in ~1ms on exitCode alone, so undici keep-alive does NOT hold the
 * loop open and there is nothing here that needs a hard exit.
 *
 * WHY IT EXISTS: on 2026-07-28 a per-occurrence cover override was pointed at an
 * R2 object that was never uploaded, and /event/bachata-night served a 404 image
 * for ~14 hours. The only thing that noticed was Prod Smoke happening to open
 * that one page, and its report said "Failed to load resource: 404" with no URL
 * -- so locating it needed a bespoke Playwright probe. This turns that into a
 * checked invariant that names the row.
 *
 * Local:  node scripts/check-image-refs-live.mjs
 *         node scripts/check-image-refs-live.mjs --self-test   (no DB, no network)
 * CI:     .github/workflows/db-contract-check.yml, check #65.
 *
 * A WHOLE DEAD INVENTORY IS A DIAGNOSIS, NOT N DEFECTS. 404 and 403 are
 * deliberately not transient, so a removed bucket binding or a changed route rule
 * scores every URL dead. Past 90% of the sweep (and at least 10 URLs) the failure
 * text says so and points at the edge, instead of instructing an operator to fix
 * or re-upload hundreds of rows that were never broken. It still exits 1 -- a
 * whole dead inventory IS a contract violation -- only the remediation changes.
 *
 * UNMEASURED IS TOLERATED IN SMALL DOSES. Failing on a single transient 503, or
 * on a 429 this sweep provoked itself, reds an unrelated PR whose only available
 * fix is "re-run CI" -- the habit that teaches people to stop reading reds. Up to
 * max(5, 2% of the sweep) unmeasured refs therefore pass with a NOTE naming them;
 * beyond that it is systemic and fails. The NOTE prints on every such run, because
 * a tolerance that reports nothing is indistinguishable from a check that quietly
 * stopped looking.
 *
 * Exit: 0 pass, 1 contract violated (dead refs, malformed refs, a shrunken or
 *       empty inventory, a missing RPC), 2 the check could not run or could not
 *       measure (bad creds, unreachable DB, a systemic CDN stall).
 */
import fs from 'node:fs';
import { pathToFileURL } from 'node:url';
// @supabase/supabase-js is imported DYNAMICALLY inside main(), not statically: a
// static import throws at MODULE LOAD, before any handler exists, so a broken or
// missing dependency would surface as an uncaught exception and exit 1 -- which
// this file's header defines as "contract violated", sending the operator to
// edit live rows over a bad node_modules. Same reasoning as
// check-festival-detail-span.mjs.

const RPC_TIMEOUT_MS = 20_000;
const REQ_TIMEOUT_MS = 10_000;
const SWEEP_BUDGET_MS = 120_000;
const RETRY_BACKOFF_MS = 1_000;
const CONCURRENCY = 10;

// A measured floor, not a guess: prod returned 321 rows on 2026-08-10. Only
// checking for ZERO rows lets a narrowed predicate (a venue_is_public change, a
// join going inner, a shrunken occurrence window) return 1 row and report green
// having probed almost nothing -- rule R1's exact failure mode. Same discipline
// as check-upcoming-event-cover.mjs's MIN_ROWS.
const MIN_ROWS = 100;

// How many refs to print for a list that is a diagnosis rather than a worklist. Unlike dead refs -- which an operator
// fixes one by one, so truncating that list would be a lie -- an indeterminate
// list is not worked through: its entire actionable content is "the CDN is
// unhappy". A CDN-wide stall would otherwise dump the whole inventory into the
// CI log.
const LIST_PRINT_CAP = 20;

function loadEnv() {
  const env = { ...process.env };
  if (fs.existsSync('.env')) {
    for (const raw of fs.readFileSync('.env', 'utf8').split(/\r?\n/)) {
      const line = raw.trim();
      if (!line || line.startsWith('#')) continue;
      const i = line.indexOf('=');
      if (i < 0) continue;
      const k = line.slice(0, i).trim();
      const v = line.slice(i + 1).replace(/^"|"$/g, '');
      if (env[k] === undefined) env[k] = v;
    }
  }
  return env;
}

// ---------------------------------------------------------------------------
// Pure decision surface. Everything that decides an outcome lives here so that
// --self-test can prove each rule in BOTH directions without a DB or a network
// (rule R4, scripts/check-script-conventions.mjs). The sweep below is plumbing.
// ---------------------------------------------------------------------------

// Statuses that mean "ask again later", not "this object is gone". A CDN blip, a
// rate limit triggered by our own CONCURRENCY, or a 5xx during a deploy must
// never be reported as a dead row on an unrelated PR.
// 520-527 and 530 are Cloudflare EDGE-generated: origin unreachable, origin
// handshake failed, origin timed out, invalid SSL cert. Every URL in this
// inventory is served from a Cloudflare-fronted R2 bucket (see
// src/lib/imageCdn.ts), so these are the shape a real origin wobble takes here
// -- and being >= 400 and absent from this set, they scored "dead" and told the
// operator to re-upload objects that exist.
const TRANSIENT_STATUSES = new Set([
  408, 425, 429, 500, 502, 503, 504, 520, 521, 522, 523, 524, 525, 526, 527, 530,
]);

export function statusVerdict(status) {
  if (status < 400) return 'ok';
  if (TRANSIENT_STATUSES.has(status)) return 'transient';
  return 'dead';
}

// Fall back to GET on HEAD-hostile answers -- signed URLs and edge-rule-protected
// buckets routinely answer HEAD with 400/403/405/501 while serving GET perfectly,
// and calling those dead is a false red on an image that renders. Deliberately
// NOT done for the transient set: re-requesting into a rate limiter is what turns
// a blip into an outage, and those are retried instead.
export function shouldTryGet(status) {
  return status >= 400 && !TRANSIENT_STATUSES.has(status);
}

// The GET fallback asks for `bytes=0-0` so a dead-link probe does not download a
// multi-MB original. An origin that does not implement Range answers 416, which
// is >= 400 and not transient -- it would be scored "dead" for an image that
// serves perfectly. So a 416 means "ask again without the Range header", never
// "the object is gone".
export function shouldRetryWithoutRange(status) {
  return status === 416;
}

// cause.code carries the useful name for the cases that actually happen
// (ECONNREFUSED, ENOTFOUND, ECONNRESET). Reading e.name first is what made an
// unlabelled cause print as a bare "TypeError", which names nothing: fetch
// rejects with TypeError for every transport failure there is.
export function errorLabel(e, reqTimeoutMs) {
  if (e?.name === 'TimeoutError') return `ERR timeout after ${reqTimeoutMs}ms`;
  return `ERR ${e?.cause?.code || e?.cause?.message || e?.message || e?.name || 'unknown'}`;
}

// A row whose url is null, blank, relative or non-HTTP is a broken row, not a
// broken CDN: fetch would throw a TypeError that reads like a transport failure,
// get retried, and then be reported as a dead object. Caught up front instead.
//
// Parsed with URL rather than a startsWith pair, which was wrong in BOTH
// directions: "https://exa mple.com/a.jpg" and "https://" passed it and then
// threw inside fetch, while "HTTPS://cdn/a.webp" and a leading-space URL were
// called malformed even though URL parses them and fetch serves them.
export function isProbeableUrl(u) {
  if (typeof u !== 'string' || u.trim() === '') return false;
  try {
    const parsed = new URL(u.trim());
    return parsed.protocol === 'http:' || parsed.protocol === 'https:';
  } catch {
    return false;
  }
}

// PostgREST caps an unbounded select at 1000 rows and says nothing about it, so
// a full page is indistinguishable from a complete one -- the inventory would
// silently stop at the cap and the tail would never be probed. Same tripwire as
// check-upcoming-event-cover.mjs, whose floor discipline this file copied only
// half of.
const ROW_CAP = 1000;

// A floor on the DISTINCT URLs actually probed, not just on rows. MIN_ROWS
// guards the row count, but the probed population is the deduped URL set: if the
// RPC's url expression regresses to a shared placeholder (a changed COALESCE, a
// wrong column in a UNION arm) it can return a healthy 321 rows that collapse to
// ONE distinct URL, and the run would report green having probed one object.
// That is the same green-having-probed-nothing hole the MIN_ROWS comment claims
// to close, one level down.
const MIN_DISTINCT_URLS = 50;

// An inventory that shrank -- or that got silently truncated -- is a broken read
// path, not a clean site.
export function inventoryVerdict(rowCount, minRows, rowCap) {
  if (rowCount === 0) return 'empty';
  if (rowCount < minRows) return 'shrunken';
  // rowCap is REQUIRED. Guarding this on `rowCap !== undefined` made the
  // truncation tripwire opt-in, so a caller that omitted the argument silently
  // disabled it and a 1000-row truncated inventory scored 'ok' -- an absent
  // input read as "no constraint" instead of blocking.
  if (typeof rowCap !== 'number') return 'unusable';
  if (rowCount >= rowCap) return 'capped';
  return 'ok';
}

export function probeSetVerdict(distinctCount, minDistinct) {
  if (distinctCount === 0) return 'empty';
  if (distinctCount < minDistinct) return 'shrunken';
  return 'ok';
}

// Tolerance for refs we could not measure. An indeterminate URL means the probe
// could not judge it, NOT that the object is broken -- and failing the whole
// check on one transient 503, or on a 429 this sweep provoked itself, reds an
// unrelated PR whose only available fix is "re-run CI". That is the habit that
// teaches people to stop reading reds. So a small number passes with a warning
// while anything systemic still fails.
//
// Floor AND ratio, because either alone is wrong: a bare ratio fails a small
// inventory on a single blip (2% of 30 URLs is 0), and a bare floor lets a large
// one hide 50 stalls under a fixed 5.
const UNMEASURED_FLOOR = 5;
const UNMEASURED_RATIO = 0.02;

// One definition, used by BOTH the decision and every message that quotes it.
// Written out separately in each place, the enforced allowance and the reported
// one drift apart on the first edit -- a run failing while announcing it was
// within tolerance.
export function unmeasuredAllowance(totalUrls, floor, ratio) {
  return Math.max(floor, Math.ceil(totalUrls * ratio));
}

export function unmeasuredVerdict(unmeasured, totalUrls, floor, ratio) {
  if (unmeasured <= 0) return 'none';
  // Nothing was verified at all: tolerance is meaningless here. Without this,
  // an inventory at or below the floor (five distinct URLs -- a shared
  // placeholder cover plus a few city heroes) could go 100% unmeasured during a
  // total CDN outage, count 5 <= 5, and exit GREEN having probed nothing. That
  // is rule R1's exact failure mode, and R1's own detector keys on
  // `process.exit(0)`, which this file does not use -- so the ratchet could not
  // have caught it either.
  if (unmeasured >= totalUrls) return 'systemic';
  return unmeasured > unmeasuredAllowance(totalUrls, floor, ratio) ? 'systemic' : 'tolerated';
}

// dead/malformed are contract violations (1); a systemic failure to measure is
// infrastructure (2). Violations win, so a real dead ref is never downgraded by
// a CDN wobble in the same run.
export function decideExit({ dead, invalid, unmeasured }) {
  if (dead > 0 || invalid > 0) return 1;
  // By INCLUSION, never by exclusion. Testing `=== 'systemic'` meant an
  // unrecognised value -- a typo, a stale caller still passing the old numeric
  // shape -- fell through to 0, so a run with 200 unprobed URLs would report
  // green and log nothing. Only the two verdicts known to be clean pass.
  if (unmeasured !== 'none' && unmeasured !== 'tolerated') return 2;
  return 0;
}

// When essentially the WHOLE inventory scores dead, that is a diagnosis about
// the CDN -- a removed bucket binding, a changed route rule, an expired origin
// cert -- not N independent broken rows. 404 and 403 are deliberately excluded
// from TRANSIENT_STATUSES (a genuinely missing object must stay loud), so a
// bucket-wide failure lands here rather than in the unmeasured bucket, and
// without this it printed "227 of 227 unreachable -- fix the row (or re-upload
// the object)". That is the same "go and edit live data over a probe problem"
// this file guards hardest against, arriving through the dead door.
//
// Still exits 1: a whole dead inventory IS a contract violation. Only the
// remediation text changes, because the remediation is completely different.
//
// Ratio AND floor: a 2-URL inventory that is fully dead is far more likely to be
// two genuinely broken rows than a CDN outage, so a bare ratio would misdiagnose
// every small inventory.
const DEAD_SYSTEMIC_RATIO = 0.9;
const DEAD_SYSTEMIC_FLOOR = 10;

export function deadVerdict(deadCount, totalUrls, floor, ratio) {
  if (deadCount <= 0) return 'none';
  if (deadCount >= floor && deadCount / totalUrls >= ratio) return 'systemic';
  return 'rows';
}

// Keyed on the error CODE, not on prose. A message regex was wrong in both
// directions: it missed 42501 (`permission denied for function`) -- the revoked
// anon EXECUTE this branch exists for -- and matched 42703/42P01, so a dropped
// column inside the RPC body was reported as the function being missing, sending
// the operator to re-grant EXECUTE on a function that was already executable.
// Mirrors isFunctionMissing() in check-festival-detail-span.mjs, whose canary
// asserts these same codes.
export function isFunctionMissing(err) {
  return err?.code === 'PGRST202' || err?.code === '42883';
}

// A revoked grant is NOT "function missing" -- the function is right there --
// but it IS a broken contract, and the distinction matters because the fixes are
// different (re-create vs re-grant). Kept separate rather than folded into
// isFunctionMissing so the sibling's canary semantics still hold, and because
// the branch below has to print different remediation for each.
export function isGrantRevoked(err) {
  return err?.code === '42501';
}

// ---------------------------------------------------------------------------
// Canary. `--self-test` proves the rules above can both fire and stay silent,
// with no DB and no network. Every case is a regression that shipped or was
// caught in review; each was verified to KILL a deliberate mutation of the rule
// it covers, because a canary that cannot fail is worth nothing.
// ---------------------------------------------------------------------------
function selfTest() {
  let failed = 0;
  let ran = 0;
  const eq = (name, actual, expected) => {
    ran += 1;
    const a = JSON.stringify(actual);
    const e = JSON.stringify(expected);
    if (a === e) {
      console.log(`ok    ${name}`);
    } else {
      failed += 1;
      console.error(`FAIL  ${name}: got ${a}, want ${e}`);
    }
  };

  // statusVerdict -- the dead/transient split, in both directions.
  eq('200 is ok', statusVerdict(200), 'ok');
  eq('404 is dead', statusVerdict(404), 'dead');
  eq('403 is dead once GET has also refused', statusVerdict(403), 'dead');
  eq('429 is transient, NOT dead', statusVerdict(429), 'transient');
  eq('500 is transient, NOT dead', statusVerdict(500), 'transient');
  eq('502 is transient, NOT dead', statusVerdict(502), 'transient');
  eq('503 is transient, NOT dead', statusVerdict(503), 'transient');
  eq('504 is transient, NOT dead', statusVerdict(504), 'transient');

  // shouldTryGet -- fall back for HEAD-hostile edges, never into a rate limiter.
  eq('405 falls back to GET', shouldTryGet(405), true);
  eq('501 falls back to GET', shouldTryGet(501), true);
  eq('403 falls back to GET', shouldTryGet(403), true);
  eq('200 does not fall back', shouldTryGet(200), false);
  eq('429 does not fall back (would double the load)', shouldTryGet(429), false);
  eq('503 does not fall back (would double the load)', shouldTryGet(503), false);

  // shouldRetryWithoutRange -- a Range-refusing origin is not a dead object.
  eq('416 retries without Range', shouldRetryWithoutRange(416), true);
  eq('404 does not retry without Range', shouldRetryWithoutRange(404), false);
  eq('200 does not retry without Range', shouldRetryWithoutRange(200), false);

  // errorLabel -- the regression here was a bare "TypeError", which names nothing.
  eq(
    'timeout is named with its budget',
    errorLabel({ name: 'TimeoutError' }, 10_000),
    'ERR timeout after 10000ms',
  );
  eq(
    'connection refused surfaces cause.code',
    errorLabel({ name: 'TypeError', message: 'fetch failed', cause: { code: 'ECONNREFUSED' } }, 10_000),
    'ERR ECONNREFUSED',
  );
  eq(
    'dns failure surfaces cause.code',
    errorLabel({ name: 'TypeError', message: 'fetch failed', cause: { code: 'ENOTFOUND' } }, 10_000),
    'ERR ENOTFOUND',
  );
  eq(
    'a cause with no code falls back to its message, not the useless name',
    errorLabel({ name: 'TypeError', message: 'fetch failed', cause: { message: 'bad port' } }, 10_000),
    'ERR bad port',
  );

  // isProbeableUrl -- wrong in EITHER direction sends the operator to the wrong place.
  eq('https is probeable', isProbeableUrl('https://cdn.example.com/a.webp'), true);
  eq('http is probeable', isProbeableUrl('http://cdn.example.com/a.webp'), true);
  eq('an uppercase scheme is probeable', isProbeableUrl('HTTPS://cdn.example.com/a.webp'), true);
  eq('a padded url is probeable', isProbeableUrl('  https://cdn.example.com/a.webp '), true);
  eq('null is not probeable', isProbeableUrl(null), false);
  eq('undefined is not probeable', isProbeableUrl(undefined), false);
  eq('empty string is not probeable', isProbeableUrl(''), false);
  eq('whitespace is not probeable', isProbeableUrl('   '), false);
  eq('a relative path is not probeable', isProbeableUrl('/covers/a.webp'), false);
  eq('a non-http scheme is not probeable', isProbeableUrl('ftp://x/a.webp'), false);
  eq('a scheme with no host is not probeable', isProbeableUrl('https://'), false);
  eq('an embedded space is not probeable', isProbeableUrl('https://exa mple.com/a.jpg'), false);

  // inventoryVerdict -- zero is not the only broken inventory.
  eq('an empty inventory is empty', inventoryVerdict(0, 100, 1000), 'empty');
  eq('one row where 321 are expected is shrunken', inventoryVerdict(1, 100, 1000), 'shrunken');
  eq('just under the floor is shrunken', inventoryVerdict(99, 100, 1000), 'shrunken');
  eq('the floor itself is ok', inventoryVerdict(100, 100, 1000), 'ok');
  eq('the measured population is ok', inventoryVerdict(321, 100, 1000), 'ok');
  // A full PostgREST page is indistinguishable from a complete one.
  eq('exactly the row cap is capped, not ok', inventoryVerdict(1000, 100, 1000), 'capped');
  eq('past the row cap is capped', inventoryVerdict(1200, 100, 1000), 'capped');
  eq('one below the row cap is ok', inventoryVerdict(999, 100, 1000), 'ok');
  // An absent cap must BLOCK, not silently disable the tripwire.
  eq('a missing row cap is unusable, not ok', inventoryVerdict(500, 100), 'unusable');
  eq('a null row cap is unusable, not ok', inventoryVerdict(500, 100, null), 'unusable');

  // probeSetVerdict -- rows can stay healthy while the deduped URL set collapses.
  eq('no distinct URLs is empty', probeSetVerdict(0, 60), 'empty');
  eq('321 rows collapsing to 1 URL is shrunken', probeSetVerdict(1, 60), 'shrunken');
  eq('just under the distinct floor is shrunken', probeSetVerdict(59, 60), 'shrunken');
  eq('the distinct floor itself is ok', probeSetVerdict(60, 60), 'ok');
  eq('the measured distinct population is ok', probeSetVerdict(227, 60), 'ok');

  // Cloudflare edge codes: these buckets sit behind Cloudflare, so an origin
  // wobble arrives as 52x/530 and must not read as a missing object.
  eq('520 is transient, NOT dead', statusVerdict(520), 'transient');
  eq('521 origin down is transient', statusVerdict(521), 'transient');
  eq('522 connection timed out is transient', statusVerdict(522), 'transient');
  eq('524 origin timeout is transient', statusVerdict(524), 'transient');
  eq('525 SSL handshake failed is transient', statusVerdict(525), 'transient');
  eq('530 is transient', statusVerdict(530), 'transient');
  eq('520 does not fall back to GET', shouldTryGet(520), false);
  eq('510 is still dead (not a Cloudflare edge code)', statusVerdict(510), 'dead');

  // isGrantRevoked -- a revoked grant is a contract break, not infrastructure.
  eq('42501 is a revoked grant', isGrantRevoked({ code: '42501' }), true);
  eq('42883 is NOT a revoked grant', isGrantRevoked({ code: '42883' }), false);
  eq('57014 is NOT a revoked grant', isGrantRevoked({ code: '57014' }), false);
  eq('undefined is NOT a revoked grant', isGrantRevoked(undefined), false);

  // unmeasuredVerdict -- one blip is tolerated, a systemic stall is not.
  const um = (n, total) => unmeasuredVerdict(n, total, UNMEASURED_FLOOR, UNMEASURED_RATIO);
  eq('nothing unmeasured is none', um(0, 227), 'none');
  eq('a single blip is tolerated, not systemic', um(1, 227), 'tolerated');
  eq('the floor itself is tolerated', um(5, 227), 'tolerated');
  eq('just past the floor is systemic', um(6, 227), 'systemic');
  eq('a whole-CDN stall is systemic', um(227, 227), 'systemic');
  eq('the ratio governs a large inventory', um(20, 5000), 'tolerated');
  eq('the ratio still fails a large inventory', um(101, 5000), 'systemic');
  eq('the floor protects a tiny inventory from one blip', um(3, 30), 'tolerated');
  // Measuring NOTHING must never be tolerated, at any inventory size -- the
  // green-having-probed-nothing hole.
  eq('a tiny inventory fully unmeasured is systemic', um(5, 5), 'systemic');
  eq('a 2-URL inventory fully unmeasured is systemic', um(2, 2), 'systemic');
  eq('a 1-URL inventory fully unmeasured is systemic', um(1, 1), 'systemic');
  eq('4 of 5 unmeasured is still tolerated', um(4, 5), 'tolerated');

  // deadVerdict -- a whole dead inventory is a CDN diagnosis, a few are rows.
  const dv = (n, total) => deadVerdict(n, total, DEAD_SYSTEMIC_FLOOR, DEAD_SYSTEMIC_RATIO);
  eq('no dead refs is none', dv(0, 227), 'none');
  eq('one dead ref is a row, not a CDN outage', dv(1, 227), 'rows');
  eq('a third of the inventory is still rows', dv(75, 227), 'rows');
  eq('just under the ratio is still rows', dv(204, 227), 'rows');
  eq('just over the ratio is systemic', dv(205, 227), 'systemic');
  // EXACTLY on the ratio. Without this the >= / > boundary is untested: every
  // other case clears it by a margin, and a mutation to `>` survived the whole
  // canary until this line existed.
  eq('exactly at the ratio is systemic', dv(90, 100), 'systemic');
  eq('one below the exact ratio is rows', dv(89, 100), 'rows');
  eq('the whole inventory dead is systemic', dv(227, 227), 'systemic');
  eq('a tiny inventory fully dead is rows, not a CDN outage', dv(3, 3), 'rows');
  eq('the floor itself, fully dead, is systemic', dv(10, 10), 'systemic');
  eq('just under the floor, fully dead, is rows', dv(9, 9), 'rows');

  // isFunctionMissing -- codes, not prose, and wrong in EITHER direction misleads.
  eq('PGRST202 is a missing function', isFunctionMissing({ code: 'PGRST202' }), true);
  eq('42883 is a missing function', isFunctionMissing({ code: '42883' }), true);
  eq('42501 permission denied is NOT function-missing', isFunctionMissing({ code: '42501' }), false);
  eq('42703 undefined column is NOT function-missing', isFunctionMissing({ code: '42703' }), false);
  eq('42P01 undefined table is NOT function-missing', isFunctionMissing({ code: '42P01' }), false);
  eq('57014 statement timeout is NOT function-missing', isFunctionMissing({ code: '57014' }), false);
  eq('a codeless error is NOT function-missing', isFunctionMissing({ message: 'boom' }), false);
  eq('undefined is NOT function-missing', isFunctionMissing(undefined), false);

  // decideExit -- the 0/1/2 contract this file's header promises.
  const ex = (d, i, um2) => decideExit({ dead: d, invalid: i, unmeasured: um2 });
  eq('all clear exits 0', ex(0, 0, 'none'), 0);
  eq('a dead ref exits 1', ex(1, 0, 'none'), 1);
  eq('a malformed ref exits 1', ex(0, 1, 'none'), 1);
  eq('a systemic stall exits 2, not 1', ex(0, 0, 'systemic'), 2);
  eq('a TOLERATED stall exits 0, not 2', ex(0, 0, 'tolerated'), 0);
  // Fail CLOSED on anything unrecognised, rather than sliding to green.
  eq('an unrecognised verdict exits 2, not 0', ex(0, 0, 'SYSTEMIC'), 2);
  eq('a missing verdict exits 2, not 0', ex(0, 0, undefined), 2);
  eq('a stale numeric caller shape exits 2, not 0', ex(0, 0, 7), 2);
  eq('a dead ref outranks a systemic stall in the same run', ex(1, 0, 'systemic'), 1);
  eq('a dead ref still fails alongside a tolerated stall', ex(1, 0, 'tolerated'), 1);

  if (failed > 0) {
    console.error(`\nSELF-TEST FAILED -- ${failed} of ${ran} case(s).`);
    return 1;
  }
  console.log(`\nPASS self-test -- ${ran} cases, every rule proven in both directions.`);
  return 0;
}

async function main() {
  const env = loadEnv();
  const url = env.VITE_SUPABASE_URL || env.SUPABASE_URL;
  const key =
    env.VITE_SUPABASE_PUBLISHABLE_KEY || env.SUPABASE_PUBLISHABLE_KEY || env.SUPABASE_ANON_KEY;

  if (!url || !key) {
    console.error('Missing VITE_SUPABASE_URL or VITE_SUPABASE_PUBLISHABLE_KEY');
    return 2;
  }

  const { createClient } = await import('@supabase/supabase-js');
  const sb = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });

  // The inventory call is bounded too. It was the one unbounded await left in
  // the file: a PostgREST edge that accepts the connection and never answers is
  // not a statement timeout, so undici's 300s default applied and the job died
  // on ITS timeout with no named failing check -- precisely the hole every other
  // cap here exists to close. Same shape as check-festival-detail-span.mjs.
  const rpcAbort = new AbortController();
  const rpcTimer = setTimeout(() => rpcAbort.abort(), RPC_TIMEOUT_MS);
  // unref'd like sweepTimer: if sb.rpc() THROWS rather than resolving to
  // { error }, clearTimeout below is skipped and a live 20s timer would hold the
  // event loop open long after the exit code was set -- the hang this file's
  // header claims cannot happen.
  rpcTimer.unref();
  const { data, error } = await sb.rpc('list_public_image_refs_v1').abortSignal(rpcAbort.signal);
  clearTimeout(rpcTimer);

  if (error) {
    // A REMOVED or REVOKED function is a broken contract (1); a stalled or
    // unreachable PostgREST is infrastructure (2). The old code special-cased
    // "function does not exist" only to take the identical exit path, which is
    // why it was deleted -- but collapsing both into 2 lost a real distinction:
    // this repo has revoked anon EXECUTE on a public RPC before (admin
    // 20260709080000), and that must read as a contract break, not a blip.
    if (rpcAbort.signal.aborted) {
      console.error(
        `FAIL: list_public_image_refs_v1 did not answer within ${RPC_TIMEOUT_MS}ms: ${error.message}`,
      );
      return 2;
    }
    console.error(`FAIL: list_public_image_refs_v1 errored (${error.code ?? 'no code'}): ${error.message}`);
    if (isFunctionMissing(error)) {
      console.error('  The RPC is missing from the schema cache -- contract broken.');
      return 1;
    }
    if (isGrantRevoked(error)) {
      console.error('  anon EXECUTE on the RPC has been revoked -- contract broken. Re-grant it.');
      return 1;
    }
    return 2;
  }

  const rows = data ?? [];
  const inventory = inventoryVerdict(rows.length, MIN_ROWS, ROW_CAP);
  if (inventory !== 'ok') {
    const why = {
      empty:
        'FAIL: list_public_image_refs_v1 returned 0 rows. The site has public images, so this means the RPC or its predicates are broken.',
      shrunken: `FAIL: list_public_image_refs_v1 returned only ${rows.length} rows, below the floor of ${MIN_ROWS} (prod measured 321 on 2026-08-10). The read path has narrowed -- this check would otherwise report green having probed almost nothing.`,
      capped: `FAIL: list_public_image_refs_v1 returned exactly ${rows.length} rows, at or above the PostgREST page cap of ${ROW_CAP}. A full page is indistinguishable from a complete one, so the tail of the inventory would go unprobed while this reported green. Paginate the RPC (or raise the cap) before trusting this check again.`,
    }[inventory];
    // By INCLUSION: an unrecognised verdict must not print the literal string
    // "undefined" as its entire diagnosis. inventoryVerdict already grew from
    // two outcomes to three in this diff.
    console.error(why ?? `FAIL: inventory verdict '${inventory}' is not recognised by this check.`);
    return 1;
  }

  // De-dupe: the same URL is often shared across rows (series default + gallery).
  // Malformed rows are separated here rather than handed to fetch(), which would
  // throw a TypeError indistinguishable from a transport failure, retry it, and
  // then report a broken row as a dead object. Grouped by value, exactly like
  // byUrl, so invalid_count counts distinct broken values and not raw rows.
  const byUrl = new Map();
  const byInvalid = new Map();
  for (const r of rows) {
    const ref = `${r.source}#${r.ref_id}`;
    // Evaluated ONCE: called twice it parsed every URL twice, and the two
    // ternaries could be edited out of step with each other.
    const probeable = isProbeableUrl(r.url);
    const target = probeable ? byUrl : byInvalid;
    const k = probeable ? r.url.trim() : String(r.url);
    if (!target.has(k)) target.set(k, []);
    target.get(k).push(ref);
  }

  const urls = [...byUrl.keys()];
  const invalid = [...byInvalid.entries()].map(([value, refs]) => ({ url: value, refs }));

  // The floor that actually matters: rows can stay healthy while the deduped
  // probe set collapses. Checked AFTER dedupe, because that is the population
  // this check really covers.
  const probeSet = probeSetVerdict(urls.length, MIN_DISTINCT_URLS);
  if (probeSet !== 'ok') {
    console.error(
      `FAIL: ${rows.length} rows deduped to only ${urls.length} distinct probeable URL(s), below the ` +
        `floor of ${MIN_DISTINCT_URLS} (prod measured 227 on 2026-08-10). The rows look healthy but the ` +
        `url expression has collapsed -- this check would otherwise report green having probed a handful ` +
        `of objects.`,
    );
    // Name them. This gate returns before report(), and an early return that
    // prints only counts drops the one thing this check exists to provide: the
    // table.column#id of every broken ref.
    console.log(
      JSON.stringify(
        { check: 'image_refs_live', status: 'probe_set_collapsed', rows_returned: rows.length, distinct_urls: urls.length, invalid_count: invalid.length, invalid, probeable: urls },
        null,
        2,
      ),
    );
    return 1;
  }
  const dead = [];
  const indeterminate = [];
  let cursor = 0;
  const unprobed = [];
  let bodyCancelFailures = 0;

  // Whole-sweep cap, on top of the per-request one. The per-request cap bounds
  // ONE probe, not the sweep: under a mass CDN stall, ceil(urls / CONCURRENCY)
  // rounds of (HEAD 10s + GET 10s) x 2 attempts + backoff would still overrun the
  // job. This controller is folded into every request signal, so tripping it also
  // aborts probes already in flight instead of waiting out their own timeouts.
  const sweep = new AbortController();
  const sweepTimer = setTimeout(() => sweep.abort(), SWEEP_BUDGET_MS);
  sweepTimer.unref();

  async function once(u, method, withRange) {
    const res = await fetch(u, {
      method,
      redirect: 'follow',
      // Ask for one byte on the GET fallback -- only the status line matters and
      // the originals are multi-MB. Servers that ignore Range send the body
      // anyway, which is why it is cancelled below regardless; servers that
      // REFUSE Range answer 416 and are re-asked without it.
      headers: method === 'GET' && withRange ? { range: 'bytes=0-0' } : undefined,
      signal: AbortSignal.any([AbortSignal.timeout(REQ_TIMEOUT_MS), sweep.signal]),
    });
    // Release the socket without downloading the object. HEAD responses have no
    // body, hence the optional call. Counted rather than swallowed: it cannot
    // invalidate the status already in hand, so it is diagnostics only and gates
    // nothing.
    try {
      await res.body?.cancel();
    } catch {
      bodyCancelFailures += 1;
    }
    return res.status;
  }

  // Returns {verdict, label}; verdict is ok | dead | indeterminate | unprobed.
  async function probe(u) {
    let last = null;
    for (let attempt = 1; attempt <= 2; attempt++) {
      if (sweep.signal.aborted) return { verdict: 'unprobed' };
      try {
        let status = await once(u, 'HEAD', false);
        if (shouldTryGet(status)) {
          status = await once(u, 'GET', true);
          if (shouldRetryWithoutRange(status)) status = await once(u, 'GET', false);
        }
        const verdict = statusVerdict(status);
        if (verdict === 'ok') return { verdict: 'ok' };
        // Dead is reported on FIRST observation, deliberately. Giving it a second
        // look was tried and REVERTED: `last` holds whatever the last attempt
        // said, so a 404 followed by a 503 or a timeout overwrote the dead
        // verdict with 'indeterminate', which the unmeasured tolerance then
        // absorbed -- a genuinely deleted object exiting GREEN with a NOTE. That
        // is the precise 14-hour regression this check exists to catch. The dead
        // bucket has zero tolerance on purpose; the cost of a transient 404
        // producing one red is far below the cost of a real one passing.
        if (verdict === 'dead') return { verdict: 'dead', label: String(status) };
        last = { verdict: 'indeterminate', label: `HTTP ${status}` };
      } catch (e) {
        if (sweep.signal.aborted) return { verdict: 'unprobed' };
        last = { verdict: 'indeterminate', label: errorLabel(e, REQ_TIMEOUT_MS) };
      }
      if (attempt === 1) await new Promise((resolve) => setTimeout(resolve, RETRY_BACKOFF_MS));
    }
    return last;
  }

  async function worker() {
    while (cursor < urls.length) {
      const u = urls[cursor++];
      const { verdict, label } = await probe(u);
      // Recorded, not just counted: the tolerated NOTE says the unmeasured
      // refs are "named above", and a bare counter made that a lie -- the
      // operator was sent to look at URLs nothing had printed.
      if (verdict === 'unprobed') unprobed.push({ url: u, refs: byUrl.get(u) });
      else if (verdict === 'dead') dead.push({ url: u, status: label, refs: byUrl.get(u) });
      else if (verdict === 'indeterminate')
        indeterminate.push({ url: u, status: label, refs: byUrl.get(u) });
    }
  }

  const sweepStarted = Date.now();
  await Promise.all(Array.from({ length: CONCURRENCY }, worker));
  clearTimeout(sweepTimer);
  const sweepMs = Date.now() - sweepStarted;
  return report({ rows, urls, dead, invalid, indeterminate, unprobed, bodyCancelFailures, sweepMs });
}

function report({ rows, urls, dead, invalid, indeterminate, unprobed, bodyCancelFailures, sweepMs }) {
  const allowed = unmeasuredAllowance(urls.length, UNMEASURED_FLOOR, UNMEASURED_RATIO);
  // Ratio against the population actually MEASURED, not the whole inventory. A
  // real edge incident is mixed -- some 404, some 503, some stalls -- so with
  // urls.length as the denominator 200 dead of 227 with 27 stalled scores 0.881
  // and falls back to "fix the row" for 200 rows that were never broken. Against
  // the 200 that were actually judged it is 1.0, which is the truth.
  const unmeasured = indeterminate.length + unprobed.length;
  // Denominator is the WHOLE inventory. Using the measured subset (urls minus
  // unmeasured) was tried and REVERTED: with 217 of 227 stalled, 10 genuinely
  // dead rows scored 10-of-10 = 'systemic' and the operator was told "do not
  // start editing or re-uploading rows", leaving 10 real broken images live. The
  // two error directions are not symmetric -- over-reporting 'rows' costs a
  // wasted look, under-reporting costs broken images nobody fixes -- so this
  // leans to 'rows'. The cost is that a genuinely mixed edge incident reads as
  // per-row, which is the safe way to be wrong, and every ref is still named.
  const deadClass = deadVerdict(dead.length, urls.length, DEAD_SYSTEMIC_FLOOR, DEAD_SYSTEMIC_RATIO);
  const deadShown = deadClass === 'systemic' ? dead.slice(0, LIST_PRINT_CAP) : dead;
  const indeterminateShown = indeterminate.slice(0, LIST_PRINT_CAP);
  const unprobedShown = unprobed.slice(0, LIST_PRINT_CAP);
  // "Named above" is only honest when nothing was cut. Any capped list appends
  // its own count instead of silently claiming completeness.
  const namedAbove = (shown, all) =>
    shown.length === all.length ? 'Named above.' : `First ${shown.length} of ${all.length} named above.`;
  // One clause covering both unmeasured buckets. Emitting namedAbove() per bucket
  // printed "Named above. Named above." whenever both were complete.
  const unmeasuredNaming =
    [
      indeterminate.length > 0 ? namedAbove(indeterminateShown, indeterminate) : null,
      unprobed.length > 0 ? namedAbove(unprobedShown, unprobed) : null,
    ]
      .filter(Boolean)
      .join(' ');
  const unmeasuredClass = unmeasuredVerdict(
    unmeasured,
    urls.length,
    UNMEASURED_FLOOR,
    UNMEASURED_RATIO,
  );
  const exitCode = decideExit({
    dead: dead.length,
    invalid: invalid.length,
    unmeasured: unmeasuredClass,
  });

  console.log(
    JSON.stringify(
      {
        check: 'image_refs_live',
        status: exitCode === 0 ? 'ok' : exitCode === 1 ? 'contract_violated' : 'could_not_measure',
        rows_returned: rows.length,
        distinct_urls: urls.length,
        sweep_ms: sweepMs,
        sweep_budget_ms: SWEEP_BUDGET_MS,
        dead_count: dead.length,
        dead_class: deadClass,
        invalid_count: invalid.length,
        indeterminate_count: indeterminate.length,
        unprobed_count: unprobed.length,
        unmeasured_class: unmeasuredClass,
        unmeasured_allowed: allowed,
        body_cancel_failures: bodyCancelFailures,
        // A list prints IN FULL when it is a worklist and is CAPPED when it is a
        // diagnosis. Dead rows and malformed refs are worked through one at a
        // time, so truncating them made the "each is named above" claim a lie.
        // But a wholly-dead inventory is one CDN fact rather than N rows, and
        // unmeasured refs are never a worklist, so those are capped -- otherwise
        // a CDN-wide stall dumps the entire inventory into the CI log through
        // whichever field happens to hold it. Every cap reports what it cut.
        dead: deadShown,
        dead_truncated: dead.length - deadShown.length,
        invalid,
        indeterminate: indeterminateShown,
        indeterminate_truncated: indeterminate.length - indeterminateShown.length,
        unprobed: unprobedShown,
        unprobed_truncated: unprobed.length - unprobedShown.length,
      },
      null,
      2,
    ),
  );

  // Every condition is reported before returning. An earlier draft returned on
  // the first one, so a run that found real dead refs AND then hit a stall
  // printed only the stall -- and told the operator not to touch any row.
  if (invalid.length > 0) {
    console.error(
      `\nIMAGE REFS FAIL: ${invalid.length} distinct url value(s) are null, blank, relative or ` +
        `non-HTTP. Those are broken rows, not broken objects -- fix the ref, listed above.`,
    );
  }

  if (deadClass === 'systemic') {
    console.error(
      `\nIMAGE REFS FAIL: ${dead.length} of ${urls.length} public image URL(s) are unreachable -- ` +
        `that is essentially the whole inventory, which points at a CDN or bucket misconfiguration ` +
        `(a removed binding, a changed route rule, an expired origin cert), NOT at ${dead.length} ` +
        `independently broken rows. Check the bucket and the edge FIRST; do not start editing or ` +
        `re-uploading rows. ${namedAbove(deadShown, dead)}`,
    );
  } else if (deadClass === 'rows') {
    console.error(
      `\nIMAGE REFS FAIL: ${dead.length} of ${urls.length} public image URL(s) are unreachable. ` +
        `Each is named with its table.column#id above -- fix the row (or re-upload the object), do not weaken this check.`,
    );
  }

  if (unmeasuredClass === 'systemic') {
    console.error(
      `\nIMAGE REFS UNMEASURED: ${indeterminate.length} URL(s) answered with a transient status or ` +
        `transport error after a retry, and ${unprobed.length} were cut off by the ${SWEEP_BUDGET_MS / 1000}s ` +
        `sweep budget -- ${unmeasured} of ${urls.length}, past the tolerance of ` +
        `${allowed}. That points at CDN ` +
        `reachability, NOT at those rows -- investigate before touching any data.`,
    );
  } else if (unmeasuredClass === 'tolerated') {
    // Deliberately not a failure: see UNMEASURED_FLOOR. Still printed every time,
    // because a tolerance that reports nothing is indistinguishable from a check
    // that stopped looking -- and this line is the only trace that some of the
    // inventory went unverified on an otherwise green run.
    console.error(
      `\nNOTE: ${unmeasured} of ${urls.length} URL(s) could not be measured (${indeterminate.length} ` +
        `transient, ${unprobed.length} cut off by the sweep budget). Within the tolerance of ` +
        `${allowed}, so this did not by ` +
        `itself fail the run -- but those refs were NOT verified. ${unmeasuredNaming}`,
    );
  }

  // Deliberately NOT gated on a green run: the runs where the budget is under
  // pressure are exactly the ones that fail, so gating this on success would
  // silence it precisely when it matters.
  if (sweepMs > SWEEP_BUDGET_MS / 2) {
    console.error(
      `\nWARNING: the sweep took ${sweepMs}ms of its ${SWEEP_BUDGET_MS}ms budget over ` +
        `${urls.length} URLs. Raise SWEEP_BUDGET_MS or CONCURRENCY before it starts failing runs.`,
    );
  }

  if (exitCode === 0) {
    // "all reachable" is only true when nothing went unmeasured. On a tolerated
    // run it directly contradicts the NOTE printed just above, and a green line
    // that overstates what was checked is the failure this file is about.
    const verified = urls.length - unmeasured;
    console.log(
      unmeasured === 0
        ? `\nLive image refs: ok (${urls.length} distinct public URLs, all reachable, ${sweepMs}ms).`
        : `\nLive image refs: ok (${verified} of ${urls.length} distinct public URLs verified reachable, ` +
            `${unmeasured} unverified but within tolerance, ${sweepMs}ms).`,
    );
  }
  return exitCode;
}

// Only act as a CLI when actually invoked as one. Unguarded, the top-level body
// plus its exit ran on mere `import`, so a spec pulling in one of the exports
// above would fire the RPC, make hundreds of outbound CDN requests, and then set
// the test runner's exit code. Four specs in this repo already import check
// scripts; both sibling guards carry this same guard for the same reason.
const IS_CLI =
  process.argv[1] !== undefined && import.meta.url === pathToFileURL(process.argv[1]).href;

if (IS_CLI) {
  const argv = process.argv.slice(2);
  const KNOWN_FLAGS = ['--self-test'];
  const unknown = argv.filter((a) => !KNOWN_FLAGS.includes(a));
  if (unknown.length > 0) {
    // A silently-ignored typo (--selftest) would run the full live sweep while
    // the operator believed they were running the offline canary.
    console.error(`Unknown flag(s): ${unknown.join(', ')}. Known: ${KNOWN_FLAGS.join(', ')}`);
    process.exitCode = 2;
  } else if (argv.includes('--self-test')) {
    process.exitCode = selfTest();
  } else {
    // Anything that escapes main() is infrastructure, not a contract violation.
    // Uncaught, Node exits 1, which this file's own contract reads as "dead or
    // malformed refs" -- the operator would be sent to edit live data over a
    // malformed VITE_SUPABASE_URL or a broken dependency.
    try {
      process.exitCode = await main();
    } catch (e) {
      console.error(`FAIL: the check could not run: ${e?.stack || e?.message || e}`);
      process.exitCode = 2;
    }
  }
}

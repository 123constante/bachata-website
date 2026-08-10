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
 * Exit: 0 pass, 1 contract violated (dead refs, malformed refs, a shrunken or
 *       empty inventory, a missing RPC), 2 the check could not run or could not
 *       measure (bad creds, unreachable DB, stalled CDN).
 */
import fs from 'node:fs';
import { pathToFileURL } from 'node:url';
import { createClient } from '@supabase/supabase-js';

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

// How many indeterminate refs to print. Unlike dead refs -- which an operator
// fixes one by one, so truncating that list would be a lie -- an indeterminate
// list is not worked through: its entire actionable content is "the CDN is
// unhappy". A CDN-wide stall would otherwise dump the whole inventory into the
// CI log.
const INDETERMINATE_PRINT_CAP = 20;

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
const TRANSIENT_STATUSES = new Set([408, 425, 429, 500, 502, 503, 504]);

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

// An inventory that shrank is a broken read path, not a clean site.
export function inventoryVerdict(rowCount, minRows) {
  if (rowCount === 0) return 'empty';
  if (rowCount < minRows) return 'shrunken';
  return 'ok';
}

// dead/malformed are contract violations (1); anything we merely failed to
// measure is infrastructure (2). Violations win so a real dead ref is never
// downgraded by a CDN wobble in the same run.
export function decideExit({ dead, invalid, indeterminate, unprobed }) {
  if (dead > 0 || invalid > 0) return 1;
  if (indeterminate > 0 || unprobed > 0) return 2;
  return 0;
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
  eq('an empty inventory is empty', inventoryVerdict(0, 100), 'empty');
  eq('one row where 321 are expected is shrunken', inventoryVerdict(1, 100), 'shrunken');
  eq('just under the floor is shrunken', inventoryVerdict(99, 100), 'shrunken');
  eq('the floor itself is ok', inventoryVerdict(100, 100), 'ok');
  eq('the measured population is ok', inventoryVerdict(321, 100), 'ok');

  // decideExit -- the 0/1/2 contract this file's header promises.
  const ex = (d, i, ind, u) => decideExit({ dead: d, invalid: i, indeterminate: ind, unprobed: u });
  eq('all clear exits 0', ex(0, 0, 0, 0), 0);
  eq('a dead ref exits 1', ex(1, 0, 0, 0), 1);
  eq('a malformed ref exits 1', ex(0, 1, 0, 0), 1);
  eq('indeterminate alone exits 2, not 1', ex(0, 0, 1, 0), 2);
  eq('unprobed alone exits 2, not 1', ex(0, 0, 0, 1), 2);
  eq('a dead ref outranks a stall in the same run', ex(1, 0, 0, 5), 1);
  eq('a stall does not invent a violation', ex(0, 0, 3, 200), 2);

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

  const sb = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });

  // The inventory call is bounded too. It was the one unbounded await left in
  // the file: a PostgREST edge that accepts the connection and never answers is
  // not a statement timeout, so undici's 300s default applied and the job died
  // on ITS timeout with no named failing check -- precisely the hole every other
  // cap here exists to close. Same shape as check-festival-detail-span.mjs.
  const rpcAbort = new AbortController();
  const rpcTimer = setTimeout(() => rpcAbort.abort(), RPC_TIMEOUT_MS);
  const { data, error } = await sb.rpc('list_public_image_refs_v1').abortSignal(rpcAbort.signal);
  clearTimeout(rpcTimer);

  if (error) {
    // A REMOVED or REVOKED function is a broken contract (1); a stalled or
    // unreachable PostgREST is infrastructure (2). The old code special-cased
    // "function does not exist" only to take the identical exit path, which is
    // why it was deleted -- but collapsing both into 2 lost a real distinction:
    // this repo has revoked anon EXECUTE on a public RPC before (admin
    // 20260709080000), and that must read as a contract break, not a blip.
    const missing = /does not exist|PGRST202|schema cache/i.test(error.message || '');
    if (rpcAbort.signal.aborted) {
      console.error(
        `FAIL: list_public_image_refs_v1 did not answer within ${RPC_TIMEOUT_MS}ms: ${error.message}`,
      );
      return 2;
    }
    console.error(`FAIL: list_public_image_refs_v1 errored: ${error.message}`);
    if (missing) {
      console.error('  The RPC is missing or anon EXECUTE was revoked -- contract broken.');
      return 1;
    }
    return 2;
  }

  const rows = data ?? [];
  const inventory = inventoryVerdict(rows.length, MIN_ROWS);
  if (inventory !== 'ok') {
    console.error(
      inventory === 'empty'
        ? 'FAIL: list_public_image_refs_v1 returned 0 rows. The site has public images, so this means the RPC or its predicates are broken.'
        : `FAIL: list_public_image_refs_v1 returned only ${rows.length} rows, below the floor of ${MIN_ROWS} (prod measured 321 on 2026-08-10). The read path has narrowed -- this check would otherwise report green having probed almost nothing.`,
    );
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
    const target = isProbeableUrl(r.url) ? byUrl : byInvalid;
    const k = isProbeableUrl(r.url) ? r.url.trim() : String(r.url);
    if (!target.has(k)) target.set(k, []);
    target.get(k).push(ref);
  }

  const urls = [...byUrl.keys()];
  const invalid = [...byInvalid.entries()].map(([value, refs]) => ({ url: value, refs }));
  const dead = [];
  const indeterminate = [];
  let cursor = 0;
  let unprobed = 0;
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
      if (verdict === 'unprobed') unprobed += 1;
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
  const exitCode = decideExit({
    dead: dead.length,
    invalid: invalid.length,
    indeterminate: indeterminate.length,
    unprobed,
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
        invalid_count: invalid.length,
        indeterminate_count: indeterminate.length,
        unprobed_count: unprobed,
        body_cancel_failures: bodyCancelFailures,
        // dead and invalid are NOT truncated: the operator works through them one
        // by one, and slicing to 20 made the "each is named above" claim a lie --
        // they would fix 20, re-run, and get another red with no sign of a cut.
        dead,
        invalid,
        indeterminate: indeterminate.slice(0, INDETERMINATE_PRINT_CAP),
        indeterminate_truncated: Math.max(0, indeterminate.length - INDETERMINATE_PRINT_CAP),
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

  if (dead.length > 0) {
    console.error(
      `\nIMAGE REFS FAIL: ${dead.length} of ${urls.length} public image URL(s) are unreachable. ` +
        `Each is named with its table.column#id above -- fix the row (or re-upload the object), do not weaken this check.`,
    );
  }

  if (indeterminate.length > 0 || unprobed > 0) {
    console.error(
      `\nIMAGE REFS UNMEASURED: ${indeterminate.length} URL(s) answered with a transient status or ` +
        `transport error after a retry, and ${unprobed} were cut off by the ${SWEEP_BUDGET_MS / 1000}s ` +
        `sweep budget. That points at CDN reachability, NOT at those rows -- investigate before ` +
        `touching any data.`,
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
    console.log(
      `\nLive image refs: ok (${urls.length} distinct public URLs, all reachable, ${sweepMs}ms).`,
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
    process.exitCode = await main();
  }
}

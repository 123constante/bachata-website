#!/usr/bin/env node
/**
 * Is /sitemap.xml actually FETCHABLE before we tell Google to go and crawl it?
 *
 * WHY THIS EXISTS -- what the old workflow could not see
 * -----------------------------------------------------
 * sitemap-submit.yml ran green throughout the 2026-08-21 WAF incident while
 * https://www.bachatacalendar.co.uk/sitemap.xml was serving HTTP 429 and a
 * "Vercel Security Checkpoint" HTML page to every non-browser client. That is
 * not a bug in the workflow's error handling. It is what the workflow measured:
 *
 *   `check-gsc.mjs --submit-canonical` calls the Search Console API
 *   `PUT /webmasters/v3/sites/{site}/sitemaps/{feedpath}`. That call REGISTERS
 *   a feedpath. Google accepts the registration and fetches the URL later, on
 *   its own schedule, from its own machines. The 2xx we assert on is Google
 *   saying "noted", never "fetched".
 *
 * So the workflow's green was accurate and useless at the same time: a
 * perfectly successful announcement of a document nobody could read. Worse
 * than useless, in fact -- submitting an unfetchable sitemap is how a fetch
 * error gets recorded against the property.
 *
 * The assumption the old version rested on, now named: something else was
 * believed to guarantee fetchability. Nothing did. check-gsc.mjs's default
 * (non-submit) mode does read sitemaps.list and flags errors Google reports
 * against the canonical sitemap -- but that runs in gsc-health-check.yml, is
 * LAGGING (it reports Google's last fetch, whenever that was), and was not in
 * this workflow's path at all.
 *
 * THE USER-AGENT IS THE POINT
 * ---------------------------
 * On 2026-08-21 a real browser got 200 and every non-browser client got 429
 * from the same URL in the same minute. A probe sent with a browser UA would
 * have been green right through it. This guard therefore identifies itself
 * honestly as a non-browser agent, which is the class the flip actually broke.
 *
 * HONEST LIMIT, stated rather than implied: this does NOT prove Googlebot
 * specifically is allowed. Vercel verifies Googlebot by reverse DNS, so we
 * cannot impersonate one from a GitHub runner -- and spoofing the UA would
 * make the reading LESS accurate, not more, once P6 re-arms bot_protection
 * (a spoofed Googlebot fails verification where the real one passes). What
 * this proves is that the sitemap is servable to a generic non-browser HTTP
 * client. When P6 re-arms bot_protection, this guard is expected to be one of
 * the surfaces the new bypass rules must cover -- and it going red at that
 * point is the guard working, not a false positive.
 *
 * Also out of scope, deliberately: /robots.txt, which 429'd in the same
 * incident and gates crawling just as hard. It has no guard here yet.
 *
 * EXIT CODES (R3)
 *   0  the sitemap is fetchable and looks like a sitemap
 *   1  contract violated -- not 200, not XML, not a sitemap, or near-empty
 *   2  infrastructure -- could not measure (DNS death, timeout, no target)
 *
 * Local:  node scripts/check-sitemap-fetchable.mjs
 * Canary: node scripts/check-sitemap-fetchable.mjs --self-test
 * CI:     SITEMAP_CHECK_BASE overrides the base URL (default production).
 */
import { isEntryPoint } from './lib/entry-point.mjs';

export const DEFAULT_BASE = 'https://www.bachatacalendar.co.uk';

/** Honest, non-browser, and identifiable in an access log. NOT a spoofed
 *  crawler UA -- see the header for why that would be worse. */
export const PROBE_UA = 'BachataCalendar-SitemapGuard/1 (+https://github.com/123constante/bachata-website)';

/** MEASURED, both edges pinned by the canary. Prod served 314 <loc> entries on
 *  2026-08-22: 26 singleton static routes (the hand-listed marketing/landing
 *  pages, which render even when every database read returns nothing) plus 288
 *  entity URLs (135 dancers, 72 events, 42 venues, 40 organisers).
 *
 *  50 sits ABOVE the static-only floor, so a sitemap whose entity queries all
 *  failed still reds while remaining valid XML; and far BELOW the live count,
 *  so ordinary entity churn cannot red it. A floor set "well below" a number
 *  nobody ran would miss exactly the generation failure this is for. */
export const MIN_LOCS = 50;

/** Wall-clock bound on the single request. The STEP that runs this declares
 *  `timeout-minutes: 1` (sitemap-submit.yml) -- that 60s, not the job's 3
 *  minutes, is the budget this has to fit inside. An earlier comment quoted the
 *  job's, which is the wrong denominator: sized against 3 minutes, a raised
 *  bound would be killed by the step as CANCELLED with no violation message
 *  rather than returning the exit 2 the contract promises. Raised in review. */
export const TIMEOUT_MS = 15000;

/**
 * Which URL are we about to prove, and is it the one that will be SUBMITTED?
 *
 * check-gsc.mjs builds the submitted feedpath from GSC_CHECK_BASE; this guard
 * builds its probe target from SITEMAP_CHECK_BASE. Two independent defaults for
 * one URL means they can drift, and a drifted gate goes GREEN having measured a
 * different URL from the one announced -- the wrong-surface class this whole
 * arc exists to remove, reintroduced inside the workflow that fixes it. Raised
 * in review.
 *
 * SITEMAP_CHECK_BASE wins when set, because it is the deliberate rehearsal
 * override. But if GSC_CHECK_BASE is ALSO set and disagrees, that is not a
 * rehearsal, it is the divergence itself -- refused rather than measured
 * around.
 */
export function resolveTarget(env = {}) {
  const probe = env.SITEMAP_CHECK_BASE || env.GSC_CHECK_BASE || DEFAULT_BASE;
  const submit = env.GSC_CHECK_BASE || null;
  const norm = (u) => String(u).replace(/\/$/, '');
  if (submit && norm(submit) !== norm(probe)) {
    throw new CannotMeasure(
      'SITEMAP_CHECK_BASE resolves to ' + norm(probe) + ' but check-gsc.mjs will submit ' +
      norm(submit) + ' (GSC_CHECK_BASE). Proving one URL and announcing another is not a check. ' +
      'Set them to the same value, or unset SITEMAP_CHECK_BASE.'
    );
  }
  return norm(probe);
}

export class CannotMeasure extends Error {}

/** Extracts the <loc> count without a full XML parse -- zero dependencies, and
 *  the shape assertions below are what actually establish this is a sitemap. */
export function countLocs(body) {
  return (String(body).match(/<loc>/g) || []).length;
}

/**
 * The whole decision, as a pure function of ONE reading. No network, no clock,
 * no filesystem -- so the canary drives exactly this.
 *
 * `reading` is { url, ua, status, contentType, body, finalUrl }.
 */
export function evaluate(reading) {
  const violations = [];
  const notes = [];
  let checks = 0;

  if (reading === null || typeof reading !== 'object') {
    throw new CannotMeasure('the probe returned ' + JSON.stringify(reading) + ', expected a reading object');
  }
  const status = reading.status;
  if (typeof status !== 'number' || !Number.isFinite(status)) {
    throw new CannotMeasure('no HTTP status in the reading (' + JSON.stringify(status) + '); nothing was measured');
  }
  const body = typeof reading.body === 'string' ? reading.body : null;
  if (body === null) {
    throw new CannotMeasure('the reading carries no body string; nothing was measured');
  }
  checks++;

  // ---- V1: it answered 200 ------------------------------------------------
  // 429 is the 2026-08-21 shape exactly. 403/401 is the same family. Anything
  // that is not 200 means the document we are about to announce cannot be read
  // by the agents we are announcing it to.
  if (status !== 200) {
    violations.push(
      reading.url + ' answered HTTP ' + status + ' to a non-browser client (UA ' + JSON.stringify(reading.ua) + '). ' +
      (status === 429 || status === 403
        ? 'That is the 2026-08-21 shape: an edge/WAF control challenging non-browser clients. Check the Vercel firewall config (npm run check:firewall-drift). '
        : '') +
      'Submitting this URL to a search engine would record a fetch error against the property. ' +
      'First 120 bytes of what it served: ' + JSON.stringify(body.slice(0, 120))
    );
  }
  checks++;

  // ---- V2: it is XML ------------------------------------------------------
  // A checkpoint / login / error page can answer 200 with HTML. The status
  // check alone would pass it, and Google would then record a parse error.
  const ct = String(reading.contentType ?? '').toLowerCase();
  if (!/xml/.test(ct)) {
    violations.push(
      reading.url + ' served content-type ' + JSON.stringify(reading.contentType ?? null) +
      ', which is not XML. A 200 that is not XML is an interstitial (checkpoint, login, SPA fallback), not a sitemap.'
    );
  }
  checks++;

  // ---- V3: it is a SITEMAP ------------------------------------------------
  // The content-type header is set by whatever answered; the root element is
  // set by the generator. Both, because either alone is forgeable by an
  // interstitial that happens to be served as XML.
  const isUrlset = /<urlset[\s>]/i.test(body);
  const isIndex = /<sitemapindex[\s>]/i.test(body);
  const isSitemap = isUrlset || isIndex;
  if (!isSitemap) {
    violations.push(
      reading.url + ' has no <urlset> or <sitemapindex> root element. Whatever answered, it is not a sitemap. ' +
      'First 120 bytes: ' + JSON.stringify(body.slice(0, 120))
    );
  }
  checks++;

  // ---- V4: it is not near-empty ------------------------------------------
  // A valid, well-formed, correctly-typed sitemap listing almost nothing is
  // the failure mode with no other tell: every assertion above passes and the
  // site quietly de-indexes.
  // THE FLOOR APPLIES TO A FLAT <urlset> ONLY. MIN_LOCS is calibrated against
  // prod's 314-entry urlset; a <sitemapindex> lists CHILD SITEMAPS, and a real
  // one carries a handful, not fifty. Holding both shapes to one floor would
  // have false-redded the gate -- and blocked the GSC submit on a healthy site
  // -- the day the generator was split per entity type or past 50k URLs. Raised
  // in review; the first draft's canary hid it behind a 60-child index, an
  // index size no generator produces.
  const locs = countLocs(body);
  if (isUrlset && locs < MIN_LOCS) {
    violations.push(
      reading.url + ' lists only ' + locs + ' URL(s), floor is ' + MIN_LOCS + '. Prod carried 314 on 2026-08-22, ' +
      'of which 26 are static routes that render with no database at all -- so this reads as entity generation ' +
      'having failed while the document stayed valid.'
    );
  } else if (isIndex && locs < 1) {
    // An index with no children is the same defect wearing the other shape:
    // valid, well-formed, correctly typed, and pointing at nothing.
    violations.push(reading.url + ' is a <sitemapindex> listing NO child sitemaps. It points at nothing.');
  }
  checks++;

  if (reading.finalUrl && reading.finalUrl !== reading.url) {
    notes.push('redirected to ' + reading.finalUrl);
  }
  notes.push(locs + ' <loc> entries, ' + body.length + ' bytes, content-type ' + JSON.stringify(reading.contentType ?? null) + '.');

  return { code: violations.length ? 1 : 0, violations, notes, checks, locs };
}

/** The floor R1 asks for. Every valid reading runs the same straight-line
 *  path; the canary pins this to the measured value in both directions. */
export const MIN_CHECKS = 5;

/**
 * Default collaborator. Injected so the canary never opens a socket.
 *
 * A THROW here (DNS death, timeout, connection reset) is exit 2, never a
 * violation and never a pass: it means the reading was not taken. A 429 IS a
 * reading, and is a violation -- the distinction is the whole exit contract.
 */
export async function probeLive(base, { ua = PROBE_UA, timeoutMs = TIMEOUT_MS, fetchImpl = fetch } = {}) {
  const url = String(base).replace(/\/$/, '') + '/sitemap.xml';
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const res = await fetchImpl(url, {
      headers: { 'user-agent': ua, accept: 'application/xml,text/xml,*/*' },
      redirect: 'follow',
      signal: ctrl.signal,
    });
    // Read the body on EVERY status. The 429 case is the one whose body names
    // the cause ("Vercel Security Checkpoint"), and an unconsumed undici body
    // keeps the event loop alive for minutes (repo-measured).
    const body = await res.text();
    return {
      url, ua, status: res.status, contentType: res.headers.get('content-type'),
      body, finalUrl: res.url,
    };
  } catch (error) {
    throw new CannotMeasure('could not reach ' + url + ' as ' + JSON.stringify(ua) + ': ' + (error?.message || error));
  } finally {
    clearTimeout(timer);
  }
}

/**
 * The exit owner. Every collaborator is injected, so the canary drives THIS
 * function -- not a re-implementation of it -- with no network (R5).
 */
export async function main(argv = [], deps = {}) {
  const out = deps.log || console.log;
  const err = deps.err || console.error;

  if (argv.includes('--self-test')) return selfTest({ log: out, err });

  const env = deps.env || process.env;

  let reading;
  try {
    const base = (deps.resolveTarget || resolveTarget)(env);
    reading = await (deps.probe || probeLive)(base);
  } catch (error) {
    err('sitemap fetchability: CANNOT MEASURE -- ' + (error?.message || error));
    err('  This is exit 2, not a pass. The sitemap was NOT submitted.');
    return 2;
  }

  // Printed before the verdict, on every path: RC5 was a guard that was green
  // because it measured the wrong host, so this one always says what it hit.
  //
  // Defensive on a MALFORMED reading, not decoration: the first draft read
  // reading.url unguarded here, ahead of the shape assertions in evaluate(),
  // so a null reading threw a TypeError out of main() instead of returning 2 --
  // an uncaught crash where the exit contract promises an infrastructure code.
  // The canary caught that too.
  out('sitemap fetchability: measured ' + (reading && reading.url ? reading.url : '(no reading)') +
    ' as ' + JSON.stringify(reading && reading.ua ? reading.ua : null) + '.');

  const assess = deps.evaluate || evaluate;
  let result;
  try {
    result = assess(reading);
  } catch (error) {
    if (error instanceof CannotMeasure) {
      err('sitemap fetchability: CANNOT MEASURE -- ' + error.message);
      err('  This is exit 2, not a pass. The sitemap was NOT submitted.');
      return 2;
    }
    throw error;
  }

  if (result.checks < MIN_CHECKS) {
    err('sitemap fetchability: CANNOT MEASURE -- only ' + result.checks + ' assertion(s) evaluated, floor is ' + MIN_CHECKS + '.');
    return 2;
  }

  for (const n of result.notes) out('  note: ' + n);

  if (result.code === 0) {
    out('sitemap is fetchable: OK (' + result.checks + ' assertions).');
    out('  NOTE: this proves a generic non-browser client can read it. It does NOT');
    out('  prove Googlebot is allowed -- see this script\'s header.');
    return 0;
  }

  err('sitemap fetchability: CONTRACT VIOLATED -- NOT submitting to search engines.');
  for (const v of result.violations) err('  - ' + v);
  return 1;
}

// ---------------------------------------------------------------------------
// CANARY (R4). Every case drives main() -- the exit owner -- with an injected
// probe, so the EXIT CODES are measured, not asserted (R5). Each case pins
// WHICH branch produced its code; four branches here return 2.
//
// The healthy fixture is prod as read on 2026-08-22 (200, application/xml,
// 59360 bytes, 314 <loc>), and the 429 fixture is the body Vercel's checkpoint
// actually serves.
// ---------------------------------------------------------------------------
const PROD_URL = DEFAULT_BASE + '/sitemap.xml';

function healthyBody(n = 314) {
  return '<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">' +
    Array.from({ length: n }, (_, i) => '<url><loc>' + DEFAULT_BASE + '/event/e' + i + '</loc></url>').join('') +
    '</urlset>';
}
function healthy(overrides = {}) {
  return {
    url: PROD_URL, ua: PROBE_UA, status: 200,
    contentType: 'application/xml', body: healthyBody(), finalUrl: PROD_URL,
    ...overrides,
  };
}
const CHECKPOINT = '<!doctype html><html><head><title>Vercel Security Checkpoint</title></head><body></body></html>';

export function canaryCases() {
  return [
    { name: 'prod as measured 2026-08-22 -> 0', reading: healthy(), code: 0, expect: /is fetchable: OK/ },
    // FOUR children, not sixty. A real index carries a handful, and the first
    // draft's 60-child fixture was what hid the floor being applied to it.
    { name: 'a REAL-SIZED sitemapindex (4 children) is not held to the urlset floor -> 0',
      reading: healthy({ body: '<?xml version="1.0"?><sitemapindex>' +
        Array.from({ length: 4 }, (_, i) => '<sitemap><loc>' + DEFAULT_BASE + '/s' + i + '.xml</loc></sitemap>').join('') +
        '</sitemapindex>' }), code: 0, expect: /is fetchable: OK/ },
    { name: 'an EMPTY sitemapindex points at nothing -> 1 (index branch)',
      reading: healthy({ body: '<?xml version="1.0"?><sitemapindex></sitemapindex>' }),
      code: 1, expect: /listing NO child sitemaps/ },
    { name: 'text/xml is XML too -> 0', reading: healthy({ contentType: 'text/xml; charset=utf-8' }), code: 0, expect: /is fetchable: OK/ },

    { name: 'THE INCIDENT: 429 checkpoint -> 1 (status branch)',
      reading: healthy({ status: 429, contentType: 'text/html; charset=utf-8', body: CHECKPOINT }),
      code: 1, expect: /answered HTTP 429[\s\S]*2026-08-21 shape/ },
    { name: '403 is the same family -> 1 (status branch, WAF arm)',
      reading: healthy({ status: 403, contentType: 'text/html', body: CHECKPOINT }),
      code: 1, expect: /answered HTTP 403[\s\S]*check:firewall-drift/ },
    { name: '404 -> 1 (status branch, non-WAF arm)',
      reading: healthy({ status: 404, contentType: 'text/html', body: '<html>not found</html>' }),
      code: 1, expect: /answered HTTP 404/ },
    { name: '200 HTML interstitial -> 1 (content-type branch)',
      reading: healthy({ contentType: 'text/html; charset=utf-8', body: CHECKPOINT }),
      code: 1, expect: /not XML/ },
    { name: '200 XML that is not a sitemap -> 1 (root-element branch)',
      reading: healthy({ body: '<?xml version="1.0"?><error>nope</error>' }),
      code: 1, expect: /no <urlset> or <sitemapindex>/ },
    { name: 'near-empty sitemap -> 1 (floor branch)',
      reading: healthy({ body: healthyBody(MIN_LOCS - 1) }),
      // No escaped parens in this pattern ON PURPOSE. The first draft built it
      // with a doubled backslash and the FUSE mount collapsed it to a single
      // one, turning URL(s) into a capture group that matched nothing. The
      // canary caught it; the fix is to need no escape at all.
      code: 1, expect: new RegExp('lists only ' + (MIN_LOCS - 1) + ' URL') },
    { name: 'exactly at the floor stays green -> 0 (the other edge)',
      reading: healthy({ body: healthyBody(MIN_LOCS) }), code: 0, expect: /is fetchable: OK/ },
    { name: 'a static-only sitemap (26 locs) reds -> 1',
      reading: healthy({ body: healthyBody(26) }), code: 1, expect: /lists only 26 URL\(s\)/ },

    // --- THE EXIT-CODE CONTRACT ITSELF: four distinct roads to 2 ------------
    { name: 'DNS death / timeout -> 2, never a violation (probe-throw branch)',
      throws: new CannotMeasure('could not reach ' + PROD_URL + ': fetch failed'),
      code: 2, expect: /could not reach[\s\S]*NOT submitted/ },
    { name: 'no status in the reading -> 2 (status-shape branch)',
      reading: healthy({ status: null }), code: 2, expect: /no HTTP status in the reading/ },
    { name: 'no body in the reading -> 2 (body-shape branch)',
      reading: healthy({ body: null }), code: 2, expect: /carries no body string/ },
    { name: 'null reading -> 2 (reading-shape branch)',
      reading: null, code: 2, expect: /expected a reading object/ },
    { name: 'short-circuited assessment -> 2 (measurement floor branch)',
      reading: healthy(), code: 2, expect: /assertion\(s\) evaluated, floor is 5/,
      evaluate: () => ({ code: 0, violations: [], notes: [], checks: 1, locs: 0 }) },
    // The gate and the submit pointing at different URLs is exit 2: nothing
    // useful was measured, and submitting on the strength of it would be the
    // wrong-surface failure this arc exists to remove.
    { name: 'gate and submit targets disagree -> 2 (divergence branch)',
      env: { SITEMAP_CHECK_BASE: 'https://www.bachatacalendar.co.uk',
             GSC_CHECK_BASE: 'https://bachatacalendar.co.uk' },
      reading: healthy(), code: 2, expect: /Proving one URL and announcing another/ },
  ];
}

export async function selfTest({ log = console.log, err = console.error } = {}) {
  const cases = canaryCases();
  let failed = 0;
  let extra = 0;

  for (const c of cases) {
    const lines = [];
    const sink = (s) => lines.push(String(s));
    const code = await main([], {
      log: sink, err: sink, env: c.env || {},
      evaluate: c.evaluate,
      probe: async () => {
        if (c.throws) throw c.throws;
        return c.reading;
      },
    });
    const text = lines.join('\n');
    const codeOk = code === c.code;
    const msgOk = c.expect.test(text);
    if (codeOk && msgOk) {
      log('  PASS  ' + c.name);
    } else {
      failed++;
      err('  FAIL  ' + c.name);
      if (!codeOk) err('        expected exit ' + c.code + ', got ' + code);
      if (!msgOk) err('        exit code was right but no branch matched ' + c.expect + '\n        got: ' + text);
    }
  }

  // The UA is the entire reason this guard can see what the old workflow could
  // not. Asserted as a property of the request main() actually makes, not of a
  // constant -- a browser UA reintroduces the exact blindness.
  extra++;
  {
    let seenBase = null;
    const lines = [];
    await main([], { log: (s) => lines.push(String(s)), err: (s) => lines.push(String(s)), env: {},
      probe: async (base) => { seenBase = base; return healthy(); } });
    const text = lines.join('\n');
    const ok = seenBase === DEFAULT_BASE && !/Mozilla|Chrome|Safari/i.test(PROBE_UA) && text.includes(PROBE_UA);
    if (!ok) {
      failed++;
      err('  FAIL  a GREEN run must probe production with a NON-browser UA and say so (base=' +
        JSON.stringify(seenBase) + ')');
    } else {
      log('  PASS  a GREEN run probes production with a non-browser UA and names it');
    }
  }

  // SITEMAP_CHECK_BASE must actually steer the probe, or every "point it at a
  // broken host" rehearsal silently measures production instead.
  extra++;
  {
    let seenBase = null;
    await main([], { log: () => {}, err: () => {}, env: { SITEMAP_CHECK_BASE: 'https://example.invalid' },
      probe: async (base) => { seenBase = base; return healthy(); } });
    if (seenBase !== 'https://example.invalid') {
      failed++;
      err('  FAIL  SITEMAP_CHECK_BASE did not steer the probe (got ' + JSON.stringify(seenBase) + ')');
    } else {
      log('  PASS  SITEMAP_CHECK_BASE steers the probe');
    }
  }

  // Both edges of the measurement floor, pinned to what the code produces.
  // resolveTarget's agreement path, in the direction the divergence case above
  // cannot reach: both bases set to the SAME value must resolve, not refuse.
  // That is the shape sitemap-submit.yml actually produces via SITEMAP_TARGET.
  extra++;
  {
    const same = 'https://www.bachatacalendar.co.uk';
    let ok = false;
    try {
      ok = resolveTarget({ SITEMAP_CHECK_BASE: same, GSC_CHECK_BASE: same + '/' }) === same;
    } catch { ok = false; }
    if (!ok) {
      failed++;
      err('  FAIL  two bases agreeing (bar a trailing slash) must resolve, not refuse');
    } else {
      log('  PASS  agreeing gate/submit bases resolve to one target');
    }
  }

  extra++;
  const fewest = evaluate(healthy({ body: '<?xml version="1.0"?><error/>' })).checks;
  const most = evaluate(healthy()).checks;
  if (fewest !== MIN_CHECKS || most !== MIN_CHECKS) {
    failed++;
    err('  FAIL  MIN_CHECKS is ' + MIN_CHECKS + ' but readings evaluate ' + fewest + '..' + most);
  } else {
    log('  PASS  MIN_CHECKS equals what every valid reading evaluates (' + fewest + ')');
  }

  const total = cases.length + extra;
  if (failed) {
    err('canary: ' + failed + ' of ' + total + ' FAILED');
    return 2;
  }
  log('canary: ' + total + '/' + total + ' passed');
  return 0;
}

// Realpath-to-realpath (scripts/lib/entry-point.mjs) -- R6.
if (isEntryPoint(import.meta.url)) {
  // process.exitCode, never process.exit() after printing.
  process.exitCode = await main(process.argv.slice(2));
}

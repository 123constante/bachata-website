#!/usr/bin/env node
/**
 * ORIGIN-CONSUMER INVENTORY -- P4 of the edge-config-governance arc (RC2).
 *
 * Enumerates every non-browser first-party consumer of the site's origin from
 * SOURCE and DB MIGRATIONS, not from memory, and cross-references each against
 * the committed vercel-firewall.json. The one custom bypass rule that existed
 * before this check ("Bypass revalidate webhook") was written from one
 * incident; the 2026-08-21 outage proved the un-enumerated remainder (ICS,
 * embed, bake, card, robots, sitemap, every crawler) breaks the moment an
 * edge control is armed. This check derives that inventory so P6 can populate
 * the rules array from measurement rather than recollection.
 *
 * WHAT IT ENUMERATES
 *   1. pg_net callers: every function whose LATEST definition across the
 *      admin repo's supabase/migrations/ calls net.http_post/net.http_get
 *      (dollar-quote-bounded bodies, SQL comments stripped -- comment
 *      mentions of net.http_post are everywhere in that corpus and must not
 *      count). Last-definition-wins by migration timestamp.
 *   2. Vault URL secrets those callers read (vault.decrypted_secrets WHERE
 *      name = '...'), resolved through KNOWN_VAULT_TARGETS -- the values live
 *      only in prod Vault, so the mapping is a committed assertion, and a
 *      url-ish vault name this file cannot classify is a FINDING, not a skip.
 *   3. First-party API routes (app/routes/api.*.tsx), classified browser-only
 *      vs non-browser via KNOWN_ROUTES. A route on disk that this map does
 *      not know -- or a map entry with no file -- is a FINDING.
 *   4. Search/preview crawlers from middleware.ts's BOT_UA_PATTERN (the
 *      canonical UA list -- read, never re-derived). Each crawler is a
 *      consumer of page HTML plus /robots.txt and /sitemap.xml.
 *   5. The KNOWN-UNENUMERABLE set: prod Supabase Edge Functions have no
 *      source in either repo (~11 of them, documented arc trap). They are
 *      declared LOUDLY in the report -- attempted via `supabase functions
 *      list` when SUPABASE_ACCESS_TOKEN is present, declared as unenumerable
 *      with the reason otherwise. Never silently under-counted.
 *
 * EXIT CONTRACT (R3: 0 pass / 1 contract violated / 2 infrastructure)
 *   0  everything measured and classified; every consumer covered -- OR
 *      coverage gaps exist but the COMMITTED bot_protection is not enforcing
 *      (log / off / inactive). The gaps are printed as the P6 backlog.
 *   1  inventory drift (an unclassified route, caller, or url-ish vault
 *      secret; a stale map entry) -- ALWAYS, in any mode. OR coverage gaps
 *      while the committed bot_protection is active AND challenge/deny:
 *      arming enforcement over an uncovered consumer is the exact 2026-08-21
 *      incident shape, and the commit that re-arms it (P6) must not pass
 *      while any enumerated consumer lacks a rule.
 *   2  could not measure: no migrations directory, zero pg_net callers
 *      found (a corpus this size yielding nothing means the scanner broke,
 *      not that the callers left), a KNOWN_PG_NET_CALLERS entry missing
 *      (either deliberately retired -- update the map in the same commit --
 *      or the extractor regressed), unreadable vercel-firewall.json /
 *      middleware.ts / routes dir.
 *
 * SCOPING DECISION (the arc says "fail on any consumer with no coverage";
 * this file deliberately narrows WHEN): P0-P3 fixed the acute failures and
 * bot_protection sits in `log`, so an uncovered consumer today is a queued
 * P6 work item, not an active incident -- a hard red on every run until P6
 * would train everyone to ignore the check. Gating the coverage failure on
 * the committed enforcement mode makes the check strict at exactly the
 * moment strictness matters, with no edit to this file required: P6's own
 * re-arming diff trips it. Classification drift stays a hard failure in
 * every mode because the inventory is only worth keeping if additions to
 * the consumer set cannot land unclassified.
 *
 * NOT WIRED INTO CI, deliberately: the migration corpus lives in the ADMIN
 * repo (a sibling checkout, not present in this repo's Actions runners), so
 * a workflow run here would exit 2 on every tick. Local tool + P6 gate.
 * Wiring options for P6: check out the admin repo in the workflow, or move
 * the pg_net half behind an anon-callable RPC that enumerates pg_proc live
 * (which would also close the migrations-vs-prod drift this static scan
 * cannot see -- prod functions CAN drift from committed migrations; the
 * ledger-orphan incident proved it).
 *
 * KNOWN LIMITS, stated rather than implied away:
 *   - DROP FUNCTION is not tracked: a dropped caller would linger in the
 *     inventory (over-reporting -- the conservative direction).
 *   - Vault values are unreadable statically; KNOWN_VAULT_TARGETS asserts
 *     where each URL points and prod could disagree. The Log-mode traffic
 *     sample P0 started collecting is the empirical cross-check (P6).
 *   - Second-order consumers: _og_scrape POSTs to graph.facebook.com, which
 *     makes Meta's crawler fetch OUR pages -- the crawler side is covered by
 *     the BOT_UA_PATTERN half of the inventory (facebookexternalhit,
 *     whatsapp), not by the pg_net half.
 *
 * Local: node scripts/check-origin-consumers.mjs
 *        node scripts/check-origin-consumers.mjs --self-test
 *        ADMIN_MIGRATIONS_DIR=<dir> overrides the default corpus paths.
 */
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { isEntryPoint } from './lib/entry-point.mjs';
import { isPlausibleLiveConfig } from './lib/firewall-config.mjs';

const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const FIREWALL_PATH = path.join(ROOT, 'vercel-firewall.json');
const MIDDLEWARE_PATH = path.join(ROOT, 'middleware.ts');
const ROUTES_DIR = path.join(ROOT, 'app', 'routes');
const CONFIG_TOML_PATH = path.join(ROOT, 'supabase', 'config.toml');

// The admin repo owns the migrations (CLAUDE.md: migration authority). Both
// default paths are Ricky's local checkouts -- the og-waf worktree carries
// P1's 20260822090000 until it merges into the canonical tree, so the scan
// unions every existing candidate (filename-deduped; first dir wins a tie).
const DEFAULT_MIGRATION_DIRS = [
  'C:/dev/bachata-admin-11april/supabase/migrations',
  'C:/dev/bachata-admin-og-waf-wt/supabase/migrations',
];

// ---------------------------------------------------------------------------
// The committed assertions. Each map is verified against what enumeration
// actually finds -- an entry with no finding is STALE (exit 1), a finding
// with no entry is UNCLASSIFIED (exit 1). That is what keeps these maps an
// inventory rather than a memory.
// ---------------------------------------------------------------------------

// Direct net.http_* callers that must still exist (non-vacuity floor).
// _og_bake_reconcile is deliberately NOT here: it READS net._http_response
// (reconciliation, P1) and enqueues nothing itself.
const KNOWN_PG_NET_CALLERS = [
  '_emit_cache_revalidation_v1',
  '_og_sweep',
  '_og_enqueue',
  '_og_scrape',
];

// Where each url-ish Vault secret points. Values live only in prod Vault --
// this is an assertion the check cross-references, not a measurement.
// `origin` targets must hold a WAF bypass; `external` targets never traverse
// our WAF (their second-order effects are covered elsewhere -- see header).
const KNOWN_VAULT_TARGETS = {
  revalidate_url: { kind: 'origin', path: '/api/revalidate' },
  og_bake_url: { kind: 'origin', path: '/api/og/bake' },
  send_listing_request_email_url: {
    kind: 'external',
    note: 'Supabase Edge Function (anon-key auth) -- supabase.co, not our origin',
  },
};

// Every app/routes/api.*.tsx, classified. `nonBrowser: true` means the route
// is MEANT to be hit by non-browser clients and needs firewall coverage the
// moment bot_protection enforces.
const KNOWN_ROUTES = {
  'api.revalidate': {
    path: '/api/revalidate',
    nonBrowser: true,
    clients: 'pg_net only (_emit_cache_revalidation_v1) -- not public',
  },
  'api.og.bake': {
    path: '/api/og/bake',
    nonBrowser: true,
    clients: 'pg_net (_og_sweep/_og_enqueue via Vault og_bake_url)',
  },
  'api.og.card': {
    path: '/api/og/card',
    nonBrowser: true,
    clients: 'messaging-platform image fetchers (og:image URL)',
  },
  'api.ics.calendar': {
    path: '/api/ics/calendar',
    nonBrowser: true,
    clients: 'calendar clients (Google/Apple/Outlook/CalDAV) -- non-browser by definition',
  },
  'api.embed.calendar': {
    path: '/api/embed/calendar',
    nonBrowser: true,
    clients: 'third-party site embeds',
  },
};

// Origin surfaces crawlers read that are not api.* routes. Enumerated here
// because the 2026-08-21 outage measured both at 429.
const CRAWLER_SURFACES = ['/robots.txt', '/sitemap.xml'];

// A literal URL on one of these hosts is OUR origin, not an external target
// -- _og_scrape builds 'https://www.bachatacalendar.co.uk/...' as the page
// URL it hands to Meta, and calling that "external" misreads a second-order
// origin fetch (Meta's crawler traverses our WAF with it; the crawler half
// of this inventory is what covers that fetch).
const FIRST_PARTY_HOSTS = ['bachatacalendar.co.uk'];

function isFirstPartyUrl(url) {
  try {
    const host = new URL(url).hostname;
    return FIRST_PARTY_HOSTS.some((h) => host === h || host.endsWith('.' + h));
  } catch {
    return false;
  }
}

// ---------------------------------------------------------------------------
// SQL scanning -- pure, exported for the canary.
// ---------------------------------------------------------------------------

/** Remove `--` line comments. Executed SQL never follows `--` on a line, so
 *  this can only remove non-code; string literals spanning lines are not
 *  parsed, which is fine for a PRESENCE test (a literal containing
 *  "net.http_post" after `--` inside a string would be dropped -- and a
 *  string mention was never a call anyway). */
export function stripSqlComments(sql) {
  return sql.replace(/--[^\n]*/g, '');
}

/** Every CREATE [OR REPLACE] FUNCTION body, bounded by its own dollar-quote
 *  tag -- NOT by the next CREATE, so COMMENT ON prose between functions
 *  (which in this corpus routinely mentions net.http_post) never leaks into
 *  a body. The opening tag is searched only up to the NEXT function header:
 *  a function without a dollar-quoted body (AS 'string' / BEGIN ATOMIC)
 *  must yield NO body rather than stealing its neighbour's and
 *  misattributing a caller. Headers that sit INSIDE an extracted body
 *  (EXECUTE'd DDL text) are skipped. Names are normalized: double quotes
 *  stripped, schema stripped. Returns absolute {start,end} offsets so
 *  findUnattributedPgNetCalls can mask the attributed regions. */
export function extractFunctionBodies(sql) {
  const out = [];
  const headerRe = /CREATE\s+(?:OR\s+REPLACE\s+)?FUNCTION\s+([A-Za-z0-9_."]+)\s*\(/g;
  const headers = [];
  let m;
  while ((m = headerRe.exec(sql)) !== null) {
    headers.push({ index: m.index, end: m.index + m[0].length, rawName: m[1] });
  }
  let lastBodyEnd = -1;
  for (let i = 0; i < headers.length; i++) {
    const h = headers[i];
    if (h.index < lastBodyEnd) continue; // header text inside a previous body
    const name = h.rawName.replace(/"/g, '').replace(/^[A-Za-z0-9_]+\./, '');
    const nextIndex = i + 1 < headers.length ? headers[i + 1].index : sql.length;
    const open = /\$[A-Za-z0-9_]*\$/.exec(sql.slice(h.end, nextIndex));
    if (!open) continue; // no dollar-quoted body before the next function
    const bodyStart = h.end + open.index + open[0].length;
    const close = sql.indexOf(open[0], bodyStart);
    if (close < 0) continue;
    out.push({ name, body: sql.slice(bodyStart, close), start: bodyStart, end: close });
    lastBodyEnd = close;
  }
  return out;
}

/** True when a migration carries a net.http_* call OUTSIDE every
 *  attributable function body: a cron.schedule inline command, a DO block,
 *  a non-dollar-quoted body. Loud rather than silent -- each hit is a
 *  VIOLATION naming the file until the extractor learns to attribute it,
 *  because the alternative is exactly the under-enumeration the header
 *  promises never to take. Single-quoted literals are stripped so COMMENT
 *  ON prose cannot fire it; dollar-quoted strings are deliberately KEPT,
 *  which is where a cron.schedule inline command lives. */
export function findUnattributedPgNetCalls(file) {
  const sql = file.content;
  let masked = '';
  let cursor = 0;
  for (const b of extractFunctionBodies(sql)) {
    masked += sql.slice(cursor, b.start) + ' '.repeat(b.end - b.start);
    cursor = b.end;
  }
  masked += sql.slice(cursor);
  const code = stripSqlComments(masked).replace(/'(?:[^']|'')*'/g, "''");
  return /net\.http_(post|get)\s*\(/.test(code);
}

/** Scan migration files (already sorted by timestamp ascending) and return
 *  the functions whose LATEST definition calls net.http_post/net.http_get,
 *  with the evidence extracted from that latest body: literal URLs, vault
 *  secret names read, and origin-relative path literals. */
export function scanPgNetCallers(files) {
  const latest = new Map(); // name -> { file, body }
  for (const f of files) {
    for (const fn of extractFunctionBodies(f.content)) {
      latest.set(fn.name, { file: f.name, body: fn.body });
    }
  }
  const callers = [];
  for (const [name, { file, body }] of latest) {
    const code = stripSqlComments(body);
    if (!/net\.http_(post|get)\s*\(/.test(code)) continue;
    // A literal handed to the url:= argument is the REQUEST TARGET; any other
    // literal in the body is data (e.g. _og_scrape passes our page URL as a
    // Graph API param). The lookbehind keeps `v_url := '...'` assignments --
    // data, not the argument -- out of urlArgs.
    const urlArgs = [...code.matchAll(/(?<![A-Za-z0-9_])url\s*:=\s*'(https?:\/\/[^']+)'/g)]
      .map((x) => x[1]);
    const urls = [...code.matchAll(/'(https?:\/\/[^']+)'/g)]
      .map((x) => x[1])
      .filter((u) => !urlArgs.includes(u));
    const vaultNames = [
      ...code.matchAll(
        /decrypted_secrets(?:\s+AS)?(?:\s+(?!WHERE\b)[A-Za-z_]+)?\s+WHERE\s+(?:[A-Za-z_]+\.)?name\s*=\s*'([^']+)'/gi,
      ),
    ].map((x) => x[1]);
    const paths = [...code.matchAll(/'(\/api\/[^']*)'/g)].map((x) => x[1]);
    callers.push({ name, file, urlArgs, urls, vaultNames, paths });
  }
  return callers.sort((a, b) => a.name.localeCompare(b.name));
}

/** Resolve one pg_net caller to its targets, via literals and the vault map.
 *  Returns { targets: [{kind, path?|url?, via}], unknownVault: [names] }. */
export function resolveCallerTargets(caller) {
  const targets = [];
  const unknownVault = [];
  // url:= argument literals are FIRST-ORDER requests: a first-party one is
  // an origin consumer that needs coverage (classifying it second-order was
  // this file's own reviewed false-green -- a future caller POSTing to our
  // origin by absolute URL would have sailed through under enforcement).
  for (const url of caller.urlArgs ?? []) {
    if (isFirstPartyUrl(url)) {
      targets.push({ kind: 'origin', path: new URL(url).pathname, via: 'url-arg literal' });
    } else {
      targets.push({ kind: 'external', url, via: 'url-arg literal' });
    }
  }
  // Non-argument literals are data. A first-party one signals a second-order
  // fetch (someone else will request our URL -- the crawler half covers the
  // fetching client); a third-party one is informational.
  for (const url of caller.urls) {
    targets.push(isFirstPartyUrl(url)
      ? { kind: 'origin-second-order', url, via: 'literal' }
      : { kind: 'external', url, via: 'literal' });
  }
  for (const p of caller.paths) {
    targets.push({ kind: 'origin', path: p, via: 'literal' });
  }
  for (const name of caller.vaultNames) {
    const known = KNOWN_VAULT_TARGETS[name];
    if (!known) {
      // Heuristic, stated: names suggesting a location are targets to
      // classify; everything else is auth material. A url-bearing secret
      // named outside this vocabulary is the residual risk -- widen the
      // list before narrowing it.
      if (/url|endpoint|uri|webhook|host/i.test(name)) unknownVault.push(name);
      continue;
    }
    targets.push({ ...known, via: `vault:${name}` });
  }
  return { targets, unknownVault };
}

// ---------------------------------------------------------------------------
// Middleware / firewall parsing -- pure, exported for the canary.
// ---------------------------------------------------------------------------

/** The canonical crawler list is middleware.ts's BOT_UA_PATTERN. Read it,
 *  never re-derive it. Returns the alternation tokens, or null when the
 *  pattern cannot be found (a refactor moved it -- exit 2, not a guess). */
export function parseBotUaTokens(middlewareSource) {
  const m = /(?<![A-Za-z0-9_])BOT_UA_PATTERN\s*=\s*\/([^/\n]+)\/i/.exec(middlewareSource);
  if (!m) return null;
  const tokens = m[1].split('|').map((t) => t.trim()).filter(Boolean);
  // A plain alternation of literal tokens is all this parser understands.
  // If the middleware pattern ever grows regex syntax (grouping, escapes,
  // an escaped slash truncating the [^/\n]+ capture), the shredded fragments
  // must NOT be scored as crawlers -- null here is exit 2 ("could not
  // measure"), which is the honest verdict until this parser is extended.
  if (!tokens.length || tokens.some((t) => !/^[A-Za-z0-9 _.-]+$/.test(t))) return null;
  return tokens;
}

/** True when the committed config would ENFORCE bot protection: active and
 *  in any mode that mitigates (challenge/deny). `log` observes only. */
export function botProtectionEnforcing(firewall) {
  const bp = firewall?.managedRules?.bot_protection;
  return bp?.active === true && bp?.action !== 'log' && bp?.action !== 'off';
}

const ruleConditions = (rule) =>
  (rule.conditionGroup ?? []).flatMap((g) => g.conditions ?? []);

const activeBypassRules = (firewall) =>
  (firewall.rules ?? []).filter(
    (r) => r.active && r.action?.mitigate?.action === 'bypass',
  );

/** Vercel ANDs conditions within a group (groups OR together). A group with
 *  siblings beside the matching condition is NARROWER than the path/UA
 *  alone -- an IP- or header-scoped bypass does not cover the consumer in
 *  general, and claiming it does was a reviewed false-green (the incident
 *  recurs with the guard reading covered). Conservative rule, stated: only
 *  a group whose SOLE condition matches counts as coverage. A legitimately
 *  ANDed-but-benign group reads as uncovered -- the red is the safe
 *  direction, and P6 can widen this the day it can evaluate the siblings. */
function soloConditions(rule) {
  return (rule.conditionGroup ?? [])
    .map((g) => g.conditions ?? [])
    .filter((conds) => conds.length === 1)
    .map((conds) => conds[0]);
}

/** A path target is covered by an active bypass rule whose SOLO path
 *  condition equals it (op 'eq') or prefixes it (op 'pre'). */
export function pathCoverage(firewall, targetPath) {
  for (const rule of activeBypassRules(firewall)) {
    for (const c of soloConditions(rule)) {
      if (c.type !== 'path') continue;
      if (c.op === 'eq' && c.value === targetPath) return rule.name;
      if (c.op === 'pre' && targetPath.startsWith(c.value)) return rule.name;
    }
  }
  return null;
}

/** A crawler UA token is covered by an active bypass rule with a SOLO
 *  user_agent condition that contains it as a substring (op 'sub') or
 *  matches it as a regex (op 're'). Deliberately NOT scored: 'eq' (a full
 *  UA header never equals a bare token -- scoring it covered was a reviewed
 *  false-green) and 'inc' (Vercel's is-any-of over an array of exact
 *  values; a String() coercion made array entries substring-match tokens
 *  they do not cover). Pricing only the ops whose semantics are verified,
 *  declining the rest as a named gap, is the vendor-algorithm rule. */
export function uaCoverage(firewall, token) {
  for (const rule of activeBypassRules(firewall)) {
    for (const c of soloConditions(rule)) {
      if (c.type !== 'user_agent') continue;
      if (c.op === 'sub' && typeof c.value === 'string' &&
          c.value.toLowerCase().includes(token.toLowerCase())) return rule.name;
      if (c.op === 're' && typeof c.value === 'string') {
        try {
          if (new RegExp(c.value, 'i').test(token)) return rule.name;
        } catch {
          // an unparseable pattern covers nothing -- fall through, never throw
        }
      }
    }
  }
  return null;
}

// ---------------------------------------------------------------------------
// The check itself. Every collaborator is injected so the canary can drive
// every branch, including the failures (R5: the exit owner is main(), and the
// canary drives it).
// ---------------------------------------------------------------------------

export async function runCheck(deps = {}) {
  const {
    readMigrationFiles = defaultReadMigrationFiles,
    readRouteNames = defaultReadRouteNames,
    readMiddleware = () => fs.readFileSync(MIDDLEWARE_PATH, 'utf8'),
    readFirewall = () => fs.readFileSync(FIREWALL_PATH, 'utf8'),
    listEdgeFunctions = defaultListEdgeFunctions,
    env = process.env,
    log = console.log,
  } = deps;

  const violations = []; // -> exit 1 in any mode (inventory drift)
  const gaps = []; // -> exit 1 only when enforcement is armed

  // --- Corpus ---
  let corpus;
  try {
    corpus = readMigrationFiles(env);
  } catch (error) {
    // R3: one unreadable .sql (mount EACCES, dir vanishing mid-scan) is
    // infrastructure, not a contract verdict -- exit 2, never a thrown 1.
    return { code: 2, reason: `could not read the migration corpus: ${error.message}` };
  }
  if (corpus.dirs.length === 0) {
    return {
      code: 2,
      reason:
        'no admin migrations directory found (tried ' + corpus.tried.join(', ') + '). ' +
        'Set ADMIN_MIGRATIONS_DIR or check out the admin repo -- this check cannot ' +
        'enumerate pg_net callers without the corpus, and "found nothing" must never ' +
        'read as "no consumers".',
    };
  }
  const callers = scanPgNetCallers(corpus.files);
  if (callers.length < KNOWN_PG_NET_CALLERS.length) {
    return {
      code: 2,
      reason:
        `only ${callers.length} pg_net caller(s) found across ${corpus.files.length} migration ` +
        `file(s) -- a corpus this size yielding fewer than the ${KNOWN_PG_NET_CALLERS.length} ` +
        'known callers means the extractor broke, not that the callers left.',
    };
  }
  for (const known of KNOWN_PG_NET_CALLERS) {
    if (!callers.some((c) => c.name === known)) {
      return {
        code: 2,
        reason:
          `known pg_net caller "${known}" was not found by enumeration. Either it was ` +
          'deliberately retired (update KNOWN_PG_NET_CALLERS in the same commit as the ' +
          'retiring migration) or the scanner regressed. Refusing to report an inventory ' +
          'that contradicts its own floor.',
      };
    }
  }
  // net.http_* OUTSIDE any attributable body (cron inline command, DO
  // block, non-dollar-quoted body) -- loud, never silently unenumerated.
  for (const f of corpus.files) {
    if (findUnattributedPgNetCalls(f)) {
      violations.push(
        `migration ${f.name} contains a net.http_* call OUTSIDE any attributable ` +
        'CREATE FUNCTION body (cron.schedule inline command, DO block, or ' +
        'non-dollar-quoted body) -- extend the extractor to attribute it rather ' +
        'than letting it join the consumer set uninventoried.',
      );
    }
  }

  // --- Firewall ---
  let firewall;
  try {
    firewall = JSON.parse(readFirewall());
  } catch (error) {
    return { code: 2, reason: `cannot read/parse vercel-firewall.json: ${error.message}` };
  }
  if (!isPlausibleLiveConfig(firewall)) {
    return {
      code: 2,
      reason: 'vercel-firewall.json has no managedRules -- not a plausible config, refusing to ' +
        'assess coverage against it.',
    };
  }
  const enforcing = botProtectionEnforcing(firewall);

  // --- Middleware crawlers ---
  let middlewareSource;
  try {
    middlewareSource = readMiddleware();
  } catch (error) {
    return { code: 2, reason: `cannot read middleware.ts: ${error.message}` };
  }
  const botTokens = parseBotUaTokens(middlewareSource);
  if (!botTokens) {
    return {
      code: 2,
      reason: 'BOT_UA_PATTERN not found in middleware.ts -- the canonical crawler list moved; ' +
        'update parseBotUaTokens rather than re-deriving the list here.',
    };
  }

  // --- Routes ---
  let routeNames;
  try {
    routeNames = readRouteNames();
  } catch (error) {
    return { code: 2, reason: `cannot list app/routes: ${error.message}` };
  }
  if (routeNames.length === 0) {
    return { code: 2, reason: 'no app/routes/api.*.tsx routes found -- the route glob broke ' +
      '(this repo ships several), refusing to report an empty API surface.' };
  }

  log('origin-consumer inventory');
  log(`  corpus: ${corpus.files.length} migration file(s) from ${corpus.dirs.join(' + ')}`);
  log(`  committed bot_protection: ${enforcing ? 'ENFORCING' : 'not enforcing (log/off/inactive)'}`);
  log('');

  // --- 1. pg_net callers ---
  log(`  pg_net callers (${callers.length}):`);
  const seenVault = new Set();
  for (const caller of callers) {
    for (const n of caller.vaultNames) seenVault.add(n);
    const { targets, unknownVault } = resolveCallerTargets(caller);
    for (const name of unknownVault) {
      violations.push(
        `pg_net caller ${caller.name} reads url-ish Vault secret "${name}" that ` +
        'KNOWN_VAULT_TARGETS cannot classify -- add it with its target in the same commit.',
      );
    }
    if (targets.length === 0 && unknownVault.length === 0) {
      violations.push(
        `pg_net caller ${caller.name} (${caller.file}) has no resolvable target -- ` +
        'no literal URL, no known Vault secret. Classify it in KNOWN_VAULT_TARGETS ' +
        'or extend the extractor.',
      );
    }
    for (const t of targets) {
      if (t.kind === 'origin') {
        const rule = pathCoverage(firewall, t.path);
        log(`    ${caller.name} -> ${t.path} (${t.via}) ${rule ? `[covered: ${rule}]` : '[NO BYPASS RULE]'}`);
        if (!rule) gaps.push(`pg_net ${caller.name} -> ${t.path} has no bypass rule`);
      } else if (t.kind === 'origin-second-order') {
        log(`    ${caller.name} -> ${t.url} (${t.via}) [OUR origin, fetched second-order -- ` +
          'the fetching client is covered under the crawler half of this inventory]');
      } else {
        log(`    ${caller.name} -> ${t.url ?? t.note} (${t.via}) [external -- not our WAF]`);
      }
    }
  }
  // The maps' own invariant, applied to KNOWN_VAULT_TARGETS too: an entry no
  // caller reads any more is a memory, not an inventory row.
  for (const name of Object.keys(KNOWN_VAULT_TARGETS)) {
    if (!seenVault.has(name)) {
      violations.push(
        `KNOWN_VAULT_TARGETS entry "${name}" is stale -- no enumerated pg_net caller ` +
        'reads it any more. Remove it in the same commit that retired the reader.',
      );
    }
  }
  log('');

  // --- 2. API routes ---
  const knownRouteNames = Object.keys(KNOWN_ROUTES);
  for (const r of routeNames) {
    if (!knownRouteNames.includes(r)) {
      violations.push(
        `route app/routes/${r}.tsx is not classified in KNOWN_ROUTES -- classify it ` +
        '(browser-only vs non-browser, expected clients) in the same commit that adds it.',
      );
    }
  }
  for (const r of knownRouteNames) {
    if (!routeNames.includes(r)) {
      violations.push(
        `KNOWN_ROUTES entry "${r}" has no app/routes/${r}.tsx on disk -- stale map, ` +
        'remove the entry in the same commit that retires the route.',
      );
    }
  }
  log(`  API routes (${routeNames.length}):`);
  for (const r of routeNames) {
    const info = KNOWN_ROUTES[r];
    if (!info) {
      log(`    ${r} -> UNCLASSIFIED`);
      continue;
    }
    if (!info.nonBrowser) {
      log(`    ${r} -> ${info.path} [browser-only]`);
      continue;
    }
    const rule = pathCoverage(firewall, info.path);
    log(`    ${r} -> ${info.path} (${info.clients}) ${rule ? `[covered: ${rule}]` : '[NO BYPASS RULE]'}`);
    if (!rule) gaps.push(`route ${info.path} (${info.clients}) has no bypass rule`);
  }
  log('');

  // --- 3. Crawlers ---
  log(`  crawlers from middleware BOT_UA_PATTERN (${botTokens.length}), fetching page HTML + ${CRAWLER_SURFACES.join(' + ')}:`);
  for (const token of botTokens) {
    const rule = uaCoverage(firewall, token);
    log(`    ${token} ${rule ? `[covered: ${rule}]` : '[NO UA RULE]'}`);
    if (!rule) gaps.push(`crawler UA "${token}" has no bypass rule`);
  }
  // The two surfaces the 2026-08-21 outage measured at 429 are assessed,
  // not just named: covered by a path bypass of their own, or implicitly by
  // EVERY crawler UA being covered (a crawler surface is only fetched by
  // crawlers). Partial UA coverage leaves them exposed to the uncovered
  // remainder, so it does not count.
  const allBotsCovered = botTokens.every((t) => uaCoverage(firewall, t) !== null);
  for (const surface of CRAWLER_SURFACES) {
    const rule = pathCoverage(firewall, surface);
    const label = rule ? `[covered: ${rule}]` : allBotsCovered ? '[covered: full crawler-UA coverage]' : '[NO COVERAGE]';
    log(`    ${surface} ${label}`);
    if (!rule && !allBotsCovered) {
      gaps.push(`crawler surface ${surface} has neither a path bypass nor full crawler-UA coverage`);
    }
  }
  log('');

  // --- 4. The known-unenumerable set ---
  const edge = await listEdgeFunctions(env);
  if (edge.names) {
    log(`  Supabase Edge Functions (${edge.names.length}, enumerated live):`);
    for (const n of edge.names) log(`    ${n} -- origin-consumption UNKNOWN (no source in either repo)`);
  } else {
    log('  UNENUMERABLE: prod Supabase Edge Functions (~11) have no source in either repo');
    log(`    and could not be listed live: ${edge.reason}`);
    log('    Static enumeration under-counts by that set. This is a declared gap, not coverage.');
  }
  log('');

  // --- Verdict ---
  for (const v of violations) log(`  VIOLATION: ${v}`);
  for (const g of gaps) log(`  ${enforcing ? 'UNCOVERED (enforcing!)' : 'P6 backlog (not enforcing)'}: ${g}`);
  if (violations.length) {
    log('');
    log(`origin-consumers: ${violations.length} inventory violation(s) -- the maps in this file ` +
      'must move in the same commit as the consumer set.');
    return { code: 1, violations, gaps };
  }
  if (gaps.length && enforcing) {
    log('');
    log(`origin-consumers: bot_protection is committed as ENFORCING with ${gaps.length} ` +
      'uncovered consumer(s) -- this is the 2026-08-21 incident shape. Cover every ' +
      'consumer above (P6) before arming enforcement.');
    return { code: 1, violations, gaps };
  }
  log(gaps.length
    ? `origin-consumers: inventory clean; ${gaps.length} coverage gap(s) queued for P6 ` +
      '(bot_protection not enforcing -- gaps become FAILURES the moment it is).'
    : 'origin-consumers: inventory clean and every consumer covered.');
  return { code: 0, violations, gaps };
}

// ---------------------------------------------------------------------------
// Default collaborators (the real filesystem / CLI).
// ---------------------------------------------------------------------------

/** First list wins a filename tie (the canonical checkout shadows the
 *  worktree's copy); result sorted by name, i.e. migration timestamp order,
 *  which is what makes last-definition-wins in scanPgNetCallers true.
 *  Exported and pure so the canary can pin BOTH properties -- the injection
 *  seam otherwise hides the default collaborators entirely. */
export function mergeMigrationFileLists(lists) {
  const byName = new Map();
  for (const list of lists) {
    for (const f of list) {
      if (!byName.has(f.name)) byName.set(f.name, f);
    }
  }
  return [...byName.values()].sort((a, b) => a.name.localeCompare(b.name));
}

export const API_ROUTE_RE = /^api\..+\.tsx$/;

function defaultReadMigrationFiles(env = process.env) {
  const tried = env.ADMIN_MIGRATIONS_DIR
    ? [env.ADMIN_MIGRATIONS_DIR]
    : DEFAULT_MIGRATION_DIRS;
  const dirs = tried.filter((d) => {
    try {
      return fs.statSync(d).isDirectory();
    } catch {
      return false;
    }
  });
  const merged = mergeMigrationFileLists(dirs.map((dir) =>
    fs.readdirSync(dir)
      .filter((name) => name.endsWith('.sql'))
      .map((name) => ({ name, dir })),
  ));
  const files = merged.map(({ name, dir }) => ({
    name,
    content: fs.readFileSync(path.join(dir, name), 'utf8'),
  }));
  return { dirs, tried, files };
}

function defaultReadRouteNames() {
  return fs
    .readdirSync(ROUTES_DIR)
    .filter((f) => API_ROUTE_RE.test(f))
    .map((f) => f.replace(/\.tsx$/, ''))
    .sort();
}

/** Attempt `supabase functions list` only when a token is present; declare
 *  the gap (with the reason) otherwise. Never silently returns an empty
 *  fleet: a CLI failure is a REASON, not a zero. */
async function defaultListEdgeFunctions(env = process.env) {
  if (!env.SUPABASE_ACCESS_TOKEN) {
    return { names: null, reason: 'SUPABASE_ACCESS_TOKEN not set in this context' };
  }
  let ref = null;
  try {
    ref = /project_id\s*=\s*"([^"]+)"/.exec(fs.readFileSync(CONFIG_TOML_PATH, 'utf8'))?.[1] ?? null;
  } catch {
    ref = null;
  }
  if (!ref) return { names: null, reason: 'supabase/config.toml project_id not readable' };
  const r = spawnSync('npx', ['supabase', 'functions', 'list', '--project-ref', ref, '--output', 'json'], {
    encoding: 'utf8',
    shell: process.platform === 'win32',
    timeout: 60_000,
  });
  if (r.status !== 0 || !r.stdout) {
    return { names: null, reason: `supabase functions list failed: ${(r.stderr || r.error?.message || 'no output').toString().slice(0, 200)}` };
  }
  try {
    const parsed = JSON.parse(r.stdout);
    const names = parsed.map((f) => f.name ?? f.slug ?? String(f));
    return names.length
      ? { names, reason: null }
      : { names: null, reason: 'CLI returned an empty fleet -- implausible (~11 known), treating as unmeasured' };
  } catch (error) {
    return { names: null, reason: `could not parse CLI output: ${error.message}` };
  }
}

export async function main(argv = [], deps = {}) {
  const { out = console.log, err = console.error } = deps;
  if (argv.includes('--self-test')) {
    const passed = await selfTest();
    return passed ? 0 : 1;
  }
  let result;
  try {
    result = await runCheck({ ...deps, log: out });
  } catch (error) {
    // R3 backstop: an unexpected throw anywhere in the check is
    // infrastructure ("could not measure"), never the contract-violated 1 a
    // bare uncaught rejection would exit with.
    result = { code: 2, reason: `unexpected failure: ${error.message}` };
  }
  if (result.code === 2) {
    err('');
    err('origin-consumers COULD NOT MEASURE: ' + result.reason);
    err('Exit 2 on purpose -- an inventory that found nothing must never read as "no consumers".');
  }
  return result.code;
}

// ---------------------------------------------------------------------------
// Canary (R4/R5): pure fixtures, no filesystem, no network, no CLI. Drives
// main() -- the exit-code owner -- and pins WHICH branch produced each code.
// Declared before the dispatch below so the top-level `await main` can reach
// every `const` (same TDZ reasoning as check-firewall-drift.mjs).
// ---------------------------------------------------------------------------

const FIX_MIGRATION = `
CREATE OR REPLACE FUNCTION public._emit_cache_revalidation_v1() RETURNS void AS $$
BEGIN
  SELECT decrypted_secret INTO v_url FROM vault.decrypted_secrets WHERE name = 'revalidate_url';
  PERFORM net.http_post(url := v_url);
END; $$ LANGUAGE plpgsql;
CREATE OR REPLACE FUNCTION public._og_sweep() RETURNS void AS $fn$
BEGIN
  SELECT decrypted_secret INTO v_url FROM vault.decrypted_secrets WHERE name = 'og_bake_url';
  SELECT net.http_post(url := v_url) INTO v_req;
END; $fn$ LANGUAGE plpgsql;
CREATE OR REPLACE FUNCTION public._og_enqueue(p uuid) RETURNS void AS $$
BEGIN
  SELECT decrypted_secret INTO v_url FROM vault.decrypted_secrets WHERE name = 'og_bake_url';
  SELECT net.http_post(url := v_url) INTO v_req;
END; $$ LANGUAGE plpgsql;
CREATE OR REPLACE FUNCTION public._og_scrape(p text) RETURNS bigint AS $$
BEGIN
  SELECT net.http_post(url := 'https://graph.facebook.com/v19.0/') INTO v_req;
END; $$ LANGUAGE plpgsql;
CREATE OR REPLACE FUNCTION public._listing_email_fixture() RETURNS trigger AS $$
BEGIN
  SELECT decrypted_secret INTO v FROM vault.decrypted_secrets WHERE name = 'send_listing_request_email_url';
  PERFORM net.http_post(url := v);
END; $$ LANGUAGE plpgsql;
`;

const FIX_MIDDLEWARE = `
const BOT_UA_PATTERN =
  /googlebot|bingbot|facebookexternalhit|whatsapp/i;
`;

const FIX_FIREWALL_LOG = {
  firewallEnabled: true,
  managedRules: {
    ai_bots: { active: true, action: 'deny' },
    bot_protection: { active: true, action: 'log' },
  },
  crs: {},
  rules: [
    {
      id: 'rule_reval',
      name: 'Bypass revalidate webhook',
      active: true,
      conditionGroup: [{ conditions: [{ type: 'path', op: 'eq', value: '/api/revalidate' }] }],
      action: { mitigate: { action: 'bypass' } },
    },
  ],
  ips: [],
};

const FIX_ROUTES = ['api.embed.calendar', 'api.ics.calendar', 'api.og.bake', 'api.og.card', 'api.revalidate'];

/** A fully-covered firewall for the fixture inventory: every origin path and
 *  every crawler token carries a bypass rule. */
function fullCoverageFirewall() {
  const paths = ['/api/revalidate', '/api/og/bake', '/api/og/card', '/api/ics/calendar', '/api/embed/calendar'];
  return {
    firewallEnabled: true,
    managedRules: {
      ai_bots: { active: true, action: 'deny' },
      bot_protection: { active: true, action: 'challenge' },
    },
    crs: {},
    rules: [
      ...paths.map((p, i) => ({
        id: `rule_p${i}`,
        name: `Bypass ${p}`,
        active: true,
        conditionGroup: [{ conditions: [{ type: 'path', op: 'eq', value: p }] }],
        action: { mitigate: { action: 'bypass' } },
      })),
      {
        id: 'rule_ua',
        name: 'Bypass known crawlers',
        active: true,
        conditionGroup: [{ conditions: [{ type: 'user_agent', op: 're', value: 'googlebot|bingbot|facebookexternalhit|whatsapp' }] }],
        action: { mitigate: { action: 'bypass' } },
      },
    ],
    ips: [],
  };
}

const clone = (o) => JSON.parse(JSON.stringify(o));

function fixtureDeps(overrides = {}) {
  return {
    readMigrationFiles: () => ({
      dirs: ['<fixture>'],
      tried: ['<fixture>'],
      files: [{ name: '00000000000001_fixture.sql', content: FIX_MIGRATION }],
    }),
    readRouteNames: () => [...FIX_ROUTES],
    readMiddleware: () => FIX_MIDDLEWARE,
    readFirewall: () => JSON.stringify(FIX_FIREWALL_LOG),
    listEdgeFunctions: async () => ({ names: null, reason: 'fixture -- not attempted' }),
    env: {},
    log: () => {},
    out: () => {},
    err: () => {},
    ...overrides,
  };
}

async function selfTest() {
  const cases = [];
  const add = (name, run, expected) => cases.push({ name, run, expected });

  // --- Extractor (pure) ---
  add('extractor: finds all five fixture callers', () =>
    scanPgNetCallers([{ name: 'f.sql', content: FIX_MIGRATION }]).map((c) => c.name).join(','),
    '_emit_cache_revalidation_v1,_listing_email_fixture,_og_enqueue,_og_scrape,_og_sweep');
  add('extractor: plain CREATE FUNCTION (no OR REPLACE) is a caller too', () =>
    scanPgNetCallers([{
      name: 'f.sql',
      content: 'CREATE FUNCTION public._plain_caller() RETURNS void AS $$ PERFORM net.http_post(url := v); $$;',
    }])[0]?.name, '_plain_caller');
  add('extractor: url:= literal lands in urlArgs; a v_url := assignment does NOT', () => {
    const c = scanPgNetCallers([{
      name: 'f.sql',
      content: 'CREATE OR REPLACE FUNCTION public._x() RETURNS void AS $$\n' +
        "  v_url := 'https://www.bachatacalendar.co.uk/event/e';\n" +
        "  PERFORM net.http_post(url := 'https://api.example.com/hook', body := v_url);\n$$;",
    }])[0];
    return `args:${c.urlArgs.join(',')} urls:${c.urls.join(',')}`;
  }, 'args:https://api.example.com/hook urls:https://www.bachatacalendar.co.uk/event/e');
  add('extractor: a function without a dollar-quoted body cannot steal the next body', () =>
    scanPgNetCallers([{
      name: 'f.sql',
      content: "CREATE OR REPLACE FUNCTION public._string_body() RETURNS void AS 'select 1' LANGUAGE sql;\n" +
        'CREATE OR REPLACE FUNCTION public._real_caller() RETURNS void AS $$ PERFORM net.http_post(url := v); $$;',
    }]).map((c) => c.name).join(','), '_real_caller');
  add('findUnattributedPgNetCalls: a cron.schedule inline command is caught', () =>
    findUnattributedPgNetCalls({
      name: 'f.sql',
      content: "SELECT cron.schedule('job', '*/2 * * * *', $cmd$ SELECT net.http_post(url := 'https://x.example/') $cmd$);",
    }), true);
  add('findUnattributedPgNetCalls: COMMENT ON prose does not fire it', () =>
    findUnattributedPgNetCalls({
      name: 'f.sql',
      content: "COMMENT ON FUNCTION public._quiet IS 'mentions net.http_post( at length';",
    }), false);
  add('findUnattributedPgNetCalls: an attributed body does not fire it', () =>
    findUnattributedPgNetCalls({ name: 'f.sql', content: FIX_MIGRATION }), false);
  add('extractor: a comment-only net.http_post mention is NOT a caller', () =>
    scanPgNetCallers([{
      name: 'f.sql',
      content: 'CREATE OR REPLACE FUNCTION public._reader() RETURNS void AS $$\nBEGIN\n' +
        '  -- reconciles what net.http_post( enqueued earlier\n  SELECT 1;\nEND; $$ LANGUAGE plpgsql;',
    }]).length, 0);
  add('extractor: COMMENT ON prose between functions is outside every body', () =>
    scanPgNetCallers([{
      name: 'f.sql',
      content: 'CREATE OR REPLACE FUNCTION public._quiet() RETURNS void AS $$ SELECT 1; $$;\n' +
        "COMMENT ON FUNCTION public._quiet IS 'talks about net.http_post( at length';",
    }]).length, 0);
  add('extractor: last definition wins -- a caller rewritten without pg_net drops out', () =>
    scanPgNetCallers([
      { name: '1.sql', content: 'CREATE OR REPLACE FUNCTION public._was_caller() RETURNS void AS $$ PERFORM net.http_post(url := v); $$;' },
      { name: '2.sql', content: 'CREATE OR REPLACE FUNCTION public._was_caller() RETURNS void AS $$ SELECT 1; $$;' },
    ]).length, 0);
  add('extractor: quoted "public"."name" normalizes to bare name', () =>
    scanPgNetCallers([{
      name: 'f.sql',
      content: 'CREATE OR REPLACE FUNCTION "public"."_quoted_fn"() RETURNS void AS $$ PERFORM net.http_get(url := v); $$;',
    }])[0]?.name, '_quoted_fn');
  add('resolveCallerTargets: a first-party DATA literal is origin-second-order, not external', () =>
    resolveCallerTargets({ urls: ['https://www.bachatacalendar.co.uk/event/x'], vaultNames: [], paths: [] })
      .targets[0].kind, 'origin-second-order');
  add('resolveCallerTargets: a first-party url:= ARGUMENT is a first-order origin target', () => {
    const t = resolveCallerTargets({
      urlArgs: ['https://www.bachatacalendar.co.uk/api/notify'], urls: [], vaultNames: [], paths: [],
    }).targets[0];
    return `${t.kind}:${t.path}`;
  }, 'origin:/api/notify');
  add('resolveCallerTargets: a third-party URL stays external', () =>
    resolveCallerTargets({ urls: ['https://graph.facebook.com/v19.0/'], vaultNames: [], paths: [] })
      .targets[0].kind, 'external');
  add('resolveCallerTargets: an unknown endpoint-suffixed vault secret is flagged, not dropped', () =>
    resolveCallerTargets({ urls: [], vaultNames: ['notify_endpoint'], paths: [] })
      .unknownVault.join(','), 'notify_endpoint');
  add('parseBotUaTokens: reads the alternation', () =>
    (parseBotUaTokens(FIX_MIDDLEWARE) ?? []).join(','), 'googlebot,bingbot,facebookexternalhit,whatsapp');
  add('parseBotUaTokens: missing pattern is null, not a guess', () =>
    parseBotUaTokens('nothing here'), null);
  add('parseBotUaTokens: regex syntax in the pattern is null (exit 2), never shredded tokens', () =>
    parseBotUaTokens('const BOT_UA_PATTERN =\n  /googlebot|(?:x|y)bot/i;'), null);
  add('pathCoverage: an ANDed sibling condition disqualifies the group (scoped != covered)', () => {
    const fw = clone(FIX_FIREWALL_LOG);
    fw.rules[0].conditionGroup[0].conditions.push({ type: 'ip_address', op: 'eq', value: '10.0.0.1' });
    return pathCoverage(fw, '/api/revalidate');
  }, null);
  add('uaCoverage: an eq rule on a bare token no longer claims coverage (full UA never equals it)', () => {
    const fw = clone(FIX_FIREWALL_LOG);
    fw.rules.push({
      id: 'r_eq', name: 'eq rule', active: true,
      conditionGroup: [{ conditions: [{ type: 'user_agent', op: 'eq', value: 'googlebot' }] }],
      action: { mitigate: { action: 'bypass' } },
    });
    return uaCoverage(fw, 'googlebot');
  }, null);
  add('uaCoverage: an inc (is-any-of) array is not String()-coerced into coverage', () => {
    const fw = clone(FIX_FIREWALL_LOG);
    fw.rules.push({
      id: 'r_inc', name: 'inc rule', active: true,
      conditionGroup: [{ conditions: [{ type: 'user_agent', op: 'inc', value: ['googlebot-image'] }] }],
      action: { mitigate: { action: 'bypass' } },
    });
    return uaCoverage(fw, 'googlebot');
  }, null);
  add('uaCoverage: a sub (substring) string rule covers its token', () => {
    const fw = clone(FIX_FIREWALL_LOG);
    fw.rules.push({
      id: 'r_sub', name: 'sub rule', active: true,
      conditionGroup: [{ conditions: [{ type: 'user_agent', op: 'sub', value: 'Googlebot' }] }],
      action: { mitigate: { action: 'bypass' } },
    });
    return uaCoverage(fw, 'googlebot');
  }, 'sub rule');
  add('mergeMigrationFileLists: first list wins a tie, result sorted by name', () =>
    mergeMigrationFileLists([
      [{ name: '2.sql', src: 'canonical' }],
      [{ name: '2.sql', src: 'worktree' }, { name: '1.sql', src: 'worktree' }],
    ]).map((f) => `${f.name}:${f.src}`).join(','), '1.sql:worktree,2.sql:canonical');
  add('API_ROUTE_RE: accepts api.*.tsx only', () =>
    ['api.og.bake.tsx', 'api.foo.ts', 'zapi.x.tsx', 'api.tsx'].map((n) => API_ROUTE_RE.test(n)).join(','),
    'true,false,false,false');
  add('pathCoverage: eq match names the rule', () =>
    pathCoverage(FIX_FIREWALL_LOG, '/api/revalidate'), 'Bypass revalidate webhook');
  add('pathCoverage: unmatched path is null', () =>
    pathCoverage(FIX_FIREWALL_LOG, '/api/og/bake'), null);
  add('pathCoverage: an INACTIVE bypass rule covers nothing', () => {
    const fw = clone(FIX_FIREWALL_LOG);
    fw.rules[0].active = false;
    return pathCoverage(fw, '/api/revalidate');
  }, null);
  add('pathCoverage: a non-bypass action covers nothing', () => {
    const fw = clone(FIX_FIREWALL_LOG);
    fw.rules[0].action.mitigate.action = 'log';
    return pathCoverage(fw, '/api/revalidate');
  }, null);
  add('uaCoverage: regex rule covers a token', () =>
    uaCoverage(fullCoverageFirewall(), 'googlebot'), 'Bypass known crawlers');
  add('uaCoverage: an unparseable regex covers nothing rather than throwing', () => {
    const fw = clone(FIX_FIREWALL_LOG);
    fw.rules.push({
      id: 'r_bad', name: 'bad', active: true,
      conditionGroup: [{ conditions: [{ type: 'user_agent', op: 're', value: '(' }] }],
      action: { mitigate: { action: 'bypass' } },
    });
    return uaCoverage(fw, 'googlebot');
  }, null);
  add('botProtectionEnforcing: challenge enforces, log does not, inactive does not', () =>
    [
      botProtectionEnforcing({ managedRules: { bot_protection: { active: true, action: 'challenge' } } }),
      botProtectionEnforcing({ managedRules: { bot_protection: { active: true, action: 'log' } } }),
      botProtectionEnforcing({ managedRules: { bot_protection: { active: false, action: 'challenge' } } }),
    ].join(','), 'true,false,false');

  // --- main(): every exit code pinned to the branch that produced it ---
  add('main: log-mode with coverage gaps is exit 0 (report-only branch)', () =>
    main([], fixtureDeps()), 0);
  add('main: the same gaps under committed ENFORCEMENT are exit 1', () =>
    main([], fixtureDeps({
      readFirewall: () => {
        const fw = clone(FIX_FIREWALL_LOG);
        fw.managedRules.bot_protection = { active: true, action: 'challenge' };
        return JSON.stringify(fw);
      },
    })), 1);
  add('main: enforcement over a FULLY covered inventory is exit 0', () =>
    main([], fixtureDeps({ readFirewall: () => JSON.stringify(fullCoverageFirewall()) })), 0);
  add('main: a dummy pg_net caller with an unknown url-ish vault secret is exit 1 and NAMED', async () => {
    let named = false;
    const code = await main([], fixtureDeps({
      readMigrationFiles: () => ({
        dirs: ['<fixture>'], tried: ['<fixture>'],
        files: [{
          name: '00000000000001_fixture.sql',
          content: FIX_MIGRATION +
            'CREATE OR REPLACE FUNCTION public._sneaky_caller() RETURNS void AS $$\n' +
            "  SELECT decrypted_secret INTO v FROM vault.decrypted_secrets WHERE name = 'sneaky_hook_url';\n" +
            '  PERFORM net.http_post(url := v);\n$$ LANGUAGE plpgsql;',
        }],
      }),
      out: (line) => { if (String(line).includes('_sneaky_caller')) named = true; },
    }));
    return `${code},named:${named}`;
  }, '1,named:true');
  add('main: a caller with NO resolvable target is exit 1 (unclassified, any mode)', () =>
    main([], fixtureDeps({
      readMigrationFiles: () => ({
        dirs: ['<fixture>'], tried: ['<fixture>'],
        files: [{
          name: '00000000000001_fixture.sql',
          content: FIX_MIGRATION +
            'CREATE OR REPLACE FUNCTION public._opaque_caller() RETURNS void AS $$\n' +
            '  PERFORM net.http_post(url := v_somewhere);\n$$ LANGUAGE plpgsql;',
        }],
      }),
    })), 1);
  add('main: a first-party url:= caller under committed ENFORCEMENT is exit 1 (the reviewed false-green)', async () => {
    let logged = false;
    const code = await main([], fixtureDeps({
      readMigrationFiles: () => ({
        dirs: ['<fixture>'], tried: ['<fixture>'],
        files: [{
          name: '00000000000001_fixture.sql',
          content: FIX_MIGRATION +
            'CREATE OR REPLACE FUNCTION public._direct_origin_post() RETURNS void AS $$\n' +
            "  PERFORM net.http_post(url := 'https://www.bachatacalendar.co.uk/api/notify');\n$$;",
        }],
      }),
      readFirewall: () => {
        const fw = clone(FIX_FIREWALL_LOG);
        fw.managedRules.bot_protection = { active: true, action: 'challenge' };
        return JSON.stringify(fw);
      },
      out: (line) => { if (String(line).includes('/api/notify') && String(line).includes('NO BYPASS RULE')) logged = true; },
    }));
    return `${code},gap-named:${logged}`;
  }, '1,gap-named:true');
  add('main: a cron.schedule inline pg_net command is exit 1 even in log mode', () =>
    main([], fixtureDeps({
      readMigrationFiles: () => ({
        dirs: ['<fixture>'], tried: ['<fixture>'],
        files: [
          { name: '00000000000001_fixture.sql', content: FIX_MIGRATION },
          { name: '00000000000002_cron.sql', content: "SELECT cron.schedule('j', '* * * * *', $cmd$ SELECT net.http_post(url := 'https://x.example/') $cmd$);" },
        ],
      }),
    })), 1);
  add('main: a stale KNOWN_VAULT_TARGETS entry is exit 1 and NAMED', async () => {
    let named = false;
    const code = await main([], fixtureDeps({
      readMigrationFiles: () => ({
        dirs: ['<fixture>'], tried: ['<fixture>'],
        // _og_sweep/_og_enqueue redefined WITHOUT the og_bake_url read (the
        // callers survive the floor; the secret is no longer read anywhere).
        files: [{
          name: '00000000000001_fixture.sql',
          content: FIX_MIGRATION +
            'CREATE OR REPLACE FUNCTION public._og_sweep() RETURNS void AS $$ PERFORM net.http_post(url := v_x); $$;\n' +
            'CREATE OR REPLACE FUNCTION public._og_enqueue(p uuid) RETURNS void AS $$ PERFORM net.http_post(url := v_x); $$;',
        }],
      }),
      out: (line) => { if (String(line).includes('KNOWN_VAULT_TARGETS entry "og_bake_url" is stale')) named = true; },
    }));
    return `${code},stale-named:${named}`;
  }, '1,stale-named:true');
  add('main: a corpus read that THROWS is exit 2, not an uncaught 1 (R3)', () =>
    main([], fixtureDeps({ readMigrationFiles: () => { throw new Error('EACCES mid-scan'); } })), 2);
  add('main: an unexpected throw anywhere else lands in the catch-all as exit 2', () =>
    main([], fixtureDeps({ listEdgeFunctions: async () => { throw new Error('spawn EPERM'); } })), 2);
  add('main: an unclassified route on disk is exit 1 even in log mode', () =>
    main([], fixtureDeps({ readRouteNames: () => [...FIX_ROUTES, 'api.surprise'] })), 1);
  add('main: a stale KNOWN_ROUTES entry (file gone) is exit 1', () =>
    main([], fixtureDeps({ readRouteNames: () => FIX_ROUTES.filter((r) => r !== 'api.og.card') })), 1);
  add('main: no migrations dir anywhere is exit 2', () =>
    main([], fixtureDeps({ readMigrationFiles: () => ({ dirs: [], tried: ['<none>'], files: [] }) })), 2);
  add('main: a corpus yielding zero callers is exit 2, never "no consumers, all good"', () =>
    main([], fixtureDeps({
      readMigrationFiles: () => ({
        dirs: ['<fixture>'], tried: ['<fixture>'],
        files: [{ name: '1.sql', content: 'CREATE TABLE t (id int);' }],
      }),
    })), 2);
  add('main: a missing KNOWN caller (retired or scanner broke) is exit 2', () =>
    main([], fixtureDeps({
      readMigrationFiles: () => ({
        dirs: ['<fixture>'], tried: ['<fixture>'],
        files: [{
          name: '1.sql',
          // _og_scrape rewritten without pg_net, and a fourth anonymous
          // caller added so the caller COUNT still meets the floor -- this
          // isolates the missing-KNOWN branch from the too-few-callers one.
          content: FIX_MIGRATION +
            'CREATE OR REPLACE FUNCTION public._og_scrape(p text) RETURNS bigint AS $$ SELECT 1; $$;\n' +
            "CREATE OR REPLACE FUNCTION public._other() RETURNS void AS $$ PERFORM net.http_post(url := 'https://example.com/x'); $$;",
        }],
      }),
    })), 2);
  add('main: unreadable vercel-firewall.json is exit 2', () =>
    main([], fixtureDeps({ readFirewall: () => { throw new Error('disk gone'); } })), 2);
  add('main: firewall json with no managedRules is exit 2 (implausible config)', () =>
    main([], fixtureDeps({ readFirewall: () => JSON.stringify({ rules: [] }) })), 2);
  add('main: middleware without BOT_UA_PATTERN is exit 2', () =>
    main([], fixtureDeps({ readMiddleware: () => 'export default 1;' })), 2);
  add('main: zero api routes on disk is exit 2', () =>
    main([], fixtureDeps({ readRouteNames: () => [] })), 2);
  add('main: edge-fn CLI unavailable still exits 0 -- the gap is DECLARED, not fatal', async () => {
    let declared = false;
    const code = await main([], fixtureDeps({
      listEdgeFunctions: async () => ({ names: null, reason: 'no token' }),
      out: (line) => { if (String(line).includes('UNENUMERABLE')) declared = true; },
    }));
    return `${code},declared:${declared}`;
  }, '0,declared:true');
  add('main: an enumerated edge fleet is listed as unknown-behaviour, still exit 0', () =>
    main([], fixtureDeps({ listEdgeFunctions: async () => ({ names: ['fn-a', 'fn-b'], reason: null }) })), 0);

  let pass = 0;
  for (const c of cases) {
    let actual;
    try { actual = await c.run(); } catch (error) { actual = 'THREW: ' + error.message; }
    const ok = actual === c.expected;
    if (ok) pass++;
    else console.error(`  FAIL  ${c.name} -- expected ${JSON.stringify(c.expected)}, got ${JSON.stringify(actual)}`);
  }
  console.log(`check-origin-consumers self-test: ${pass}/${cases.length} passed`);
  return pass === cases.length;
}

// Realpath-to-realpath (scripts/lib/entry-point.mjs) -- a raw import.meta vs
// argv[1] compare mispredicts through a junction and the whole check,
// canary included, prints nothing and exits 0 (R6). Placed LAST: the
// top-level await must not run before the `const` fixtures above exist.
if (isEntryPoint(import.meta.url)) {
  // process.exitCode, never process.exit() after printing -- POSIX truncates
  // buffered stdout on process.exit (measured in this repo: 904 -> 194 lines).
  process.exitCode = await main(process.argv.slice(2));
}

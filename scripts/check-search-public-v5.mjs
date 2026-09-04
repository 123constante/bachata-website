#!/usr/bin/env node
/**
 * CI contract check for the search_public_v5 RPC (replaces check-search-public-v3).
 * Verifies:
 *   1. The RPC exists and is callable as anon.
 *   2. It returns a jsonb object with the EIGHT expected section arrays
 *      (events, organisers, teachers, djs, dancers, venues, vendors, cities)
 *      plus total_count (number) and a did_you_mean key (string | null).
 *   3. Empty query returns total_count = 0 with all-empty sections.
 *   4. Nonsense query returns total_count = 0 and a null did_you_mean.
 *   5. Default p_include_past=false returns only upcoming events (start-anchored
 *      proxy -- the payload carries no end_time; deliberately loose).
 *   6. p_include_past=true broadens to include past events.
 *   6b. The default view excludes every DEFINITELY-past event that is not
 *      flagged is_ended, while p_include_past=true still surfaces them -- the
 *      decisive proof that the upcoming filter is applied at all. Needs no
 *      complete result set.
 *   6c. And the ended half of that same contract: an ended series that DOES
 *      appear must come back from a search of its own name, still flagged.
 *      Arc P2 exempts lifecycle_status='ended' from the upcoming filter on
 *      purpose, so 6b's exemption is only honest beside a test that the
 *      exempted row is being surfaced for the reason the arc claims.
 *   7. Fuzzy: a near-miss ("bachatta") still resolves (results OR a suggestion).
 *   8. Filters narrow: p_event_type constrains the events section
 *      (soft-passes when the unfiltered base is already empty).
 *
 * Local:  node scripts/check-search-public-v5.mjs   (reads .env)
 * CI:     env vars VITE_SUPABASE_URL + VITE_SUPABASE_PUBLISHABLE_KEY.
 *
 * Admin migration 20260826002000_search_public_v5; see
 * .github/workflows/db-contract-check.yml.
 */
import fs from 'node:fs';
import { createClient } from '@supabase/supabase-js';
import {
  partitionDefinitelyPast,
  classifyEndedRoundTrip,
  describeEvents,
} from './lib/search-past-leak.mjs';

function loadEnv() {
  const env = { ...process.env };
  if (fs.existsSync('.env')) {
    const file = fs.readFileSync('.env', 'utf8');
    for (const raw of file.split(/\r?\n/)) {
      const line = raw.trim();
      if (!line || line.startsWith('#')) continue;
      const idx = line.indexOf('=');
      if (idx < 0) continue;
      const k = line.slice(0, idx).trim();
      const v = line.slice(idx + 1).replace(/^"|"$/g, '');
      if (env[k] === undefined) env[k] = v;
    }
  }
  return env;
}

const env = loadEnv();
const url = env.VITE_SUPABASE_URL || env.SUPABASE_URL;
const key =
  env.VITE_SUPABASE_PUBLISHABLE_KEY ||
  env.SUPABASE_PUBLISHABLE_KEY ||
  env.SUPABASE_ANON_KEY;

if (!url || !key) {
  console.error('Missing VITE_SUPABASE_URL or VITE_SUPABASE_PUBLISHABLE_KEY');
  process.exit(2);
}

const sb = createClient(url, key, {
  auth: { persistSession: false, autoRefreshToken: false },
});

const SECTION_KEYS = ['events', 'organisers', 'teachers', 'djs', 'dancers', 'venues', 'vendors', 'cities'];

function assertShape(payload, label) {
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
    throw new Error(`${label}: payload must be a jsonb object, got ${JSON.stringify(payload)}`);
  }
  for (const k of SECTION_KEYS) {
    if (!Array.isArray(payload[k])) {
      throw new Error(`${label}: section '${k}' must be an array, got ${JSON.stringify(payload[k])}`);
    }
  }
  if (typeof payload.total_count !== 'number') {
    throw new Error(`${label}: total_count must be a number, got ${typeof payload.total_count}`);
  }
  if (!('did_you_mean' in payload)) {
    throw new Error(`${label}: did_you_mean key must always be present`);
  }
  if (payload.did_you_mean !== null && typeof payload.did_you_mean !== 'string') {
    throw new Error(`${label}: did_you_mean must be string|null, got ${typeof payload.did_you_mean}`);
  }
}

async function callRpc(args, label) {
  const { data, error } = await sb.rpc('search_public_v5', args);
  if (error) {
    console.error(`${label}: RPC error: ${error.message}`);
    process.exit(2);
  }
  return data;
}

// Test 1: a known query that should match production data.
const known = await callRpc(
  { p_query: 'bachata', p_city_slug: null, p_section_limit: 5 },
  'search_public_v5("bachata")',
);
assertShape(known, 'bachata');
if (known.total_count === 0) {
  throw new Error('bachata query returned total_count=0 - DB has lost all bachata content?');
}

// Test 2: empty query returns all-empty sections.
const emptyResult = await callRpc(
  { p_query: '', p_city_slug: null, p_section_limit: 5 },
  'search_public_v5("")',
);
assertShape(emptyResult, 'empty-query');
if (emptyResult.total_count !== 0) {
  throw new Error(`empty query should return total_count=0, got ${emptyResult.total_count}`);
}
for (const k of SECTION_KEYS) {
  if (emptyResult[k].length !== 0) {
    throw new Error(`empty query: section '${k}' should be empty, got ${emptyResult[k].length} rows`);
  }
}

// Test 3: nonsense query returns empty sections AND a null did_you_mean.
const bogusResult = await callRpc(
  { p_query: 'zzxqwlllk', p_city_slug: null, p_section_limit: 5 },
  'search_public_v5("zzxqwlllk")',
);
assertShape(bogusResult, 'bogus');
if (bogusResult.total_count !== 0) {
  throw new Error(`bogus query should return total_count=0, got ${bogusResult.total_count}`);
}
if (bogusResult.did_you_mean !== null) {
  throw new Error(`bogus query should have did_you_mean=null, got ${JSON.stringify(bogusResult.did_you_mean)}`);
}

// Test 4: city scope works.
const londonResult = await callRpc(
  { p_query: 'bachata', p_city_slug: 'london-gb', p_section_limit: 5 },
  'search_public_v5("bachata","london-gb")',
);
assertShape(londonResult, 'bachata+london');

// Test 5: default (p_include_past=false) returns only upcoming events.
const upcomingOnly = await callRpc(
  { p_query: 'bachata', p_city_slug: null, p_section_limit: 12 },
  'search_public_v5("bachata",upcoming)',
);
assertShape(upcomingOnly, 'upcoming-only');
// The RPC's upcoming filter is anchored on the event's END:
//   eo.materialised_end_utc > now() - interval '6 hours'
// but the payload only carries start_time, so this check can only assert a
// START-anchored PROXY. Anchoring the 6h grace to the start was a real bug: any
// evening event sits inside the RPC's window and outside the check's for ~3h
// every night (~02:30-05:30 UTC), which reddened db-contract-check on unrelated
// PRs -- e.g. PR #135's 03:22 UTC run, on a "Rogue Bachata" 19:30-22:30 night.
//
// So the bound must be the RPC's own grace PLUS the longest event span that can
// still be legitimately in-window. Measured against live data (2026-07-22): the
// longest materialised span is 4d04h (a multi-day festival), p99 is 08:30.
// 5 days is a deliberate upper bound with headroom, not a tuned threshold.
//
// This is deliberately loose: it still catches the failure that matters (the RPC
// leaking long-past events into the default view) without false-reddening on the
// end-vs-start skew. Emitting end_time in the events payload would let this
// assert the genuine invariant instead of a proxy -- tracked as a follow-up.
const MAX_EVENT_SPAN_HOURS = 5 * 24;
const RPC_PAST_GRACE_HOURS = 6;
const oldestAllowedStart =
  Date.now() - (RPC_PAST_GRACE_HOURS + MAX_EVENT_SPAN_HOURS) * 60 * 60 * 1000;
//
// Rows flagged is_ended are exempt, and the exemption belongs HERE as much as
// in 6b: this probe asks for 12 and the RPC orders `is_ended ASC` before
// relevance, so an ended series is the last row of the section and shows up
// here only once fewer than 12 live events match. That is a corpus accident,
// not a contract difference -- leaving the exemption out of one of the two
// call sites would make the same payload legal in one and a violation in the
// other. See scripts/lib/search-past-leak.mjs for why ended rows are past on
// purpose.
const { leaked: leakedNarrow } = partitionDefinitelyPast(
  upcomingOnly.events,
  oldestAllowedStart,
  'upcoming-only',
);
if (leakedNarrow.length > 0) {
  throw new Error(
    `upcoming-only: ${describeEvents(leakedNarrow)} -- start_time more than ` +
      `${RPC_PAST_GRACE_HOURS}h grace + ${MAX_EVENT_SPAN_HOURS}h max span in the past, ` +
      'and not flagged is_ended',
  );
}

// Test 6: p_include_past=true returns >= the upcoming-only count.
const includePast = await callRpc(
  { p_query: 'bachata', p_city_slug: null, p_section_limit: 12, p_include_past: true },
  'search_public_v5("bachata",include_past)',
);
assertShape(includePast, 'include-past');
if (includePast.events.length < upcomingOnly.events.length) {
  throw new Error(`include_past returned fewer events (${includePast.events.length}) than upcoming-only (${upcomingOnly.events.length})`);
}

// Test 6b: the decisive proof that the upcoming filter is actually applied.
//
// Test 5's start-anchored bound is a loose proxy (see its comment), and it has
// to be: a multi-day festival RUNNING RIGHT NOW legitimately has a start in the
// past. So the question is never "did any returned event start in the past" but
// "does the default view carry events that are past by ANY reading".
//
// DEFINITELY past = started before now - (6h grace + 5d max span). No event
// still in progress can be that old, so such an event must be excluded by
// `materialised_end_utc > now() - 6h`; finding one in the default view means
// the filter is gone. Two properties, and crucially NEITHER needs a complete
// result set:
//   (a) p_include_past=true surfaces at least one definitely-past event, so the
//       filter has something to exclude and (b) is not vacuous.
//   (b) the default view contains NONE of them.
// Truncation cannot flip either: clipping only ever REMOVES rows, (b) is a
// universal over whatever came back, and (a) has wide measured margin.
//
// This replaces an earlier set-differential (include_past minus upcoming, all
// past). That shape is unsound here and could never be made sound: the RPC caps
// the events section server-side at LEAST(COALESCE(p_section_limit, 12), 50),
// so asking for more than 50 is silently ignored and NO probe can guarantee a
// complete set. Its truncation guard also told you to raise a limit that was
// already sitting at that ceiling. Its second leg (include_past-only events are
// all past) is dropped rather than kept as false comfort: under a capped probe
// an upcoming event missing from a clipped upcoming set is indistinguishable
// from a mis-anchored one.
//
// Measured 2026-08-04 at limit 50 across bachata/salsa/kizomba/london/festival:
// definitely-past events in the include_past set = 10/7/2/11/4, and in the
// default view 0/0/0/0/0. For "bachata" those 10 sit at result positions 12-42,
// nowhere near the truncation boundary. Past events also accumulate
// monotonically as the calendar moves, so (a) only strengthens with time.
const PROBE_LIMIT = 50; // the RPC's own ceiling -- asking for more is a no-op
const upcomingWide = await callRpc(
  { p_query: 'bachata', p_city_slug: null, p_section_limit: PROBE_LIMIT },
  'search_public_v5("bachata",upcoming,wide)',
);
assertShape(upcomingWide, 'upcoming-wide');
const includePastWide = await callRpc(
  {
    p_query: 'bachata',
    p_city_slug: null,
    p_section_limit: PROBE_LIMIT,
    p_include_past: true,
  },
  'search_public_v5("bachata",include_past,wide)',
);
assertShape(includePastWide, 'include-past-wide');

const { leaked: pastReachable } = partitionDefinitelyPast(
  includePastWide.events,
  oldestAllowedStart,
  'include-past-wide',
);
const { leaked, endedPast: endedInDefault } = partitionDefinitelyPast(
  upcomingWide.events,
  oldestAllowedStart,
  'upcoming-wide',
);

// (a) the filter has something to exclude -- and something it is NOT allowed
// to exempt. Counting ended rows here would let the whole proof go vacuous the
// day the only definitely-past matches are ended ones: every subject of (b)
// would be exempt, (b) would pass over an empty set, and (a) would still say
// the corpus was rich enough to prove something.
if (pastReachable.length === 0) {
  throw new Error(
    'p_include_past=true surfaced NO non-ended event older than the 6h grace + 5d max span. ' +
      'Either the corpus genuinely holds no past events (implausible for a live calendar), or ' +
      'include_past is no longer widening the query. Without at least one, the exclusion test ' +
      'below would pass vacuously -- so this fails rather than reporting a green it has not earned.',
  );
}

// (b) and the default view excludes every one of them.
if (leaked.length > 0) {
  throw new Error(
    `the default (upcoming) view returned ${leaked.length} event(s) that started more than ` +
      `${RPC_PAST_GRACE_HOURS}h grace + ${MAX_EVENT_SPAN_HOURS}h max span ago, are not flagged ` +
      `is_ended, and so are covered by no reading of "still running": ${describeEvents(leaked)}. ` +
      'The upcoming filter (materialised_end_utc > now() - 6h) is no longer being applied.',
  );
}

// (c) the other half of the same contract, so the exemption in (b) cannot fail
// open. Arc P2 does not merely TOLERATE an ended series in the default view --
// it requires one, marked, because search is the surface where silence is the
// failure. Assert it the way a visitor meets it: search the series by its own
// name and require the same row back, still flagged.
//
// This arm is opportunistic by construction. An ended series sorts last
// (`ORDER BY sc.is_ended ASC`) and the section is capped at 50, so whether one
// appears above depends on how many live events match "bachata" -- measured at
// exactly 50 on 2026-09-04, one row either side of the cap. That is the same
// condition under which (b)'s exemption does anything at all, so when this is
// skipped the exemption is inert and nothing has been waved through.
//
// Driven against prod once, 2026-09-04, through the same code with p_query
// "styling" (8 events, leaked 0, endedPast 1): June Styling Course round-trips
// by name with is_ended true. The hardcoded "bachata" probe cannot reach it
// today, so treat a WARN here as "not exercised this run", never as evidence
// the arm does not work.
if (endedInDefault.length > 0) {
  const ended = endedInDefault[0];
  if (!ended.name || !ended.name.trim()) {
    throw new Error(
      `the default view surfaced ended event ${ended.id} with no name, so a visitor has no ` +
        'query that could reach it -- the tombstone is unreachable by search.',
    );
  }
  const byName = await callRpc(
    { p_query: ended.name.trim(), p_city_slug: null, p_section_limit: PROBE_LIMIT },
    `search_public_v5("${ended.name.trim()}")`,
  );
  assertShape(byName, 'ended-by-name');
  const echoed = byName.events.find((e) => e.id === ended.id);
  const verdict = classifyEndedRoundTrip({
    echoed,
    sectionLength: byName.events.length,
    probeLimit: PROBE_LIMIT,
  });
  if (verdict === 'unflagged') {
    throw new Error(
      `ended series ${ended.id} (${ended.name}) came back from a name search with is_ended=` +
        `${JSON.stringify(echoed.is_ended)}. It is exempt from the upcoming filter BECAUSE it ` +
        'is flagged ended; unflagged, the same row is an ordinary past-event leak.',
    );
  }
  if (verdict === 'silent') {
    throw new Error(
      `ended series ${ended.id} (${ended.name}) is returned for a broad query but NOT for a ` +
        `search of its own name, which came back with room to spare (${byName.events.length} of ` +
        `${PROBE_LIMIT}), so nothing was clipped. Arc P2 exists so a visitor searching a night ` +
        'that has stopped gets the answer marked rather than silence; this is that silence.',
    );
  }
  if (verdict === 'clipped') {
    console.warn(
      `[WARN] ended series ${ended.id} (${ended.name}) did not appear in a search of its own ` +
        `name, but that section came back full (${byName.events.length} = the RPC cap), so this ` +
        'cannot tell clipping from silence. The ended-series round trip is unproven this run.',
    );
  }
} else {
  console.warn(
    '[WARN] no ended series appeared in the default view this run, so the ended-series arm of ' +
      'the upcoming filter was not exercised. It sorts last and the section is capped, so this ' +
      'is a corpus accident -- and the exemption in (b) is inert in exactly the same case.',
  );
}

// Test 7: fuzzy / typo tolerance -- a near-miss resolves to results OR a suggestion.
const fuzzy = await callRpc(
  { p_query: 'bachatta', p_city_slug: null, p_section_limit: 5 },
  'search_public_v5("bachatta")',
);
assertShape(fuzzy, 'fuzzy');
if (fuzzy.total_count <= 0 && typeof fuzzy.did_you_mean !== 'string') {
  throw new Error('fuzzy "bachatta": expected results or a did_you_mean suggestion, got neither');
}

// Test 8: p_event_type narrows the events section (soft-pass when base is empty).
const baseEvents = upcomingOnly.events.length;
if (baseEvents > 0) {
  const filtered = await callRpc(
    { p_query: 'bachata', p_city_slug: null, p_section_limit: 12, p_event_type: ['festival'] },
    'search_public_v5("bachata",etype=festival)',
  );
  assertShape(filtered, 'etype-filter');
  if (filtered.events.length > baseEvents) {
    throw new Error(`etype filter widened events (${filtered.events.length} > ${baseEvents}) - filter not applied`);
  }
}

console.log(JSON.stringify({
  bachata_total: known.total_count,
  empty_total: emptyResult.total_count,
  bogus_total: bogusResult.total_count,
  bachata_london_total: londonResult.total_count,
  upcoming_only_events: upcomingOnly.events.length,
  include_past_events: includePast.events.length,
  fuzzy_total: fuzzy.total_count,
  fuzzy_did_you_mean: fuzzy.did_you_mean,
}, null, 2));

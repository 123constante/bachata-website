#!/usr/bin/env node
/**
 * CI contract check -- EVENT TRUTH (event-truth arc P0, 2026-10-12).
 *
 * WHY THIS EXISTS. An event's "what is it" lives in TWO places that nobody made
 * agree: the declared event_series_p5.category (party | class | workshop |
 * masterclass, asked on both dashboards) and the programme sessions underneath
 * it (section kinds + item types), which is what the public calendar's
 * Parties / Classes tabs actually read. Measured on prod 2026-10-12: 7 open
 * series whose declared category contradicts every one of their sessions
 * (five "courses" of pure class sessions stored as party), 2 live courses with
 * no length, and the public readers computing has_class / has_party from
 * different sources at different grains. The owner's decision is that the
 * sessions are the truth and category becomes DERIVED (plan:
 * in-the-admin-dashboard-peaceful-tide.md). This guard is the floor under that
 * arc: it names today's drift so it can only shrink, and it REPORTS how far the
 * readers disagree so P1 has a number to bring to zero.
 *
 * P3 (2026-10-13, owner decision; admin #780). Organisers edit the programme PER
 * DATE: organiser_set_occurrence_programme_v1 writes new sessions to
 * event_occurrence_added_session_p5 (section_kind, type), never to the series
 * programme, and the Website's organiser create makes a series with ONLY such
 * date-only sessions. So the genre set is the UNION of series section kinds,
 * series item types, and date-only section_kind AND type, through one mapping.
 * check_event_truth_v1 carries them as added_sessions per series (REQUIRED:
 * the P0 payload without the key is exit 2, fail closed) and an independent
 * added_session_count. #780 repairs the stored mirror from that derivation, so
 * category_drift GATES AT ZERO since then: the baseline block is empty and any
 * drifting live series is a fresh failure. A NULL mirror under mapped sessions
 * is drift too (the mirror is derived; unset means it was not written), as the
 * canonical src/lib/eventCategory.ts reads it -- scripts/fixtures/
 * event-truth-parity.json pins this guard's mapping to that lib case by case
 * (the canary runs it here, eventCategory.parity.test.ts runs it there).
 *
 * WHERE THE DATA COMES FROM. The series and programme tables are admin-only
 * under RLS, so the anon key reads 0 rows from them. They are read through
 * check_event_truth_v1() (admin migration 20261115050000), SECURITY DEFINER with
 * anon EXECUTE like every sibling check_*_v1: a projection of every LIVE series
 * with its section kinds and {kind, type} item pairs, plus independent totals.
 * The RULES stay here, in one place, where the canary drives them. Live only on
 * purpose: anon can call the RPC, and a paused or pending_review series is not
 * public, so returning it would let anyone enumerate unpublished submissions. A
 * series is measured from the moment it goes live -- when its category starts
 * misleading the public.
 * get_calendar_events_v2 and get_latest_events_v2 are called directly, as anon,
 * as the site calls them. get_map_events_v1 is NOT called: it selects
 * has_class / has_party straight out of get_calendar_events_v2, so comparing
 * the two could never disagree and only spent a second calendar run.
 *
 * WHAT IT CHECKS (with the anon key):
 *   1. category_drift     -- GATED. A live series whose programme (series
 *                            sections + items + date-only sessions) maps to at
 *                            least one genre, and whose stored category is absent
 *                            from that set (NULL included). RATCHETED by series id
 *                            (event-truth-baseline.json; EMPTY since #780, so it
 *                            gates at 0): a NEW id fails, and a
 *                            listed id that is still measured but no longer
 *                            drifts ALSO fails (stale -- shrink the file). A
 *                            listed id that LEFT the measured scope (ended,
 *                            paused, archived, programme emptied) is reported, not
 *                            failed: nothing was repaired, and a run on main
 *                            must not go red because a series finished.
 *   2. course_without_length -- GATED. A live format='course' with NULL
 *                            course_total_sessions. Same ratchet; scope is every
 *                            live series.
 *   3. reader_flags       -- REPORTED, never gating. For each occurrence that
 *                            get_latest_events_v2 shares with
 *                            get_calendar_events_v2 (next HORIZON_DAYS), latest's
 *                            flags against the OR of the calendar's flags over
 *                            that occurrence's days. Not a contract today: latest
 *                            is series-wide over item types, the calendar is per
 *                            day and honours session overrides, so a festival
 *                            with its party on day 2 or a night whose class is
 *                            cancelled for one date legitimately differs. Joined
 *                            on occurrence_id alone, because latest dates its row
 *                            in UTC and the calendar in city time.
 *   4. kind_vs_type       -- REPORTED, never gating (8 today): a programme item
 *                            whose type contradicts its section's kind, and
 *                            (FIX-2) a date-only session whose type contradicts
 *                            its section_kind: both grains are in the scan.
 *   Live series WITHOUT a programme, or whose sections are all of kinds and
 *   types that map to no genre (showcase, competition, show, ...), are reported:
 *   that is P1's "Not set" state, not drift.
 *
 * GENRE MAPPING. Section kind first (87 party sections on prod carry no item),
 * item type second, date-only session kind and type third, and the same
 * synonyms the public readers use: masterclass (kind or type) counts as a
 * class AND a masterclass, item type social counts as a party. A guard that
 * mapped more narrowly than the readers would call a series drift while the
 * Classes tab lists it. Unknown values (showcase, performance, ...) and nulls
 * say nothing.
 *
 * WHAT IT DELIBERATELY DOES NOT CHECK. Live series with no future date: CI #28
 * (check_live_series_occurrence_horizon_v1) already reports those and gates
 * only open-ended rules, on purpose. See docs/event-truth-table.md.
 *
 * THE LOAD-BEARING ASSERTIONS. Every count here can read as zero by measuring
 * nothing: an RPC that lost SECURITY DEFINER, an RPC renamed, an empty city.
 * assertTruthPayload() refuses a payload whose arrays disagree with its own
 * totals (a strict ===, so a total arriving as null or a string never matches),
 * a duplicated series id, a field of the wrong type, or a series that is not
 * live (the RPC widened its scope: a privacy regression, not data); assertReaderRows() refuses a reader row with no occurrence_id or a
 * non-boolean flag; assertMeasured() turns an empty live-series sample and an
 * empty calendar into exit 2, never a green 0. Every RPC goes through
 * rpcWithRetry, so a cold instance's 57014 is retried before it becomes exit 2.
 *
 * Local:  node scripts/check-event-truth-v1.mjs   (.env / .env.local / .env.development at the repo root)
 *         node scripts/check-event-truth-v1.mjs --self-test
 * CI:     db-contract-check.yml step #70, env VITE_SUPABASE_URL,
 *         VITE_SUPABASE_PUBLISHABLE_KEY.
 *
 * Exit: 0 pass, 1 a gated contract is violated (new drift, a stale baseline
 * entry), 2 the guard could not measure. Missing creds are 2.
 */
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createClient } from '@supabase/supabase-js';
import { assertMeasured } from './lib/previewProbe.mjs';
import { isEntryPoint } from './lib/entry-point.mjs';
import { readEnvDirs, firstValue } from './lib/dotenv.mjs';
import { rpcWithRetry } from './lib/rpc-retry.mjs';

const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const BASELINE_PATH = path.join(ROOT, 'event-truth-baseline.json');
/** The parity corpus the canonical lib's vitest also runs (see the canary). */
const PARITY_PATH = path.join(ROOT, 'scripts', 'fixtures', 'event-truth-parity.json');
const TRUTH_RPC = 'check_event_truth_v1';
const CITY_SLUG = 'london-gb';
const HORIZON_DAYS = 14;
const LATEST_LIMIT = 50;
/** The scope check_event_truth_v1 promises. A row outside it is a changed RPC, not data. */
const MEASURED_STATUSES = ['live'];

/** The guard could not measure what it promised. Exit 2, never 0. */
export class CannotMeasure extends Error {}
const cannot = (msg) => {
  throw new CannotMeasure(msg);
};

// ---------------------------------------------------------------------------
// Pure rules. Every one takes its data, so the canary drives them from fixtures
// with no network and no key.
// ---------------------------------------------------------------------------

/**
 * The genre set a programme implies, with the readers' synonyms (see GENRE
 * MAPPING above). Kinds and types outside the mapping add nothing: unknown is
 * "says nothing", never an error, so a new section kind cannot red this guard by
 * existing -- a programme that maps to nothing at all is reported as not set.
 */
export function deriveGenres(sectionKinds, itemTypes, addedSessions) {
  const genres = new Set();
  const add = (token) => {
    if (token === 'party' || token === 'social') genres.add('party');
    else if (token === 'classes' || token === 'class' || token === 'workshop') genres.add('class');
    else if (token === 'masterclass') {
      genres.add('class');
      genres.add('masterclass');
    }
  };
  for (const kind of sectionKinds ?? []) add(kind);
  for (const type of itemTypes ?? []) add(type);
  // Date-only sessions (P3): section_kind then type, the SAME mapping -- the
  // canonical lib folds them into the kind and type lists; a null says nothing.
  for (const session of addedSessions ?? []) {
    add(session && session.kind);
    add(session && session.type);
  }
  return genres;
}

/**
 * Does the stored category sit inside the derived set? `workshop` counts as
 * a class (the one_off-class shape the organiser picker writes). Since P3 the
 * mirror is DERIVED from the sessions (admin #780 repairs it), so a NULL under
 * mapped sessions is a mirror that was not written, not "declares nothing":
 * it agrees with nothing, exactly as the canonical lib's categoryAgrees reads
 * it (the parity corpus pins that). A series whose sessions map to no genre
 * never reaches this function (reported as genre not set, above). A value
 * outside the CHECK constraint's four tokens is a disagreement by definition
 * -- it maps to no session kind -- and is reported loudly rather than skipped.
 */
export function categoryAgrees(category, genres) {
  if (category === 'party') return genres.has('party');
  if (category === 'class' || category === 'workshop') return genres.has('class');
  if (category === 'masterclass') return genres.has('masterclass');
  return false;
}

/**
 * The ratchet. `offenders` are the ids failing the rule NOW; `baseline` the ids
 * the committed file listed; `scope` the ids the rule MEASURED this run. A fresh
 * id is a regression. A baseline id that was measured and no longer offends is
 * STALE, and stale entries fail -- otherwise the file is a pool that only grows.
 * A baseline id that was not measured at all DEPARTED (the series ended, was
 * archived, lost its programme): nothing was repaired, so it is reported, never
 * failed. Without the split, a series finishing would red main with "remove it".
 */
export function classifyAgainstBaseline(offenders, baseline, scope) {
  const now = new Set(offenders);
  const measured = (id) => now.has(id) || scope.has(id);
  return {
    fresh: [...now].filter((id) => !baseline.includes(id)).sort(),
    known: [...now].filter((id) => baseline.includes(id)).sort(),
    stale: baseline.filter((id) => !now.has(id) && measured(id)).sort(),
    departed: baseline.filter((id) => !measured(id)).sort(),
  };
}

/**
 * Latest's flags against the calendar's, per occurrence. The calendar returns
 * one row per occurrence DAY, so its flags are OR-ed over the occurrence's days
 * first; latest returns one row per series at its next occurrence. Joined on
 * occurrence_id alone: latest's instance_date is the UTC date, the calendar's
 * the city date. Rows only one reader returned are not compared.
 */
export function latestVsCalendar(calendarRows, latestRows) {
  const byOcc = new Map();
  for (const row of calendarRows ?? []) {
    const agg = byOcc.get(row.occurrence_id) ?? { has_class: false, has_party: false };
    agg.has_class = agg.has_class || row.has_class;
    agg.has_party = agg.has_party || row.has_party;
    byOcc.set(row.occurrence_id, agg);
  }
  let overlap = 0;
  const disagreements = [];
  for (const b of latestRows ?? []) {
    const a = byOcc.get(b.occurrence_id);
    if (!a) continue;
    overlap += 1;
    if (a.has_class !== b.has_class || a.has_party !== b.has_party) {
      disagreements.push({
        occurrence_id: b.occurrence_id,
        calendar: a,
        latest: { has_class: b.has_class, has_party: b.has_party },
      });
    }
  }
  return { overlap, disagreements };
}

/** A programme item whose type contradicts the kind of the section holding it,
 *  with the readers' synonyms. Each item arrives as the RPC's {kind, type}
 *  pair -- a series item (kind = its section's kind) and a date-only session
 *  (kind = its section_kind) alike. A NULL on either side contradicts nothing.
 *  Reported only. */
export function kindTypeMismatches(items) {
  const mismatches = [];
  for (const item of items ?? []) {
    const kind = item && item.kind;
    const type = item && item.type;
    if (type === null || type === undefined || kind === null || kind === undefined) continue;
    const bad =
      ((kind === 'party' || kind === 'social') && type !== 'party' && type !== 'social') ||
      (kind === 'classes' && type !== 'class' && type !== 'workshop' && type !== 'masterclass') ||
      (kind === 'masterclass' && type !== 'masterclass');
    if (bad) mismatches.push({ kind, type });
  }
  return mismatches;
}

const isNullOr = (v, test) => v === null || test(v);

/**
 * The plain step a red names while prod is still on the P0 shape (FIX-6 F-a). CI #70
 * reds this repo's PRs and main until admin #780 (the derived category: date-only
 * sessions in the payload and the mirror re-derived from them) is applied, and no
 * code here can reorder those merges, so the red says what has to happen first.
 */
export const ADMIN_780_FIRST = 'admin #780 (derived category) must be applied first';

/**
 * The check_event_truth_v1 payload, asserted complete before any rule reads it.
 * The totals are computed by the RPC independently of the arrays, so an array
 * that came back short -- or a total that came back as null, a string, or not at
 * all, which the strict comparison below can never match -- is a payload this
 * guard has not understood: exit 2, never a pass over whatever did arrive. A
 * series listed twice (a join fan-out in a later rewrite would keep the totals
 * consistent) and a field of the wrong type (a course length of '' read as
 * "has a length") are refused the same way. Returns the live series.
 */
export function assertTruthPayload(payload) {
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
    cannot(TRUTH_RPC + ' returned no object (got ' + JSON.stringify(payload) + ').');
  }
  const series = payload.series;
  if (!Array.isArray(series)) cannot(TRUTH_RPC + ' returned no series array.');
  let sections = 0;
  let items = 0;
  let added = 0;
  const seen = new Set();
  const isText = (v) => typeof v === 'string';
  for (const s of series) {
    if (!s || typeof s.id !== 'string' || !Array.isArray(s.section_kinds) || !Array.isArray(s.items) || !Array.isArray(s.added_sessions)) {
      cannot(TRUTH_RPC + ' series entry ' + JSON.stringify(s && s.id) + ' is missing id, section_kinds, items or added_sessions.' +
        (s && !Array.isArray(s.added_sessions) ? ' ' + ADMIN_780_FIRST + ' (added_sessions is REQUIRED since P3: a payload without it is the P0 RPC, which cannot see date-only sessions -- fail closed, never a pass).' : ''));
    }
    // Each date-only session is exactly {kind, type}, each text or null: a
    // renamed column would arrive as undefined and read as "says nothing".
    for (const a of s.added_sessions) {
      const keys = a && typeof a === 'object' && !Array.isArray(a) ? Object.keys(a).sort().join(',') : '';
      if (keys !== 'kind,type' || !isNullOr(a.kind, isText) || !isNullOr(a.type, isText)) {
        cannot(TRUTH_RPC + ' series ' + s.id + ' has an added_sessions entry that is not exactly {kind: text|null, type: text|null}: ' + JSON.stringify(a) + '.');
      }
    }
    if (seen.has(s.id)) cannot(TRUTH_RPC + ' listed series ' + s.id + ' twice.');
    seen.add(s.id);
    if (!MEASURED_STATUSES.includes(s.lifecycle_status)) {
      cannot(TRUTH_RPC + ' returned series ' + s.id + ' with lifecycle_status ' + JSON.stringify(s.lifecycle_status) + ', outside the ' + MEASURED_STATUSES.join('/') + ' scope it promises -- an anon-callable RPC exposing unpublished series is a privacy regression, fix the RPC.');
    }
    if (!isNullOr(s.category, isText) || !isNullOr(s.format, isText) || !isText(s.name)
        || !isNullOr(s.course_total_sessions, Number.isInteger)) {
      cannot(TRUTH_RPC + ' series ' + s.id + ' has a field of the wrong type: ' + JSON.stringify({ name: s.name, category: s.category, format: s.format, course_total_sessions: s.course_total_sessions }) + '.');
    }
    sections += s.section_kinds.length;
    items += s.items.length;
    added += s.added_sessions.length;
  }
  if (series.length !== payload.series_count || sections !== payload.section_count || items !== payload.item_count
      || added !== payload.added_session_count) {
    cannot(
      TRUTH_RPC + ' payload is incomplete: ' + series.length + '/' + JSON.stringify(payload.series_count) + ' series, ' +
        sections + '/' + JSON.stringify(payload.section_count) + ' sections, ' + items + '/' + JSON.stringify(payload.item_count) + ' items, ' +
        added + '/' + JSON.stringify(payload.added_session_count) + ' date-only sessions' +
        (payload.added_session_count === undefined ? '. ' + ADMIN_780_FIRST + ' (added_session_count is REQUIRED since P3).' : '.'),
    );
  }
  return series;
}

/**
 * A reader's rows, asserted to carry the join key and boolean flags. Without
 * this a renamed column turns every key into "undefined" and the comparison
 * pairs unrelated events, or compares undefined against a boolean.
 */
export function assertReaderRows(label, rows) {
  for (const row of rows) {
    if (!row || typeof row.occurrence_id !== 'string' || row.occurrence_id === ''
        || typeof row.has_class !== 'boolean' || typeof row.has_party !== 'boolean') {
      cannot(label + ' returned a row without an occurrence_id or with non-boolean has_class/has_party: ' + JSON.stringify(row && { occurrence_id: row.occurrence_id, has_class: row.has_class, has_party: row.has_party }) + '.');
    }
  }
  return rows;
}

/** How a series reads in the log. assertTruthPayload has already proved the name is text. */
const label = (s) => JSON.stringify(s.name);

/**
 * The committed baseline, asserted well-formed. Each list is an object of
 * id -> human name, so the file reads without a database. An EMPTY object is
 * valid (after repair); a MISSING key is not -- a missing key would make that
 * rule compare against nothing and pass every offender as "known".
 */
export function assertBaseline(cfg) {
  if (!cfg || typeof cfg !== 'object') cannot('event-truth-baseline.json did not parse to an object.');
  if (typeof cfg.recorded_on !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(cfg.recorded_on)) {
    cannot('event-truth-baseline.json recorded_on must be a YYYY-MM-DD date; the ratchet is dated so a reader knows how old the debt is.');
  }
  const ids = {};
  for (const key of ['category_drift', 'course_without_length']) {
    const block = cfg[key];
    if (!block || typeof block !== 'object' || Array.isArray(block)) {
      cannot('event-truth-baseline.json has no ' + key + ' object; without it that rule would compare against nothing and call every offender known.');
    }
    for (const [id, name] of Object.entries(block)) {
      if (!/^[0-9a-f-]{36}$/.test(id) || typeof name !== 'string' || name === '') {
        cannot('event-truth-baseline.json ' + key + ' entry ' + JSON.stringify(id) + ' is not a uuid -> name pair.');
      }
    }
    ids[key] = Object.keys(block);
  }
  return { recordedOn: cfg.recorded_on, ids };
}

// ---------------------------------------------------------------------------
// Data. Thin; every PostgREST error is a throw -- there is no response this
// guard is willing to read as "measured nothing, all good". Reads go through
// rpcWithRetry: a transient error (57014 on a cold instance) is retried, and
// one that persists is still exit 2, never a pass.
// ---------------------------------------------------------------------------

export function makeSupabaseSource({ url, key, createClientImpl = createClient, retry = {} }) {
  const sb = createClientImpl(url, key, { auth: { persistSession: false, autoRefreshToken: false } });

  const call = async (fn, args) => {
    try {
      return await rpcWithRetry(sb, fn, args, retry);
    } catch (error) {
      cannot(fn + ' failed: ' + (error && error.message) + (error && error.transient ? ' (transient, retries exhausted)' : ''));
    }
  };
  const rows = async (fn, args) => {
    const data = await call(fn, args);
    if (!Array.isArray(data)) cannot(fn + ' returned no array.');
    return data;
  };

  return {
    /** The payload as returned; assertTruthPayload() judges it, so the canary can feed it any shape. */
    truth: () => call(TRUTH_RPC, {}),
    calendar: (from, to) =>
      rows('get_calendar_events_v2', { range_start: from, range_end: to, city_slug_param: CITY_SLUG }),
    latest: () => rows('get_latest_events_v2', { p_city_slug: CITY_SLUG, p_limit: LATEST_LIMIT }),
  };
}

// ---------------------------------------------------------------------------
// The check
// ---------------------------------------------------------------------------

const isoDay = (d) => d.toISOString().slice(0, 10);

/** Print one ratchet's verdict and push its failures. */
function reportRatchet(say, failures, rule, offenders, verdict) {
  for (const s of offenders) say('  ' + (verdict.fresh.includes(s.id) ? 'NEW   ' : 'known ') + s.id + ' ' + label(s) + (s.detail ? ' ' + s.detail : ''));
  if (verdict.departed.length > 0) {
    say('  ' + verdict.departed.length + ' baseline entr' + (verdict.departed.length === 1 ? 'y' : 'ies') + ' no longer measured (ended, archived, or no mapped programme; reported, not failed -- prune when convenient): ' + verdict.departed.join(', '));
  }
  if (verdict.fresh.length > 0) failures.push(rule + ': ' + verdict.fresh.length + ' NEW offender(s) not in event-truth-baseline.json');
  if (verdict.stale.length > 0) failures.push(rule + ': ' + verdict.stale.length + ' baseline entries are still measured and no longer offend -- remove them from event-truth-baseline.json (' + verdict.stale.join(', ') + ')');
}

/**
 * Measure prod and return a verdict. The source is injected so the canary can
 * drive every branch -- above all the failures.
 */
export async function runCheck({ source, baseline, now, log = console.log }) {
  const lines = [];
  const say = (text) => {
    lines.push(text);
    log(text);
  };
  const failures = [];

  // --- Programme-derived genre vs declared category (gated) ---
  const payload = await source.truth();
  const series = assertTruthPayload(payload);
  assertMeasured(series.length, 1, 'live series from ' + TRUTH_RPC + ' -- an empty list means the RPC measured nothing (lost SECURITY DEFINER, or its scope changed), not an empty calendar');
  // The floor is the SERIES programme, section_count >= 1 on its own (review A,
  // FIX-2). Date-only rows cannot stand in for it: 64 of 64 live series carry a
  // series programme today, so a broken day -> section join must read as
  // "measured nothing" (exit 2), never pass on date-only rows alone. A future
  // where every live series is organiser-created (date-only only) is a decision
  // to take then, not a floor to relax now. (assertTruthPayload has already
  // proved both counts are integers that match their arrays.)
  assertMeasured(payload.section_count, 1, 'series programme sections under live series -- the day -> section join read as empty (date-only sessions never stand in for it)');

  const withoutProgramme = [];
  const unmapped = [];
  const mapped = new Set();
  const drifting = [];
  for (const s of series) {
    if (s.section_kinds.length === 0 && s.added_sessions.length === 0) {
      withoutProgramme.push(s);
      continue;
    }
    const genres = deriveGenres(s.section_kinds, s.items.map((i) => i && i.type), s.added_sessions);
    if (genres.size === 0) {
      unmapped.push(s);
      continue;
    }
    mapped.add(s.id);
    if (!categoryAgrees(s.category, genres)) {
      drifting.push({ ...s, detail: 'category=' + s.category + ' format=' + s.format + ' sessions=' + [...genres].sort().join(',') });
    }
  }
  const drift = classifyAgainstBaseline(drifting.map((s) => s.id), baseline.ids.category_drift, mapped);
  say(
    'category_drift: ' + drifting.length + ' of ' + mapped.size + ' live series with a mapped programme disagree with their sessions ' +
      '(known ' + drift.known.length + ', NEW ' + drift.fresh.length + ', stale ' + drift.stale.length + ', departed ' + drift.departed.length +
      '; baseline recorded ' + baseline.recordedOn + ')',
  );
  reportRatchet(say, failures, 'category_drift', drifting, drift);
  if (withoutProgramme.length > 0) {
    say('  ' + withoutProgramme.length + ' live series have no programme at all (genre not set; reported, not drift): ' + withoutProgramme.map((s) => s.id).join(', '));
  }
  if (unmapped.length > 0) {
    say('  ' + unmapped.length + ' live series have only sessions that map to no genre (genre not set; reported, not drift): ' + unmapped.map((s) => s.id).join(', '));
  }

  // --- A course must say how long it is (gated) ---
  const noLength = series.filter((s) => s.format === 'course' && s.course_total_sessions === null);
  const course = classifyAgainstBaseline(noLength.map((s) => s.id), baseline.ids.course_without_length, new Set(series.map((s) => s.id)));
  say('course_without_length: ' + noLength.length + ' live courses with NULL course_total_sessions (known ' + course.known.length + ', NEW ' + course.fresh.length + ', stale ' + course.stale.length + ', departed ' + course.departed.length + ')');
  reportRatchet(say, failures, 'course_without_length', noLength, course);

  // --- How far the public readers disagree (reported, never gating) ---
  const from = isoDay(now);
  const to = isoDay(new Date(now.getTime() + HORIZON_DAYS * 86400000));
  const [calendar, latest] = await Promise.all([source.calendar(from, to), source.latest()]);
  assertReaderRows('get_calendar_events_v2', calendar);
  assertReaderRows('get_latest_events_v2', latest);
  assertMeasured(calendar.length, 1, 'get_calendar_events_v2 rows for ' + CITY_SLUG + ' ' + from + '..' + to);
  const readers = latestVsCalendar(calendar, latest);
  say(
    'reader_flags (reported, not gating): ' + readers.overlap + ' occurrence(s) shared by get_latest_events_v2 and get_calendar_events_v2 (' +
      calendar.length + ' calendar rows, ' + latest.length + ' latest rows); ' + readers.disagreements.length + ' disagree' +
      (readers.overlap === 0 ? ' -- compared NOTHING this run' : ''),
  );
  for (const d of readers.disagreements) {
    say('  ' + d.occurrence_id + ' calendar class=' + d.calendar.has_class + ' party=' + d.calendar.has_party + ' vs latest class=' + d.latest.has_class + ' party=' + d.latest.has_party);
  }

  // --- Reported only: series items AND date-only sessions, both {kind, type} ---
  const mismatches = kindTypeMismatches(series.flatMap((s) => [...s.items, ...s.added_sessions]));
  say('kind_vs_type (reported, not gating): ' + mismatches.length + ' programme item(s) or date-only session(s) whose type contradicts their section kind');

  return {
    code: failures.length > 0 ? 1 : 0,
    failures,
    counts: {
      liveSeries: series.length,
      drifting: drifting.length,
      driftFresh: drift.fresh.length,
      driftStale: drift.stale.length,
      withoutProgramme: withoutProgramme.length,
      unmapped: unmapped.length,
      courseWithoutLength: noLength.length,
      calendarRows: calendar.length,
      latestOverlap: readers.overlap,
      readerDisagreements: readers.disagreements.length,
      kindTypeMismatches: mismatches.length,
    },
    lines,
  };
}


// ---------------------------------------------------------------------------
// Canary (R4/R5). Every rule in BOTH directions from fixtures, and the exit
// codes driven through main() with each case pinning WHICH branch produced it.
// ---------------------------------------------------------------------------

/**
 * The check_event_truth_v1 payload a spec of TABLE rows implies -- the same
 * projection the RPC computes (live series only, sections reach a series through
 * its days, items carry their section's kind), so a fixture is written
 * as the tables look and the payload is derived, never hand-typed.
 */
export function truthPayload(spec = {}) {
  const days = spec.days ?? [];
  const sections = spec.sections ?? [];
  const items = spec.items ?? [];
  // Date-only sessions (event_occurrence_added_session_p5) reach a series
  // through its OCCURRENCE, not its programme days -- the P3 shape (#780).
  const occurrences = spec.occurrences ?? [];
  const addedSessions = spec.addedSessions ?? [];
  const live = (spec.series ?? []).filter((s) => s.lifecycle_status === 'live').map((s) => {
    const dayIds = new Set(days.filter((d) => d.series_id === s.id).map((d) => d.id));
    const own = sections.filter((x) => dayIds.has(x.day_id));
    const kindOf = new Map(own.map((x) => [x.id, x.kind]));
    const occIds = new Set(occurrences.filter((o) => o.series_id === s.id).map((o) => o.id));
    return {
      ...s,
      section_kinds: own.map((x) => x.kind),
      items: items.filter((i) => kindOf.has(i.section_id)).map((i) => ({ kind: kindOf.get(i.section_id), type: i.type })),
      added_sessions: addedSessions.filter((a) => occIds.has(a.occurrence_id)).map((a) => ({ kind: a.section_kind, type: a.type })),
    };
  });
  return {
    check: 'event_truth',
    series: live,
    series_count: live.length,
    section_count: live.reduce((n, s) => n + s.section_kinds.length, 0),
    item_count: live.reduce((n, s) => n + s.items.length, 0),
    added_session_count: live.reduce((n, s) => n + s.added_sessions.length, 0),
    measured_as: 'fixture',
  };
}


/** A fixture source. `truth` is derived from the table rows unless the spec
 *  overrides it with a raw payload; any call can throw. */
export function makeFixtureSource(spec = {}) {
  const fail = (label) => {
    if (spec.throws === label) cannot(label + ' failed: fixture');
  };
  return {
    truth: async () => { fail('truth'); return 'truth' in spec ? spec.truth : truthPayload(spec); },
    calendar: async () => { fail('calendar'); return spec.calendar ?? []; },
    latest: async () => { fail('latest'); return spec.latest ?? []; },
  };
}

const S1 = '11111111-1111-4111-8111-111111111111';
const S2 = '22222222-2222-4222-8222-222222222222';
const S3 = '33333333-3333-4333-8333-333333333333';
const OCC = (n) => ({ occurrence_id: 'occ-' + n, instance_date: '2026-10-20', has_class: true, has_party: true });

/** Two agreeing series (a night and a class), one calendar day both readers share. */
const cleanSpec = () => ({
  series: [
    { id: S1, name: 'A night', format: 'recurring', category: 'party', lifecycle_status: 'live', course_total_sessions: null },
    { id: S2, name: 'A course', format: 'course', category: 'class', lifecycle_status: 'live', course_total_sessions: 6 },
  ],
  days: [{ id: 'd1', series_id: S1 }, { id: 'd2', series_id: S2 }],
  sections: [{ id: 'sec1', day_id: 'd1', kind: 'party' }, { id: 'sec2', day_id: 'd2', kind: 'classes' }],
  items: [{ section_id: 'sec1', type: 'party' }, { section_id: 'sec2', type: 'class' }],
  calendar: [OCC(1), OCC(2)],
  latest: [OCC(1)],
});
const emptyBaseline = { recorded_on: '2026-10-12', category_drift: {}, course_without_length: {} };
const NOW = new Date('2026-10-12T12:00:00Z');

async function selfTest() {
  const cases = [];
  const add = (name, run, expected) => cases.push({ name, run, expected });

  // ONE classifier, by message needle, so a case asserting exit 2 also says WHY.
  const KINDS = [
    ['previewProbe: measured', 'measured-shortfall'],
    ['event-truth-baseline.json', 'bad-baseline'],
    ['failed: fixture', 'source-failed'],
    ['check_event_truth_v1', 'bad-payload'],
    ['occurrence_id or with non-boolean', 'bad-rows'],
  ];
  const classify = (error) => {
    for (const [needle, kind] of KINDS) if (String(error.message).includes(needle)) return kind;
    return 'unclassified: ' + String(error.message).slice(0, 90);
  };
  const check = (spec, baseline = emptyBaseline) =>
    runCheck({ source: makeFixtureSource(spec), baseline: assertBaseline(baseline), now: NOW, log: () => {} });
  const outcome = async (spec, baseline) => {
    try {
      const result = await check(spec, baseline);
      return result.code === 1 ? 'violated:' + result.failures.map((f) => f.split(':')[0]).join('+') : 'ok';
    } catch (error) {
      return classify(error);
    }
  };
  const says = async (spec, needle, baseline) => (await check(spec, baseline)).lines.some((l) => l.includes(needle));
  const setOf = (s) => [...s].sort().join(',');
  const withSpec = (edit) => { const spec = cleanSpec(); edit(spec); return spec; };

  // --- deriveGenres, both directions, with the readers' synonyms ---
  add('derive: a party section with no items is a party', () => setOf(deriveGenres(['party'], [])), 'party');
  add('derive: a social section is a party', () => setOf(deriveGenres(['social'], [])), 'party');
  add('derive: a social ITEM is a party (as get_latest_events_v2 counts it)', () => setOf(deriveGenres([], ['social'])), 'party');
  add('derive: classes section + workshop item is a class', () => setOf(deriveGenres(['classes'], ['workshop'])), 'class');
  add('derive: a masterclass item is a class AND a masterclass', () => setOf(deriveGenres([], ['masterclass'])), 'class,masterclass');
  add('derive: a masterclass section is a class AND a masterclass', () => setOf(deriveGenres(['masterclass'], [])), 'class,masterclass');
  add('derive: a night is party AND class', () => setOf(deriveGenres(['classes', 'party'], ['class', 'party'])), 'class,party');
  add('derive: unknown kinds and types say nothing', () => setOf(deriveGenres(['ceremony', 'showcase'], ['performance', 'show', null])), '');

  // --- categoryAgrees ---
  add('agrees: party over a party set', () => categoryAgrees('party', new Set(['party'])), true);
  add('agrees: party over a class-only set does NOT', () => categoryAgrees('party', new Set(['class'])), false);
  add('agrees: workshop counts as class', () => categoryAgrees('workshop', new Set(['class'])), true);
  add('agrees: class over masterclass-only sessions (the Classes tab lists it)', () => categoryAgrees('class', deriveGenres([], ['masterclass'])), true);
  add('agrees: class over a party-only set does NOT', () => categoryAgrees('class', new Set(['party'])), false);
  add('agrees: a NULL mirror under mapped sessions agrees with NOTHING (P3: the mirror is derived, so unset is wrong)', () => categoryAgrees(null, new Set(['party'])), false);
  add('agrees: a token outside the CHECK is a disagreement, not a skip', () => categoryAgrees('bogus', new Set(['party'])), false);

  // --- the ratchet, with scope ---
  add('ratchet: a new offender is fresh', () => classifyAgainstBaseline([S1, S2], [S1], new Set([S1, S2])).fresh.join(), S2);
  add('ratchet: a measured baseline id that no longer offends is stale', () => classifyAgainstBaseline([S1], [S1, S2], new Set([S1, S2])).stale.join(), S2);
  add('ratchet: an unmeasured baseline id departed, and is NOT stale', () => {
    const v = classifyAgainstBaseline([S1], [S1, S2], new Set([S1]));
    return v.departed.join() + '|' + v.stale.join();
  }, S2 + '|');
  add('ratchet: an unchanged offender is known', () => classifyAgainstBaseline([S1], [S1], new Set([S1])).known.join(), S1);

  // --- latest vs calendar (reported) ---
  add('readers: equal flags agree', () => latestVsCalendar([OCC(1)], [OCC(1)]).disagreements.length, 0);
  add('readers: a has_class flip disagrees', () => latestVsCalendar([OCC(1)], [{ ...OCC(1), has_class: false }]).disagreements.length, 1);
  add('readers: a has_party flip disagrees', () => latestVsCalendar([OCC(1)], [{ ...OCC(1), has_party: false }]).disagreements.length, 1);
  add('readers: a row only one reader returns is not compared', () => latestVsCalendar([OCC(1)], [OCC(2)]).overlap, 0);
  // Three days: classes, then the party, then a closing day with neither -- so a
  // "last day wins" aggregation on EITHER flag disagrees, not only on one.
  add('readers: a festival with its party on day 2 agrees with series-wide latest', () => latestVsCalendar(
    [{ ...OCC(1), has_party: false }, { ...OCC(1), instance_date: '2026-10-21', has_class: false },
      { ...OCC(1), instance_date: '2026-10-22', has_class: false, has_party: false }],
    [OCC(1)]).disagreements.length, 0);
  add('readers: latest dated in UTC still joins the calendar row', () => latestVsCalendar([OCC(1)], [{ ...OCC(1), instance_date: '2026-10-19' }]).overlap, 1);
  add('readers: a duplicated calendar day does not inflate the overlap', () => latestVsCalendar([OCC(1), OCC(1)], [OCC(1)]).overlap, 1);

  // --- kind vs type (over the RPC's {kind, type} pairs) ---
  add('kind/type: a class item in a party section mismatches', () => kindTypeMismatches([{ kind: 'party', type: 'class' }]).length, 1);
  add('kind/type: a workshop item in a classes section is fine', () => kindTypeMismatches([{ kind: 'classes', type: 'workshop' }]).length, 0);
  add('kind/type: a masterclass item in a classes section is fine', () => kindTypeMismatches([{ kind: 'classes', type: 'masterclass' }]).length, 0);
  add('kind/type: a social item in a party section is fine', () => kindTypeMismatches([{ kind: 'party', type: 'social' }]).length, 0);
  add('kind/type: a NULL item type contradicts nothing', () => kindTypeMismatches([{ kind: 'party', type: null }]).length, 0);

  // --- the whole check over fixtures: gated rules ---
  add('check: clean fixture passes', () => outcome(cleanSpec()), 'ok');
  add('check: a course of classes declared party is NEW drift', () => outcome(withSpec((s) => { s.series[1].category = 'party'; })), 'violated:category_drift');
  add('check: the same drift listed in the baseline is known and passes', () => outcome(withSpec((s) => { s.series[1].category = 'party'; }), { ...emptyBaseline, category_drift: { [S2]: 'A course' } }), 'ok');
  add('check: a measured baseline entry that no longer drifts is STALE and fails', () => outcome(cleanSpec(), { ...emptyBaseline, category_drift: { [S2]: 'A course' } }), 'violated:category_drift');
  add('check: a baseline drift id whose series ended is reported, not failed', () => outcome(withSpec((s) => { s.series.pop(); }), { ...emptyBaseline, category_drift: { [S2]: 'A course' } }), 'ok');
  add('check: ...and the departure is printed', () => says(withSpec((s) => { s.series.pop(); }), 'no longer measured', { ...emptyBaseline, category_drift: { [S2]: 'A course' } }), true);
  add('check: a baseline drift id that lost its programme is not stale', () => outcome(withSpec((s) => { s.days.pop(); }), { ...emptyBaseline, category_drift: { [S2]: 'A course' } }), 'ok');
  add('check: a class series of masterclasses only is not drift', () => outcome(withSpec((s) => { s.sections[1].kind = 'masterclass'; s.items[1].type = 'masterclass'; })), 'ok');
  add('check: a series with no programme is reported, not drift', () => outcome(withSpec((s) => {
    s.series.push({ id: S3, name: 'Draft', format: 'recurring', category: 'class', lifecycle_status: 'live', course_total_sessions: null });
  })), 'ok');
  add('check: a party series of showcase sessions only is reported, not drift', () => outcome(withSpec((s) => { s.sections[0].kind = 'showcase'; s.items[0].type = 'show'; })), 'ok');
  add('check: ...and printed as genre not set', () => says(withSpec((s) => { s.sections[0].kind = 'showcase'; s.items[0].type = 'show'; }), 'map to no genre'), true);
  add('check: a live course with no length is NEW', () => outcome(withSpec((s) => { s.series[1].course_total_sessions = null; })), 'violated:course_without_length');
  add('check: a one_off with no course length is not a course', () => outcome(withSpec((s) => { s.series[1].format = 'one_off'; s.series[1].course_total_sessions = null; })), 'ok');
  add('check: a paused course with no length is outside the RPC, so not gated', () => outcome(withSpec((s) => { s.series[1].course_total_sessions = null; s.series[1].lifecycle_status = 'paused'; })), 'ok');
  add('check: a baseline course that got its length is STALE', () => outcome(cleanSpec(), { ...emptyBaseline, course_without_length: { [S2]: 'A course' } }), 'violated:course_without_length');
  add('check: a baseline course that was paused is departed, not stale', () => outcome(withSpec((s) => { s.series[1].course_total_sessions = null; s.series[1].lifecycle_status = 'paused'; }), { ...emptyBaseline, course_without_length: { [S2]: 'A course' } }), 'ok');
  add('check: ...and the course departure is printed', () => says(withSpec((s) => { s.series[1].course_total_sessions = null; s.series[1].lifecycle_status = 'paused'; }), 'no longer measured', { ...emptyBaseline, course_without_length: { [S2]: 'A course' } }), true);
  add('check: kind/type mismatches alone never gate', () => outcome(withSpec((s) => { s.items.push({ section_id: 'sec1', type: 'class' }); })), 'ok');

  // --- the whole check: the reader report never gates ---
  add('check: calendar and latest disagreeing is REPORTED, never gating', () => outcome({ ...cleanSpec(), latest: [{ ...OCC(1), has_party: false }] }), 'ok');
  add('check: ...and the disagreement is printed', () => says({ ...cleanSpec(), latest: [{ ...OCC(1), has_party: false }] }, 'occ-1 calendar class=true party=true vs latest class=true party=false'), true);
  add('check: zero overlap with latest is printed as comparing nothing, not exit 2', () => says({ ...cleanSpec(), latest: [] }, 'compared NOTHING'), true);
  add('check: a reader row with no occurrence_id is exit 2', () => outcome({ ...cleanSpec(), calendar: [{ ...OCC(1), occurrence_id: undefined }] }), 'bad-rows');
  add('check: a latest row with a NULL flag is exit 2', () => outcome({ ...cleanSpec(), latest: [{ ...OCC(1), has_party: null }] }), 'bad-rows');

  // --- THE LOAD-BEARING ASSERTIONS, both directions ---
  add('measured: an EMPTY open-series list is exit 2, never a green 0', () => outcome({ ...cleanSpec(), series: [] }), 'measured-shortfall');
  add('measured: series with no programme rows at all is exit 2', () => outcome({ ...cleanSpec(), sections: [] }), 'measured-shortfall');
  add('measured: an empty calendar is exit 2', () => outcome({ ...cleanSpec(), calendar: [] }), 'measured-shortfall');
  add('measured: a failing reader is exit 2, not a pass over the rest', () => outcome({ ...cleanSpec(), throws: 'latest' }), 'source-failed');
  add('baseline: a missing block is exit 2', () => outcome(cleanSpec(), { recorded_on: '2026-10-12', category_drift: {} }), 'bad-baseline');
  add('baseline: an undated file is exit 2', () => outcome(cleanSpec(), { category_drift: {}, course_without_length: {} }), 'bad-baseline');
  add('baseline: a non-uuid key is exit 2', () => outcome(cleanSpec(), { ...emptyBaseline, category_drift: { nope: 'x' } }), 'bad-baseline');
  add('baseline: the SHIPPED file parses and is well-formed', () => assertBaseline(JSON.parse(readFileSync(BASELINE_PATH, 'utf8'))).recordedOn.length, 10);

  // --- the RPC payload is judged before any rule reads it ---
  const truthWith = (edit) => { const p = truthPayload(cleanSpec()); edit(p); return outcome({ ...cleanSpec(), truth: p }); };
  add('payload: the fixture projection is complete', () => assertTruthPayload(truthPayload(cleanSpec())).length, 2);
  add('payload: the fixture projection leaves a paused series out, as the RPC does', () => truthPayload(withSpec((s) => { s.series[0].lifecycle_status = 'paused'; })).series.map((s) => s.id).join(), S2);
  add('payload: null is exit 2', () => outcome({ ...cleanSpec(), truth: null }), 'bad-payload');
  add('payload: an array instead of an object is exit 2', () => outcome({ ...cleanSpec(), truth: [] }), 'bad-payload');
  add('payload: a missing series array is exit 2', () => truthWith((p) => { delete p.series; }), 'bad-payload');
  add('payload: a series total arriving as a string is exit 2', () => truthWith((p) => { p.series_count = '2'; }), 'bad-payload');
  add('payload: a NULL item total is exit 2, not 0 items', () => truthWith((p) => { p.item_count = null; }), 'bad-payload');
  add('payload: an array shorter than its total is exit 2', () => truthWith((p) => { p.series_count = 3; }), 'bad-payload');
  add('payload: section kinds short of their total is exit 2', () => truthWith((p) => { p.section_count = 3; }), 'bad-payload');
  add('payload: items short of their total is exit 2', () => truthWith((p) => { p.item_count = 3; }), 'bad-payload');
  add('payload: an entry with no section_kinds is exit 2', () => truthWith((p) => { delete p.series[0].section_kinds; }), 'bad-payload');
  add('payload: a series listed twice (totals consistent) is exit 2', () => truthWith((p) => {
    p.series.push(p.series[0]);
    p.series_count += 1;
    p.section_count += p.series[0].section_kinds.length;
    p.item_count += p.series[0].items.length;
  }), 'bad-payload');
  add('payload: a course length of "" is exit 2, not "has a length"', () => truthWith((p) => { p.series[1].course_total_sessions = ''; }), 'bad-payload');
  add('payload: a non-text category is exit 2', () => truthWith((p) => { p.series[0].category = 5; }), 'bad-payload');
  add('payload: a NULL name is exit 2 (the RPC promises one for every live series)', () => truthWith((p) => { p.series[0].name = null; }), 'bad-payload');
  add('payload: a PAUSED series in the payload is exit 2 (anon must not see it)', () => truthWith((p) => { p.series[0].lifecycle_status = 'paused'; }), 'bad-payload');
  add('payload: a pending_review series in the payload is exit 2', () => truthWith((p) => { p.series[0].lifecycle_status = 'pending_review'; }), 'bad-payload');
  add('payload: the pre-rename keys (open_series) are exit 2, not an empty pass', () => truthWith((p) => { p.open_series = p.series; p.open_series_count = p.series_count; delete p.series; delete p.series_count; }), 'bad-payload');
  add('payload: the RPC failing is exit 2', () => outcome({ ...cleanSpec(), throws: 'truth' }), 'source-failed');
  add('label: a drifting live series prints its name', () => says(withSpec((s) => { s.series[1].category = 'party'; }), S2 + ' "A course"'), true);

  // --- date-only sessions (P3, admin #780): a series with NO series programme and
  // its sessions on the occurrence is what the organiser create writes ---
  add('derive: a date-only class session (by kind) is a class', () => setOf(deriveGenres([], [], [{ kind: 'class', type: null }])), 'class');
  add('derive: a date-only party by TYPE alone (kind null) is a party', () => setOf(deriveGenres([], [], [{ kind: null, type: 'party' }])), 'party');
  add('derive: a date-only masterclass type is a class AND a masterclass', () => setOf(deriveGenres([], [], [{ kind: 'classes', type: 'masterclass' }])), 'class,masterclass');
  add('derive: a date-only null/null session says nothing', () => setOf(deriveGenres([], [], [{ kind: null, type: null }])), '');
  add('derive: date-only performance / showcase say nothing', () => setOf(deriveGenres([], [], [{ kind: 'showcase', type: 'performance' }])), '');
  add('derive: series classes plus a date-only party is the UNION', () => setOf(deriveGenres(['classes'], ['class'], [{ kind: 'party', type: 'party' }])), 'class,party');
  /** cleanSpec plus a third LIVE series with no programme day and ONE date-only session. */
  const dateOnly = (kind, type, stored) => withSpec((s) => {
    s.series.push({ id: S3, name: 'Date-only', format: 'one_off', category: stored, lifecycle_status: 'live', course_total_sessions: null });
    s.occurrences = [{ id: 'occ-3', series_id: S3 }, { id: 'occ-1', series_id: S1 }];
    s.addedSessions = [{ occurrence_id: 'occ-3', section_kind: kind, type }];
  });
  add('payload: the fixture projection carries a date-only session to its series, and counts it', () => {
    const p = truthPayload(dateOnly('class', null, 'class'));
    return p.series.find((s) => s.id === S3).added_sessions.map((a) => a.kind + '/' + a.type).join() + ':' + p.added_session_count + ':' + p.series.find((s) => s.id === S1).added_sessions.length;
  }, 'class/null:1:0');
  add('check: no series programme + one date-only class session, stored party, is NEW drift', () => outcome(dateOnly('class', null, 'party')), 'violated:category_drift');
  add('check: ...stored class is no drift', () => outcome(dateOnly('class', null, 'class')), 'ok');
  add('check: ...and it is NOT reported as having no programme', () => says(dateOnly('class', null, 'class'), 'no programme at all'), false);
  add('check: a date-only party by type alone, stored party, is no drift', () => outcome(dateOnly(null, 'party', 'party')), 'ok');
  add('check: date-only performance / showcase only is genre not set, not drift', () => outcome(dateOnly('showcase', 'performance', 'class')), 'ok');
  add('check: ...and printed as genre not set', () => says(dateOnly('showcase', 'performance', 'class'), 'map to no genre'), true);
  add('check: a NULL mirror under a date-only class session is NEW drift (unset is not "not set")', () => outcome(dateOnly('class', null, null)), 'violated:category_drift');
  add('measured: section_count 0 with date-only sessions only is exit 2 (the series-programme floor stands on its own; date-only rows never stand in for it)', () => outcome({ ...dateOnly('class', null, 'class'), sections: [], items: [] }), 'measured-shortfall');
  add('kind/type: a date-only session whose type contradicts its section_kind is in the report (series items alone would say 0)', () => says(dateOnly('party', 'class', 'party'), 'kind_vs_type (reported, not gating): 1 '), true);
  add('kind/type: ...and a date-only mismatch still never gates', () => outcome(dateOnly('party', 'class', 'party')), 'ok');
  add('payload: added_session_count off by one is exit 2', () => truthWith((p) => { p.added_session_count += 1; }), 'bad-payload');
  add('payload: added_session_count arriving as a string is exit 2', () => truthWith((p) => { p.added_session_count = String(p.added_session_count); }), 'bad-payload');
  add('payload: a NULL added_session_count is exit 2, not 0 sessions', () => truthWith((p) => { p.added_session_count = null; }), 'bad-payload');
  add('payload: a series with no added_sessions key is exit 2 (fail closed)', () => truthWith((p) => { delete p.series[0].added_sessions; }), 'bad-payload');
  add('payload: the P0 shape (no added_sessions, no added_session_count) is exit 2, never a pass', () => truthWith((p) => { delete p.added_session_count; for (const s of p.series) delete s.added_sessions; }), 'bad-payload');
  add('payload: added_sessions that is not an array is exit 2', () => truthWith((p) => { p.series[0].added_sessions = {}; }), 'bad-payload');
  add('payload: an added session with a non-text kind is exit 2', () => truthWith((p) => { p.series[0].added_sessions = [{ kind: 5, type: null }]; p.added_session_count = 1; }), 'bad-payload');
  add('payload: an added session with a non-text type is exit 2', () => truthWith((p) => { p.series[0].added_sessions = [{ kind: null, type: true }]; p.added_session_count = 1; }), 'bad-payload');
  add('payload: an added session missing its type key is exit 2', () => truthWith((p) => { p.series[0].added_sessions = [{ kind: 'class' }]; p.added_session_count = 1; }), 'bad-payload');
  add('payload: an added session with an extra key is exit 2 (exactly kind and type)', () => truthWith((p) => { p.series[0].added_sessions = [{ kind: 'class', type: null, level: 'x' }]; p.added_session_count = 1; }), 'bad-payload');
  add('payload: a null added session entry is exit 2', () => truthWith((p) => { p.series[0].added_sessions = [null]; p.added_session_count = 1; }), 'bad-payload');

  // --- PARITY with the canonical lib (src/lib/eventCategory.ts). The SAME file
  // drives src/lib/__tests__/eventCategory.parity.test.ts; a mapping edited on
  // one side only reds that side only. ---
  const parity = JSON.parse(readFileSync(PARITY_PATH, 'utf8'));
  add('parity: the corpus holds at least 15 cases', () => Array.isArray(parity.cases) && parity.cases.length >= 15, true);
  const GENRE_ORDER = ['party', 'class', 'masterclass'];
  for (const c of parity.cases) {
    add('parity: ' + c.name, () => {
      const genres = deriveGenres(c.sectionKinds, c.itemTypes, c.addedSessions);
      return GENRE_ORDER.filter((g) => genres.has(g)).join(',') + '|' + categoryAgrees(c.stored, genres);
    }, c.expect.set.join(',') + '|' + c.expect.agrees);
  }

  // --- the real source adapter, over a fake client: retry, then exit 2 ---
  const fakeClient = (answers) => {
    const calls = [];
    return { calls, make: () => ({ rpc: async (fn) => { calls.push(fn); return answers.length > 1 ? answers.shift() : answers[0]; } }) };
  };
  const adapter = (fake) => makeSupabaseSource({ url: 'u', key: 'k', createClientImpl: fake.make, retry: { sleep: async () => {} } });
  add('source: a cold-instance 57014 is retried, then the payload is returned', async () => {
    const fake = fakeClient([{ data: null, error: { code: '57014', message: 'canceling statement due to statement timeout' } }, { data: { ok: 1 }, error: null }]);
    const data = await adapter(fake).truth();
    return data.ok + ':' + fake.calls.length;
  }, '1:2');
  add('source: a 57014 that persists is exit 2, never a pass', () => adapter(fakeClient([{ data: null, error: { code: '57014', message: 'timeout' } }])).truth().then(() => 'passed', (e) => (e instanceof CannotMeasure && /transient/.test(e.message) ? 'cannot' : 'other: ' + e.message)), 'cannot');
  add('source: a missing RPC (PGRST202) is exit 2 at once, not retried', async () => {
    const fake = fakeClient([{ data: null, error: { code: 'PGRST202', message: 'Could not find the function' } }]);
    const got = await adapter(fake).truth().then(() => 'passed', (e) => (e instanceof CannotMeasure ? 'cannot' : 'other'));
    return got + ':' + fake.calls.length;
  }, 'cannot:1');
  add('source: a reader returning no array is exit 2', () => adapter(fakeClient([{ data: { not: 'rows' }, error: null }])).latest().then(() => 'passed', (e) => (e instanceof CannotMeasure ? 'cannot' : 'other')), 'cannot');

  // --- THE EXIT-CODE CONTRACT ITSELF (R3), driven through main() ---
  // Sealed: no creds, no env files, no network, no output, a baseline that
  // parses. Each case opens exactly the path it proves, and pins the branch by
  // the stderr needle -- with an empty env an unknown flag and a missing key
  // both return 2.
  const sealed = {
    env: {},
    readEnvFiles: () => ({}),
    out: () => {},
    err: () => {},
    makeSource: () => { throw new Error('the canary reached the real network -- inject makeSource'); },
    readBaseline: () => JSON.stringify(emptyBaseline),
    clock: () => NOW,
  };
  const CREDS = { VITE_SUPABASE_URL: 'https://x.supabase.co', VITE_SUPABASE_PUBLISHABLE_KEY: 'k' };
  const runMain = async (argv, extra) => {
    const errs = [];
    const code = await main(argv, { ...sealed, err: (m) => errs.push(String(m)), ...extra });
    return { code, errs: errs.join('\n') };
  };
  const pin = (needle) => (r) => r.code + (r.errs.includes(needle) ? ':' + needle : ':other');
  const clean = () => makeFixtureSource(cleanSpec());
  add('exit: unknown flag is 2 from the FLAG branch (creds present)', () => runMain(['--nope'], { env: CREDS, makeSource: clean }).then(pin('Unknown flag')), '2:Unknown flag');
  add('exit: missing creds is 2 from the CREDS branch (source would pass)', () => runMain([], { makeSource: clean }).then(pin('VITE_SUPABASE_URL')), '2:VITE_SUPABASE_URL');
  add('exit: creds that only the env files hold are used', () => runMain([], { readEnvFiles: () => CREDS, makeSource: clean }).then((r) => r.code), 0);
  add('exit: the real environment wins over the env files', async () => {
    let seen = null;
    await runMain([], { env: CREDS, readEnvFiles: () => ({ VITE_SUPABASE_URL: 'https://from-file.supabase.co', VITE_SUPABASE_PUBLISHABLE_KEY: 'f' }), makeSource: (cfg) => { seen = cfg.url; return clean(); } });
    return seen;
  }, CREDS.VITE_SUPABASE_URL);
  add('exit: unreadable baseline is 2 from the BASELINE branch', () => runMain([], { env: CREDS, makeSource: clean, readBaseline: () => { throw new Error('ENOENT'); } }).then(pin('event-truth-baseline.json')), '2:event-truth-baseline.json');
  add('exit: malformed baseline is 2 from the BASELINE branch', () => runMain([], { env: CREDS, makeSource: clean, readBaseline: () => '{"category_drift":{}}' }).then(pin('event-truth-baseline.json')), '2:event-truth-baseline.json');
  add('exit: a clean measurement is 0', () => runMain([], { env: CREDS, makeSource: clean }).then((r) => r.code), 0);
  add('exit: a violated contract is 1 from the VERDICT branch', () => runMain([], { env: CREDS, makeSource: () => makeFixtureSource(withSpec((s) => { s.series[1].category = 'party'; })) }).then(pin('EVENT TRUTH VIOLATED')), '1:EVENT TRUTH VIOLATED');
  add('exit: a measurement failure is 2 from the CANNOT-MEASURE branch', () => runMain([], { env: CREDS, makeSource: () => makeFixtureSource({ ...cleanSpec(), series: [] }) }).then(pin('could not measure')), '2:could not measure');
  add('exit: a malformed RPC payload is 2 from the CANNOT-MEASURE branch', () => runMain([], { env: CREDS, makeSource: () => makeFixtureSource({ ...cleanSpec(), truth: { series: [] } }) }).then(pin('could not measure')), '2:could not measure');
  // FIX-6 F-a: until admin #780 is applied, prod answers with the P0 payload (no added_sessions)
  // and a mirror nobody re-derived. Both reds must say, in plain words, what has to happen first.
  const P0_TRUTH = () => { const p = truthPayload(cleanSpec()); delete p.added_session_count; for (const s of p.series) delete s.added_sessions; return p; };
  add('exit: the P0 payload (admin #780 not applied) names #780 as the step to take first', () => runMain([], { env: CREDS, makeSource: () => makeFixtureSource({ ...cleanSpec(), truth: P0_TRUTH() }) }).then(pin('admin #780 (derived category) must be applied first')), '2:admin #780 (derived category) must be applied first');
  add('exit: a P0 payload with no series names #780 too (the totals branch)', () => runMain([], { env: CREDS, makeSource: () => makeFixtureSource({ ...cleanSpec(), truth: { ...P0_TRUTH(), series: [], series_count: 0, section_count: 0, item_count: 0 } }) }).then(pin('admin #780 (derived category) must be applied first')), '2:admin #780 (derived category) must be applied first');
  // FIX-7 #6: drift on a payload that HAS the P3 shape is a real mirror fault; the #780 hint is only
  // for the P0 payload (no added_sessions / added_session_count), which stops in CANNOT-MEASURE above.
  add('exit: category drift on a P3 payload does NOT blame #780', () => runMain([], { env: CREDS, makeSource: () => makeFixtureSource(withSpec((s) => { s.series[1].category = 'party'; })) }).then(pin('admin #780')), '1:other');
  add('exit: a series with no id but WITH added_sessions does NOT blame #780', () => runMain([], { env: CREDS, makeSource: () => makeFixtureSource({ ...cleanSpec(), truth: (() => { const p = truthPayload(cleanSpec()); delete p.series[0].id; return p; })() }) }).then(pin('admin #780')), '2:other');
  add('exit: a course with no length does NOT blame #780 (it is not a mirror fault)', () => runMain([], { env: CREDS, makeSource: () => makeFixtureSource(withSpec((s) => { s.series[1].course_total_sessions = null; })) }).then(pin('admin #780')), '1:other');

  let failed = 0;
  for (const c of cases) {
    let got;
    try {
      got = await c.run();
    } catch (error) {
      got = 'threw: ' + String(error && error.message);
    }
    const ok = got === c.expected;
    if (!ok) failed += 1;
    console.log((ok ? 'PASS ' : 'FAIL ') + c.name + (ok ? '' : ' -- expected ' + JSON.stringify(c.expected) + ', got ' + JSON.stringify(got)));
  }
  console.log('check-event-truth-v1 --self-test: ' + (cases.length - failed) + '/' + cases.length + ' passed');
  return failed === 0;
}

// ---------------------------------------------------------------------------
// Entry
// ---------------------------------------------------------------------------

/**
 * The exit owner. Collaborators are injected so the canary can drive every
 * branch with no key, no network and no filesystem; the defaults are the real
 * thing. Returns the exit code; the dispatch below assigns it.
 */
export async function main(argv = [], deps = {}) {
  const {
    env: baseEnv = process.env,
    readEnvFiles = () => readEnvDirs([ROOT]),
    makeSource = makeSupabaseSource,
    readBaseline = () => readFileSync(BASELINE_PATH, 'utf8'),
    clock = () => new Date(),
    out = console.log,
    err = console.error,
  } = deps ?? {};
  const KNOWN_FLAGS = ['--self-test'];
  const unknown = argv.filter((arg) => !KNOWN_FLAGS.includes(arg));
  if (unknown.length > 0) {
    err('Unknown flag(s): ' + unknown.join(', ') + '. Known: ' + KNOWN_FLAGS.join(', '));
    return 2;
  }
  if (argv.includes('--self-test')) return (await selfTest()) ? 0 : 1;

  // The shared reader: .env, .env.local, .env.development at the repo root,
  // first non-blank per name, and a real environment variable always wins.
  const sources = [baseEnv, readEnvFiles()];
  const url = firstValue(sources, 'VITE_SUPABASE_URL', 'SUPABASE_URL');
  const key = firstValue(sources, 'VITE_SUPABASE_PUBLISHABLE_KEY', 'SUPABASE_PUBLISHABLE_KEY', 'SUPABASE_ANON_KEY');
  if (!url || !key) {
    err('Missing VITE_SUPABASE_URL or VITE_SUPABASE_PUBLISHABLE_KEY -- this guard reads prod and cannot run without them (exit 2, never a green 0).');
    return 2;
  }

  let baseline;
  try {
    baseline = assertBaseline(JSON.parse(readBaseline()));
  } catch (error) {
    err('event-truth-baseline.json could not be read or is malformed: ' + (error && error.message) + '. Without the ratchet file the drift rule has nothing to compare against.');
    return 2;
  }

  try {
    const result = await runCheck({ source: makeSource({ url, key }), baseline, now: clock(), log: out });
    if (result.code !== 0) {
      // Only a P0 payload (no added_sessions / added_session_count) means #780 is not applied,
      // and that stops in CANNOT-MEASURE with the hint; drift here is a real fault (FIX-7 #6).
      err('\nEVENT TRUTH VIOLATED:\n  - ' + result.failures.join('\n  - ') +
        '\nSee the breakdown above and docs/event-truth-table.md.');
      return 1;
    }
    out('\nevent truth: ok (' + result.counts.liveSeries + ' live series, ' + result.counts.drifting + ' known drift; reported: ' + result.counts.readerDisagreements + ' reader disagreements over ' + result.counts.latestOverlap + ' shared occurrences, ' + result.counts.kindTypeMismatches + ' kind/type mismatches).');
    return 0;
  } catch (error) {
    if (error instanceof CannotMeasure || /previewProbe: measured/.test(String(error && error.message))) {
      err('event truth: could not measure -- ' + error.message);
      return 2;
    }
    err('event truth: could not measure -- unexpected error: ' + (error && error.stack ? error.stack : String(error)));
    return 2;
  }
}

if (isEntryPoint(import.meta.url)) {
  // process.exitCode, never process.exit() after printing: on Linux CI a
  // process.exit truncates buffered stdout.
  process.exitCode = await main(process.argv.slice(2));
}

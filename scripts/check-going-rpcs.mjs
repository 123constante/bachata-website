#!/usr/bin/env node
/**
 * check-going-rpcs.mjs -- the live contract of the four "I'm going" RPCs the
 * Website reads (Going P2; database side is admin Going P1, migrations
 * 20261204520000 / 20261204530000, handover docs/handovers/going-p1-db.md).
 *
 * Called AS ANON, the only executor db-contract-check.yml holds:
 *
 *   get_nights_going_v1(p_occurrence_ids, p_limit)
 *     - top level is an array; each row has EXACTLY {occurrence_id, going_count, people}
 *     - every returned occurrence_id was one we asked for
 *     - going_count is an integer >= 0, people.length <= p_limit and <= going_count
 *     - each person has EXACTLY {dancer_profile_id, first_name, photo_url};
 *       dancer_profile_id is a uuid or null, photo_url a string or null, and a
 *       person with no public page (null id) never carries a photo
 *     - p_limit 0 is refused with `invalid_argument`; 201 ids with `too_many_ids`
 *       (the live function's message -- the brief's copy of the interface said
 *       invalid_argument for this case; the function body is the authority)
 *   get_public_dancer_extras_v1(p_profile_id)
 *     - an unknown id returns null (the hidden-page answer)
 *     - a public profile returns EXACTLY {bio, languages, whatsapp, going_next};
 *       going_next has at most 3 entries of EXACTLY {occurrence_id, public_event_id,
 *       event_title, occurrence_date, starts_at_local}, starts_at_local a zone-less
 *       London wall clock (YYYY-MM-DDTHH:MM:SS)
 *   set_my_going_v1 / get_my_going_v1 / get_my_event_going_v1 (Going P3, organiser read)
 *     - refused for anon: either no EXECUTE grant (42501, today's prod) or the
 *       function's own not_signed_in / anonymous_session. Data must be null.
 *
 * And everywhere, at every depth: no key that names an account (user_id, auth_uid,
 * created_by, claimed_by, account_id, uid). Going lists dancer PROFILES, never the
 * auth user behind them.
 *
 * SIGNED-IN SHAPES ARE NOT CHECKED HERE, and the run says so on every pass. The
 * workflow holds only the anon publishable key; there is no signed-in test account
 * to call set_my_going_v1 / get_my_going_v1 with. That half is a printed SKIP with
 * its reason, never a pass.
 *
 * REAL IDS, NOT INVENTED ONES. get_calendar_events_v2's occurrence_id is
 * COALESCE(legacy_occurrence_id, p5 id) -- for most nights a LEGACY id, which
 * get_nights_going_v1 silently drops (it joins event_occurrence_p5). So the sample
 * goes calendar -> event_view_p5(snapshot_compat) -> its P5 occurrence ids, the
 * same ids the event page holds. NON-VACUITY IS ASSERTED: no ids, no rows back, or
 * no public profile to read is exit 2, not a green that looked at nothing.
 *
 * Local:  node scripts/check-going-rpcs.mjs            (reads .env when present)
 *         node scripts/check-going-rpcs.mjs --self-test
 * CI:     env vars VITE_SUPABASE_URL + VITE_SUPABASE_PUBLISHABLE_KEY
 *
 * EMPTY PEOPLE / going_next ARE A PRINTED SKIP, NOT A PASS. The person and
 * going_next assertions only bite on entries that exist; prod had 0 going
 * everywhere at launch, so the run counts the entries it checked and prints a
 * SKIP line naming the unchecked assertions whenever a count is 0. Set
 * REQUIRE_GOING_PEOPLE=1 (default off) once prod has real going rows and a public
 * profile with a going_next night: then either SKIP is exit 2 instead of 0, so a
 * run that never checked a person cannot be green.
 *
 * A NETWORK FAILURE IS "COULD NOT MEASURE". supabase-js does not throw on a fetch
 * failure: it returns {error: {message: 'TypeError: fetch failed', code: ''},
 * status: 0}. collect() treats status 0, or an empty code with a fetch-failure
 * message, as infrastructure (exit 2), never as a contract violation (exit 1).
 *
 * URL precedence (VITE_SUPABASE_URL first, then SUPABASE_URL) is the same as every
 * other scripts/check-*.mjs; a local .env whose VITE_SUPABASE_URL names a non-prod
 * project measures that project.
 *
 * Exit codes (R3): 0 pass, 1 contract violated, 2 could not measure.
 */
import fs from 'node:fs';
import { createClient } from '@supabase/supabase-js';
import { isEntryPoint } from './lib/entry-point.mjs';

export const NIGHT_KEYS = ['going_count', 'occurrence_id', 'people'];
export const PERSON_KEYS = ['dancer_profile_id', 'first_name', 'photo_url'];
export const EXTRAS_KEYS = ['bio', 'going_next', 'languages', 'whatsapp'];
export const GOING_NEXT_KEYS = ['event_title', 'occurrence_date', 'occurrence_id', 'public_event_id', 'starts_at_local'];
export const ANON_REFUSALS = ['not_signed_in', 'anonymous_session'];
export const ACCOUNT_KEY = /^(?:user_id|auth_uid|auth_user_id|uid|created_by|claimed_by|account_id)$|_user_id$/;

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const WALL_CLOCK = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}$/;
const SAMPLE_EVENTS = 6;
const MAX_IDS = 60;
const PROFILE_SAMPLE = 25;
const PEOPLE_LIMIT = 8;
const UNKNOWN_ID = '00000000-0000-4000-8000-000000000000';

export const SIGNED_IN_SKIP =
  'SKIP signed-in shapes (set_my_going_v1 success, get_my_going_v1 {upcoming, past}): ' +
  'db-contract-check.yml holds only the anon publishable key and no signed-in test ' +
  'account, so those shapes are NOT verified by this check.';

export function loadEnv(base = process.env, readFile = null) {
  const env = { ...base };
  const read =
    readFile ?? ((p) => (fs.existsSync(p) ? fs.readFileSync(p, 'utf8') : null));
  const file = read('.env');
  if (typeof file === 'string') {
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

const sameKeys = (obj, keys) =>
  obj !== null && typeof obj === 'object' && !Array.isArray(obj) &&
  Object.keys(obj).sort().join(',') === [...keys].sort().join(',');

const keysOf = (obj) => (obj && typeof obj === 'object' ? Object.keys(obj).sort().join(',') : String(obj));

/** Every key path, at any depth, whose key names an account. */
export function accountKeyPaths(value, path = '$') {
  const hits = [];
  if (Array.isArray(value)) {
    value.forEach((v, i) => hits.push(...accountKeyPaths(v, path + '[' + i + ']')));
  } else if (value !== null && typeof value === 'object') {
    for (const [k, v] of Object.entries(value)) {
      if (ACCOUNT_KEY.test(k)) hits.push(path + '.' + k);
      hits.push(...accountKeyPaths(v, path + '.' + k));
    }
  }
  return hits;
}

const FETCH_FAILURE = /fetch failed|failed to fetch|networkerror|load failed|ECONN|ENOTFOUND|ETIMEDOUT|EAI_AGAIN|socket hang up/i;

/** A supabase-js answer that never reached the database: status 0, or no code and a fetch-failure message. */
export const isInfraFailure = (res) =>
  Boolean(res?.error) && (res.status === 0 || (!res.error.code && FETCH_FAILURE.test(String(res.error.message ?? ''))));

export const PEOPLE_SKIP =
  'SKIP person assertions (p_limit cap, person key set, null-id photo rule, no account key on a person): ' +
  'every sampled night has 0 people (nobody going yet), so they were NOT verified this run.';
export const GOING_NEXT_SKIP =
  'SKIP going_next entry assertions (key set, zone-less starts_at_local): every sampled public profile ' +
  'has an empty going_next (nobody going yet), so they were NOT verified this run.';

const isRefusal = (res) => {
  const e = res?.error;
  if (!e || res.data != null) return false;
  return e.code === '42501' || ANON_REFUSALS.includes(e.message);
};

/**
 * Grade the collected responses. PURE -- no network, no env.
 * Returns { code, kind, lines }; `kind` names the branch, because two branches
 * return 2 and a canary asserting only the integer could pass for the wrong one.
 */
export function grade(obs) {
  const lines = [];
  const bad = (msg) => lines.push('VIOLATION ' + msg);

  const asked = new Set(obs.occurrenceIds ?? []);
  if (asked.size < 1) {
    return { code: 2, kind: 'vacuous-ids', lines: ['Could not measure: no P5 occurrence ids were sampled.'] };
  }

  const nightsCalls = [
    ['p_limit ' + PEOPLE_LIMIT, obs.nights, PEOPLE_LIMIT],
    ['p_limit 1', obs.nightsOne, 1],
  ];
  let measuredRows = 0;
  let peopleChecked = 0;
  for (const [label, res, limit] of nightsCalls) {
    if (res?.error) {
      bad('get_nights_going_v1(' + label + ') errored for anon: ' + res.error.message);
      continue;
    }
    if (!Array.isArray(res?.data)) {
      bad('get_nights_going_v1(' + label + ') did not return an array (got ' + typeof res?.data + ')');
      continue;
    }
    for (const row of res.data) {
      measuredRows += 1;
      const at = 'get_nights_going_v1(' + label + ')[' + row?.occurrence_id + ']';
      if (!sameKeys(row, NIGHT_KEYS)) {
        bad(at + ' keys ' + keysOf(row) + ' != ' + NIGHT_KEYS.join(','));
        continue;
      }
      if (!asked.has(row.occurrence_id)) bad(at + ' returned an occurrence_id that was not asked for');
      if (!Number.isInteger(row.going_count) || row.going_count < 0) bad(at + ' going_count is not an integer >= 0');
      if (!Array.isArray(row.people)) {
        bad(at + ' people is not an array');
        continue;
      }
      if (row.people.length > limit) bad(at + ' people.length ' + row.people.length + ' > p_limit ' + limit);
      if (row.people.length > row.going_count) bad(at + ' people.length ' + row.people.length + ' > going_count ' + row.going_count);
      row.people.forEach((p, i) => {
        peopleChecked += 1;
        const pat = at + '.people[' + i + ']';
        if (!sameKeys(p, PERSON_KEYS)) {
          bad(pat + ' keys ' + keysOf(p) + ' != ' + PERSON_KEYS.join(','));
          return;
        }
        if (p.dancer_profile_id !== null && !(typeof p.dancer_profile_id === 'string' && UUID.test(p.dancer_profile_id))) {
          bad(pat + ' dancer_profile_id is neither a uuid nor null');
        }
        if (p.first_name !== null && typeof p.first_name !== 'string') bad(pat + ' first_name is neither text nor null');
        if (p.photo_url !== null && typeof p.photo_url !== 'string') bad(pat + ' photo_url is neither text nor null');
        if (p.dancer_profile_id === null && p.photo_url !== null) bad(pat + ' has a photo but no public page');
      });
    }
  }

  const refusalCases = [
    ['get_nights_going_v1(p_limit 0)', obs.badLimit, 'invalid_argument'],
    ['get_nights_going_v1(201 ids)', obs.tooMany, 'too_many_ids'],
  ];
  for (const [label, res, message] of refusalCases) {
    if (res?.error?.message !== message) {
      bad(label + ' should refuse with ' + message + ', got ' + (res?.error ? 'error ' + res.error.message : 'success'));
    }
  }

  for (const [label, res] of [['set_my_going_v1', obs.anonSet], ['get_my_going_v1', obs.anonMy], ['get_my_event_going_v1', obs.anonMyEvent]]) {
    if (!isRefusal(res)) {
      bad(label + ' as anon was not refused (want 42501 or ' + ANON_REFUSALS.join('/') + '; got ' +
        (res?.error ? res.error.code + ' ' + res.error.message : 'data') + ')');
    }
  }

  if (obs.extrasUnknown?.error) bad('get_public_dancer_extras_v1(unknown id) errored: ' + obs.extrasUnknown.error.message);
  else if (obs.extrasUnknown?.data !== null) bad('get_public_dancer_extras_v1(unknown id) did not return null');

  let publicProfiles = 0;
  let goingNextChecked = 0;
  for (const { id, res } of obs.extras ?? []) {
    const at = 'get_public_dancer_extras_v1(' + id + ')';
    if (res?.error) {
      bad(at + ' errored: ' + res.error.message);
      continue;
    }
    if (res?.data === null) continue;
    publicProfiles += 1;
    const x = res.data;
    if (!sameKeys(x, EXTRAS_KEYS)) {
      bad(at + ' keys ' + keysOf(x) + ' != ' + EXTRAS_KEYS.join(','));
      continue;
    }
    if (!Array.isArray(x.languages)) bad(at + '.languages is not an array');
    if (!Array.isArray(x.going_next)) {
      bad(at + '.going_next is not an array');
      continue;
    }
    if (x.going_next.length > 3) bad(at + '.going_next has ' + x.going_next.length + ' entries (max 3)');
    x.going_next.forEach((n, i) => {
      goingNextChecked += 1;
      const nat = at + '.going_next[' + i + ']';
      if (!sameKeys(n, GOING_NEXT_KEYS)) {
        bad(nat + ' keys ' + keysOf(n) + ' != ' + GOING_NEXT_KEYS.join(','));
        return;
      }
      if (typeof n.starts_at_local !== 'string' || !WALL_CLOCK.test(n.starts_at_local)) {
        bad(nat + '.starts_at_local is not a zone-less wall clock: ' + n.starts_at_local);
      }
    });
  }

  const everything = [obs.nights?.data, obs.nightsOne?.data, obs.extrasUnknown?.data, ...(obs.extras ?? []).map((e) => e.res?.data)];
  for (const hit of accountKeyPaths(everything)) bad('account-identifying key in a going payload: ' + hit);

  if (lines.length > 0) {
    lines.push('Going RPC contract: FAIL (' + lines.length + ' violation(s)).');
    return { code: 1, kind: 'violation', lines };
  }
  if (measuredRows < 1 || publicProfiles < 1) {
    return {
      code: 2,
      kind: 'vacuous-sample',
      lines: ['Could not measure: ' + measuredRows + ' night row(s) and ' + publicProfiles + ' public profile(s) came back.'],
    };
  }
  return {
    code: 0,
    kind: 'ok',
    peopleChecked,
    goingNextChecked,
    lines: [
      'Going RPC contract (anon): ok -- ' + asked.size + ' P5 ids asked, ' + measuredRows + ' night rows, ' +
        peopleChecked + ' people, ' + publicProfiles + ' public profiles and ' + goingNextChecked +
        ' going_next entries checked; refusals and key sets hold.',
      ...(peopleChecked === 0 ? [PEOPLE_SKIP] : []),
      ...(goingNextChecked === 0 ? [GOING_NEXT_SKIP] : []),
    ],
  };
}

/** The real collaborator: one supabase-js client, anon. Injected in the canary. */
export function makeApi(url, key) {
  const sb = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
  return {
    rpc: (name, args) => sb.rpc(name, args),
    profileIds: (limit) => sb.from('dancer_profiles').select('id').limit(limit),
  };
}

/** Gather every response grade() needs. Throws on infrastructure failure (caller maps to 2). */
export async function collect(api, now = new Date()) {
  const cal = await api.rpc('get_calendar_events_v2', {
    range_start: now.toISOString(),
    range_end: new Date(now.getTime() + 14 * 86400e3).toISOString(),
    city_slug_param: null,
    p_include_past: false,
  });
  if (cal.error) throw new Error('get_calendar_events_v2: ' + cal.error.message);
  const byEvent = new Map();
  for (const r of cal.data ?? []) if (!byEvent.has(r.event_id)) byEvent.set(r.event_id, r);

  const ids = new Set();
  for (const r of [...byEvent.values()].slice(0, SAMPLE_EVENTS)) {
    const ev = await api.rpc('event_view_p5', {
      p_target: { series_id: r.event_id, occurrence_id: r.occurrence_id },
      p_viewer: { role: 'anon', shape: 'snapshot_compat' },
    });
    if (ev.error) throw new Error('event_view_p5: ' + ev.error.message);
    if (typeof ev.data?.occurrence_id === 'string') ids.add(ev.data.occurrence_id);
    for (const o of ev.data?.occurrences ?? []) {
      if (o?.is_upcoming && typeof o.occurrence_id === 'string') ids.add(o.occurrence_id);
    }
  }
  const occurrenceIds = [...ids].slice(0, MAX_IDS);
  const tooManyIds = Array.from({ length: 201 }, (_, i) =>
    '00000000-0000-4000-8000-' + String(i).padStart(12, '0'));

  const profiles = await api.profileIds(PROFILE_SAMPLE);
  if (profiles.error) throw new Error('dancer_profiles: ' + profiles.error.message);
  const extras = [];
  for (const { id } of profiles.data ?? []) {
    extras.push({ id, res: await api.rpc('get_public_dancer_extras_v1', { p_profile_id: id }) });
  }

  const obs = {
    occurrenceIds,
    nights: await api.rpc('get_nights_going_v1', { p_occurrence_ids: occurrenceIds, p_limit: PEOPLE_LIMIT }),
    nightsOne: await api.rpc('get_nights_going_v1', { p_occurrence_ids: occurrenceIds, p_limit: 1 }),
    badLimit: await api.rpc('get_nights_going_v1', { p_occurrence_ids: occurrenceIds, p_limit: 0 }),
    tooMany: await api.rpc('get_nights_going_v1', { p_occurrence_ids: tooManyIds, p_limit: PEOPLE_LIMIT }),
    anonSet: await api.rpc('set_my_going_v1', { p_occurrence_id: occurrenceIds[0] ?? UNKNOWN_ID, p_going: true }),
    anonMy: await api.rpc('get_my_going_v1', {}),
    anonMyEvent: await api.rpc('get_my_event_going_v1', { p_public_event_id: UNKNOWN_ID }),
    extrasUnknown: await api.rpc('get_public_dancer_extras_v1', { p_profile_id: UNKNOWN_ID }),
    extras,
  };
  const answers = [
    ['get_nights_going_v1', obs.nights], ['get_nights_going_v1', obs.nightsOne], ['get_nights_going_v1', obs.badLimit],
    ['get_nights_going_v1', obs.tooMany], ['set_my_going_v1', obs.anonSet], ['get_my_going_v1', obs.anonMy],
    ['get_my_event_going_v1', obs.anonMyEvent],
    ['get_public_dancer_extras_v1', obs.extrasUnknown], ...extras.map((e) => ['get_public_dancer_extras_v1', e.res]),
  ];
  for (const [name, res] of answers) {
    if (isInfraFailure(res)) throw new Error(name + ': ' + res.error.message + ' (status ' + res.status + ')');
  }
  return obs;
}

// ---------------------------------------------------------------------------
// Canary
// ---------------------------------------------------------------------------

const OCC = '11111111-1111-4111-8111-111111111111';
const PROF = '22222222-2222-4222-8222-222222222222';

/** A fake api answering like healthy prod; `patch` overrides single RPC answers. */
function fakeApi(patch = {}) {
  const ok = (data) => ({ data, error: null });
  const fail = (code, message) => ({ data: null, error: { code, message } });
  const answers = {
    get_calendar_events_v2: () => ok([{ event_id: 'e1', occurrence_id: 'legacy-1' }]),
    event_view_p5: () => ok({ occurrence_id: OCC, occurrences: [{ occurrence_id: OCC, is_upcoming: true }] }),
    get_nights_going_v1: (a) => {
      if (a.p_limit < 1) return fail('22023', 'invalid_argument');
      if (a.p_occurrence_ids.length > 200) return fail('22023', 'too_many_ids');
      const people = [{ dancer_profile_id: PROF, first_name: 'Ana', photo_url: null }, { dancer_profile_id: null, first_name: 'Bo', photo_url: null }];
      return ok([{ occurrence_id: OCC, going_count: 2, people: people.slice(0, a.p_limit) }]);
    },
    set_my_going_v1: () => fail('42501', 'permission denied for function set_my_going_v1'),
    get_my_going_v1: () => fail('42501', 'permission denied for function get_my_going_v1'),
    get_my_event_going_v1: () => fail('42501', 'permission denied for function get_my_event_going_v1'),
    get_public_dancer_extras_v1: (a) =>
      ok(a.p_profile_id === PROF ? { bio: null, languages: [], whatsapp: null, going_next: [] } : null),
    ...patch,
  };
  return {
    rpc: async (name, args) => {
      const answer = answers[name];
      if (!answer) throw new Error('fakeApi: no answer for ' + name);
      return answer(args);
    },
    profileIds: async () => (patch.profileIds ? patch.profileIds() : ok([{ id: PROF }])),
  };
}

async function selfTest(log = console) {
  const silent = { out: () => {}, err: () => {} };
  const CREDS = { VITE_SUPABASE_URL: 'https://example.test', VITE_SUPABASE_PUBLISHABLE_KEY: 'anon-key' };
  const run = (patch, env = CREDS, extra = {}) =>
    main([], { ...silent, env, readEnvFile: () => null, api: () => fakeApi(patch), ...extra });
  const ok = (data) => ({ data, error: null });
  const nightWith = (row) => () => ok([row]);
  const person = { dancer_profile_id: PROF, first_name: 'Ana', photo_url: null };

  const fetchFailed = { data: null, error: { message: 'TypeError: fetch failed', details: '', hint: '', code: '' }, status: 0 };
  const passThrough = (a, rows) =>
    (a.p_limit < 1 || a.p_occurrence_ids.length > 200 ? fakeApi().rpc('get_nights_going_v1', a) : ok(rows));
  const NEXT = { occurrence_id: OCC, public_event_id: 'e', event_title: 't', occurrence_date: '2026-11-06', starts_at_local: '2026-11-06T21:00:00' };
  const extrasWith = (going_next) => (a) =>
    ok(a.p_profile_id !== PROF ? null : { bio: null, languages: [], whatsapp: null, going_next });

  const cases = [
    ['healthy prod shape passes', 0, () => run({})],
    ['fetch failure (status 0) is infrastructure, not a violation', 2, () => run({ get_nights_going_v1: () => fetchFailed })],
    ['fetch failure (empty code, no status) is infrastructure', 2, () =>
      run({ get_public_dancer_extras_v1: () => ({ data: null, error: { message: 'TypeError: fetch failed', code: '' } }) })],
    ['a real error with an empty code and another message still fails', 1, () =>
      run({ get_my_going_v1: () => ({ data: null, error: { message: 'rate_limited', code: '' }, status: 400 }) })],
    ['p_limit ignored (people present) fails', 1, () => run({ get_nights_going_v1: (a) => passThrough(a,
      [{ occurrence_id: OCC, going_count: 2, people: [person, { dancer_profile_id: null, first_name: 'Bo', photo_url: null }] }]) })],
    ['renamed person key fails', 1, () => run({ get_nights_going_v1: (a) => passThrough(a,
      [{ occurrence_id: OCC, going_count: 1, people: [{ dancer_profile_id: PROF, name: 'Ana', photo_url: null }] }]) })],
    ['renamed going_next key fails', 1, () => run({ get_public_dancer_extras_v1: extrasWith([(({ event_title, ...rest }) => ({ ...rest, title: event_title }))(NEXT)]) })],
    ['going_next present passes', 0, () => run({ get_public_dancer_extras_v1: extrasWith([NEXT]) })],
    ['refusal by function message (not_signed_in) also passes', 0, () =>
      run({ set_my_going_v1: () => ({ data: null, error: { code: 'P0001', message: 'not_signed_in' } }) })],
    ['missing creds is infrastructure', 2, () => run({}, {})],
    ['network throw is infrastructure', 2, () => run({ get_calendar_events_v2: () => { throw new Error('ECONNRESET'); } })],
    ['no ids sampled is vacuous', 2, () => run({ event_view_p5: () => ok({ occurrence_id: null, occurrences: [] }) })],
    ['no night rows back is vacuous', 2, () => run({ get_nights_going_v1: (a) =>
      (a.p_limit < 1 ? { data: null, error: { message: 'invalid_argument' } }
        : a.p_occurrence_ids.length > 200 ? { data: null, error: { message: 'too_many_ids' } } : ok([])) })],
    ['no public profile is vacuous', 2, () => run({ get_public_dancer_extras_v1: () => ok(null) })],
    ['extra night key fails', 1, () => run({ get_nights_going_v1: (a) =>
      (a.p_limit < 1 || a.p_occurrence_ids.length > 200 ? fakeApi().rpc('get_nights_going_v1', a)
        : ok([{ occurrence_id: OCC, going_count: 1, people: [person], hidden_count: 0 }])) })],
    ['user_id on a person fails', 1, () => run({ get_nights_going_v1: (a) =>
      (a.p_limit < 1 || a.p_occurrence_ids.length > 200 ? fakeApi().rpc('get_nights_going_v1', a)
        : ok([{ occurrence_id: OCC, going_count: 1, people: [{ ...person, user_id: PROF }] }])) })],
    ['people over p_limit fails', 1, () => run({ get_nights_going_v1: (a) =>
      (a.p_limit < 1 || a.p_occurrence_ids.length > 200 ? fakeApi().rpc('get_nights_going_v1', a)
        : ok([{ occurrence_id: OCC, going_count: 9, people: Array(9).fill(person) }])) })],
    ['photo without a public page fails', 1, () => run({ get_nights_going_v1: (a) =>
      (a.p_limit < 1 || a.p_occurrence_ids.length > 200 ? fakeApi().rpc('get_nights_going_v1', a)
        : ok([{ occurrence_id: OCC, going_count: 1, people: [{ dancer_profile_id: null, first_name: 'Bo', photo_url: 'x.jpg' }] }])) })],
    ['an occurrence nobody asked for fails', 1, () => run({ get_nights_going_v1: (a) =>
      (a.p_limit < 1 || a.p_occurrence_ids.length > 200 ? fakeApi().rpc('get_nights_going_v1', a)
        : nightWith({ occurrence_id: PROF, going_count: 0, people: [] })()) })],
    ['p_limit 0 accepted fails', 1, () => run({ get_nights_going_v1: (a) =>
      (a.p_limit < 1 ? ok([]) : fakeApi().rpc('get_nights_going_v1', a)) })],
    ['201 ids accepted fails', 1, () => run({ get_nights_going_v1: (a) =>
      (a.p_occurrence_ids.length > 200 ? ok([]) : fakeApi().rpc('get_nights_going_v1', a)) })],
    ['anon set_my_going_v1 succeeding fails', 1, () =>
      run({ set_my_going_v1: () => ok({ occurrence_id: OCC, going: true, changed: true, going_count: 1 }) })],
    ['anon get_my_going_v1 succeeding fails', 1, () => run({ get_my_going_v1: () => ok({ upcoming: [], past: [] }) })],
    ['anon get_my_event_going_v1 succeeding fails', 1, () =>
      run({ get_my_event_going_v1: () => ok({ public_event_id: UNKNOWN_ID, nights: [] }) })],
    ['anon refused for the wrong reason fails', 1, () =>
      run({ get_my_going_v1: () => ({ data: null, error: { code: 'P0001', message: 'rate_limited' } }) })],
    ['unknown profile not null fails', 1, () => run({ get_public_dancer_extras_v1: () =>
      ok({ bio: null, languages: [], whatsapp: null, going_next: [] }) })],
    ['going_next over 3 fails', 1, () => run({ get_public_dancer_extras_v1: (a) => ok(a.p_profile_id !== PROF ? null : {
      bio: null, languages: [], whatsapp: null,
      going_next: Array(4).fill({ occurrence_id: OCC, public_event_id: 'e', event_title: 't', occurrence_date: '2026-11-06', starts_at_local: '2026-11-06T21:00:00' }),
    }) })],
    ['starts_at_local with a zone fails', 1, () => run({ get_public_dancer_extras_v1: (a) => ok(a.p_profile_id !== PROF ? null : {
      bio: null, languages: [], whatsapp: null,
      going_next: [{ occurrence_id: OCC, public_event_id: 'e', event_title: 't', occurrence_date: '2026-11-06', starts_at_local: '2026-11-06T21:00:00+00:00' }],
    }) })],
    ['extras missing going_next fails', 1, () => run({ get_public_dancer_extras_v1: (a) =>
      ok(a.p_profile_id !== PROF ? null : { bio: null, languages: [], whatsapp: null }) })],
    ['nights RPC missing fails', 1, () => run({ get_nights_going_v1: () =>
      ({ data: null, error: { code: 'PGRST202', message: 'Could not find the function' } }) })],
    ['unknown flag is infrastructure', 2, () => main(['--bogus'], { ...silent })],
  ];

  let failed = 0;
  for (const [name, want, fn] of cases) {
    let got;
    try {
      got = await fn();
    } catch (error) {
      got = 'threw ' + (error?.message ?? String(error));
    }
    if (got !== want) {
      failed += 1;
      log.error('FAIL ' + name + ': expected exit ' + want + ', got ' + got);
    }
  }

  // Never a silent green: an empty people / going_next list prints its SKIP, a filled one does not.
  const printed = async (patch) => {
    const outLines = [];
    const code = await main([], { err: () => {}, out: (l) => outLines.push(l), env: CREDS, readEnvFile: () => null, api: () => fakeApi(patch) });
    return { code, text: outLines.join('\n') };
  };
  const noPeople = { get_nights_going_v1: (a) => passThrough(a, [{ occurrence_id: OCC, going_count: 0, people: [] }]) };
  const skips = [
    ['people present, going_next empty', {}, false, true],
    ['people empty, going_next present', { ...noPeople, get_public_dancer_extras_v1: extrasWith([NEXT]) }, true, false],
    ['both empty (prod at launch)', noPeople, true, true],
  ];
  for (const [name, patch, wantPeopleSkip, wantNextSkip] of skips) {
    const { code, text } = await printed(patch);
    if (code !== 0 || text.includes(PEOPLE_SKIP) !== wantPeopleSkip || text.includes(GOING_NEXT_SKIP) !== wantNextSkip) {
      failed += 1;
      log.error('FAIL skip ' + name + ': exit ' + code + ', people SKIP ' + text.includes(PEOPLE_SKIP) +
        ', going_next SKIP ' + text.includes(GOING_NEXT_SKIP));
    }
  }

  // REQUIRE_GOING_PEOPLE=1: a SKIP becomes exit 2 (the person / going_next checks
  // must have run); unset, the same runs stay 0 with their SKIP line.
  const required = async (patch, envExtra) =>
    main([], { err: () => {}, out: () => {}, env: { ...CREDS, ...envExtra }, readEnvFile: () => null, api: () => fakeApi(patch) });
  const requireCases = [
    ['REQUIRE + both empty', noPeople, { REQUIRE_GOING_PEOPLE: '1' }, 2],
    ['REQUIRE + people empty only', { ...noPeople, get_public_dancer_extras_v1: extrasWith([NEXT]) }, { REQUIRE_GOING_PEOPLE: '1' }, 2],
    ['REQUIRE + going_next empty only', {}, { REQUIRE_GOING_PEOPLE: '1' }, 2],
    ['REQUIRE + both present', { get_public_dancer_extras_v1: extrasWith([NEXT]) }, { REQUIRE_GOING_PEOPLE: '1' }, 0],
    ['REQUIRE=0 + both empty', noPeople, { REQUIRE_GOING_PEOPLE: '0' }, 0],
    ['no REQUIRE + both empty', noPeople, {}, 0],
  ];
  for (const [name, patch, envExtra, want] of requireCases) {
    const got = await required(patch, envExtra);
    if (got !== want) {
      failed += 1;
      log.error('FAIL require ' + name + ': expected exit ' + want + ', got ' + got);
    }
  }

  // Branch pinning: two branches return 2, so the KIND must be the one we meant.
  const kinds = [
    ['vacuous ids', grade({ occurrenceIds: [] }).kind, 'vacuous-ids'],
    ['vacuous sample', grade(await collect(fakeApi({ get_public_dancer_extras_v1: () => ok(null) }))).kind, 'vacuous-sample'],
    ['healthy', grade(await collect(fakeApi())).kind, 'ok'],
  ];
  for (const [name, got, want] of kinds) {
    if (got !== want) {
      failed += 1;
      log.error('FAIL kind ' + name + ': expected ' + want + ', got ' + got);
    }
  }

  if (failed) {
    log.error('FAIL self-test -- ' + failed + ' case(s).');
    return false;
  }
  log.log('PASS self-test -- ' + (cases.length + skips.length + requireCases.length + kinds.length) + ' cases, both directions.');
  return true;
}

// ---------------------------------------------------------------------------
// CLI
// ---------------------------------------------------------------------------

/** Owns the exit code: it RETURNS the integer and the CLI tail assigns it (R5). */
export async function main(argv = [], deps = {}) {
  const {
    env: baseEnv = process.env,
    readEnvFile = null,
    api: makeApiFn = makeApi,
    out = console.log,
    err = console.error,
  } = deps ?? {};

  const KNOWN_FLAGS = ['--self-test'];
  const unknown = argv.filter((a) => !KNOWN_FLAGS.includes(a));
  if (unknown.length > 0) {
    err('Unknown flag(s): ' + unknown.join(', ') + '. Known: ' + KNOWN_FLAGS.join(', '));
    return 2;
  }
  if (argv.includes('--self-test')) {
    return (await selfTest()) ? 0 : 1;
  }

  const env = loadEnv(baseEnv, readEnvFile);
  const url = env.VITE_SUPABASE_URL || env.SUPABASE_URL;
  const key = env.VITE_SUPABASE_PUBLISHABLE_KEY || env.SUPABASE_PUBLISHABLE_KEY || env.SUPABASE_ANON_KEY;
  if (!url || !key) {
    err('Missing VITE_SUPABASE_URL or VITE_SUPABASE_PUBLISHABLE_KEY');
    return 2;
  }

  let obs;
  try {
    obs = await collect(makeApiFn(url, key));
  } catch (error) {
    err('Could not measure: ' + (error?.message ?? String(error)));
    return 2;
  }

  const verdict = grade(obs);
  for (const line of verdict.lines) (verdict.code === 0 ? out : err)(line);
  out(SIGNED_IN_SKIP);
  // REQUIRE_GOING_PEOPLE=1 (set once prod has real going rows): a run whose
  // person or going_next checks never bit is "could not measure", not green.
  if (verdict.code === 0 && env.REQUIRE_GOING_PEOPLE === '1' && (verdict.peopleChecked === 0 || verdict.goingNextChecked === 0)) {
    err('REQUIRE_GOING_PEOPLE=1: ' + verdict.peopleChecked + ' people and ' + verdict.goingNextChecked +
      ' going_next entries checked; both must be above 0. Exit 2.');
    return 2;
  }
  return verdict.code;
}

if (isEntryPoint(import.meta.url)) {
  // process.exitCode, never process.exit(): supabase-js leaves a fetch handle open.
  process.exitCode = await main(process.argv.slice(2));
}

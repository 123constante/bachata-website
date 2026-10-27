#!/usr/bin/env node
// walk-seed: the draft events the authenticated P3 walks need, created on prod
// THROUGH THE APP'S OWN OWNER COMMANDS as the walk test user (docs/walk-seed/README.md).
//
//   node scripts/walk-seed.mjs                 dry run (default): prints every envelope, NO network
//   node scripts/walk-seed.mjs --apply         signs in as the walk user and sends them
//   --env-file <path>   WALK_TEST_EMAIL / WALK_TEST_PASSWORD / VITE_SUPABASE_URL /
//                       VITE_SUPABASE_ANON_KEY (default C:/dev/bachata-admin-11april/.env.local)
//   --only <shape>      one shape (repeatable)
//   --salt <word>       fresh series ids and keys, to rebuild a shape (README)
//
// The command builders below MIRROR src/modules/organiser/shared/seriesCommands.ts,
// shared/selfServeApi.ts (createSeriesCommand) and events/programmeSeriesModel.ts
// (buildDays): this file runs under plain node, which cannot load the app's TS and
// its `@/` aliases. tests/walkSeed.test.ts builds every command through BOTH and
// fails on any drift, so a mirror can never send a shape the app would not.
//
// Every write goes through series_command_p5 / occurrence_command_p5, the same RPCs
// and envelope the organiser screens use, so the server's owner allowlist judges
// each one exactly as it judges the app. Nothing here works around a refusal: a
// refused step is reported, the shape stops, the run goes on to the next shape.
//
// Exit codes: 0 done, 1 a step was refused or failed, 2 cannot run (credentials,
// sign-in, no organiser page).

import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { isEntryPoint } from './lib/entry-point.mjs';

export const DEFAULT_ENV_FILE = 'C:/dev/bachata-admin-11april/.env.local';
export const SERIES_TIMEZONE = 'Europe/London';
export const NAME_PREFIX = 'WALK ';
export const shapeName = (shape) => `${NAME_PREFIX}${shape} (draft, do not publish)`;

// ---- the mirrors (pinned by tests/walkSeed.test.ts) ---------------------------------

/** A uuid-shaped value derived from text: the same text always gives the same uuid. */
export function stableUuid(text) {
  const h = createHash('sha256').update(text).digest('hex');
  const variant = ((parseInt(h[16], 16) & 0x3) | 0x8).toString(16);
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-5${h.slice(13, 16)}-${variant}${h.slice(17, 20)}-${h.slice(20, 32)}`;
}
/** ONE idempotency key per command, from the shape and the step: a re-run replays, never duplicates. */
export const idempotencyKey = (shape, step, salt = '') => stableUuid(`walk-seed${salt}:${shape}:${step}`);
/** The series id a create claims (the handler inserts under target_id), stable per shape. */
export const seriesIdFor = (shape, salt = '') => stableUuid(`walk-seed${salt}:series:${shape}`);

/** seriesCommands.envelope */
export function envelope(targetId, version, command, key) {
  return {
    target_id: targetId,
    ...(typeof version === 'number' && version > 0 ? { expected_version: version } : {}),
    idempotency_key: key,
    command,
  };
}

/** seriesCommands.upsertCommand: category is server-derived and never sent. */
export function upsertCommand(payload) {
  const { category: _serverDerived, ...rest } = payload;
  return { kind: 'series.upsert', payload: rest };
}
/** selfServeApi.createSeriesCommand */
export const createSeriesCommand = (payload, organiserId) => upsertCommand({ ...payload, organiser_ids: [organiserId] });
/** seriesCommands.createPayload, for the fields this script sets. */
export function createPayload({ name, format, startDate, startTime, durationMinutes }) {
  const payload = { name: name.trim(), format, default_start_date: startDate, default_local_start_time: startTime, timezone: SERIES_TIMEZONE };
  if (durationMinutes) payload.default_duration_minutes = durationMinutes;
  return payload;
}
export const weeklyRuleCommand = (weekday) => ({ kind: 'series.set_recurrence', payload: { mode: 'weekly', weekdays: [weekday], end: { kind: 'none' } } });
export const addDateCommand = (date) => ({ kind: 'series.add_date', payload: { date } });
export const skipDateCommand = (occurrenceId) => ({ kind: 'series.skip_date', payload: { occurrence_id: occurrenceId } });
export const cancelCommand = (reason) => ({ kind: 'occurrence.cancel', payload: { cancelled: true, reason } });
export const setProgramCommand = (days) => ({ kind: 'series.set_program', payload: { days } });

/** programmeModel.levelsApplyTo / sessionLevels: only a class or a masterclass keeps levels. */
const LEVELLED_TYPES = ['class', 'masterclass'];
/** programmeSeriesModel.ADD_ACTIONS: the section each session type is added to. */
export const SECTION_FOR_TYPE = { class: 'classes', party: 'party', performance: 'showcase' };

/**
 * programmeSeriesModel.buildDays for a NEW tree (no stored ids): one day, the
 * sections in first-use order, each item as the editor's Save sends it.
 * item: { type, title, start?, end?, levels?, room?, people?: [{profileId, profileType, role}] }
 */
export function programDays(items) {
  const sections = [];
  for (const it of items) {
    const kind = SECTION_FOR_TYPE[it.type];
    let section = sections.find((s) => s.kind === kind);
    if (!section) sections.push((section = { kind, items: [] }));
    section.items.push(it);
  }
  return [{
    day_index: 0,
    date_offset_days: 0,
    label: null,
    sort_order: 0,
    sections: sections.map((s, si) => ({
      kind: s.kind,
      sort_order: si,
      label_override: null,
      items: s.items.map((it, ii) => ({
        title: it.title.trim(),
        type: it.type,
        start_time: it.start || null,
        end_time: it.end || null,
        room: it.room ?? null,
        venue_room_id: null,
        level_keys: LEVELLED_TYPES.includes(it.type) ? (it.levels ?? []) : [],
        style: null,
        theme: null,
        track_id: null,
        parallel_group_id: null,
        sort_order: ii,
        people: (it.people ?? []).map((p, pi) => ({ profile_id: p.profileId, profile_type: p.profileType, role: p.role, level: null, sort: pi })),
      })),
    })),
  }];
}

// ---- the shapes --------------------------------------------------------------------

const addDays = (iso, n) => new Date(Date.parse(`${iso}T12:00:00Z`) + n * 86_400_000).toISOString().slice(0, 10);
const weekdayOf = (iso) => new Date(`${iso}T12:00:00Z`).getUTCDay();
/** London's calendar date (the walk dates are London dates, like every date the app sends). */
export const londonToday = (now = new Date()) => new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/London' }).format(now);

/** The 16 sessions of weekly16 (the prod max): classes with levels and times, two in named rooms, parties, one performance. */
function sixteen() {
  const levels = ['beginner', 'improver', 'intermediate', 'advanced', 'open_level'];
  const items = [];
  for (let i = 0; i < 12; i += 1) {
    const timed = i < 8;
    const h = 18 + Math.floor(i / 4);
    items.push({
      type: 'class',
      title: `Class ${i + 1}`,
      start: timed ? `${String(h).padStart(2, '0')}:${i % 2 ? '30' : '00'}` : '',
      end: timed ? `${String(h + 1).padStart(2, '0')}:${i % 2 ? '15' : '00'}` : '',
      levels: i < 10 ? [levels[i % levels.length]] : [],
      room: i === 0 ? 'Studio A' : i === 1 ? 'Studio B' : null,
    });
  }
  items.push({ type: 'party', title: 'Social', start: '22:00', end: '02:00' });
  items.push({ type: 'party', title: 'Late social', start: '', end: '' });
  items.push({ type: 'performance', title: 'Showcase', start: '21:30', end: '21:45' });
  items.push({ type: 'performance', title: 'Student showcase', start: '', end: '' });
  return items;
}

/**
 * Each shape: { shape, purpose, format, steps(ctx) } or { shape, purpose, skip }.
 * A step: { step, rpc: 'series' | 'occurrence', target?: {occurrence: n}, command(ctx) }.
 * ctx carries the ids only --apply learns (organiser, occurrences, people, reason);
 * a dry run shows angle-bracket placeholders for them.
 */
export const SHAPES = [
  { shape: 'weekly16', purpose: '16 sessions (the prod max): levels, times, untimed rows, two named rooms', format: 'recurring',
    program: () => sixteen() },
  { shape: 'weekly-lineup', purpose: '3 sessions with a teacher and a DJ on each (line-up rendering)', format: 'recurring', people: true,
    program: (ctx) => [
      { type: 'class', title: 'Footwork', start: '19:00', end: '20:00', levels: ['beginner'], people: [ctx.teacher] },
      { type: 'class', title: 'Partnerwork', start: '20:00', end: '21:00', levels: ['intermediate'], people: [ctx.teacher] },
      { type: 'party', title: 'Social', start: '21:00', end: '23:30', people: [ctx.dj] },
    ] },
  { shape: 'oneoff-untimed', purpose: 'one-off with one session that has no time', format: 'one_off',
    program: () => [{ type: 'party', title: 'Social', start: '', end: '' }] },
  { shape: 'oneoff-2dates', purpose: 'one-off that has 2 dates', format: 'one_off',
    extra: (ctx) => [{ step: 'add-date', rpc: 'series', command: () => addDateCommand(addDays(ctx.startDate, 7)) }] },
  { shape: 'course', purpose: 'course with course_total_sessions and 2 sessions', format: 'recurring',
    extra: () => [{ step: 'course-format', rpc: 'series', command: (c) => upsertCommand({ name: c.name, format: 'course', course_total_sessions: 8 }) }],
    program: () => [
      { type: 'class', title: 'Course class', start: '19:00', end: '20:00', levels: ['beginner'] },
      { type: 'class', title: 'Practice', start: '20:00', end: '21:00', levels: ['beginner'] },
    ] },
  { shape: 'weekly-cancelled-date', purpose: 'weekly with 1 cancelled coming date and 1 skipped date', format: 'recurring',
    extra: () => [
      { step: 'cancel-date', rpc: 'occurrence', target: { occurrence: 1 }, command: (c) => cancelCommand(c.reason) },
      { step: 'skip-date', rpc: 'series', command: (c) => skipDateCommand(c.occurrence(2).id) },
    ] },
  { shape: 'weekly-30dates', purpose: 'weekly, open-ended: the server materialises about a year (~52 coming dates, over 30)', format: 'recurring' },
  { shape: 'empty-sessions', purpose: 'weekly with 0 sessions (the #25 empty-session shape)', format: 'recurring' },
  { shape: 'nameless-session', purpose: 'weekly with one stored UNTITLED session (the 239-on-prod shape)', format: 'recurring',
    program: () => [{ type: 'class', title: '', start: '19:00', end: '20:00', levels: ['open_level'] }] },
  { shape: 'festival', purpose: 'festival', skip: 'an owner cannot create a festival series and festival programmes are admin-only (_owner_program_problem_p5)' },
];

/** The ordered steps of one shape. */
export function planShape(def, ctx) {
  const name = shapeName(def.shape);
  const steps = [{
    step: 'create', rpc: 'series', create: true,
    command: (c) => createSeriesCommand(createPayload({ name, format: def.format, startDate: c.startDate, startTime: '19:00', durationMinutes: 240 }), c.organiserId),
  }];
  if (def.format === 'recurring') steps.push({ step: 'weekly-rule', rpc: 'series', command: (c) => weeklyRuleCommand(weekdayOf(c.startDate)) });
  if (def.extra) steps.push(...def.extra(ctx));
  if (def.program) steps.push({ step: 'program', rpc: 'series', command: (c) => setProgramCommand(programDays(def.program(c))) });
  return steps;
}

/** Placeholders a dry run prints where --apply would put a learnt id. */
export function dryContext(shape, today, salt = '') {
  const startDate = addDays(today, 7);
  return {
    shape, salt, name: shapeName(shape), startDate, seriesId: seriesIdFor(shape, salt),
    organiserId: '<walk user organiser id>', reason: '<first cancellation_reasons label>',
    teacher: { profileId: '<teacher id>', profileType: 'teacher', role: 'teaching' },
    dj: { profileId: '<dj id>', profileType: 'dj', role: 'djing' },
    occurrence: (n) => ({ id: `<occurrence #${n}>`, version: undefined }),
    version: undefined,
  };
}

/** The envelope one step sends, and the RPC it goes to. */
export function buildStep(st, ctx) {
  const command = st.command(ctx);
  const key = idempotencyKey(ctx.shape, st.step, ctx.salt);
  if (st.rpc === 'occurrence') {
    const occ = ctx.occurrence(st.target.occurrence);
    return { fn: 'occurrence_command_p5', env: envelope(occ.id, occ.version, command, key) };
  }
  return { fn: 'series_command_p5', env: envelope(ctx.seriesId, st.create ? undefined : ctx.version, command, key) };
}

// ---- network (only --apply reaches here) -------------------------------------------

export function readEnvFile(path, read = readFileSync) {
  const out = {};
  for (const line of String(read(path, 'utf8')).split(/\r?\n/)) {
    const m = line.match(/^\s*(?:export\s+)?([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
    if (m) out[m[1]] = m[2].replace(/^(['"])(.*)\1$/, '$2');
  }
  return out;
}

/** A tiny PostgREST client. Errors carry the server's message, never a token. */
export function client(env, fetchImpl) {
  const base = env.VITE_SUPABASE_URL.replace(/\/$/, '');
  let token = null;
  const call = async (path, init) => {
    const res = await fetchImpl(`${base}${path}`, {
      ...init,
      headers: { apikey: env.VITE_SUPABASE_ANON_KEY, 'content-type': 'application/json', ...(token ? { authorization: `Bearer ${token}` } : {}) },
    });
    const text = await res.text();
    let body = null;
    try { body = text ? JSON.parse(text) : null; } catch (e) { body = { message: `unreadable response (${e.message})` }; }
    if (!res.ok) throw new Error(`${res.status} ${body?.message ?? body?.error_description ?? body?.msg ?? 'request failed'}`);
    return body;
  };
  return {
    async signIn() {
      const body = await call('/auth/v1/token?grant_type=password', { method: 'POST', body: JSON.stringify({ email: env.WALK_TEST_EMAIL, password: env.WALK_TEST_PASSWORD }) });
      if (!body?.access_token) throw new Error('sign-in returned no session');
      token = body.access_token;
    },
    rpc: (fn, args) => call(`/rest/v1/rpc/${fn}`, { method: 'POST', body: JSON.stringify(args ?? {}) }),
    get: (path) => call(path, { method: 'GET' }),
  };
}

/** organiser_home_v1 (the app's own list): the owned organiser page and every series name the user can see. */
export function readHome(home) {
  const organisers = Array.isArray(home?.organisers) ? home.organisers : [];
  const owned = organisers.filter((o) => o.role === 'owner');
  const names = new Map();
  for (const o of organisers) for (const s of Array.isArray(o.series) ? o.series : []) names.set(s.name, s.id);
  return { organiserId: owned[0]?.id ?? null, ownedCount: owned.length, names };
}

/** A shape already present by exact name is skipped: a re-run never makes a second copy. */
export const shapesToCreate = (defs, names) => defs.filter((d) => !d.skip && !names.has(shapeName(d.shape)));

async function pickPerson(api, role) {
  for (const q of ['an', 'ar', 'el', 'er', 'in', 'ia']) {
    const rows = await api.rpc('organiser_search_people_v1', { p_query: q, p_role: role, p_limit: 20 });
    const row = Array.isArray(rows) ? rows.find((r) => typeof r.id === 'string') : null;
    if (row) return { profileId: row.id, profileType: role === 'djing' ? 'dj' : 'teacher', role };
  }
  return null;
}

async function workspace(api, seriesId) {
  const ws = await api.rpc('admin_event_workspace_p5', { p_series_id: seriesId });
  const series = ws?.series?.series ?? {};
  const today = londonToday();
  const dates = (Array.isArray(ws?.occurrences) ? ws.occurrences : [])
    .filter((o) => String(o.occurrence_date) >= today)
    .sort((a, b) => String(a.occurrence_date).localeCompare(String(b.occurrence_date)));
  return { version: typeof series.version === 'number' ? series.version : undefined, dates };
}

async function applyShape(api, def, base, log) {
  const ctx = { ...base, shape: def.shape, name: shapeName(def.shape), seriesId: seriesIdFor(def.shape, base.salt), version: undefined, dates: [] };
  ctx.occurrence = (n) => {
    const d = ctx.dates[n - 1];
    if (!d) throw new Error(`no coming date #${n}`);
    return { id: String(d.id), version: typeof d.version === 'number' ? d.version : undefined };
  };
  for (const st of planShape(def, ctx)) {
    if (!st.create) Object.assign(ctx, await workspace(api, ctx.seriesId));
    const { fn, env } = buildStep(st, ctx);
    await api.rpc(fn, { p_envelope: env });
    log(`  ok ${def.shape}/${st.step}`);
  }
  return ctx.seriesId;
}

// ---- main -----------------------------------------------------------------------------

export function parseArgs(argv) {
  const opts = { apply: false, envFile: DEFAULT_ENV_FILE, only: [], today: null, salt: '' };
  for (let i = 0; i < argv.length; i += 1) {
    const a = argv[i];
    if (a === '--apply') opts.apply = true;
    else if (a === '--dry-run') opts.apply = false;
    else if (a === '--env-file') opts.envFile = argv[(i += 1)];
    else if (a === '--only') opts.only.push(argv[(i += 1)]);
    else if (a === '--today') opts.today = argv[(i += 1)];
    else if (a === '--salt') opts.salt = `:${argv[(i += 1)]}`;
    else throw new Error(`unknown argument ${a}`);
  }
  return opts;
}

export async function main({ argv = process.argv.slice(2), fetchImpl = globalThis.fetch, log = console.log, readFile = readFileSync } = {}) {
  let opts;
  try { opts = parseArgs(argv); } catch (e) { log(`walk-seed: ${e.message}`); return 2; }
  const defs = opts.only.length ? SHAPES.filter((d) => opts.only.includes(d.shape)) : SHAPES;
  const today = opts.today ?? londonToday();

  if (!opts.apply) {
    const counts = {};
    for (const def of defs) {
      if (def.skip) { log(`# ${def.shape}: SKIPPED -- ${def.skip}`); continue; }
      const ctx = dryContext(def.shape, today, opts.salt);
      const steps = planShape(def, ctx);
      counts[def.shape] = steps.length;
      log(`# ${def.shape}: ${shapeName(def.shape)} (${steps.length} commands)`);
      for (const st of steps) log(JSON.stringify({ step: st.step, ...buildStep(st, ctx) }));
    }
    log(`# dry run: ${Object.values(counts).reduce((a, b) => a + b, 0)} commands, no network call made. ${JSON.stringify(counts)}`);
    return 0;
  }

  let env;
  try { env = readEnvFile(opts.envFile, readFile); } catch (e) { log(`walk-seed: cannot read env file (${e.code ?? e.message})`); return 2; }
  const missing = ['WALK_TEST_EMAIL', 'WALK_TEST_PASSWORD', 'VITE_SUPABASE_URL', 'VITE_SUPABASE_ANON_KEY'].filter((k) => !env[k]);
  if (missing.length) { log(`walk-seed: env file lacks ${missing.join(', ')}`); return 2; }
  const api = client(env, fetchImpl);
  let base;
  let names;
  try {
    await api.signIn();
    const home = readHome(await api.rpc('organiser_home_v1'));
    if (!home.organiserId) { log('walk-seed: the walk user owns no organiser page'); return 2; }
    if (home.ownedCount > 1) log(`walk-seed: the walk user owns ${home.ownedCount} pages; using the first`);
    names = home.names;
    const reasons = await api.get('/rest/v1/cancellation_reasons?select=key,label&archived_at=is.null&order=sort_order');
    base = {
      organiserId: home.organiserId, startDate: addDays(today, 7), salt: opts.salt,
      reason: Array.isArray(reasons) && reasons[0]?.label ? reasons[0].label : null,
      teacher: null, dj: null,
    };
  } catch (e) { log(`walk-seed: cannot start (${e.message})`); return 2; }

  const manifest = {};
  let failed = 0;
  for (const def of defs) {
    if (def.skip) { log(`skip ${def.shape}: ${def.skip}`); continue; }
    if (names.has(shapeName(def.shape))) { manifest[def.shape] = names.get(shapeName(def.shape)); log(`present ${def.shape}`); continue; }
    try {
      if (def.people && !base.teacher) {
        base.teacher = await pickPerson(api, 'teaching');
        base.dj = await pickPerson(api, 'djing');
        if (!base.teacher || !base.dj) throw new Error('the people search found no teacher or no DJ');
      }
      if (def.shape === 'weekly-cancelled-date' && !base.reason) throw new Error('no cancellation reason to give');
      manifest[def.shape] = await applyShape(api, def, base, log);
    } catch (e) {
      failed += 1;
      log(`FAILED ${def.shape}: ${e.message}`);
    }
  }
  log(JSON.stringify(manifest, null, 2));
  return failed ? 1 : 0;
}

if (isEntryPoint(import.meta.url)) {
  main().then((code) => { process.exitCode = code; });
}

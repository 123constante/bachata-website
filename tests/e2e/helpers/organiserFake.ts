import { expect, type Page, type Route } from '@playwright/test';

// One STATEFUL fake of every RPC / table the new organiser area (/account/o, W0-W5) reads or
// writes, for the organiser-*.spec.ts smoke specs. Like the old organiser specs it answers
// every **/auth/v1/** and **/rest/v1/** call in the browser (page.route), so nothing leaves
// the browser and no Supabase project is touched; e2e-smoke.yml turns
// VITE_ENABLE_ORGANISER_SELF_SERVE on for the dev server. Writes change the fake's state, so a
// spec can assert the exact body the screen sent AND that the screen re-reads the result.
// Shapes follow the parsers in src/modules/organiser/shared (selfServeApi, programmeModel,
// teamModel) and the unit-test fixtures of each screen.

export const projectRef = 'stsdtacfauprzrdebmzg';
export const ME = '11111111-1111-4111-8111-111111111111';
export const EMAIL = 'diego@ritmo.example';
/** Thursday 8 Oct 2026, noon in London. */
export const TODAY = '2026-10-08';
export const NOW = new Date('2026-10-08T11:00:00Z');

export const ORG = 'a0000000-0000-4000-8000-000000000001';
export const ORG_NAME = 'Ritmo Bachata London';
export const FRIDAY = 'b0000000-0000-4000-8000-000000000001';
export const SUNDAY = 'b0000000-0000-4000-8000-000000000002';
export const CITY = { id: 'c1000000-0000-4000-8000-000000000001', name: 'London', slug: 'london' };
export const VENUES = [
  { id: 'd0000000-0000-4000-8000-000000000001', name: 'Studio One', neighbourhood: 'Soho', city_name: 'London', address: null, postcode: null },
  { id: 'd0000000-0000-4000-8000-000000000002', name: 'Salsa Hall', neighbourhood: 'Leith', city_name: 'Edinburgh', address: null, postcode: null },
];
export const REASONS = [
  { key: 'venue_closed', label: 'Venue closed' },
  { key: 'teacher_unavailable', label: 'Teacher unavailable' },
];

export interface Person { id: string; display_name: string; dj_name?: string | null; role: 'teaching' | 'djing'; city_name?: string }
const pid = (n: number) => `e0000000-0000-4000-8000-00000000000${n}`;
export const PEOPLE: Person[] = [
  { id: pid(1), display_name: 'Ana Ruiz', role: 'teaching', city_name: 'London' },
  { id: pid(2), display_name: 'Cleo Park', role: 'teaching', city_name: 'Leeds' },
  { id: pid(3), display_name: 'Eva Sol', role: 'teaching', city_name: 'Leeds' },
  { id: pid(4), display_name: 'Sol Mendez', dj_name: 'DJ Sol', role: 'djing' },
  { id: pid(5), display_name: 'Ben Ortiz', dj_name: 'DJ Ben', role: 'djing' },
  { id: pid(6), display_name: 'Luna Vega', dj_name: 'DJ Luna', role: 'djing' },
];
export const ITEM_CLASS = 'f0000000-0000-4000-8000-000000000001';
export const ITEM_PARTY = 'f0000000-0000-4000-8000-000000000002';

const b64url = (value: unknown) =>
  Buffer.from(JSON.stringify(value)).toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');

export const json = (route: Route, body: unknown, status = 200) =>
  route.fulfill({ status, headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) });

/** A PostgREST refusal: the RPC's RAISE EXCEPTION '<code>' as the client reads it. */
export const refuse = (route: Route, message: string) => json(route, { code: 'P0001', message, details: null, hint: null }, 400);

const addDays = (key: string, n: number) => {
  const d = new Date(`${key}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
};
const weekday = (key: string) => new Date(`${key}T12:00:00Z`).getUTCDay();
const uuid = () => crypto.randomUUID();

interface Rule { mode: 'weekly'; weekdays: number[]; end: { kind: 'until_date'; date: string } | { kind: 'none' } }
export interface FakeSeries {
  id: string;
  name: string;
  slug: string;
  format: string;
  category: string;
  lifecycle_status: string;
  version: number;
  default_venue_id: string | null;
  default_city_id: string | null;
  default_start_date: string;
  default_description: string | null;
  default_ticket_url: string | null;
  default_music_styles: string[];
  gallery: string[];
  video_urls: string[];
  recurrence_rule: Rule | null;
  /** An ended event's last day (event_series_p5.ended_on). */
  ended_on?: string | null;
  removed_dates: string[];
  extra_dates: string[];
  cancelled: Record<string, string>;
  /** Stable index, part of every occurrence id of this series. */
  n: number;
}

interface Session { [k: string]: unknown }
export interface FakeProgramme { version: number; sessions: Session[]; people: Map<string, { profile_id: string; display_name: string; role: string }[]> }

export interface Member { user_id: string; member_role: 'owner' | 'manager'; is_primary: boolean; email: string; display_name: string | null }
export interface IncomingRequest { request_id: string; user_id: string; requester_email: string; message: string | null; created_at: string }
export interface Call { rpc: string; body: Record<string, unknown> }

export interface FakeOrganiser {
  id: string;
  name: string;
  lifecycle_status: string;
  role: 'owner' | 'manager';
  city_id: string | null;
  latest_decision: Record<string, unknown> | null;
  series: string[];
  team: Member[];
  requests: IncomingRequest[];
  instagram: string | null;
  website: string | null;
  bio: string | null;
  contact_email: string | null;
}

export interface Claimable { id: string; name: string; contact_email: string | null; claimed_by: string | null }

export interface FakeOptions {
  /** No organiser yet: Home shows onboarding. */
  noOrganiser?: boolean;
  /** Mailbox-proven session (email code / magic link) vs password. */
  method?: 'otp' | 'password';
  organiserStatus?: string;
  /** Signed out: no session in storage, /auth/v1/user answers 401. */
  signedOut?: boolean;
}

export class OrganiserFake {
  calls: Call[] = [];
  /** rpc name -> refusal message and how many more calls get it. */
  private refusals = new Map<string, { message: string; times: number }>();
  organisers: FakeOrganiser[] = [];
  series = new Map<string, FakeSeries>();
  programmes = new Map<string, FakeProgramme>();
  claimable: Claimable[] = [
    { id: 'a0000000-0000-4000-8000-0000000000c1', name: 'Ritmo Latino Leeds', contact_email: 'Diego@Ritmo.example', claimed_by: null },
    { id: 'a0000000-0000-4000-8000-0000000000c2', name: 'Ritmo Manchester', contact_email: 'priya@latino.example', claimed_by: null },
  ];
  myRequests: Record<string, unknown>[] = [];
  /** Occurrence dates (any series) whose programme names nobody: the Home line-up strip counts them. */
  emptyLineup = new Set<string>();
  private seriesCount = 0;

  constructor(readonly opts: FakeOptions = {}) {
    if (opts.noOrganiser) return;
    const org: FakeOrganiser = {
      id: ORG, name: ORG_NAME, lifecycle_status: opts.organiserStatus ?? 'live', role: 'owner', city_id: CITY.id,
      latest_decision: null, series: [], instagram: 'https://instagram.com/ritmo', website: null, bio: 'Weekly bachata in London.',
      contact_email: EMAIL,
      team: [
        { user_id: ME, member_role: 'owner', is_primary: true, email: EMAIL, display_name: 'Diego R.' },
        { user_id: '22222222-2222-4222-8222-222222222222', member_role: 'owner', is_primary: false, email: 'sofia@ritmo.example', display_name: null },
        { user_id: '33333333-3333-4333-8333-333333333333', member_role: 'manager', is_primary: false, email: 'ana@ritmo.example', display_name: 'Ana M.' },
      ],
      requests: [
        { request_id: 'r0000000-0000-4000-8000-000000000001', user_id: '44444444-4444-4444-8444-444444444444', requester_email: 'maria.k@example.com', message: 'I run the Sunday party with Diego, can I get access?', created_at: '2026-10-03T09:00:00+00:00' },
        { request_id: 'r0000000-0000-4000-8000-000000000002', user_id: '55555555-5555-4555-8555-555555555555', requester_email: 'tom.b@example.com', message: null, created_at: '2026-10-04T09:00:00+00:00' },
      ],
    };
    this.organisers.push(org);
    // 12 Fridays from 9 Oct: plenty of runway, a class and a party each date.
    this.addSeries(org, {
      id: FRIDAY, name: 'Friday Bachata', category: 'class', default_start_date: '2026-10-09',
      recurrence_rule: { mode: 'weekly', weekdays: [5], end: { kind: 'until_date', date: '2026-12-25' } },
    });
    // Two Sundays left: the runway strip; its party has no DJ yet: the line-up strip.
    const sun = this.addSeries(org, {
      id: SUNDAY, name: 'Sunday Party', category: 'party', default_start_date: '2026-10-11',
      recurrence_rule: { mode: 'weekly', weekdays: [0], end: { kind: 'until_date', date: '2026-10-18' } },
    });
    for (const d of this.dates(sun)) this.emptyLineup.add(d);
  }

  addSeries(org: FakeOrganiser, over: Partial<FakeSeries> & { id: string; name: string }): FakeSeries {
    this.seriesCount += 1;
    const s: FakeSeries = {
      slug: over.name.toLowerCase().replace(/[^a-z0-9]+/g, '-'), format: 'recurring', category: 'class', lifecycle_status: 'live',
      version: 3, default_venue_id: VENUES[0].id, default_city_id: CITY.id, default_start_date: TODAY, default_description: 'Friendly night.',
      default_ticket_url: null, default_music_styles: ['Bachata'], gallery: [], video_urls: [], recurrence_rule: null,
      removed_dates: [], extra_dates: [], cancelled: {}, n: this.seriesCount, ...over,
    };
    this.series.set(s.id, s);
    org.series.push(s.id);
    return s;
  }

  occId(s: FakeSeries, date: string) {
    return `c000000${s.n}-0000-4000-8000-${date.replace(/-/g, '')}0000`;
  }

  /** Every date of the series, ascending (past ones included). */
  dates(s: FakeSeries): string[] {
    const out = new Set<string>(s.extra_dates);
    const rule = s.recurrence_rule;
    if (rule) {
      const until = rule.end.kind === 'until_date' ? rule.end.date : addDays(s.default_start_date, 7 * 52);
      for (let d = s.default_start_date; d <= until; d = addDays(d, 1)) if (rule.weekdays.includes(weekday(d))) out.add(d);
    } else {
      out.add(s.default_start_date);
    }
    return [...out].filter((d) => !s.removed_dates.includes(d)).sort();
  }

  upcoming(s: FakeSeries) {
    return this.dates(s).filter((d) => d >= TODAY);
  }

  findOccurrence(occurrenceId: string): { s: FakeSeries; date: string } | null {
    for (const s of this.series.values()) {
      const date = this.dates(s).find((d) => this.occId(s, d) === occurrenceId);
      if (date) return { s, date };
    }
    return null;
  }

  programme(occurrenceId: string): FakeProgramme {
    let p = this.programmes.get(occurrenceId);
    if (p) return p;
    const found = this.findOccurrence(occurrenceId);
    const party = found?.s.category === 'party';
    const empty = found ? this.emptyLineup.has(found.date) : false;
    const sessions: Session[] = party
      ? [{ series_item_id: ITEM_PARTY, type: 'party', title: 'Party', start_time: '21:00', end_time: '01:00', ends_next_day: true, level_keys: [], removed: false }]
      : [
          { series_item_id: ITEM_CLASS, type: 'class', title: 'Beginners', start_time: '20:00', end_time: '21:00', ends_next_day: false, level_keys: ['beginner'], removed: false },
          { series_item_id: ITEM_PARTY, type: 'party', title: 'Party', start_time: '21:00', end_time: '23:30', ends_next_day: false, level_keys: [], removed: false },
        ];
    const people = new Map<string, { profile_id: string; display_name: string; role: string }[]>();
    if (!empty && !party) {
      people.set(ITEM_CLASS, [{ profile_id: PEOPLE[0].id, display_name: 'Ana Ruiz', role: 'teaching' }]);
      people.set(ITEM_PARTY, [{ profile_id: PEOPLE[3].id, display_name: 'DJ Sol', role: 'djing' }]);
    }
    p = { version: 1, sessions, people };
    this.programmes.set(occurrenceId, p);
    return p;
  }

  homeRead() {
    return {
      today: TODAY,
      organisers: this.organisers.map((o) => ({
        id: o.id, name: o.name, slug: o.name.toLowerCase().replace(/[^a-z0-9]+/g, '-'), avatar_url: null, city_id: o.city_id,
        lifecycle_status: o.lifecycle_status, role: o.role, is_primary: o.role === 'owner', joined_at: '2026-09-01T10:00:00+00:00',
        latest_decision: o.latest_decision,
        team: o.team.map((m) => ({ ...m, joined_at: '2026-09-01T10:00:00+00:00', is_self: m.user_id === ME })),
        series: o.series.map((id) => {
          const s = this.series.get(id)!;
          const up = this.upcoming(s);
          return {
            id: s.id, name: s.name, slug: s.slug, format: s.format, category: s.category, lifecycle_status: s.lifecycle_status,
            default_local_start_time: '20:00:00', default_venue_name: VENUES.find((v) => v.id === s.default_venue_id)?.name ?? null,
            upcoming_count: up.length, latest_decision: null, version: s.version,
            next_dates: up.slice(0, 3).map((d) => ({
              occurrence_id: this.occId(s, d), occurrence_date: d, lifecycle_status: s.cancelled[d] ? 'cancelled' : 'scheduled',
              materialised_start_utc: `${d}T19:00:00+00:00`, has_own_changes: false, version: 1,
              venue_name: VENUES.find((v) => v.id === s.default_venue_id)?.name ?? null,
            })),
          };
        }),
      })),
    };
  }

  workspace(s: FakeSeries) {
    const { n: _n, extra_dates: _e, cancelled: _c, gallery, video_urls, default_music_styles, ...series } = s;
    return {
      meta: { version: s.version, has_more: false },
      series: {
        series: { ...series, default_local_start_time: '20:00:00', default_duration: null, default_level: null, default_cover_image_url: null,
          instagram_url: null, passes: null, created_at: '2026-09-01T10:00:00+00:00', gallery, video_urls, default_music_styles },
        program: [],
      },
      occurrences: [...this.dates(s)].reverse().map((d) => ({
        id: this.occId(s, d), occurrence_date: d, lifecycle_status: s.cancelled[d] ? 'cancelled' : 'scheduled', version: 1,
        has_override: false, session_overrides_count: 0, added_sessions_count: 0, materialised_start_utc: `${d}T19:00:00+00:00`,
      })),
    };
  }

  dateDetail(s: FakeSeries, date: string) {
    return {
      event: {
        name: s.name, venue_id: s.default_venue_id, ticket_url: null, description: s.default_description, cover_image_url: null,
        venue_id_override: null, ticket_url_override: null, description_override: null, cover_image_url_override: null,
        cancellation_reason_label: s.cancelled[date] ?? null,
      },
      program: [],
      schedule: { timezone: 'Europe/London', local_start_time: '20:00:00', local_end_time: '23:30:00' },
      occurrence: { id: this.occId(s, date), date, version: 1, series_id: s.id, lifecycle_status: s.cancelled[date] ? 'cancelled' : 'scheduled',
        materialised_start_utc: `${date}T19:00:00+00:00` },
      added_sessions: [],
    };
  }

  /** Programme writer: like the real one, a date-only session is RE-CREATED under a new id on every save. */
  saveProgramme(occurrenceId: string, sent: Session[]) {
    const p = this.programme(occurrenceId);
    const people = new Map<string, { profile_id: string; display_name: string; role: string }[]>();
    const sessions: Session[] = [];
    for (const el of sent) {
      const oldKey = (el.series_item_id ?? el.added_session_id) as string | undefined;
      if (el.removed && !el.series_item_id) continue;
      const { people_add, people_remove, new: _new, ...rest } = el as Session & { people_add?: { profile_id: string; role: string }[]; people_remove?: string[] };
      const row: Session = { ...rest, removed: el.removed === true };
      let key: string;
      if (el.series_item_id) key = el.series_item_id as string;
      else {
        delete row.added_session_id;
        key = uuid();
        row.added_session_id = key;
      }
      sessions.push(row);
      let list = oldKey ? [...(p.people.get(oldKey) ?? [])] : [];
      list = list.filter((x) => !(people_remove ?? []).includes(x.profile_id));
      for (const a of people_add ?? []) {
        const who = PEOPLE.find((x) => x.id === a.profile_id);
        list.push({ profile_id: a.profile_id, display_name: (a.role === 'djing' ? who?.dj_name : null) ?? who?.display_name ?? '?', role: a.role });
      }
      if (list.length) people.set(key, list);
    }
    p.sessions = sessions;
    p.people = people;
    p.version += 1;
    return { ok: true, changed: true, version: p.version, sessions };
  }

  programmeRead(occurrenceId: string) {
    const found = this.findOccurrence(occurrenceId);
    const p = this.programme(occurrenceId);
    // The reader's own refusals (organiser_set_occurrence_programme_v1): closed event, cancelled date, past date.
    const reason = !found ? null
      : ['ended', 'archived'].includes(found.s.lifecycle_status) ? 'series_closed'
        : found.s.cancelled[found.date] ? 'date_cancelled'
          : found.date < TODAY ? 'past_date' : null;
    return {
      occurrence_id: occurrenceId, series_id: found?.s.id ?? null, occurrence_date: found?.date ?? null, version: p.version,
      editable: reason === null, not_editable_reason: reason, sessions: p.sessions,
      session_people: [...p.people.entries()].map(([key, people]) => {
        const s = p.sessions.find((x) => x.series_item_id === key || x.added_session_id === key);
        return { ...(s?.series_item_id ? { series_item_id: key } : { added_session_id: key }), people };
      }),
    };
  }

  seriesCommand(env: { target_id: string; expected_version?: number; command: { kind: string; payload: Record<string, unknown> } }) {
    const { kind, payload } = env.command;
    let s = this.series.get(env.target_id);
    if (kind === 'series.upsert' && !s) {
      const ids = (payload.organiser_ids as string[] | undefined) ?? [];
      const org = this.organisers.find((o) => ids.includes(o.id));
      if (!org) return { refusal: 'permission_denied: series.upsert (create)' };
      s = this.addSeries(org, {
        id: env.target_id, name: String(payload.name), category: String(payload.category ?? 'class'),
        format: String(payload.format ?? 'recurring'), lifecycle_status: 'draft', version: 0,
        default_start_date: String(payload.default_start_date ?? TODAY), default_venue_id: null,
        default_city_id: (payload.default_city_id as string | undefined) ?? null, default_description: null, default_music_styles: [],
      });
      s.version = 1;
      return { ok: true, data: { series_id: s.id }, audit_id: 'a', new_version: s.version };
    }
    if (!s) return { refusal: 'not_found: series' };
    if (env.expected_version !== s.version) return { refusal: `version_conflict: expected ${env.expected_version}, got ${s.version}` };
    if (kind === 'series.upsert') {
      for (const [k, v] of Object.entries(payload)) {
        if (k === 'default_gallery') s.gallery = v as string[];
        else if (k === 'default_video_urls') s.video_urls = v as string[];
        else if (k in s) (s as unknown as Record<string, unknown>)[k] = v;
      }
    } else if (kind === 'series.set_recurrence') {
      s.recurrence_rule = payload as unknown as Rule;
    } else if (kind === 'series.stop_repeating') {
      s.recurrence_rule = null;
    } else if (kind === 'series.add_date') {
      s.extra_dates.push(String(payload.date));
      s.removed_dates = s.removed_dates.filter((d) => d !== String(payload.date));
    } else if (kind === 'series.unskip_date') {
      s.removed_dates = s.removed_dates.filter((d) => d !== String(payload.date));
    } else if (kind === 'series.remove_date') {
      s.removed_dates.push(String(payload.date));
    } else if (kind === 'series.skip_date') {
      const hit = this.findOccurrence(String(payload.occurrence_id));
      if (hit) s.removed_dates.push(hit.date);
    }
    s.version += 1;
    return { ok: true, data: {}, audit_id: 'a', new_version: s.version };
  }

  async install(page: Page) {
    const user = { id: ME, aud: 'authenticated', role: 'authenticated', email: EMAIL, user_metadata: {} };
    const method = this.opts.method ?? 'otp';
    const token = `${b64url({ alg: 'HS256', typ: 'JWT' })}.${b64url({ sub: ME, role: 'authenticated', amr: [{ method, timestamp: 1 }] })}.sig`;
    await page.clock.setFixedTime(NOW);
    if (!this.opts.signedOut) {
      await page.addInitScript(
        ({ value, ref }) => localStorage.setItem(`sb-${ref}-auth-token`, JSON.stringify(value)),
        { value: { access_token: token, token_type: 'bearer', expires_in: 3600, expires_at: 4102444800, refresh_token: 'r', user }, ref: projectRef },
      );
    }
    await page.route('**/auth/v1/**', (route) => {
      const url = route.request().url();
      this.calls.push({ rpc: `auth:${new URL(url).pathname.split('/auth/v1/')[1]}`, body: route.request().postDataJSON?.() ?? {} });
      if (url.includes('/auth/v1/user')) return this.opts.signedOut ? json(route, { message: 'no session' }, 401) : json(route, user);
      if (url.includes('/auth/v1/verify')) {
        return json(route, { access_token: token, token_type: 'bearer', expires_in: 3600, expires_at: 4102444800, refresh_token: 'r2', user });
      }
      return json(route, {});
    });
    await page.route('**/rest/v1/**', (route) => this.answer(route));
  }

  private answer(route: Route) {
    const req = route.request();
    const url = new URL(req.url());
    const path = url.pathname;
    const body = (req.postDataJSON?.() ?? {}) as Record<string, unknown>;
    const rpc = path.match(/\/rpc\/([a-z0-9_]+)$/)?.[1];
    const table = rpc ? null : path.match(/\/rest\/v1\/([a-z_]+)$/)?.[1];
    const single = (req.headers()['accept'] ?? '').includes('vnd.pgrst.object');
    const rows = (list: unknown[]) => json(route, single ? list[0] ?? null : list);

    if (table) {
      this.calls.push({ rpc: `table:${table}`, body: Object.fromEntries(url.searchParams) });
      if (table === 'cancellation_reasons') return rows(REASONS);
      if (table === 'cities') return rows([{ id: CITY.id, name: CITY.name, slug: CITY.slug }]);
      if (table === 'organiser_profiles') {
        const id = url.searchParams.get('id')?.replace(/^eq\./, '');
        if (id) {
          const o = this.organisers.find((x) => x.id === id);
          return rows(o ? [{
            id: o.id, name: o.name, avatar_url: null, bio: o.bio, claimed_by: ME, socials: null, city_id: o.city_id, instagram: o.instagram,
            website: o.website, contact_email: o.contact_email, contact_phone: null, organisation_category: null, founded_year: null,
            lifecycle_status: o.lifecycle_status, slug: null, is_active: true,
          }] : []);
        }
        const term = (url.searchParams.get('name') ?? '').replace(/^ilike\.|%/g, '').toLowerCase();
        return rows(this.claimable.filter((c) => c.name.toLowerCase().includes(term)).map((c) => ({ ...c, slug: null, avatar_url: null, city_id: null })));
      }
      return rows([]);
    }
    if (!rpc) return json(route, []);
    this.calls.push({ rpc, body });
    const refusal = this.refusals.get(rpc);
    if (refusal) {
      if (--refusal.times <= 0) this.refusals.delete(rpc);
      return refuse(route, refusal.message);
    }
    const org = (id: unknown) => this.organisers.find((o) => o.id === id);

    switch (rpc) {
      case 'organiser_home_v1':
        return json(route, this.homeRead());
      case 'list_organiser_access_requests_v1':
        if (body.p_scope === 'mine') return json(route, this.myRequests);
        return json(route, (org(body.p_organiser_id)?.requests ?? []).map((r) => ({ ...r, organiser_id: body.p_organiser_id, organiser_name: org(body.p_organiser_id)?.name })));
      case 'resolve_organiser_access_request_v1': {
        for (const o of this.organisers) {
          const r = o.requests.find((x) => x.request_id === body.p_request_id);
          if (!r) continue;
          o.requests = o.requests.filter((x) => x !== r);
          if (body.p_decision === 'grant') o.team.push({ user_id: r.user_id, member_role: 'manager', is_primary: false, email: r.requester_email, display_name: null });
          return json(route, { request_id: r.request_id, user_id: r.user_id, decision: body.p_decision, member_role: body.p_decision === 'grant' ? 'manager' : null });
        }
        return refuse(route, 'request_not_open');
      }
      case 'remove_organiser_member_v1': {
        const o = org(body.p_organiser_id);
        const m = o?.team.find((x) => x.user_id === body.p_user_id);
        if (!o || !m) return refuse(route, 'not_a_member');
        o.team = o.team.filter((x) => x !== m);
        return json(route, { user_id: m.user_id, member_role: m.member_role, removed_rows: 1, self_removed: m.user_id === ME, primary_passed_to: null, audit_id: 'a' });
      }
      case 'claim_organiser_v1': {
        const c = this.claimable.find((x) => x.id === body.p_organiser_id);
        if (!c) return refuse(route, 'not_found');
        this.claimable = this.claimable.filter((x) => x !== c);
        this.organisers.push({ id: c.id, name: c.name, lifecycle_status: 'live', role: 'owner', city_id: CITY.id, latest_decision: null, series: [],
          team: [{ user_id: ME, member_role: 'owner', is_primary: true, email: EMAIL, display_name: null }], requests: [], instagram: null, website: null, bio: null, contact_email: EMAIL });
        return json(route, { organiser_id: c.id, already_claimed: false, owner_seeded: true });
      }
      case 'request_organiser_access_v1': {
        const c = this.claimable.find((x) => x.id === body.p_organiser_id);
        this.myRequests.push({ request_id: uuid(), organiser_id: body.p_organiser_id, organiser_name: c?.name ?? null, status: 'open', created_at: NOW.toISOString(), resolved_at: null });
        return json(route, { request_id: 'r1', status: 'open' });
      }
      case 'create_organiser_profile_v1': {
        const id = 'a0000000-0000-4000-8000-0000000000aa';
        this.organisers.push({ id, name: String(body.p_name), lifecycle_status: 'draft', role: 'owner', city_id: (body.p_city_id as string) ?? null,
          latest_decision: null, series: [], team: [{ user_id: ME, member_role: 'owner', is_primary: true, email: EMAIL, display_name: null }],
          requests: [], instagram: null, website: null, bio: null, contact_email: EMAIL });
        return json(route, { organiser_id: id, slug: null, lifecycle_status: 'draft', member_role: 'owner', is_primary: true });
      }
      case 'submit_organiser_profile_v1': {
        const o = org(body.p_organiser_id);
        const from = o?.lifecycle_status;
        if (o) o.lifecycle_status = 'pending_review';
        return json(route, { organiser_id: body.p_organiser_id, from_state: from, lifecycle_status: 'pending_review', audit_id: 'a1' });
      }
      case 'organiser_profile_update_p5_v1': {
        const o = org(body.p_organiser_id);
        const patch = (body.p_patch ?? {}) as Record<string, unknown>;
        if (!o) return refuse(route, 'permission_denied');
        o.name = String(patch.name ?? o.name);
        o.instagram = (patch.instagram as string | null) ?? null;
        o.website = (patch.website as string | null) ?? null;
        o.bio = (patch.bio as string | null) ?? null;
        o.city_id = (patch.city_id as string | null) ?? o.city_id;
        return json(route, { ok: true });
      }
      case 'search_cities':
        return json(route, [{ city_id: CITY.id, city_name: 'London', city_slug: 'london', country_name: 'United Kingdom', display_name: 'London, United Kingdom' }]);
      case 'admin_event_workspace_p5': {
        const s = this.series.get(String(body.p_series_id));
        return s ? json(route, this.workspace(s)) : refuse(route, 'permission_denied');
      }
      case 'event_view_p5': {
        const hit = this.findOccurrence(String((body.p_target as Record<string, unknown> | undefined)?.occurrence_id));
        return hit ? json(route, this.dateDetail(hit.s, hit.date)) : refuse(route, 'not_found: occurrence');
      }
      case 'series_command_p5':
      case 'occurrence_command_p5': {
        const env = body.p_envelope as Parameters<OrganiserFake['seriesCommand']>[0];
        if (rpc === 'occurrence_command_p5') {
          const hit = this.findOccurrence(env.target_id);
          if (!hit) return refuse(route, 'not_found: occurrence');
          if (env.command.kind === 'occurrence.cancel') {
            if (env.command.payload.cancelled) hit.s.cancelled[hit.date] = String(env.command.payload.reason);
            else delete hit.s.cancelled[hit.date];
          }
          return json(route, { ok: true, data: {}, audit_id: 'a', new_version: 2 });
        }
        const out = this.seriesCommand(env);
        return 'refusal' in out ? refuse(route, String(out.refusal)) : json(route, out);
      }
      case 'organiser_get_occurrence_programme_v1':
        return this.findOccurrence(String(body.p_occurrence_id))
          ? json(route, this.programmeRead(String(body.p_occurrence_id)))
          : refuse(route, 'not_found');
      case 'organiser_set_occurrence_programme_v1': {
        const p = this.programme(String(body.p_occurrence_id));
        if (body.p_expected_version !== p.version) return refuse(route, `version_conflict: expected ${body.p_expected_version}, found ${p.version}`);
        return json(route, this.saveProgramme(String(body.p_occurrence_id), body.p_sessions as Session[]));
      }
      case 'organiser_search_people_v1': {
        const q = String(body.p_query).toLowerCase();
        return json(route, PEOPLE.filter((p) => p.role === body.p_role && `${p.display_name} ${p.dj_name ?? ''}`.toLowerCase().includes(q))
          .map((p) => ({ id: p.id, display_name: p.display_name, dj_name: p.dj_name ?? null, photo_url: null, city_name: p.city_name ?? null, country_code: 'GB', roles: [p.role] })));
      }
      case 'get_organiser_venue_options_v1':
      case 'get_public_venues_list_v4':
        return json(route, VENUES);
      default:
        return json(route, []);
    }
  }

  /** The next `times` calls to `rpc` are refused with `message` (the app retries a failed read once). */
  refuse(rpc: string, message: string, times = 1) {
    this.refusals.set(rpc, { message, times });
  }

  /** The bodies sent to one RPC, oldest first. */
  sent(rpc: string) {
    return this.calls.filter((c) => c.rpc === rpc).map((c) => c.body);
  }

  envelopes(rpc = 'series_command_p5') {
    return this.sent(rpc).map((b) => b.p_envelope as { target_id: string; expected_version?: number; idempotency_key: string; command: { kind: string; payload: Record<string, unknown> } });
  }
}

/** Install the fake on the page and open `path`. */
export async function openOrganiser(page: Page, path: string, opts: FakeOptions = {}, setup?: (fake: OrganiserFake) => void) {
  const fake = new OrganiserFake(opts);
  setup?.(fake);
  await fake.install(page);
  await page.goto(path);
  return fake;
}

export const PHONE = { width: 390, height: 844 };
export const WIDE = { width: 1280, height: 800 };

/**
 * A fake on-screen keyboard: visualViewport reports `px` less height than the window (what
 * iOS / Android do), and fires resize, which is all useKeyboardInset reads. Call AFTER goto.
 */
export async function setKeyboard(page: Page, px: number) {
  await page.evaluate((kb) => {
    const vv = window.visualViewport;
    if (!vv) throw new Error('no visualViewport');
    Object.defineProperty(vv, 'height', { configurable: true, get: () => window.innerHeight - kb });
    Object.defineProperty(vv, 'offsetTop', { configurable: true, get: () => 0 });
    vv.dispatchEvent(new Event('resize'));
  }, px);
}

/** No page-level horizontal scroll. */
export async function expectNoHorizontalScroll(page: Page) {
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  expect(overflow).toBeLessThanOrEqual(0);
}

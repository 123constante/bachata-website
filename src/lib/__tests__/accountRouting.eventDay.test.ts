/**
 * Organiser area v2 slice 1b: event-day landing (Q1, Q2, A4, A5, A8; OPEN:11 decided).
 * Pure cells over lib/accountRouting eventDayLanding + liveTonightIds. Person types are the
 * brief's P-numbers; P2 / P4 / P12 / P14 shapes are seeded fixtures, not prod accounts.
 */
import { describe, expect, it } from 'vitest';
import {
  eventDayLanding,
  liveTonightIds,
  profileSides,
  signInLanding,
  type AreaPage,
  type SidesFacts,
  type TonightHome,
} from '@/lib/accountRouting';
import { attentionItems, type HomeSeriesFull } from '@/modules/organiser/shared/homeModel';

const TODAY = '2026-11-09';
const HOME = '/account/p3';
const A = { id: 'org-a', name: 'Bachata Nights', avatar_url: null };
const B = { id: 'org-b', name: 'Sensual Sundays', avatar_url: null };
const TEACHER: AreaPage = { role: 'teacher', key: 'teacher', to: '/account/t' };
const DJ: AreaPage = { role: 'dj', key: 'dj', to: '/account/dj' };

const facts = (organisers: SidesFacts['organisers'], dancer: SidesFacts['dancer'] = 'complete'): SidesFacts => ({
  organisers,
  dancer,
  areaAllowed: true,
  dancerFace: null,
  organiserHomeTo: HOME,
  openRequestCount: 0,
  isAdmin: false,
});

const run = (f: SidesFacts, opts: { areas?: AreaPage[] | null; live?: string[] | null | undefined; p3Live?: boolean; returnTo?: string | null } = {}) => {
  const state = profileSides(f);
  const live = opts.live === undefined ? new Set<string>() : opts.live === null ? null : new Set(opts.live);
  return eventDayLanding({
    base: signInLanding(f, opts.returnTo ?? null),
    sides: state.status === 'ready' ? state.sides : [],
    areas: opts.areas === undefined ? [] : opts.areas,
    liveTonight: 'live' in opts && opts.live === undefined ? undefined : live,
    p3Live: opts.p3Live ?? true,
  });
};

const keys = (l: ReturnType<typeof run>) => (l.kind === 'choose' ? [...l.sides.map((s) => s.key), ...l.areas.map((a) => a.key)] : l);

describe('eventDayLanding: person types x journeys', () => {
  it('P1 organiser, 1 page, owner, no dancer: straight in, no chooser', () => {
    expect(run(facts([A], 'no_profile'))).toEqual({ kind: 'go', to: HOME });
  });
  it('P7 caught-up organiser, one page with a live event today: lands on the page, no chooser', () => {
    expect(run(facts([A], 'no_profile'), { live: ['org-a'] })).toEqual({ kind: 'go', to: HOME });
  });
  it('P2 two pages (seeded), no event today: chooser on every sign-in, a second sign-in the same day too', () => {
    const first = run(facts([A, B]));
    const second = run(facts([A, B]));
    expect(keys(first)).toEqual(['organiser:org-a', 'organiser:org-b', 'dancer']);
    expect(second).toEqual(first);
  });
  it('P2 two pages (seeded), live event today on one: lands on that page', () => {
    expect(run(facts([A, B]), { live: ['org-b'] })).toEqual({ kind: 'go', to: `${HOME}?o=org-b` });
  });
  it('P2 two live pages today (seeded): chooser with Live tonight on both', () => {
    const l = run(facts([A, B]), { live: ['org-a', 'org-b'] });
    expect(l.kind).toBe('choose');
    if (l.kind === 'choose') expect([...l.liveTonight].sort()).toEqual(['org-a', 'org-b']);
  });
  it('P4 manager (seeded): the same landing as P2 for the manager\u2019s pages', () => {
    expect(run(facts([A, B]), { live: ['org-a'] })).toEqual({ kind: 'go', to: `${HOME}?o=org-a` });
  });
  it('a live event on a page the person does NOT hold never moves the landing', () => {
    const l = run(facts([A, B]), { live: ['org-zz'] });
    expect(l.kind).toBe('choose');
    if (l.kind === 'choose') expect(l.liveTonight.has('org-a') || l.liveTonight.has('org-b')).toBe(false);
  });
  it('P3 organiser + teacher + DJ + dancer: chooser lists all four kinds', () => {
    expect(keys(run(facts([A]), { areas: [TEACHER, DJ] }))).toEqual(['organiser:org-a', 'dancer', 'teacher', 'dj']);
  });
  it('P3 with a live event today: lands on the organiser page holding it, teacher / DJ pages notwithstanding', () => {
    expect(run(facts([A]), { areas: [TEACHER, DJ], live: ['org-a'] })).toEqual({ kind: 'go', to: HOME });
  });
  it('P14 teacher + dancer, no organiser page: chooser lists the dancer and teacher pages', () => {
    expect(keys(run(facts([]), { areas: [TEACHER] }))).toEqual(['dancer', 'teacher']);
  });
  it('P14 DJ only (no dancer, no organiser page): no organiser or dancer side: the no-side landing, unchanged', () => {
    // No dancer side and no organiser seat: signInLanding's no-side rule is untouched (P12-style: nothing new).
    expect(run(facts([], 'no_profile'), { areas: [DJ] })).toEqual({ kind: 'go', to: '/app/welcome' });
  });
  it('P5 claim pending: no organiser entry; only the pages it holds', () => {
    expect(keys(run(facts([]), { areas: [] }))).toEqual({ kind: 'go', to: '/app/home' });
    expect(keys(run(facts([]), { areas: [TEACHER] }))).toEqual(['dancer', 'teacher']);
  });
  it('P6 unfinished dancer + organiser: the chooser still lists the dancer area', () => {
    expect(keys(run(facts([A], 'incomplete')))).toEqual(['organiser:org-a', 'dancer']);
  });
  it('P12 interim seat (0 seats), dancer only: nothing new appears', () => {
    expect(run(facts([]))).toEqual({ kind: 'go', to: '/app/home' });
  });
  it('P15 / A14: a returnTo (door or short link) always wins; the event is never consulted', () => {
    expect(run(facts([A, B]), { returnTo: '/e/abc', live: ['org-a'] })).toEqual({ kind: 'go', to: '/e/abc' });
  });
  it('waits (never a blank screen) while the roles or the home are loading', () => {
    expect(eventDayLanding({ base: signInLanding(facts([A, B]), null), sides: [], areas: undefined, liveTonight: new Set(), p3Live: true })).toEqual({ kind: 'wait' });
    const f = facts([A, B]);
    expect(eventDayLanding({ base: signInLanding(f, null), sides: [], areas: [], liveTonight: undefined, p3Live: true })).toEqual({ kind: 'wait' });
  });
  it('a failed roles or home read lands as today (never stranded)', () => {
    expect(run(facts([A], 'no_profile'), { areas: null, live: null })).toEqual({ kind: 'go', to: HOME });
    expect(keys(run(facts([A, B]), { areas: null, live: null }))).toEqual(['organiser:org-a', 'organiser:org-b', 'dancer']);
  });
});

describe('eventDayLanding: flag off (A8) = today\u2019s landing, nothing new', () => {
  const CELLS: Array<[string, SidesFacts, string[]]> = [
    ['one page', facts([A], 'no_profile'), []],
    ['two pages, one live today', facts([A, B]), ['org-a']],
    ['organiser + teacher + DJ', facts([A]), ['org-a']],
  ];
  it.each(CELLS)('%s', (_n, f, live) => {
    const base = signInLanding(f, null);
    const l = eventDayLanding({ base, sides: [], areas: [TEACHER, DJ], liveTonight: new Set(live), p3Live: false });
    if (base.kind === 'choose') expect(l).toEqual({ kind: 'choose', sides: base.sides, areas: [], liveTonight: new Set() });
    else expect(l).toEqual(base);
  });
});

describe('liveTonightIds: the organiser home\u2019s own "on tonight" rule', () => {
  const date = (d: string, status = 'scheduled') => ({ occurrence_id: d, occurrence_date: d, lifecycle_status: status, materialised_start_utc: null, has_own_changes: false });
  const series = (id: string, lifecycle: string, dates: ReturnType<typeof date>[]): HomeSeriesFull => ({
    id, name: id, slug: null, format: null, category: null, lifecycle_status: lifecycle, default_local_start_time: null,
    default_cover_image_url: null, created_at: TODAY, upcoming_count: dates.length, cancelled_upcoming_count: 0, next_dates: dates, latest_decision: null,
  });
  const SHAPES: Array<[string, HomeSeriesFull[], boolean]> = [
    ['0 events', [], false],
    ['1 live event today', [series('s1', 'live', [date(TODAY)])], true],
    ['1 live event tomorrow', [series('s1', 'live', [date('2026-11-10')])], false],
    ['draft event today', [series('s1', 'draft', [date(TODAY)])], false],
    ['live event, today cancelled', [series('s1', 'live', [date(TODAY, 'cancelled')])], false],
    ['archived event today', [series('s1', 'archived', [date(TODAY)])], false],
    ['many events, one live today', [series('s1', 'draft', [date(TODAY)]), series('s2', 'live', [date('2026-11-12')]), series('s3', 'live', [date(TODAY), date('2026-11-16')])], true],
  ];
  it.each(SHAPES)('%s', (_n, s, on) => {
    const home: TonightHome = { today: TODAY, organisers: [{ id: 'org-a', series: s }] };
    expect(liveTonightIds(home)?.has('org-a')).toBe(on);
    // Parity: the same answer as the organiser home's "is on tonight" notice.
    expect(attentionItems(s, TODAY).some((i) => i.kind === 'tonight')).toBe(on);
  });
  it('loading and failed reads pass through', () => {
    expect(liveTonightIds(undefined)).toBeUndefined();
    expect(liveTonightIds(null)).toBeNull();
  });
});

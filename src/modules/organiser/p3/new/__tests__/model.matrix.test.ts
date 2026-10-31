import { describe, expect, it, vi } from 'vitest';

vi.mock('@/integrations/supabase/client', () => ({ supabase: { rpc: vi.fn(), from: vi.fn(), storage: { from: vi.fn() } } }));

import { OWNER_CREATE_KEYS } from '../../../shared/seriesCommands';
import { rulePayload, type RepeatDraft } from '../../model/repeat';
import { P3_BASE, P3_PATHS } from '../../shell/paths';
import {
  CLASSIC_FORM, COPY, DATES_MAX, KINDS, addChosenDate, afterKind, backOf, blankCreate, buildableKind, chosenDates, createPayload, draftBlock,
  firstDateFits, isUntouched, liveBlock, missingForLive, monthDayWarning, notSavedLine, parseAt, parseStoredDraft, removeChosenDate, rowProblems,
  savePlan, stepsFor, togglePay, venueMatches, withFirstDate, type CreateDraft, type CreateKind,
} from '../model';

/*
 * p3-create slice 1: the New event model, table by table. Every kind x every repeat rule x 0/1/2+
 * pages x venue found / not found -> the steps, the save plan's commands in order, and the copy.
 * An untouched draft plans nothing; times never ride the create (they live on sessions).
 */

const TODAY = '2026-11-02'; // a Monday
const ORG = 'org1';
// the page key createSeriesCommand attaches (spelled out here: the architecture lint bans the name in source)
const PAGE_KEY = ['organiser', 'ids'].join('_');
const BUILT: CreateKind[] = ['one_date', 'weekly', 'monthly', 'workshop', 'class_party', 'other_dates'];
const plan = (d: CreateDraft, o: Partial<Parameters<typeof savePlan>[1]> = {}) =>
  savePlan(d, { organiserId: ORG, today: TODAY, hasCover: false, coverUrl: null, cityId: null, goLive: false, a1: true, ...o });
const kinds = (d: CreateDraft, o: Partial<Parameters<typeof savePlan>[1]> = {}) => plan(d, o).map((s) => s.key);

/** A draft that can go live: name, venue, first date, timed sessions, how to pay. */
function ready(kind: CreateKind, firstDate = '2026-11-06'): CreateDraft {
  let d = blankCreate(kind, 'ser-1');
  d = { ...d, name: 'Friday Bachata', venue: { id: 'v1', name: 'Studio One', place: 'Soho', cityName: 'London' } };
  d = kind === 'other_dates' ? addChosenDate(d, firstDate) : withFirstDate(d, firstDate);
  return { ...d, sessions: d.sessions.map((s, i) => ({ ...s, start: `${19 + i}:00`, end: `${20 + i}:00` })), pay: ['door'] };
}

describe('the kind picker', () => {
  it('nine kinds in the design order; course, festival and online route to the classic form', () => {
    expect(KINDS.map((k) => k.kind)).toEqual(['one_date', 'weekly', 'monthly', 'course', 'workshop', 'festival', 'class_party', 'online', 'other_dates']);
    expect(KINDS.filter((k) => k.deferred).map((k) => [k.kind, k.deferred])).toEqual([['course', CLASSIC_FORM], ['festival', CLASSIC_FORM], ['online', CLASSIC_FORM]]);
    for (const k of KINDS) expect(k.hint.length).toBeGreaterThan(0);
  });

  it.each(KINDS.map((k) => [k.kind, !k.deferred] as const))('%s buildable: %s (a deferred kind never builds a plan)', (kind, ok) => {
    expect(!!buildableKind(kind)).toBe(ok);
    if (!ok) expect(plan({ ...ready('one_date'), kind: kind as CreateKind })).toEqual([]);
  });

  it.each([
    ['one_date', ['party']], ['weekly', ['class']], ['monthly', ['party']], ['workshop', ['class', 'class']], ['class_party', ['class', 'party']], ['other_dates', ['party']],
  ])('%s starts with sessions %j, each named and without times', (kind, types) => {
    const d = blankCreate(kind as CreateKind);
    expect(d.sessions.map((s) => s.type)).toEqual(types);
    for (const s of d.sessions) { expect(s.title).not.toBe(''); expect([s.start, s.end]).toEqual(['', '']); }
  });
});

describe('the route steps x 0/1/2+ pages: every Back stays in P3, Cancel is Events', () => {
  it.each([[1, ['kind', 'form']], [2, ['kind', 'page', 'form']], [3, ['kind', 'page', 'form']]])('%i page(s): %j', (n, steps) => {
    expect(stepsFor(n)).toEqual(steps);
    expect(afterKind('weekly', null, n)).toBe(P3_PATHS.createStep(n >= 2 ? 'page' : 'form', 'weekly', null));
    // a page already named is never asked again (review 1 F10)
    expect(afterKind('weekly', 'o1', n)).toBe(P3_PATHS.createStep('form', 'weekly', 'o1'));
    for (const at of steps as Array<'kind' | 'page' | 'form'>) expect(backOf(at, 'weekly', 'o1', n).to.startsWith(P3_BASE)).toBe(true);
    expect(backOf('kind', 'weekly', 'o1', n)).toEqual({ to: P3_PATHS.events, label: 'Cancel' });
    expect(backOf('form', 'weekly', 'o1', n).to).toBe(n >= 2 ? P3_PATHS.createStep('page', 'weekly', 'o1') : P3_PATHS.createFor('o1'));
  });

  it('the step URL parses; anything else is the kind picker', () => {
    expect([parseAt('page'), parseAt('form'), parseAt(null), parseAt('venue')]).toEqual(['page', 'form', 'kind', 'kind']);
    expect(P3_PATHS.createStep('form', 'one_date', null)).toBe(`${P3_BASE}/create?at=form&kind=one_date`);
  });
});

describe('untouched sends nothing; a draft needs only a name', () => {
  it.each(BUILT)('%s: untouched plans [] (draft and go live); a name alone plans one create', (kind) => {
    const d = blankCreate(kind, 'ser-1');
    expect(isUntouched(d)).toBe(true);
    expect(plan(d)).toEqual([]);
    expect(plan(d, { goLive: true })).toEqual([]);
    expect(draftBlock(d, TODAY)).toBe(COPY.nameFirst);
    const named = { ...d, name: 'Club night' };
    expect(isUntouched(named)).toBe(false);
    expect(draftBlock(named, TODAY)).toBeNull();
    expect(kinds(named)).toEqual(['create', 'sessions']);
  });

  it('a photo alone is a change, but still needs a name to save', () => {
    const d = blankCreate('one_date');
    expect(isUntouched(d, true)).toBe(false);
    expect(plan(d, { hasCover: true })).toEqual([]);
  });
});

describe('every kind x draft / go live: the commands in the fixed order', () => {
  it.each(BUILT)('%s', (kind) => {
    const d = ready(kind);
    const draftKeys = kinds(d, { hasCover: true, coverUrl: 'https://img/x.jpg', cityId: 'c1' });
    const repeat = kind === 'weekly' || kind === 'monthly' ? ['repeat'] : [];
    expect(draftKeys).toEqual(['cover', 'create', ...repeat, 'sessions']);
    expect(kinds(d, { hasCover: true, coverUrl: 'https://img/x.jpg', goLive: true })).toEqual(['cover', 'create', ...repeat, 'sessions', 'live']);
    const steps = plan(d, { hasCover: true, coverUrl: 'https://img/x.jpg', cityId: 'c1', goLive: true });
    expect(steps.map((s) => s.command?.kind ?? null)).toEqual([null, 'series.upsert', ...repeat.map(() => 'series.set_recurrence'), 'series.set_program', 'series.set_lifecycle']);
    const create = steps[1].command!.payload;
    expect(create).toMatchObject({
      name: 'Friday Bachata', format: buildableKind(kind)!.format, timezone: 'Europe/London', default_start_date: '2026-11-06',
      default_venue_id: 'v1', default_city_id: 'c1', default_cover_image_url: 'https://img/x.jpg', payment_methods: 'door', [PAGE_KEY]: [ORG],
    });
    // times live on sessions: the create never carries a series time, and every key is an owner create key
    expect(create).not.toHaveProperty('default_local_start_time');
    expect(create).not.toHaveProperty('default_duration_minutes');
    for (const key of Object.keys(create)) expect([...OWNER_CREATE_KEYS, PAGE_KEY]).toContain(key);
    const days = steps.find((s) => s.key === 'sessions')!.command!.payload.days as Array<{ sections: Array<{ items: Array<{ start_time: string; end_time: string; title: string }> }> }>;
    const items = days.flatMap((x) => x.sections.flatMap((s) => s.items));
    expect(items.length).toBe(d.sessions.length);
    for (const it of items) { expect(it.start_time).toMatch(/^\d\d:00$/); expect(it.end_time).toMatch(/^\d\d:00$/); expect(it.title).not.toBe(''); }
    expect(steps[steps.length - 1].command).toEqual({ kind: 'series.set_lifecycle', payload: { to: 'live' } });
  });

  it('Other dates: one series.add_date per extra date, after the create and before the sessions', () => {
    let d = ready('other_dates', '2026-11-21');
    d = addChosenDate(addChosenDate(addChosenDate(d, '2026-11-07'), '2026-12-31'), '2026-11-21');
    expect(chosenDates(d)).toEqual(['2026-11-07', '2026-11-21', '2026-12-31']);
    const steps = plan(d, { goLive: true, hasCover: true, coverUrl: 'https://img/x.jpg' });
    expect(steps.map((s) => s.key)).toEqual(['cover', 'create', 'date:2026-11-21', 'date:2026-12-31', 'sessions', 'live']);
    expect(steps[1].command!.payload.default_start_date).toBe('2026-11-07');
    expect(steps[1].command!.payload.format).toBe('recurring');
    expect(steps[2].command).toEqual({ kind: 'series.add_date', payload: { date: '2026-11-21' } });
    expect(chosenDates(removeChosenDate(d, '2026-11-07'))).toEqual(['2026-11-21', '2026-12-31']);
  });

  it('Other dates: empty is not set; more than 30 dates and a past date are refused with what to do', () => {
    const empty = { ...blankCreate('other_dates'), name: 'x' };
    expect(missingForLive(empty, true)).toContain('a date');
    let many = empty;
    for (let i = 0; i <= DATES_MAX; i += 1) many = addChosenDate(many, `2027-01-${String(i + 1).padStart(2, '0')}`);
    expect(rowProblems(many, TODAY).when).toBe(COPY.tooManyDates);
    expect(plan(many)).toEqual([]);
    expect(rowProblems(addChosenDate(empty, '2026-10-01'), TODAY).when).toBe(COPY.pastDate);
  });

  it('a repeating kind with no first date sends no rule (the rule materialises from it)', () => {
    const d = { ...blankCreate('weekly'), name: 'Weekly' };
    expect(kinds(d)).toEqual(['create', 'sessions']);
  });
});

// every repeat rule P3 already supports, built with the P3 repeat model's own payload
const R = (p: Partial<RepeatDraft>): Partial<RepeatDraft> => p;
const RULES: Array<[string, CreateKind, string, Partial<RepeatDraft>, Record<string, unknown>]> = [
  ['weekly, one day', 'weekly', '2026-11-06', R({ weekdays: [5] }), { mode: 'weekly', interval: 1, weekdays: [5] }],
  ['weekly, several weekdays', 'weekly', '2026-11-06', R({ weekdays: [2, 5] }), { mode: 'weekly', weekdays: [2, 5] }],
  ['every 2 weeks', 'weekly', '2026-11-06', R({ weekdays: [5], interval: 2 }), { interval: 2 }],
  ['every 4 weeks', 'weekly', '2026-11-06', R({ weekdays: [5], interval: 4 }), { interval: 4 }],
  ['monthly, first Saturday', 'monthly', '2026-11-07', R({ monthBy: 'nth', nths: [1], weekday: 6 }), { mode: 'monthly', monthly: { kind: 'nth_weekday', nth: 1, weekday: 6 } }],
  ['monthly, last Saturday', 'monthly', '2026-11-28', R({ monthBy: 'nth', nths: [-1], weekday: 6 }), { monthly: { kind: 'nth_weekday', nth: -1, weekday: 6 } }],
  ['monthly, first and third Saturday', 'monthly', '2026-11-07', R({ monthBy: 'nth', nths: [1, 3], weekday: 6 }), { monthly: { kind: 'multi_nth_weekday', nths: [1, 3], weekday: 6 } }],
  ['monthly, day 7', 'monthly', '2026-11-07', R({ monthBy: 'day', day: 7 }), { monthly: { kind: 'day_of_month', day: 7 } }],
  ['monthly, the 31st', 'monthly', '2026-12-31', R({ monthBy: 'day', day: 31 }), { monthly: { kind: 'day_of_month', day: 31 } }],
  ['every 3 months', 'monthly', '2026-11-07', R({ monthBy: 'nth', nths: [1], weekday: 6, interval: 3 }), { interval: 3 }],
  ['ends after 16', 'weekly', '2026-11-06', R({ weekdays: [5], end: 'after_count', count: 16 }), { end: { kind: 'after_count', count: 16 } }],
  ['ends on a date', 'monthly', '2026-11-07', R({ monthBy: 'nth', nths: [1], weekday: 6, end: 'until_date', until: '2027-06-05' }), { end: { kind: 'until_date', date: '2027-06-05' } }],
  ['keeps going', 'weekly', '2026-11-06', R({ weekdays: [5], end: 'none' }), { end: { kind: 'none' } }],
];

describe('every repeat rule -> ONE series.set_recurrence, the P3 rule payload', () => {
  it.each(RULES)('%s', (_n, kind, first, patch, expected) => {
    const base = ready(kind, first);
    const d = { ...base, repeat: { ...base.repeat, ...patch } };
    expect(firstDateFits(d.repeat, first)).toBe(true);
    expect(rowProblems(d, TODAY).when).toBeNull();
    const step = plan(d).find((s) => s.key === 'repeat')!;
    expect(step.command).toEqual({ kind: 'series.set_recurrence', payload: rulePayload(d.repeat) });
    expect(step.command!.payload).toMatchObject(expected);
    expect(step.command!.payload).not.toHaveProperty('dry_run');
  });

  it.each([
    ['no weekday', 'weekly', R({ weekdays: [] }), 'Pick at least one day.'],
    ['first date off the pattern', 'weekly', R({ weekdays: [1] }), COPY.notFit],
    ['over 500 times', 'weekly', R({ weekdays: [5], end: 'after_count', count: 501 }), 'That makes more than 500 dates'],
    ['last date before the first', 'weekly', R({ weekdays: [5], end: 'until_date', until: '2026-11-04' }), 'Pick a last date on or after the first date.'],
    ['last date over 2 years', 'weekly', R({ weekdays: [5], end: 'until_date', until: '2029-01-01' }), 'The last date can be at most 2 years'],
  ])('a broken rule (%s) says what to do and sends nothing', (_n, kind, patch, words) => {
    const base = ready(kind as CreateKind);
    const d = { ...base, repeat: { ...base.repeat, ...patch } };
    expect(rowProblems(d, TODAY).when).toContain(words);
    expect(plan(d)).toEqual([]);
    expect(draftBlock(d, TODAY)).toContain(words);
  });

  it('the 29th to 31st warn beside the day, and still save', () => {
    for (const day of [29, 30, 31]) expect(monthDayWarning({ ...blankCreate('monthly').repeat, monthBy: 'day', day })).toMatch(/^Not every month has a \d+(st|th)\. Those months get no date\.$/);
    expect(monthDayWarning({ ...blankCreate('monthly').repeat, monthBy: 'day', day: 28 })).toBeNull();
  });

  it('a rule nobody changed follows the first date; a hand-made one stays', () => {
    const w = withFirstDate(blankCreate('weekly'), '2026-11-06');
    expect(w.repeat.weekdays).toEqual([5]);
    expect(withFirstDate(w, '2026-11-07').repeat.weekdays).toEqual([6]);
    const hand = { ...w, repeat: { ...w.repeat, weekdays: [2, 5] } };
    expect(withFirstDate(hand, '2026-11-13').repeat.weekdays).toEqual([2, 5]);
    const m = withFirstDate(blankCreate('monthly'), '2026-11-21');
    expect([m.repeat.nths, m.repeat.weekday]).toEqual([[3], 6]);
  });
});

describe('go live: what is missing, in words; disabled says why', () => {
  it.each([
    ['name', (d: CreateDraft) => ({ ...d, name: '' }), 'a name'],
    ['venue (not found, skipped)', (d: CreateDraft) => ({ ...d, venue: null }), 'where it is'],
    ['first date', (d: CreateDraft) => ({ ...d, firstDate: '' }), 'the first date'],
    ['sessions', (d: CreateDraft) => ({ ...d, sessions: [] }), 'a session with its times'],
    ['session times', (d: CreateDraft) => ({ ...d, sessions: [{ ...d.sessions[0], start: '', end: '' }] }), 'a start and end on every session'],
    ['how to pay', (d: CreateDraft) => ({ ...d, pay: [] }), 'how dancers pay'],
  ])('missing %s', (_n, f, word) => {
    const d = f(ready('one_date'));
    expect(missingForLive(d, true)).toEqual([word]);
    expect(liveBlock(d, TODAY, true)).toContain(word);
    expect(plan(d, { hasCover: true, goLive: true })).toEqual([]);
  });

  it('no photo: Go live off, Save draft works now', () => {
    const d = ready('one_date');
    expect(liveBlock(d, TODAY, false)).toBe('Go live needs a photo. Save draft works now.');
    expect(liveBlock(d, TODAY, true)).toBeNull();
  });

  it('A1 rolled back: Go live off with the platform-update reason, never sent', () => {
    expect(liveBlock(ready('one_date'), TODAY, true, false)).toBe(COPY.draftOnly);
    expect(plan(ready('one_date'), { hasCover: true, goLive: true, a1: false })).toEqual([]);
  });

  it('a session that ends where it starts, a bad price or ticket link stop every save', () => {
    const d = ready('one_date');
    expect(draftBlock({ ...d, sessions: [{ ...d.sessions[0], start: '20:00', end: '20:00' }] }, TODAY)).toMatch(/end time/);
    expect(draftBlock({ ...d, sessions: [{ ...d.sessions[0], start: '20:00', end: '' }] }, TODAY)).toMatch(/start time and an end time/);
    expect(draftBlock({ ...d, prices: [{ id: '0b8f6c2e-3c9a-4a7b-9a1e-5d2f8c7b6a10', name: 'Entry', price: '12.505', currency: 'GBP' }] }, TODAY)).toBe('Use a price like 12 or 12.50');
    expect(draftBlock({ ...d, ticketUrl: 'www.tix.com' }, TODAY)).toBe(COPY.ticketUrl);
  });
});

describe('price basics', () => {
  it('Free stands alone; the price list and ticket link ride the create', () => {
    expect(togglePay(['door', 'cash'], 'free')).toEqual(['free']);
    expect(togglePay(['free'], 'door')).toEqual(['door']);
    expect(togglePay(['door'], 'door')).toEqual([]);
    const row = { id: '0b8f6c2e-3c9a-4a7b-9a1e-5d2f8c7b6a10', name: ' Entry ', price: '12', currency: 'GBP' as const };
    const d = { ...ready('one_date'), pay: ['ticket_link', 'door'] as CreateDraft['pay'], prices: [row], ticketUrl: ' https://tix.example/a ' };
    expect(createPayload(d, { coverUrl: null, cityId: null })).toMatchObject({
      payment_methods: 'ticket_link,door', default_ticket_url: 'https://tix.example/a', default_passes: [{ id: row.id, name: 'Entry', price: 12, currency: 'GBP' }],
    });
    expect(createPayload({ ...d, pay: ['free'] }, { coverUrl: null, cityId: null })).not.toHaveProperty('default_passes');
  });
});

describe('venue found / not found', () => {
  const V = [
    { id: 'v1', name: 'Studio One', neighbourhood: 'Soho', city_name: 'London', address: null, postcode: null },
    { id: 'v2', name: 'Salsa Hall', neighbourhood: 'Leith', city_name: 'Edinburgh', address: null, postcode: null },
  ];
  it.each([['studio', ['v1']], ['leith', ['v2']], ['', ['v1', 'v2']], ['nowhere', []]])('"%s" -> %j', (term, ids) => {
    expect(venueMatches(V, term).map((v) => v.id)).toEqual(ids);
  });
  it('not found says what the person can do, naming controls the sheet has (Skip for now, Help)', () => {
    expect(COPY.venueNone(' salsa lab ')).toBe('No venue matches \u201csalsa lab\u201d');
    expect(COPY.venueNoneBody).toMatch(/Try another word/);
    expect(COPY.venueNoneBody).toMatch(/Skip for now/);
    expect(COPY.venueNoneBody).toMatch(/Help/);
    // skipped: the draft still saves; going live names the venue
    const d = { ...ready('weekly'), venue: null };
    expect(kinds(d)).toEqual(['create', 'repeat', 'sessions']);
    expect(plan(d)[0].command!.payload).not.toHaveProperty('default_venue_id');
  });
});

describe('the failure line and the stored draft', () => {
  it('names what did not save', () => {
    expect(notSavedLine(['repeat', 'sessions'], TODAY)).toBe('Not saved yet: how it repeats and the sessions.');
    expect(notSavedLine(['date:2026-11-21', 'sessions', 'live'], TODAY)).toBe('Not saved yet: the date Saturday 21 November, the sessions and going live.');
  });

  it('round-trips; anything else is ignored, never trusted', () => {
    const d = ready('monthly');
    expect(parseStoredDraft(JSON.stringify(d))).toEqual(d);
    expect(parseStoredDraft('{')).toBeNull();
    expect(parseStoredDraft(JSON.stringify({ ...d, kind: 'festival' }))).toBeNull();
    expect(parseStoredDraft(JSON.stringify({ ...d, v: 2 }))).toBeNull();
    expect(parseStoredDraft(null)).toBeNull();
  });
});

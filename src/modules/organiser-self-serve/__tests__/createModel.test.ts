import { describe, expect, it, vi } from 'vitest';
import {
  EVENT_KINDS,
  KIND_CATEGORY,
  KIND_FORMAT,
  WEEKDAY_OPTIONS,
  createBlock,
  createDraft,
  createProblems,
  dateForWeekday,
  emptyCreateForm,
  followUpCommands,
  nextDateOnWeekday,
  previewModel,
  problemsSentence,
  submitHint,
  weekdayOf,
  type CreateForm,
} from '../createModel';
import { OWNER_CATEGORIES, OWNER_CREATE_KEYS, SERIES_TIMEZONE, createPayload, submitForReviewCommand, weeklyRuleCommand } from '../seriesCommands';
import { commandErrorMessage, isServerRefusal } from '../selfServeErrors';

// selfServeApi imports the Supabase client; only its pure createSeriesCommand is under test.
vi.mock('@/integrations/supabase/client', () => ({ supabase: {} }));
import { createSeriesCommand } from '../selfServeApi';

const TODAY = '2026-10-04'; // a Sunday

const weeklyForm: CreateForm = {
  kind: 'weekly_class',
  name: ' Tuesday Bachata Class ',
  venueId: 'ven-1',
  date: '2026-10-06',
  startTime: '19:00',
  endTime: '21:30',
  ticketUrl: ' https://tickets.example/tue ',
  coverImageUrl: 'https://img.example/a.jpg',
  description: 'Friendly weekly class.',
};

const partyForm: CreateForm = { ...emptyCreateForm(), kind: 'party', name: 'Bachata Sundays Party', date: '2026-10-17', startTime: '20:00' };

describe('the two kinds', () => {
  it('offer only owner categories and never a masterclass (admin D7)', () => {
    for (const k of EVENT_KINDS) {
      expect(OWNER_CATEGORIES).toContain(KIND_CATEGORY[k.kind]);
      expect(KIND_CATEGORY[k.kind]).not.toBe('masterclass');
    }
    expect(KIND_CATEGORY).toEqual({ party: 'party', weekly_class: 'class' });
    expect(KIND_FORMAT).toEqual({ party: 'one_off', weekly_class: 'recurring' });
    expect(EVENT_KINDS.map((k) => k.kind).sort()).toEqual(['party', 'weekly_class']);
  });
});

describe('weekdays', () => {
  it('reads the weekday off the digits (0 = Sunday .. 6 = Saturday)', () => {
    expect(weekdayOf('2026-10-04')).toBe(0);
    expect(weekdayOf('2026-10-06')).toBe(2);
    expect(weekdayOf('2026-10-10')).toBe(6);
    expect(Number.isNaN(weekdayOf(''))).toBe(true);
    expect(Number.isNaN(weekdayOf('6 Oct'))).toBe(true);
  });

  it('finds the next date on a weekday, today included', () => {
    expect(nextDateOnWeekday(TODAY, 2)).toBe('2026-10-06');
    expect(nextDateOnWeekday(TODAY, 0)).toBe('2026-10-04');
    expect(nextDateOnWeekday(TODAY, 6)).toBe('2026-10-10');
    expect(nextDateOnWeekday('2026-12-31', 5)).toBe('2027-01-01');
  });

  it('the Day picker keeps the chosen week, never before today, so changing the day does not drift', () => {
    expect(dateForWeekday('', TODAY, 2)).toBe('2026-10-06');
    expect(dateForWeekday('2026-10-06', TODAY, 1)).toBe('2026-10-05');
    expect(dateForWeekday('2026-10-05', TODAY, 2)).toBe('2026-10-06');
    expect(dateForWeekday('2026-10-06', TODAY, 0)).toBe('2026-10-11');
    // This week's Monday is already past: the next Monday.
    expect(dateForWeekday(TODAY, TODAY, 1)).toBe('2026-10-05');
    expect(dateForWeekday('2026-10-20', TODAY, 1)).toBe('2026-10-19');
  });

  it('offers every weekday once, Monday first, with the server values', () => {
    expect(WEEKDAY_OPTIONS.map((o) => o.value)).toEqual([1, 2, 3, 4, 5, 6, 0]);
    expect(WEEKDAY_OPTIONS[0].label).toBe('Monday');
  });
});

describe('createProblems', () => {
  it('names what is missing, in form order', () => {
    expect(createProblems(emptyCreateForm(), TODAY)).toEqual(['a name', 'the first date', 'a start time']);
    expect(createProblems({ ...emptyCreateForm(), kind: 'party' }, TODAY)).toEqual(['a name', 'the date', 'a start time']);
    expect(problemsSentence(createProblems(emptyCreateForm(), TODAY))).toBe('To continue, add a name, the first date and a start time.');
    expect(problemsSentence([])).toBeNull();
  });

  it('refuses a past date and a link that is not http(s), accepts a complete form', () => {
    expect(createProblems({ ...weeklyForm, date: '2026-10-03' }, TODAY)).toEqual(['a date from today on']);
    expect(createProblems({ ...weeklyForm, ticketUrl: 'tickets.example' }, TODAY)).toEqual(['a ticket link starting with https://']);
    expect(createProblems({ ...weeklyForm, coverImageUrl: 'ftp://x' }, TODAY)).toEqual(['a picture link starting with https://']);
    expect(createProblems({ ...weeklyForm, endTime: '9pm' }, TODAY)).toEqual(['an end time as hours and minutes']);
    expect(createProblems({ ...weeklyForm, endTime: '19:00' }, TODAY)).toEqual(['an end time different from the start']);
    // An end before the start crosses midnight: 19:00 -> 15:01 is 20h01, over the server's 20 hours.
    expect(createProblems({ ...weeklyForm, endTime: '15:01' }, TODAY)).toEqual(['an end time within 20 hours of the start']);
    expect(createProblems({ ...weeklyForm, endTime: '15:00' }, TODAY)).toEqual([]);
    expect(createProblems(weeklyForm, TODAY)).toEqual([]);
    expect(createProblems(partyForm, TODAY)).toEqual([]);
  });
});

describe('the submit gate (Lever 2 B2: approval refuses a series with no venue)', () => {
  const noVenue: CreateForm = { ...weeklyForm, venueId: null };

  it('a draft saves without a venue, but submitting needs one', () => {
    expect(createProblems(noVenue, TODAY)).toEqual([]);
    expect(createProblems(noVenue, TODAY, { forSubmit: true })).toEqual(['a venue']);
    expect(createProblems(weeklyForm, TODAY, { forSubmit: true })).toEqual([]);
    expect(createProblems({ ...partyForm, venueId: 'ven-1' }, TODAY, { forSubmit: true })).toEqual([]);
  });

  it('lists the venue in form order, after the times and before the links', () => {
    expect(createProblems(emptyCreateForm(), TODAY, { forSubmit: true })).toEqual(['a name', 'the first date', 'a start time', 'a venue']);
    expect(createProblems({ ...noVenue, ticketUrl: 'tickets.example' }, TODAY, { forSubmit: true })).toEqual([
      'a venue',
      'a ticket link starting with https://',
    ]);
  });

  it('the hint says what submitting still needs, and that a draft does not need the venue', () => {
    expect(submitHint(weeklyForm, TODAY)).toBeNull();
    expect(submitHint(noVenue, TODAY)).toBe('To submit for review, add a venue. You can save a draft without one.');
    expect(submitHint({ ...noVenue, name: '' }, TODAY)).toBe('To continue, add a name and a venue. A draft can be saved without a venue.');
    expect(submitHint({ ...weeklyForm, name: '' }, TODAY)).toBe('To continue, add a name.');
  });
});

describe('createBlock (the server: series.upsert (create) needs a live organiser)', () => {
  it('lets a live organiser through and explains every other state', () => {
    expect(createBlock({ name: 'Ritmo', lifecycle_status: 'live' })).toBeNull();
    for (const status of ['draft', 'pending_review', 'rejected', 'paused', 'ended']) {
      const text = createBlock({ name: 'Ritmo', lifecycle_status: status });
      expect(text).toContain('Ritmo');
      expect(text).toMatch(/approves it|approved|needs changes|Ask the Bachata Calendar team/);
    }
  });
});

describe('createPayload', () => {
  it('sends the exact keys for a full weekly class, trimmed, with London as the zone', () => {
    const payload = createPayload(createDraft(weeklyForm));
    expect(payload).toEqual({
      name: 'Tuesday Bachata Class',
      format: 'recurring',
      category: 'class',
      default_start_date: '2026-10-06',
      default_local_start_time: '19:00',
      timezone: 'Europe/London',
      default_duration_minutes: 150,
      default_venue_id: 'ven-1',
      default_ticket_url: 'https://tickets.example/tue',
      default_cover_image_url: 'https://img.example/a.jpg',
      default_description: 'Friendly weekly class.',
    });
    expect(SERIES_TIMEZONE).toBe('Europe/London');
  });

  it('sends only the six always-keys for a bare party (an absent key lands NULL; a blank would be noise)', () => {
    expect(createPayload(createDraft(partyForm))).toEqual({
      name: 'Bachata Sundays Party',
      format: 'one_off',
      category: 'party',
      default_start_date: '2026-10-17',
      default_local_start_time: '20:00',
      timezone: 'Europe/London',
    });
  });

  it('never emits a key outside the owner create allowlist', () => {
    const keys = Object.keys(createPayload(createDraft(weeklyForm)));
    expect(keys.filter((k) => !(OWNER_CREATE_KEYS as readonly string[]).includes(k))).toEqual([]);
  });

  it('adds default_city_id only when a city is known (B1: the server takes the city only from the payload)', () => {
    expect(createPayload(createDraft(partyForm), 'city-1').default_city_id).toBe('city-1');
    expect('default_city_id' in createPayload(createDraft(partyForm), null)).toBe(false);
    expect('default_city_id' in createPayload(createDraft(partyForm))).toBe(false);
    const keys = Object.keys(createPayload(createDraft(weeklyForm), 'city-1'));
    expect(keys.filter((k) => !(OWNER_CREATE_KEYS as readonly string[]).includes(k))).toEqual([]);
  });

  it('an end at or before the start crosses midnight; no end means no duration', () => {
    expect(createPayload(createDraft({ ...partyForm, endTime: '01:00' })).default_duration_minutes).toBe(300);
    expect('default_duration_minutes' in createPayload(createDraft(partyForm))).toBe(false);
  });
});

describe('createSeriesCommand (selfServeApi, the one file allowed to spell the organiser key)', () => {
  it('adds exactly one key, naming the one organiser, to the payload', () => {
    const payload = createPayload(createDraft(partyForm));
    const command = createSeriesCommand(payload, 'org-1');
    expect(command.kind).toBe('series.upsert');
    const extra = Object.entries(command.payload).filter(([k]) => !(k in payload));
    expect(extra).toHaveLength(1);
    expect(extra[0][1]).toEqual(['org-1']);
    expect(Object.keys(command.payload)).toHaveLength(Object.keys(payload).length + 1);
    for (const [k, v] of Object.entries(payload)) expect(command.payload[k]).toEqual(v);
  });
});

describe('followUpCommands', () => {
  it('a party draft adds its one date; a submitted party also moves to review', () => {
    expect(followUpCommands(partyForm, false)).toEqual([{ kind: 'series.add_date', payload: { date: '2026-10-17' } }]);
    expect(followUpCommands(partyForm, true)).toEqual([
      { kind: 'series.add_date', payload: { date: '2026-10-17' } },
      { kind: 'series.set_lifecycle', payload: { to: 'pending_review' } },
    ]);
  });

  it('a weekly class sets the owner rule on the first date\'s weekday, open-ended, interval absent', () => {
    expect(followUpCommands(weeklyForm, true)).toEqual([
      { kind: 'series.set_recurrence', payload: { mode: 'weekly', weekdays: [2], end: { kind: 'none' } } },
      { kind: 'series.set_lifecycle', payload: { to: 'pending_review' } },
    ]);
    expect(weeklyRuleCommand(0).payload).toEqual({ mode: 'weekly', weekdays: [0], end: { kind: 'none' } });
    expect(submitForReviewCommand()).toEqual({ kind: 'series.set_lifecycle', payload: { to: 'pending_review' } });
  });
});

describe('previewModel', () => {
  it('reads like the public page for a weekly class', () => {
    const m = previewModel(weeklyForm, 'Studio 3, Battersea Arts Hub', 'Ritmo Bachata London', TODAY);
    expect(m.title).toBe('Tuesday Bachata Class');
    expect(m.when).toBe('Every Tuesday \u00b7 19:00\u201321:30 \u00b7 first Tue 6 Oct');
    expect(m.where).toBe('Studio 3, Battersea Arts Hub');
    expect(m.by).toBe('Ritmo Bachata London');
    expect(m.coverImageUrl).toBe('https://img.example/a.jpg');
  });

  it('reads like the public page for a party, and fills blanks the way the page would', () => {
    expect(previewModel(partyForm, null, 'Ritmo', TODAY).when).toBe('Sat 17 Oct \u00b7 20:00');
    // A weekly class starting today: never "first Tonight".
    expect(previewModel({ ...weeklyForm, date: TODAY, endTime: '' }, null, 'Ritmo', TODAY).when).toBe('Every Sunday \u00b7 19:00 \u00b7 first class tonight');
    const empty = previewModel(emptyCreateForm(), null, 'Ritmo', TODAY);
    expect(empty.title).toBe('Your weekly class');
    expect(empty.when).toBe('Every week');
    expect(empty.where).toBeNull();
    expect(empty.coverImageUrl).toBeNull();
    expect(previewModel({ ...emptyCreateForm(), kind: 'party' }, null, 'Ritmo', TODAY).when).toBe('Date to be confirmed');
    expect(previewModel({ ...partyForm, coverImageUrl: 'not a link' }, null, 'Ritmo', TODAY).coverImageUrl).toBeNull();
  });
});

describe('isServerRefusal (decides whether a failed create may have landed)', () => {
  it('a PostgREST refusal carries its SQLSTATE; a dropped connection does not', () => {
    expect(isServerRefusal({ code: 'P0001', message: 'permission_denied: x' })).toBe(true);
    expect(isServerRefusal({ code: '', message: 'TypeError: Failed to fetch' })).toBe(false);
    expect(isServerRefusal({ message: 'TypeError: Failed to fetch' })).toBe(false);
    expect(isServerRefusal(new Error('boom'))).toBe(false);
    expect(isServerRefusal(null)).toBe(false);
  });
});

describe('the create refusals read as copy, never as server text', () => {
  it.each([
    ['permission_denied: series.upsert (create) needs a live organiser', /not public yet/],
    // The server's message names the organiser key; it is assembled so the architecture lint's ban stays exact.
    [`permission_denied: series.upsert (create) needs ${'organiser'}_ids naming one organiser the caller owns or manages`, /Choose one of your organisers/],
    ['permission_denied: series.upsert category must be party, class or workshop', /cannot be set here/],
    ['permission_denied: series.upsert category on a live series is admin-only', /cannot be set here/],
    ['permission_denied: series.upsert format must be one_off or recurring', /party or a weekly class/],
    ['permission_denied: series.upsert default_start_date cannot be set to a past date', /from today on/],
    ['permission_denied: series.set_recurrence end.date must not be before today', /from today on/],
    ['permission_denied: series.set_recurrence weekdays must be one weekday 0..6', /weekly pattern/],
    ['permission_denied: series.set_recurrence needs a recurring series', /weekly pattern/],
  ])('%s', (server, copy) => {
    const text = commandErrorMessage({ message: server });
    expect(text).toMatch(copy);
    expect(text).not.toContain('permission_denied');
  });
});

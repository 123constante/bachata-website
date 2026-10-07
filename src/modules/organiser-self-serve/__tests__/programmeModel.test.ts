/**
 * The per-date programme editor's rules (admin 20261109560000). The save is the
 * COMPLETE programme: every session the reader returned, exactly once, plus new
 * ones; untouched sessions go back exactly as they came.
 */
import { describe, expect, it } from 'vitest';
import {
  buildPayload,
  changesOf,
  endsNextDay,
  isDirty,
  newSession,
  newlyRemoved,
  notEditableCopy,
  parseProgramme,
  parseSaveResult,
  removeSessionsConfirmCopy,
  sessionMinutes,
  toDraft,
  validateProgramme,
  type DraftSession,
  type WireSession,
} from '../programmeModel';
import { PROGRAMME_VERSION_CONFLICT, programmeErrorCopy } from '../selfServeErrors';

const S1 = '11111111-1111-4111-8111-111111111111';
const S2 = '22222222-2222-4222-8222-222222222222';
const A1 = '33333333-3333-4333-8333-333333333333';
const S3 = '44444444-4444-4444-8444-444444444444';

const reader = () => ({
  occurrence_id: 'o1',
  series_id: 's1',
  occurrence_date: '2026-10-08',
  version: 7,
  editable: true,
  not_editable_reason: null,
  sessions: [
    { series_item_id: S1, type: 'class', title: 'Bachata Basics', start_time: '19:00', end_time: '20:00', ends_next_day: false, level_keys: ['beginner'], removed: false },
    { series_item_id: S2, type: 'party', title: 'Party', start_time: '22:00', end_time: '02:00', ends_next_day: true, level_keys: [], removed: false },
    { added_session_id: A1, type: 'class', title: 'Bootcamp', start_time: '18:00', end_time: '18:45', ends_next_day: false, level_keys: ['improver'], removed: false },
    // Grandfathered: a stored 349-char title and null times still round-trip untouched.
    { series_item_id: S3, type: 'performance', title: 'x'.repeat(349), start_time: null, end_time: null, ends_next_day: false, level_keys: [], removed: true },
  ] as WireSession[],
});

const draftOf = () => toDraft(parseProgramme(reader()).sessions);
const edit = (rows: DraftSession[], i: number, patch: Partial<DraftSession>) => rows.map((r, j) => (j === i ? { ...r, ...patch } : r));

describe('parseProgramme', () => {
  it('reads the reader, and refuses a shape without a version or sessions', () => {
    const p = parseProgramme(reader());
    expect(p.version).toBe(7);
    expect(p.editable).toBe(true);
    expect(p.sessions).toHaveLength(4);
    expect(() => parseProgramme({ occurrence_id: 'o1', sessions: [] })).toThrow();
    expect(() => parseProgramme(null)).toThrow();
  });

  it('reads the save result', () => {
    expect(parseSaveResult({ ok: true, changed: false, version: 7, sessions: [] })).toEqual({ changed: false, version: 7, sessions: [] });
    expect(() => parseSaveResult({ ok: false })).toThrow();
  });
});

describe('buildPayload: the round trip', () => {
  it('sends every session the reader returned, untouched, in order (the server no-op)', () => {
    const r = reader();
    const payload = buildPayload(draftOf());
    expect(payload).toEqual(r.sessions);
    // The very objects the reader returned, not rebuilt copies.
    const rows = draftOf();
    buildPayload(rows).forEach((p, i) => expect(p).toBe(rows[i].original));
    expect(isDirty(draftOf(), r.sessions.length)).toBe(false);
  });

  it('an edit to one session still sends the complete list, the others untouched', () => {
    const rows = edit(draftOf(), 0, { title: 'Bachata Basics 2' });
    const payload = buildPayload(rows);
    expect(payload).toHaveLength(4);
    expect(payload[0]).toEqual({
      series_item_id: S1, type: 'class', removed: false, title: 'Bachata Basics 2',
      start_time: '19:00', end_time: '20:00', ends_next_day: false, level_keys: ['beginner'],
    });
    expect(payload.slice(1)).toEqual(reader().sessions.slice(1));
  });

  it('an edited date-only session keeps its added_session_id key', () => {
    const payload = buildPayload(edit(draftOf(), 2, { levels: ['improver', 'advanced'] }));
    expect(payload[2]).toMatchObject({ added_session_id: A1, level_keys: ['improver', 'advanced'], title: 'Bootcamp' });
    expect(payload[2]).not.toHaveProperty('series_item_id');
  });

  it('a whitespace-only title change is not an edit', () => {
    const rows = edit(draftOf(), 0, { title: '  Bachata Basics ' });
    expect(changesOf(rows[0]).any).toBe(false);
    expect(buildPayload(rows)[0]).toBe(rows[0].original);
    expect(buildPayload(rows)).toEqual(reader().sessions);
  });

  it('level order does not count as a change', () => {
    const rows = edit(draftOf(), 2, { levels: ['improver'] });
    expect(changesOf(rows[2]).any).toBe(false);
  });

  it('an unchanged field on an edited session sends the STORED value, never re-typed', () => {
    // The grandfathered session put back with only its levels changed: title and null times stay as stored.
    const rows = edit(draftOf(), 3, { removed: false, levels: ['open_level'] });
    const p = buildPayload(rows)[3];
    expect(p).toMatchObject({ series_item_id: S3, removed: false, title: 'x'.repeat(349), start_time: null, end_time: null, ends_next_day: false, level_keys: ['open_level'] });
    expect(validateProgramme(rows).ok).toBe(true);
  });
});

describe('a stored title that is not a string', () => {
  const nullTitle = () => toDraft([{ series_item_id: S1, type: 'class', title: null, start_time: '19:00', end_time: '20:00', ends_next_day: false, level_keys: [], removed: false }]);
  it('round-trips untouched, but asks for a name once anything else on it changes', () => {
    expect(buildPayload(nullTitle())).toEqual([{ series_item_id: S1, type: 'class', title: null, start_time: '19:00', end_time: '20:00', ends_next_day: false, level_keys: [], removed: false }]);
    const levelled = edit(nullTitle(), 0, { levels: ['beginner'] });
    expect(validateProgramme(levelled).rows.map((p) => p.message)).toEqual(['Give this session a name.']);
    const named = edit(levelled, 0, { title: 'Basics' });
    expect(validateProgramme(named).ok).toBe(true);
    expect(buildPayload(named)[0]).toMatchObject({ title: 'Basics', level_keys: ['beginner'] });
  });
});

describe('remove and add', () => {
  it('remove sends removed:true with the stored values, and is never an omission', () => {
    const rows = edit(draftOf(), 0, { removed: true, title: 'typed then removed' });
    const payload = buildPayload(rows);
    expect(payload).toHaveLength(4);
    expect(payload[0]).toEqual({ ...reader().sessions[0], removed: true });
    expect(newlyRemoved(rows).map((r) => r.title)).toEqual(['typed then removed']);
  });

  it('a removed session put back before saving is a no-op again', () => {
    const rows = edit(edit(draftOf(), 1, { removed: true }), 1, { removed: false });
    expect(buildPayload(rows)).toEqual(reader().sessions);
    expect(newlyRemoved(rows)).toHaveLength(0);
  });

  it('a session already off this date is not a new removal', () => {
    expect(newlyRemoved(draftOf())).toHaveLength(0);
  });

  it('add appends new:true with every field, after all the existing ones', () => {
    const added = { ...newSession('party'), title: ' Late Party ', start: '23:00', end: '03:00', levels: ['open_level'] };
    const rows = [...draftOf(), added];
    const payload = buildPayload(rows);
    expect(payload).toHaveLength(5);
    expect(payload[4]).toEqual({ new: true, type: 'party', title: 'Late Party', start_time: '23:00', end_time: '03:00', ends_next_day: true, level_keys: ['open_level'] });
    expect(payload[4]).not.toHaveProperty('removed');
    expect(isDirty(rows, 4)).toBe(true);
  });

  it('a new session taken out again is not sent', () => {
    const rows = [...draftOf(), { ...newSession(), removed: true }];
    expect(buildPayload(rows)).toEqual(reader().sessions);
  });
});

describe('overnight pairing', () => {
  it('ends_next_day is true exactly when the end is at or before the start', () => {
    expect(endsNextDay('22:00', '02:00')).toBe(true);
    expect(endsNextDay('22:00', '22:00')).toBe(true);
    expect(endsNextDay('19:00', '20:00')).toBe(false);
    expect(endsNextDay(null, '20:00')).toBe(false);
    expect(sessionMinutes('22:00', '02:00')).toBe(240);
  });

  it('moving a party past midnight flips the flag the payload sends', () => {
    const rows = edit(draftOf(), 0, { end: '01:00', start: '21:00' });
    expect(buildPayload(rows)[0]).toMatchObject({ start_time: '21:00', end_time: '01:00', ends_next_day: true });
    const back = edit(draftOf(), 1, { end: '23:30' });
    expect(buildPayload(back)[1]).toMatchObject({ end_time: '23:30', ends_next_day: false });
  });
});

describe('validateProgramme mirrors the server limits', () => {
  const problems = (rows: DraftSession[]) => validateProgramme(rows).rows.map((p) => p.message);

  it('title: required, 120 characters, one line, no < or >', () => {
    expect(problems(edit(draftOf(), 0, { title: '   ' }))).toEqual(['Give this session a name.']);
    expect(problems(edit(draftOf(), 0, { title: 'x'.repeat(121) }))).toEqual(['Keep the name to 120 characters or fewer.']);
    expect(problems(edit(draftOf(), 0, { title: 'x'.repeat(120) }))).toEqual([]);
    expect(problems(edit(draftOf(), 0, { title: 'two\nlines' }))).toEqual(['Keep the name on one line.']);
    expect(problems(edit(draftOf(), 0, { title: '<b>Basics</b>' }))).toEqual(['The name cannot contain < or >.']);
  });

  it('times: both, different, 5 minutes to 12 hours', () => {
    expect(problems(edit(draftOf(), 0, { end: '' }))).toEqual(['Enter a start time and an end time.']);
    expect(problems(edit(draftOf(), 0, { end: '19:00' }))).toEqual(['The end time must be different from the start time.']);
    expect(problems(edit(draftOf(), 0, { end: '19:04' }))).toEqual(['A session must last between 5 minutes and 12 hours.']);
    expect(problems(edit(draftOf(), 0, { end: '19:05' }))).toEqual([]);
    expect(problems(edit(draftOf(), 0, { start: '07:00', end: '20:00' }))).toEqual(['A session must last between 5 minutes and 12 hours.']);
    expect(problems(edit(draftOf(), 0, { start: '07:00', end: '19:00' }))).toEqual([]);
  });

  it('an untouched grandfathered value is not re-validated', () => {
    expect(validateProgramme(draftOf()).ok).toBe(true);
  });

  it('a new session needs a name and both times', () => {
    const v = validateProgramme([...draftOf(), newSession()]);
    expect(v.ok).toBe(false);
    expect(v.rows.map((p) => p.field).sort()).toEqual(['times', 'title']);
  });

  it('the programme may span at most 20 hours, checked when a time moved', () => {
    // A start of 02:00 counts on the date itself, as the server's stash_local_as_utc does,
    // so it stretches the day back to 02:00 and the party's end at 02:00 next day is 24 h later.
    const early = { ...newSession(), title: 'Early', start: '02:00', end: '03:30' };
    expect(validateProgramme([...draftOf(), early]).programme).toEqual(['The programme of this date would run for more than 20 hours. Check the times.']);
    const rows = edit(draftOf(), 2, { start: '06:00', end: '07:00' }); // 06:00 to the party's 02:00 next day = 20 h
    expect(validateProgramme(rows).programme).toEqual([]);
    const tooLong = edit(draftOf(), 2, { start: '05:30', end: '06:30' });
    expect(validateProgramme(tooLong).programme).toEqual(['The programme of this date would run for more than 20 hours. Check the times.']);
  });

  it('caps: 40 visible sessions and 20 date-only sessions, checked when one is added', () => {
    const many = Array.from({ length: 20 }, (_, i) => ({ ...newSession(), title: `S${i}`, start: '19:00', end: '20:00' }));
    const v = validateProgramme([...draftOf(), ...many]);
    expect(v.programme).toEqual(['A date can hold up to 20 sessions added just for that date.']);
    const ok = validateProgramme([...draftOf(), ...many.slice(0, 19)]);
    expect(ok.programme).toEqual([]);
  });
});

describe('copy', () => {
  it('each not_editable_reason has plain words; multi_day says to ask the team', () => {
    expect(notEditableCopy('multi_day')).toMatch(/Ask the Bachata Calendar team/);
    expect(notEditableCopy('past_date')).toMatch(/already happened/);
    expect(notEditableCopy('series_closed')).toMatch(/ended or is archived/);
    expect(notEditableCopy('date_cancelled')).toMatch(/cancelled/);
    expect(notEditableCopy('something_new')).toMatch(/Ask the Bachata Calendar team/);
  });

  it('the remove confirm names the session and asks for a tick', () => {
    const c = removeSessionsConfirmCopy(['Bachata Basics'], 'Thu 8 Oct');
    expect(c.title).toBe('Remove "Bachata Basics" from Thu 8 Oct?');
    expect(c.requireAck).toBe(true);
    expect(removeSessionsConfirmCopy(['A', 'B'], 'Thu 8 Oct').title).toBe('Remove 2 sessions from Thu 8 Oct?');
  });

  it('never says social, never an em dash', () => {
    const all = JSON.stringify([
      notEditableCopy('multi_day'), notEditableCopy('past_date'), notEditableCopy('series_closed'), notEditableCopy('date_cancelled'),
      removeSessionsConfirmCopy(['A'], 'x'), removeSessionsConfirmCopy(['A', 'B'], 'x'),
    ]);
    expect(all).not.toMatch(/social/i);
    expect(all).not.toContain('—');
  });
});

describe('programmeErrorCopy: server refusals to plain words', () => {
  const err = (message: string) => ({ message, code: 'P0001' });
  const cases: Array<[string, RegExp, boolean]> = [
    ['version_conflict: expected 7, got 8', /changed somewhere else, so your changes were not saved/, true],
    ['permission_denied: authentication_required', /sign in/, false],
    ['permission_denied: occurrence not found or caller is not an owner or manager of its series', /cannot change this date/, false],
    ['permission_denied: programme edit on a past date is admin-only', /already happened/, true],
    ['permission_denied: programme edit on an ended or archived series is admin-only', /ended or is archived/, true],
    ['permission_denied: programme edit on a cancelled date is not allowed', /cancelled/, true],
    ['permission_denied: programme edit on a multi-day event is not supported here (use the admin editor)', /Ask the Bachata Calendar team/, true],
    ['permission_denied: session 1 type is admin-only on an existing session', /kind of an existing session/, false],
    ['permission_denied: session 1 carries a key an organiser may not set', /cannot make that change here/, false],
    ['invalid_payload: programme_incomplete: 1 session(s) of this date are missing from sessions; send every session the reader returned', /has changed since you opened it/, true],
    ['invalid_payload: session 4 names a session that is not on this date', /has changed since you opened it/, true],
    ['invalid_payload: session 1 title is required', /needs a name/, false],
    ['invalid_payload: session 1 title is longer than 120 characters', /120 characters/, false],
    ['invalid_payload: session 1 title must be a single line of text', /one line/, false],
    ['invalid_payload: session 1 title must not contain < or >', /< or >/, false],
    ['invalid_payload: session 1 needs both start_time and end_time', /start time and an end time/, false],
    ['invalid_payload: session 1 end_time must differ from start_time', /different from the start/, false],
    ['invalid_payload: session 1 must last between 5 minutes and 12 hours', /5 minutes and 12 hours/, false],
    ['invalid_payload: session 1 start_time and end_time must each be a HH:MM time or null', /like 19:30/, false],
    ['invalid_payload: session 2 ends_next_day does not match its times (true exactly when end_time is at or before start_time)', /after midnight/, false],
    ['invalid_payload: session 1 level_keys must be distinct keys from beginner, improver, intermediate, advanced, open_level', /levels from the list/, false],
    ['invalid_payload: session 4 type must be class, masterclass, party or performance', /what kind of session/, false],
    ['invalid_payload: a date holds at most 40 sessions', /40 sessions/, false],
    ['invalid_payload: a date holds at most 20 date-only sessions', /20 sessions added just/, false],
    ['invalid_payload: the programme of this date would span more than 20 hours', /20 hours/, false],
    ['invalid_payload: sessions holds more than 80 entries', /too large/, false],
  ];
  it.each(cases)('%s', (message, copy, reload) => {
    const c = programmeErrorCopy(err(message));
    expect(c.message).toMatch(copy);
    expect(c.reload).toBe(reload);
    expect(c.message).not.toContain(message);
  });

  it('the version conflict copy is the agreed sentence', () => {
    expect(programmeErrorCopy(err('version_conflict: expected 1, got 2')).message).toBe(PROGRAMME_VERSION_CONFLICT);
    // The editor reloads by itself, so the copy says the latest is showing; it never asks for a reload.
    expect(PROGRAMME_VERSION_CONFLICT).toBe('This date was changed somewhere else, so your changes were not saved. The latest programme is now showing. Make your changes again.');
  });

  it('carries the 0-based session index the server names', () => {
    expect(programmeErrorCopy(err('invalid_payload: session 2 title is required')).sessionIndex).toBe(2);
    expect(programmeErrorCopy(err('version_conflict: expected 1, got 2')).sessionIndex).toBeNull();
  });

  it('unknown text gets the generic line, never the raw message', () => {
    expect(programmeErrorCopy(err('boom: secret detail')).message).toBe('Something went wrong. Please try again.');
    expect(programmeErrorCopy(null).message).toBe('Something went wrong. Please try again.');
  });
});

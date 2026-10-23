// ER-FIX-C4: the review findings C4-1, C4-3, C4-4, C4-6..C4-9, table-tested on
// the prod shapes from the review survey (662 stored rows, read-only counts).
import { describe, expect, it } from 'vitest';
import rules from '../../shared/event-rules.json';
import { LIMITS } from '../../shared/programmeModel';
import {
  MAX_SESSION_MINUTES,
  addAnother,
  blockingIssues,
  blocksDone,
  endOptions,
  fromStored,
  isUntouched,
  isValidEnd,
  newSession,
  roomVisible,
  sessionIssues,
  setKind,
  setLength,
  setStart,
  showQuickLengths,
  startOptions,
  toStored,
  toggleLevel,
  type SessionDraft,
  type StoredSessionRow,
} from '../sessionsModel';

const row = (patch: Partial<StoredSessionRow>): StoredSessionRow => ({
  id: 'r1', type: 'class', title: 'Bachata', start_time: '20:00:00', end_time: '21:00:00', room: null, level_keys: null, ...patch,
});

// Each prod shape: the stored row, what the card must load, and the reasons it shows.
const SHAPES: { name: string; row: StoredSessionRow; draft: Partial<SessionDraft>; issues: string[] }[] = [
  { name: 'class, HH:MM:SS, no level, null room (134 classes, 552 null rooms)', row: row({}), draft: { kind: 'class', start: '20:00', end: '21:00', levels: [], room: '', otherLength: false }, issues: [] },
  { name: 'untimed party (220 rows)', row: row({ type: 'party', title: null, start_time: null, end_time: null }), draft: { kind: 'party', name: 'Party', start: '', end: '' }, issues: [] }, // ER-FIX2-S2: untimed is valid (owner decision 3)
  { name: 'party ending at 00:00 (2 rows)', row: row({ type: 'party', start_time: '21:00:00', end_time: '00:00:00' }), draft: { start: '21:00', end: '00:00' }, issues: [] },
  { name: 'off the 15-minute grid (40 rows)', row: row({ type: 'party', start_time: '21:07:00', end_time: '02:07:00' }), draft: { start: '21:07', end: '02:07' }, issues: [] },
  { name: 'class over 12 h (7 rows)', row: row({ start_time: '19:00:00', end_time: '08:00:00' }), draft: { start: '19:00', end: '08:00', otherLength: true }, issues: ['Over 12 hours'] },
  { name: 'lesson off the quick list (47 lessons)', row: row({ start_time: '19:00:00', end_time: '20:15:00' }), draft: { otherLength: true }, issues: [] },
  { name: 'performance is the showcase kind', row: row({ type: 'performance', level_keys: [] }), draft: { kind: 'showcase', name: 'Bachata' }, issues: [] },
  { name: 'unknown stored kind kept as is', row: row({ type: 'show' }), draft: { kind: 'show' as SessionDraft['kind'] }, issues: [] },
  { name: 'room and levels kept', row: row({ room: 'Studio 2', level_keys: ['improver', 'beginner'] }), draft: { room: 'Studio 2', levels: ['improver', 'beginner'] }, issues: [] },
];

describe('fromStored / toStored on prod shapes (C4-7, C4-8)', () => {
  it.each(SHAPES)('$name', ({ row: r, draft, issues }) => {
    const d = fromStored(r);
    expect(d).toMatchObject({ id: r.id, ...draft });
    expect(sessionIssues(d).map((i) => i.reason)).toEqual(issues);
    // Round trip: what toStored sends is the stored row, times as HH:MM, nothing invented.
    const back = toStored(d);
    expect(back.type).toBe(r.type);
    expect(back.start_time).toBe(r.start_time ? r.start_time.slice(0, 5) : null);
    expect(back.end_time).toBe(r.end_time ? r.end_time.slice(0, 5) : null);
    expect(back.room).toBe(r.room);
    expect(back.level_keys).toEqual(r.level_keys ?? []);
  });
  it('a lesson off the quick list shows the end list, not a pressed Other with a read-only end', () => {
    expect(showQuickLengths(fromStored(row({ start_time: '19:00:00', end_time: '20:15:00' })))).toBe(false);
    expect(showQuickLengths(fromStored(row({})))).toBe(true);
  });
});

describe('level is optional detail (C4-1, plan rule 11)', () => {
  it.each(['class', 'masterclass'] as const)('%s: a new or loaded session with no level has no issue', (kind) => {
    expect(sessionIssues(newSession(kind, '19:00', 'a'))).toEqual([]);
    expect(sessionIssues(fromStored(row({ type: kind })))).toEqual([]);
  });
});

describe('untimed session (C4-3)', () => {
  // ER-FIX2-S2 (F-C4-2): "No set time" is always offered, so a timed session can go back to untimed.
  it('Start offers "No set time" first; End offers nothing until a start', () => {
    expect(startOptions('')[0]).toEqual({ value: '', label: 'No set time', nextDay: false });
    expect(startOptions('20:00').filter((o) => o.value === '')).toHaveLength(1);
    expect(endOptions('', '')).toEqual([]);
  });
  it('picking a start gives the kind default length; a quick length waits for a start', () => {
    const p = fromStored(row({ type: 'party', start_time: null, end_time: null }));
    expect(setStart(p, '21:00').end).toBe('23:00');
    expect(setLength(fromStored(row({ start_time: null, end_time: null })), 90).end).toBe('');
  });
});

describe('one length cap (C4-4)', () => {
  it('is the writer cap, 12 h', () => {
    expect(MAX_SESSION_MINUTES).toBe(LIMITS.sessionMaxMinutes);
  });
  it('an 11 h party 20:00-07:00 is a valid end in the list', () => {
    expect(isValidEnd('20:00', '07:00')).toBe(true);
    expect(endOptions('20:00', '07:00').some((o) => o.value === '07:00')).toBe(true);
  });
  it('a stored end past the cap stays a visible option with a true reason that does not block Done', () => {
    const d = fromStored(row({ start_time: '19:00:00', end_time: '08:00:00' }));
    expect(endOptions(d.start, d.end).some((o) => o.value === '08:00')).toBe(true);
    const issues = sessionIssues(d);
    expect(issues.map((i) => i.reason)).toEqual(['Over 12 hours']);
    expect(issues.some(blocksDone)).toBe(false);
  });
});

describe('null room (C4-6)', () => {
  it('does not crash', () => {
    expect(roomVisible([{ ...newSession('party', '22:00', 'a'), room: null as unknown as string }])).toBe(false);
  });
});

describe('wording from the rules (C4-9)', () => {
  // ER-FIX2-S2: S1 made rules.blockers.name the EVENT name ("Add an event name"); a session keeps "Name needed".
  it('bad times read the rules JSON; a missing session name says "Name needed"', () => {
    expect(sessionIssues({ ...newSession('party', '22:00', 'a'), end: '22:00' }).map((i) => i.reason)).toEqual([rules.blockers.sessionTimes]);
    expect(sessionIssues({ ...newSession('party', '22:00', 'a'), name: '' }).map((i) => i.reason)).toEqual(['Name needed']);
  });
});

describe('untouched (C4-5)', () => {
  it('pressing Other or opening the room box is not a change; a new end is', () => {
    const a = fromStored(row({}));
    expect(isUntouched([a], [{ ...a, otherLength: true, showRoom: true }])).toBe(true);
    expect(isUntouched([a], [setLength(a, 90)])).toBe(false);
  });
});

describe('review round: untimed neighbours, unknown values', () => {
  const timed = fromStored(row({ id: 'a', type: 'party', start_time: '21:00:00', end_time: '02:00:00' }));
  const bare = fromStored(row({ id: 'b', type: 'party', start_time: null, end_time: null }));
  it('a stored problem on an untouched session does not block a change elsewhere', () => {
    expect(blockingIssues([timed, bare], [{ ...timed, room: 'Main' }, bare])).toEqual([]);
    // The writer checks a field only when it changed: renaming an untimed session is not a times change.
    expect(blockingIssues([timed, bare], [timed, { ...bare, name: 'Late' }])).toEqual([]);
    expect(blockingIssues([timed, bare], [{ ...timed, name: '' }, bare]).map((i) => i.reason)).toEqual(['Name needed']);
    expect(blockingIssues([timed], [timed, { ...newSession('party', '22:00', 'n'), end: '22:00' }]).map((i) => i.code)).toEqual(['end']);
  });
  it('Add another follows the latest TIMED session; no session gets an end without a start', () => {
    const added = addAnother([timed, bare], 14, 'n');
    expect(added.find((s) => s.id === 'n')?.start).toBe('02:00');
    expect(newSession('class', '', 'x')).toMatchObject({ start: '', end: '' });
    expect(setKind(bare, 'class')).toMatchObject({ start: '', end: '' });
  });
  it('a null stored title shows the kind name but goes back as null unless edited', () => {
    const p = fromStored(row({ type: 'party', title: null }));
    expect(p.name).toBe('Party');
    expect(toStored(p).title).toBeNull();
    expect(toStored({ ...p, name: 'Salsa night' }).title).toBe('Salsa night');
  });
  it('an untimed lesson loads on the quick lengths, and picking a start keeps it there', () => {
    const c = fromStored(row({ start_time: null, end_time: null }));
    expect(c.otherLength).toBe(false);
    expect(showQuickLengths(setStart(c, '19:00'))).toBe(true);
  });
  it('a null stored type goes back as null; an unknown level key survives a toggle', () => {
    expect(toStored(fromStored(row({ type: null }))).type).toBeNull();
    const c = fromStored(row({ level_keys: ['all', 'beginner'] }));
    expect(toggleLevel(c, 'improver').levels).toEqual(['beginner', 'improver', 'all']);
  });
});

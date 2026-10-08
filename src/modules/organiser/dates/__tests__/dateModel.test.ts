import { describe, expect, it } from 'vitest';
import {
  buildPayload,
  newSession,
  parseProgramme,
  removePerson,
  toDraft,
  type DraftSession,
} from '@/modules/organiser/shared/programmeModel';
import { addRoleFor, dateSpan, onSessionIds, pickPerson, setSessionType } from '../dateModel';

const S1 = '11111111-1111-4111-8111-111111111111';
const S2 = '22222222-2222-4222-8222-222222222222';
const A1 = '33333333-3333-4333-8333-333333333333';
const P = (n: number) => `0000000${n}-0000-4000-8000-000000000000`;

const sessions = () => [
  { series_item_id: S1, type: 'class', title: 'Bachata Basics', start_time: '19:00', end_time: '20:00', ends_next_day: false, level_keys: ['beginner'], removed: false },
  { series_item_id: S2, type: 'party', title: 'Party', start_time: '22:00', end_time: '02:00', ends_next_day: true, level_keys: [], removed: false },
  { added_session_id: A1, type: 'class', title: 'Bootcamp', start_time: '18:00', end_time: '18:45', ends_next_day: false, level_keys: ['improver'], removed: false },
];
const reader = () => ({
  occurrence_id: 'o1', series_id: 's1', occurrence_date: '2026-10-08', version: 7, editable: true, not_editable_reason: null,
  sessions: sessions(),
  session_people: [
    { series_item_id: S1, people: [{ profile_id: P(1), display_name: 'Ana Ruiz', role: 'teaching' }] },
    { series_item_id: S2, people: [{ profile_id: P(2), display_name: 'DJ Ben', role: 'djing' }, { profile_id: P(3), display_name: 'Cleo', role: 'mc' }] },
    { added_session_id: A1, people: [] },
  ],
});
const draft = () => { const p = parseProgramme(reader()); return toDraft(p.sessions, p.sessionPeople); };
const at = (rows: DraftSession[], i: number, fn: (r: DraftSession) => DraftSession) => rows.map((r, j) => (j === i ? fn(r) : r));

describe('payload parity with the old programmeModel', () => {
  it('an untouched draft sends the reader objects byte-identically', () => {
    const rows = draft();
    expect(JSON.stringify(buildPayload(rows))).toBe(JSON.stringify(sessions()));
    buildPayload(rows).forEach((el, i) => expect(el).toBe(rows[i].original));
  });

  it('a change made through this page touches only its own session', () => {
    const rows = at(draft(), 0, (r) => pickPerson(r, { id: P(9), name: 'Dee' }));
    const out = buildPayload(rows);
    expect(out[0]).toEqual({ ...sessions()[0], people_add: [{ profile_id: P(9), role: 'teaching' }] });
    expect(JSON.stringify(out.slice(1))).toBe(JSON.stringify(sessions().slice(1)));
  });
});

describe('people by type', () => {
  it('class and masterclass take teachers, a party takes DJs, a performance nobody', () => {
    expect(addRoleFor('class')).toBe('teaching');
    expect(addRoleFor('masterclass')).toBe('teaching');
    expect(addRoleFor('party')).toBe('djing');
    expect(addRoleFor('performance')).toBeNull();
    expect(addRoleFor(null)).toBeNull();
  });

  it('a pick takes the role the type allows; a performance refuses it', () => {
    const party = pickPerson(draft()[1], { id: P(9), name: 'DJ Dee' });
    expect(party.people?.[party.people.length - 1]).toMatchObject({ id: P(9), role: 'djing', origin: 'added' });
    const perf = { ...newSession('performance') };
    expect(pickPerson(perf, { id: P(9), name: 'X' })).toBe(perf);
  });

  it('changing a NEW session type drops picks that no longer fit; a stored session keeps its type', () => {
    let row = pickPerson(newSession('class'), { id: P(9), name: 'Dee' });
    row = setSessionType(row, 'party');
    expect(row.type).toBe('party');
    expect(row.people).toEqual([]);
    const stored = draft()[0];
    expect(setSessionType(stored, 'party')).toBe(stored);
  });

  it('picking someone taken off puts them back (no duplicate people_add)', () => {
    const removed = removePerson(draft()[0], 0);
    expect(onSessionIds(removed).has(P(1))).toBe(false);
    const back = pickPerson(removed, { id: P(1), name: 'Ana Ruiz' });
    expect(back.people?.[0].removed).toBe(false);
    expect(buildPayload([back])[0]).toBe(back.original);
  });
});

describe("a date's time follows its sessions", () => {
  it('first start to last end, past midnight', () => {
    expect(dateSpan(draft())).toEqual({ start: '18:00', end: '02:00' });
  });
  it('removed sessions and sessions without times do not count', () => {
    const rows = at(draft(), 1, (r) => ({ ...r, removed: true }));
    expect(dateSpan(rows)).toEqual({ start: '18:00', end: '20:00' });
    expect(dateSpan([newSession('class')])).toBeNull();
  });
});

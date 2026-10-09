/**
 * The line-up of each session (admin 20261109700000 / 20261109750000): the reader's
 * session_people beside the sessions, and per-session people_add / people_remove
 * deltas in the save. The first block is the parity guarantee: a programme whose
 * line-up nobody touched saves byte-identically to the payload before the line-up.
 */
import { describe, expect, it } from 'vitest';
import {
  LIMITS,
  addLimitReason,
  addPerson,
  buildPayload,
  isDirty,
  lineupSummary,
  parseProgramme,
  peopleChanged,
  peopleChangesOf,
  removeLimitReason,
  removePerson,
  toDraft,
  undoRemovePerson,
  validateProgramme,
  type DraftSession,
  type WireSession,
} from '../programmeModel';
import { PEOPLE_CHANGED_COPY, PEOPLE_GENERIC_COPY, programmeErrorCopy } from '../selfServeErrors';

const S1 = '11111111-1111-4111-8111-111111111111';
const S2 = '22222222-2222-4222-8222-222222222222';
const A1 = '33333333-3333-4333-8333-333333333333';
const P = (n: number) => `aaaaaaaa-0000-4000-8000-${String(n).padStart(12, '0')}`;

const sessions = (): WireSession[] => [
  { series_item_id: S1, type: 'class', title: 'Bachata Basics', start_time: '19:00', end_time: '20:00', ends_next_day: false, level_keys: ['beginner'], removed: false },
  { series_item_id: S2, type: 'party', title: 'Party', start_time: '22:00', end_time: '02:00', ends_next_day: true, level_keys: [], removed: true },
  { added_session_id: A1, type: 'class', title: 'Bootcamp', start_time: '18:00', end_time: '18:45', ends_next_day: false, level_keys: ['improver'], removed: false },
];
const person = (n: number, name: string, role: string) => ({ profile_id: P(n), profile_type: role === 'djing' ? 'dj' : 'teacher', display_name: name, role });
const reader = () => ({
  occurrence_id: 'o1', series_id: 's1', occurrence_date: '2026-10-08', version: 7, editable: true, not_editable_reason: null,
  sessions: sessions(),
  session_people: [
    { series_item_id: S1, people: [person(1, 'Ana', 'teaching'), person(2, 'Ben', 'teaching'), person(3, 'Cleo', 'djing'), person(4, 'Max', 'mc')] },
    { series_item_id: S2, people: [person(5, 'Dee', 'djing')] },
    { added_session_id: A1, people: [] },
  ],
});
const draftOf = () => {
  const p = parseProgramme(reader());
  return toDraft(p.sessions, p.sessionPeople);
};
const at = (rows: DraftSession[], i: number, f: (r: DraftSession) => DraftSession) => rows.map((r, j) => (j === i ? f(r) : r));

describe('parity: an untouched line-up changes nothing in the save', () => {
  it('the payload is byte-identical to the one built without the line-up', () => {
    const withPeople = draftOf();
    const without = toDraft(sessions());
    expect(JSON.stringify(buildPayload(withPeople))).toBe(JSON.stringify(buildPayload(without)));
    expect(JSON.stringify(buildPayload(withPeople))).toBe(JSON.stringify(sessions()));
    buildPayload(withPeople).forEach((el) => {
      expect(el).not.toHaveProperty('people_add');
      expect(el).not.toHaveProperty('people_remove');
    });
    expect(isDirty(withPeople, 3)).toBe(false);
  });

  it('a field edit on a session with people sends no people keys', () => {
    const rows = at(draftOf(), 0, (r) => ({ ...r, title: 'Basics 2' }));
    expect(buildPayload(rows)[0]).not.toHaveProperty('people_add');
    expect(buildPayload(rows)[0]).not.toHaveProperty('people_remove');
  });

  it('removing then undoing leaves the payload as it came', () => {
    const rows = at(draftOf(), 0, (r) => undoRemovePerson(removePerson(r, 0), 0));
    expect(JSON.stringify(buildPayload(rows))).toBe(JSON.stringify(sessions()));
    expect(isDirty(rows, 3)).toBe(false);
  });
});

describe('reading the line-up', () => {
  it('matches session_people to sessions by identity key, with the stored role', () => {
    const rows = draftOf();
    expect(rows[0].people?.map((p) => [p.name, p.role, p.origin, p.removed])).toEqual([
      ['Ana', 'teaching', 'stored', false], ['Ben', 'teaching', 'stored', false], ['Cleo', 'djing', 'stored', false], ['Max', 'mc', 'stored', false],
    ]);
    expect(rows[2].people).toEqual([]);
    // Out of order still lines up by key.
    const r = reader();
    const p = parseProgramme({ ...r, session_people: [...r.session_people].reverse() });
    expect(toDraft(p.sessions, p.sessionPeople)[0].people).toHaveLength(4);
  });

  it('a reader without session_people reads as nobody', () => {
    const { session_people: _drop, ...r } = reader();
    const p = parseProgramme(r);
    expect(p.sessionPeople).toEqual([]);
    expect(toDraft(p.sessions, p.sessionPeople).every((row) => row.people?.length === 0)).toBe(true);
  });

  it('summarises as "Ana, Ben +2", skipping people marked removed', () => {
    const rows = draftOf();
    expect(lineupSummary(rows[0].people)).toBe('Ana, Ben +2');
    expect(lineupSummary(removePerson(rows[0], 0).people)).toBe('Ben, Cleo +1');
    expect(lineupSummary([])).toBeNull();
  });
});

describe('editing the line-up', () => {
  it('add sends people_add with exactly profile_id and role', () => {
    const rows = at(draftOf(), 2, (r) => addPerson(r, { id: P(9), name: 'Zed', role: 'djing' }));
    const el = buildPayload(rows)[2];
    expect(el.people_add).toEqual([{ profile_id: P(9), role: 'djing' }]);
    expect(Object.keys((el.people_add as object[])[0]).sort()).toEqual(['profile_id', 'role']);
    expect(el).not.toHaveProperty('people_remove');
    // The rest of the session is the reader's own object.
    const { people_add: _a, ...rest } = el;
    expect(rest).toEqual(sessions()[2]);
    expect(isDirty(rows, 3)).toBe(true);
  });

  it('remove sends people_remove as profile id strings; the person stays greyed until the save', () => {
    const rows = at(draftOf(), 0, (r) => removePerson(r, 1));
    expect(rows[0].people?.[1]).toMatchObject({ name: 'Ben', removed: true });
    expect(buildPayload(rows)[0].people_remove).toEqual([P(2)]);
    expect(buildPayload(rows)[0]).not.toHaveProperty('people_add');
  });

  it('someone added here and taken out again just goes, and is never sent', () => {
    const rows = at(draftOf(), 0, (r) => {
      const added = addPerson(r, { id: P(9), name: 'Zed', role: 'teaching' });
      return removePerson(added, added.people!.length - 1);
    });
    expect(rows[0].people?.some((p) => p.id === P(9))).toBe(false);
    expect(JSON.stringify(buildPayload(rows))).toBe(JSON.stringify(sessions()));
  });

  it('never adds someone already on the session, and never removes an MC or performer', () => {
    const row = draftOf()[0];
    expect(addPerson(row, { id: P(1), name: 'Ana', role: 'djing' })).toBe(row);
    expect(removePerson(row, 3)).toBe(row);
  });

  it('a new session carries people_add next to new: true', () => {
    const p = parseProgramme(reader());
    const rows = [...toDraft(p.sessions, p.sessionPeople)];
    const fresh = addPerson({ key: 'new:x', original: null, type: 'class', title: 'Extra', start: '20:00', end: '21:00', levels: [], removed: false, people: [] }, { id: P(9), name: 'Zed', role: 'teaching' });
    const payload = buildPayload([...rows, fresh]);
    expect(payload[3]).toMatchObject({ new: true, people_add: [{ profile_id: P(9), role: 'teaching' }] });
  });

  it('a removed session never carries people keys', () => {
    const rows = at(draftOf(), 0, (r) => ({ ...removePerson(r, 0), removed: true }));
    expect(peopleChanged(rows[0])).toBe(false);
    expect(buildPayload(rows)[0]).toEqual({ ...sessions()[0], removed: true });
  });
});

describe('limits and validation', () => {
  const many = (row: DraftSession, n: number) => {
    let r: DraftSession = { ...row, people: [] };
    for (let i = 0; i < n; i += 1) r = addPerson(r, { id: P(100 + i), name: `P${i}`, role: 'teaching' });
    return r;
  };

  it('12 added is the limit: the add buttons say why, and 13 is refused by validation', () => {
    const row = many(draftOf()[2], 12);
    expect(addLimitReason(row)).toMatch(/up to 12/);
    expect(validateProgramme([row]).ok).toBe(true);
    const over = { ...row, people: [...row.people!, { id: P(999), name: 'X', role: 'teaching', origin: 'added' as const, removed: false }] };
    expect(validateProgramme([over]).rows).toEqual([expect.objectContaining({ field: 'people', message: expect.stringMatching(/up to 12/) })]);
  });

  it('12 removed is the limit', () => {
    const stored = { ...draftOf()[0], people: Array.from({ length: 13 }, (_, i) => ({ id: P(200 + i), name: `S${i}`, role: 'djing', origin: 'stored' as const, removed: i < 12 })) };
    expect(peopleChangesOf(stored).remove).toHaveLength(12);
    expect(removeLimitReason(stored)).toMatch(/up to 12/);
    expect(validateProgramme([stored]).ok).toBe(true);
    const over = { ...stored, people: stored.people.map((p) => ({ ...p, removed: true })) };
    expect(validateProgramme([over]).ok).toBe(false);
  });

  it('a person in both lists is refused', () => {
    const row = { ...draftOf()[0], people: [
      { id: P(1), name: 'Ana', role: 'teaching', origin: 'stored' as const, removed: true },
      { id: P(1), name: 'Ana', role: 'djing', origin: 'added' as const, removed: false },
    ] };
    expect(validateProgramme([row]).rows[0]).toMatchObject({ field: 'people' });
  });

  it('LIMITS mirrors the writer', () => {
    expect(LIMITS.peopleMax).toBe(12);
  });
});

describe('line-up refusals: calm copy that never names anyone', () => {
  it.each([
    ['invalid_payload: people_remove names a person who is not on that session', PEOPLE_CHANGED_COPY, true],
    [`invalid_payload: session 1 people_add person ${P(1)} is already on this session`, PEOPLE_CHANGED_COPY, true],
    [`invalid_payload: session 0 people_add person ${P(1)} is not an existing, active, visible teacher or DJ profile holding that role`, expect.stringMatching(/Someone you added/), false],
    ['invalid_payload: session 0 would hold more than 12 people', 'A session can have up to 12 teachers and DJs.', false],
    ['invalid_payload: session 2 names a person more than once in people_add and people_remove', PEOPLE_GENERIC_COPY, false],
    ['invalid_payload: session 0 is removed and cannot carry people_add or people_remove', PEOPLE_GENERIC_COPY, false],
  ])('%s', (raw, message, reload) => {
    const copy = programmeErrorCopy({ message: raw });
    expect(copy.message).toEqual(message);
    expect(copy.reload).toBe(reload);
    expect(copy.message).not.toContain(P(1));
  });
});

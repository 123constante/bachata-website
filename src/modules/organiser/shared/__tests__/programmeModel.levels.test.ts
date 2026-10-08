/**
 * LEVELS BY TYPE (owner rule 2026-10-08): the ONE mapping (levelsApplyTo) and
 * every model consumer of it, table-driven over every session type x levels
 * none / one / many x stored vs new vs new-switched. The page-level matrix
 * (sheet, row, payload through the real page) is dates/__tests__/levelsByType.matrix.test.tsx.
 */
import { describe, expect, it } from 'vitest';
import {
  LEVEL_TYPES,
  SESSION_TYPES,
  buildPayload,
  changesOf,
  isDirty,
  levelsApplyTo,
  newSession,
  sessionLevels,
  toDraft,
  validateProgramme,
  type DraftSession,
} from '../programmeModel';
import { sessionLevelsLabel, setSessionType } from '../../dates/dateModel';

// The owner's rule, written out (not derived from the code under test).
const OFFERS: Record<string, boolean> = { class: true, masterclass: true, party: false, performance: false };
const LEVEL_SETS: Record<string, string[]> = { none: [], one: ['beginner'], many: ['improver', 'intermediate', 'advanced'] };
const ITEM = '11111111-1111-4111-8111-111111111111';
const ADDED = '22222222-2222-4222-8222-222222222222';
const cases = SESSION_TYPES.flatMap((type) => Object.entries(LEVEL_SETS).map(([set, levels]) => ({ type, set, levels })));

const stored = (type: string, levels: string[], idKey = 'series_item_id') => ({
  [idKey]: idKey === 'series_item_id' ? ITEM : ADDED,
  type, title: 'Thing', start_time: '20:00', end_time: '21:00', ends_next_day: false, level_keys: levels, removed: false,
});

describe('the mapping', () => {
  it('takes levels for class and masterclass only; every other type, older ones and none, takes none', () => {
    expect([...LEVEL_TYPES]).toEqual(['class', 'masterclass']);
    for (const t of SESSION_TYPES) expect(levelsApplyTo(t)).toBe(OFFERS[t]);
    // Older types still in prod (series items): competition, show, workshop.
    for (const t of ['competition', 'show', 'workshop', '', 'Class']) expect(levelsApplyTo(t)).toBe(false);
    expect(levelsApplyTo(null)).toBe(false);
  });
});

describe('a STORED session', () => {
  it.each(cases)('$type with $set: draft, row label, dirty and payload agree', ({ type, levels }) => {
    for (const idKey of ['series_item_id', 'added_session_id']) {
      const wire = stored(type, levels, idKey);
      const [row] = toDraft([wire]);
      const shown = OFFERS[type] ? levels : [];
      expect(row.levels).toEqual(shown);
      expect(sessionLevels(row)).toEqual(shown);
      expect(sessionLevelsLabel(row) !== null).toBe(shown.length > 0);
      // Untouched: not dirty, echoed byte for byte (stray levels included: no command for nothing).
      expect(isDirty([row], 1)).toBe(false);
      expect(buildPayload([row])).toEqual([wire]);
      // Saved for another change: a type without levels sends [] (stray levels come off).
      const edited: DraftSession = { ...row, title: 'Thing 2' };
      expect(changesOf(edited).levels).toBe(!OFFERS[type] && levels.length > 0);
      const [el] = buildPayload([edited]);
      expect(el[idKey]).toBe(wire[idKey]);
      expect(el.level_keys).toEqual(shown);
      expect(validateProgramme([edited]).ok).toBe(true);
    }
  });

  it.each(cases.filter((c) => !OFFERS[c.type] && c.levels.length))('$type with stray $set: a people-only save also clears them', ({ type, levels }) => {
    const [row] = toDraft([stored(type, levels)]);
    const withPerson: DraftSession = { ...row, people: [{ id: 'p1', name: 'Ana', role: type === 'party' ? 'djing' : 'teaching', origin: 'added', removed: false }] };
    const [el] = buildPayload([withPerson]);
    expect(el.level_keys).toEqual([]);
    expect(el).toMatchObject({ series_item_id: ITEM, title: 'Thing', start_time: '20:00', end_time: '21:00' });
  });

  it('a removed stray-level session is sent as removed, its stored values untouched', () => {
    const wire = stored('party', ['beginner']);
    const [row] = toDraft([wire]);
    expect(buildPayload([{ ...row, removed: true }])).toEqual([{ ...wire, removed: true }]);
  });
});

describe('a NEW session', () => {
  it.each(cases)('$type with $set picked where offered', ({ type, levels }) => {
    const row = { ...setSessionType(newSession('class'), type), title: 'Fresh', start: '20:00', end: '21:00' };
    const picked = { ...row, levels: OFFERS[type] ? levels : row.levels };
    const shown = OFFERS[type] ? levels : [];
    expect(sessionLevels(picked)).toEqual(shown);
    expect(buildPayload([picked])[0].level_keys).toEqual(shown);
    expect(validateProgramme([picked]).ok).toBe(true);
  });

  it.each(cases)('$set picked as a class, then switched to $type: cleared, not hidden', ({ type, levels }) => {
    const asClass = { ...newSession('class'), title: 'Fresh', start: '20:00', end: '21:00', levels };
    const switched = setSessionType(asClass, type);
    const kept = OFFERS[type] ? levels : [];
    expect(switched.levels).toEqual(kept);
    // Back to a class: nothing hidden comes back.
    expect(setSessionType(switched, 'class').levels).toEqual(kept);
    expect(sessionLevelsLabel(switched) !== null).toBe(kept.length > 0);
    expect(buildPayload([switched])[0]).toMatchObject({ new: true, type, level_keys: kept });
  });

  it('a stored session keeps its type and levels (the type is not the organiser’s to change)', () => {
    const [row] = toDraft([stored('class', ['beginner'])]);
    expect(setSessionType(row, 'party')).toBe(row);
  });
});

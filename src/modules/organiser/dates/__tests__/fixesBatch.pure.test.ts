/**
 * Pure mappings behind the organiser fixes batch: the picker row (5), the
 * cancelled label (9), the problems shown (11a), the session summary and
 * heading (11c, 12) and the venue override patch (G7).
 */
import { describe, expect, it } from 'vitest';
import { pickerRow, type ProfileNames } from '../peoplePicker';
import { cancelledLabel, shownCancelReason } from '@/modules/organiser/shared/cancelLabel';
import { ownTitle, sessionHeading, sessionName, sessionSummary } from '@/modules/organiser/shared/sessionSummary';
import { SESSION_TYPES, levelsApplyTo } from '@/modules/organiser/shared/programmeModel';
import { shownProblems } from '../dateModel';
import { venueOverridePatch } from '../venueOverride';

const res = (name: string, place: string | null) => ({ id: 'p1', name, photoUrl: null, place });
const prof = (display: string | null, first: string | null, surname: string | null): ProfileNames => ({ id: 'p1', display_name: display, first_name: first, surname });

describe('5: pickerRow', () => {
  it.each([
    ['teacher, line-up name differs, city+country', res('John Otaran', 'London, GB'), 'teaching', prof('Dj O', 'John', 'Otaran'), 'Dj O', 'Teacher \u00b7 John Otaran \u00b7 London, GB'],
    ['teacher, same name, no city', res('Eva Sol', null), 'teaching', prof('Eva Sol', 'Eva', 'Sol'), 'Eva Sol', 'Teacher'],
    ['teacher, no display_name: full name', res('Eva Sol', 'Leeds'), 'teaching', prof('  ', 'Eva', 'Sol'), 'Eva Sol', 'Teacher \u00b7 Leeds'],
    ['teacher, same name in other case', res('eva sol', null), 'teaching', prof('Eva Sol', 'eva', 'sol'), 'Eva Sol', 'Teacher'],
    ['teacher, profile not readable: search name kept', res('Ana Ruiz', 'York, GB'), 'teaching', undefined, 'Ana Ruiz', 'Teacher \u00b7 York, GB'],
    ['teacher, empty profile names: search name kept', res('Ana Ruiz', null), 'teaching', prof(null, null, null), 'Ana Ruiz', 'Teacher'],
    ['DJ, DJ name kept, full name shown', res('DJ Ben', 'Leeds, GB'), 'djing', prof('Ben', 'Ben', 'Hall'), 'DJ Ben', 'DJ \u00b7 Ben Hall \u00b7 Leeds, GB'],
    ['DJ, no profile, no city', res('DJ Ben', null), 'djing', undefined, 'DJ Ben', 'DJ'],
    ['DJ without a DJ name (name is the full name)', res('Ben Hall', null), 'djing', prof(null, 'Ben', 'Hall'), 'Ben Hall', 'DJ'],
  ] as const)('%s', (_n, result, role, profile, name, sublabel) => {
    expect(pickerRow(result, role, profile)).toEqual({ id: 'p1', name, sublabel });
  });
});

describe('9: cancelled label', () => {
  it.each([
    ['Other', 'Cancelled', null],
    ['OTHER', 'Cancelled', null],
    [' other ', 'Cancelled', null],
    ['', 'Cancelled', null],
    [null, 'Cancelled', null],
    [undefined, 'Cancelled', null],
    ['Illness', 'Cancelled \u00b7 Illness', 'Illness'],
    ['Other commitments', 'Cancelled \u00b7 Other commitments', 'Other commitments'],
  ] as const)('%j', (reason, label, shown) => {
    expect(cancelledLabel(reason)).toBe(label);
    expect(shownCancelReason(reason)).toBe(shown);
  });
});

describe('11a: problems shown only after a change or a save attempt', () => {
  const problems = [{ key: 'a', message: 'x' }, { key: 'b', message: 'y' }];
  it.each([
    ['untouched, no save tried', [], false, []],
    ['one touched', ['a'], false, ['a']],
    ['save tried', [], true, ['a', 'b']],
  ] as const)('%s', (_n, touched, tried, keys) => {
    expect(shownProblems(problems, new Set(touched), tried).map((p) => p.key)).toEqual(keys);
  });
});

describe('11c/12: session summary and heading (every type x levels)', () => {
  const cases = SESSION_TYPES.flatMap((type) => [[], ['beginner', 'improver']].map((levels) => [type, levels] as const));
  it.each(cases)('%s with %j', (type, levels) => {
    const row = { type, title: '', start: '19:00', end: '20:00', levels: [...levels] };
    const words = levels.length && levelsApplyTo(type) ? ' \u00b7 Beginner, Improver' : '';
    expect(sessionSummary(row)).toBe(`19:00\u201320:00${words}`);
  });
  it.each([
    ['', 'Class', null, 'Class'],
    ['class', 'Class', null, 'Class'],
    [' Class ', 'Class', null, 'Class'],
    ['Basics', 'Basics', 'Basics', 'Class: Basics'],
  ])('title %j', (title, name, own, heading) => {
    const row = { type: 'class', title, start: '', end: '', levels: [] };
    expect(sessionName(row)).toBe(name);
    expect(ownTitle(row)).toBe(own);
    expect(sessionHeading(row)).toBe(heading);
    expect(sessionSummary(row)).toBeNull();
  });
});

describe('G7: venue override patch', () => {
  const venues = [{ id: 'v2', name: 'Studio 2', city_name: 'York', neighbourhood: null, address: null, postcode: null }];
  it.each([
    ['a venue with a city', 'v2', async () => ({ cityId: 'c-york' }), { venue_id: 'v2', city_id: 'c-york' }],
    ['back to the usual venue', null, async () => ({ cityId: 'never' }), { venue_id: null, city_id: null }],
    ['a city that cannot be resolved', 'v2', async () => null, { venue_id: 'v2', city_id: null }],
    ['a venue not in the list', 'v9', async () => ({ cityId: 'never' }), { venue_id: 'v9', city_id: null }],
  ] as const)('%s', async (_n, id, resolve, want) => {
    expect(await venueOverridePatch(id, venues as never, resolve)).toEqual(want);
  });
});

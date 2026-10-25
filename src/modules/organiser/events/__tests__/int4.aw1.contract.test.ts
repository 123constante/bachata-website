// INT4: the Website organiser model against the FINAL AW1 contract (admin PR #838, head 0abbf14).
// a. set_program sends stored ids on days/sections/items, none on new rows, none on people; profile_type as stored.
// d. organiser_series_cast_v1 recent_people carry profile_type, one row per (profile_id, profile_type).
// e. an untouched programme (even one whose series has per-date overrides) sends no command.
import { describe, expect, it } from 'vitest';
import { addSession, buildDays, parseRecentPeople, parseTree, programCommand, recentFor } from '../programmeSeriesModel';

const D = '11111111-1111-4111-8111-111111111111';
const S = '22222222-2222-4222-8222-222222222222';
const I = '33333333-3333-4333-8333-333333333333';
const P = '44444444-4444-4444-8444-444444444444';

const stored = [{
  day: { id: D, day_index: 0 },
  sections: [{
    section: { id: S, kind: 'classes' },
    items: [{
      item: { id: I, type: 'class', title: 'Footwork', start_time: '20:00:00', end_time: '21:00:00', level_keys: [] },
      people: [
        { id: 'people-row-1', profile_id: P, profile_type: 'teacher', role: 'teaching', display_name: 'Ana' },
        { id: 'people-row-2', profile_id: P, profile_type: 'dancer', role: 'performing', display_name: 'Ana' },
      ],
    }],
  }],
}];

type Day = { id?: string; sections: { id?: string; items: { id?: string; people: Record<string, unknown>[] }[] }[] };

describe('INT4 a: the set_program payload', () => {
  const days = buildDays(parseTree(stored)) as Day[];

  it('sends the stored id on the day, the section and the item', () => {
    expect(days[0].id).toBe(D);
    expect(days[0].sections[0].id).toBe(S);
    expect(days[0].sections[0].items[0].id).toBe(I);
  });

  it('sends no id on people, and each person keeps its stored profile_type whatever the role', () => {
    const people = days[0].sections[0].items[0].people;
    for (const p of people) expect(p).not.toHaveProperty('id');
    expect(people.map((p) => [p.profile_type, p.role])).toEqual([['teacher', 'teaching'], ['dancer', 'performing']]);
  });

  it('a new session carries no id key at all (not null)', () => {
    const { tree } = addSession(parseTree(stored), 'classes', 'class');
    const items = (buildDays(tree) as Day[]).flatMap((d) => d.sections).flatMap((s) => s.items);
    expect(items).toHaveLength(2);
    expect(Object.prototype.hasOwnProperty.call(items[1], 'id')).toBe(false);
  });
});

describe('INT4 d: organiser_series_cast_v1 recent_people by (profile_id, profile_type)', () => {
  const recent = parseRecentPeople({
    cast: [{ profile_id: P, profile_type: 'teacher' }, { profile_id: P, profile_type: 'dj' }],
    recent_people: [
      { profile_id: P, profile_type: 'teacher', display_name: 'Ana', photo_url: null, roles: ['teaching'] },
      { profile_id: P, profile_type: 'dj', display_name: 'DJ Ana', photo_url: null, roles: ['djing'] },
      { profile_id: P, display_name: 'No type', roles: [] },
    ],
  });

  it('keeps the two types of one person as two rows and drops a row with no type (never guessed)', () => {
    expect(recent.map((r) => [r.profileId, r.profileType])).toEqual([[P, 'teacher'], [P, 'dj']]);
  });

  it('each type lands only in the list of the role it can hold, with its own type', () => {
    expect(recentFor(recent, 'teaching').map((r) => r.profileType)).toEqual(['teacher']);
    expect(recentFor(recent, 'djing').map((r) => r.profileType)).toEqual(['dj']);
  });
});

describe('INT4 e: an untouched save sends nothing', () => {
  it('a stored programme with ids (the shape a series with per-date overrides has) builds no command', () => {
    expect(programCommand(parseTree(stored), parseTree(stored))).toBeNull();
  });
});

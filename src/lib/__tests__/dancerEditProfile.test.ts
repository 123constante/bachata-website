import { describe, expect, it } from 'vitest';
import { EDITABLE_COLUMNS, NOTHING_TO_SAVE, buildDancerEditSave, dancerEditSaveReason, type DancerEditFields } from '@/lib/dancerEditProfile';
import { buildDancerProfilePayload } from '@/lib/saveMyDancerProfile';

const BASE: DancerEditFields = { firstName: 'Ana', surname: '', cityId: 'city-1', danceRole: '', hideSurname: false };

// Prod shapes (2026-10-14): no surname, surname set, hide on, role null (86%), city null, stub (all null).
const SHAPES: [string, DancerEditFields][] = [
  ['no surname', BASE],
  ['surname set', { ...BASE, surname: 'Santos' }],
  ['hide switch on', { ...BASE, surname: 'Santos', hideSurname: true }],
  ['role null', { ...BASE, danceRole: '' }],
  ['city null', { ...BASE, cityId: '' }],
  ['stub, all empty', { firstName: '', surname: '', cityId: '', danceRole: '', hideSurname: false }],
  ['switch unreadable', { ...BASE, hideSurname: null }],
];

describe('an untouched record sends nothing', () => {
  it.each(SHAPES)('%s', (_n, s) => {
    expect(buildDancerEditSave(s, { ...s })).toBeNull();
    expect(dancerEditSaveReason(s, { ...s }, false)).toBe(NOTHING_TO_SAVE);
  });
  it('whitespace-only edits are untouched too', () => {
    expect(buildDancerEditSave(BASE, { ...BASE, firstName: ' Ana ' })).toBeNull();
  });
});

describe('only changed fields are sent', () => {
  it.each(SHAPES)('%s: a new surname is exactly {surname}', (_n, s) => {
    expect(buildDancerEditSave(s, { ...s, surname: 'Lima' })).toEqual({ surname: 'Lima' });
  });
  it('first name, city, role', () => {
    expect(buildDancerEditSave(BASE, { ...BASE, firstName: 'Anna' })).toEqual({ first_name: 'Anna' });
    expect(buildDancerEditSave(BASE, { ...BASE, cityId: 'city-2' })).toEqual({ based_city_id: 'city-2' });
    expect(buildDancerEditSave(BASE, { ...BASE, danceRole: 'Follower' })).toEqual({ dance_role: 'Follower' });
  });
  it('the hide switch on sends hide_surname_publicly true, and nothing else', () => {
    expect(buildDancerEditSave(BASE, { ...BASE, hideSurname: true })).toEqual({ hide_surname_publicly: true });
  });
  it('an unreadable switch is never sent', () => {
    const s = { ...BASE, hideSurname: null };
    expect(buildDancerEditSave(s, { ...s, hideSurname: true })).toBeNull();
  });
  it('the payload carries only the changed key (an absent key never nulls a column)', () => {
    expect(buildDancerProfilePayload(buildDancerEditSave(BASE, { ...BASE, surname: 'Lima' })!)).toEqual({ surname: 'Lima' });
  });
});

describe('clearing', () => {
  const set = { ...BASE, surname: 'Santos' };
  it('clearing the surname builds an explicit null for surname only', () => {
    expect(buildDancerEditSave(set, { ...set, surname: '' })).toEqual({ surname: null });
    expect(buildDancerProfilePayload(buildDancerEditSave(set, { ...set, surname: ' ' })!)).toEqual({ surname: null });
  });
  it('...but Save is disabled with a reason: the live function keeps the old surname for null', () => {
    expect(dancerEditSaveReason(set, { ...set, surname: '' }, false)).toMatch(/can.t be removed here yet/);
  });
  it('a cleared first name is never sent and says why', () => {
    expect(buildDancerEditSave(BASE, { ...BASE, firstName: '' })).toBeNull();
    expect(dancerEditSaveReason(BASE, { ...BASE, firstName: '' }, false)).toMatch(/first name/);
  });
  it('saving disables with a reason', () => {
    expect(dancerEditSaveReason(BASE, { ...BASE, surname: 'x' }, true)).toMatch(/Saving/);
  });
});

describe('every dancer_profiles column the screen edits can be edited', () => {
  // [column, a draft change that must produce exactly that key]
  const CHANGES: Record<string, Partial<DancerEditFields>> = {
    first_name: { firstName: 'Zed' },
    surname: { surname: 'Zed' },
    hide_surname_publicly: { hideSurname: true },
    based_city_id: { cityId: 'city-9' },
    dance_role: { danceRole: 'Leader' },
  };
  it.each(EDITABLE_COLUMNS.map(([column]) => [column]))('%s', (column) => {
    expect(Object.keys(CHANGES)).toContain(column);
    expect(Object.keys(buildDancerEditSave(BASE, { ...BASE, ...CHANGES[column] })!)).toEqual([column]);
  });
  it('the table covers every column, none missing', () => {
    expect(EDITABLE_COLUMNS.map(([c]) => c).sort()).toEqual(Object.keys(CHANGES).sort());
  });
});

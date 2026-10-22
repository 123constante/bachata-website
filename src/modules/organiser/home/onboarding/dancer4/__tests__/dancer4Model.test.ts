import { describe, expect, it } from 'vitest';
import { PROFILE_FIELDS, type ProfileField } from '@/lib/profileCompletion';
import {
  CITY_REQUESTED_DISABLED_REASON,
  EMPTY_ANSWERS,
  NO_PREFILL,
  STEP_COPY,
  buildDancer4Save,
  disabledReason,
  normaliseCityRequest,
  parseDancerPrefill,
  pickChipCities,
  planDancer4,
} from '../dancer4Model';

const ALL = [...PROFILE_FIELDS];

describe('planDancer4: which questions are asked', () => {
  // [label, missing, prefill, expected steps, expected prefilled keys]
  const table: [string, ProfileField[], Parameters<typeof planDancer4>[1], ProfileField[], string[]][] = [
    ['new person, no prefill: all four in the approved order', ALL, NO_PREFILL, ['first_name', 'based_city_id', 'dance_role', 'avatar_url'], []],
    ['bound link with name + city: two questions', ALL, { first_name: 'Marta', city_id: 'c1' }, ['first_name', 'dance_role', 'avatar_url'], ['based_city_id']],
    ['name only prefilled', ALL, { first_name: 'Marta', city_id: null }, ['first_name', 'based_city_id', 'dance_role', 'avatar_url'], []],
    ['city only prefilled', ALL, { first_name: null, city_id: 'c1' }, ['first_name', 'dance_role', 'avatar_url'], ['based_city_id']],
    ['already has a name: prefill name is ignored, never overwrites', ['based_city_id', 'dance_role', 'avatar_url'], { first_name: 'Marta', city_id: null }, ['based_city_id', 'dance_role', 'avatar_url'], []],
    ['half done profile: only what is missing', ['dance_role', 'avatar_url'], NO_PREFILL, ['dance_role', 'avatar_url'], []],
    ['only name+city missing and both prefilled: nothing to ask', ['first_name', 'based_city_id'], { first_name: 'Marta', city_id: 'c1' }, ['first_name'], ['based_city_id']],
    ['only the photo missing', ['avatar_url'], { first_name: 'Marta', city_id: 'c1' }, ['avatar_url'], []],
  ];
  it.each(table)('%s', (_label, missing, prefill, steps, prefilled) => {
    const plan = planDancer4(missing, prefill);
    expect(plan.steps).toEqual(steps);
    expect(Object.keys(plan.prefilled).sort()).toEqual([...prefilled].sort());
  });

  it('a prefilled name is shown on its own step as the editable starting value, never saved unseen', () => {
    const plan = planDancer4(ALL, { first_name: 'Marta', city_id: null });
    expect(plan.defaults).toEqual({ first_name: 'Marta' });
    expect(plan.prefilled).toEqual({});
    expect(planDancer4(['dance_role'], { first_name: 'Marta', city_id: null }).defaults).toEqual({});
  });
});

describe('parseDancerPrefill', () => {
  it.each([
    [null, NO_PREFILL],
    [undefined, NO_PREFILL],
    ['x', NO_PREFILL],
    [{}, NO_PREFILL],
    [{ first_name: '  ', city_id: '' }, NO_PREFILL],
    [{ first_name: 4, city_id: {} }, NO_PREFILL],
    [{ first_name: ' Marta ', city_id: 'c1' }, { first_name: 'Marta', city_id: 'c1' }],
    [{ first_name: null, city_id: 'c1' }, { first_name: null, city_id: 'c1' }],
  ])('%j', (raw, expected) => {
    expect(parseDancerPrefill(raw)).toEqual(expected);
  });
});

describe('one mapping of words per field', () => {
  it.each(ALL)('%s has a title, a why line and a reason its button is off', (f) => {
    const c = STEP_COPY[f];
    expect(c.title.length).toBeGreaterThan(3);
    expect(c.why.length).toBeGreaterThan(3);
    expect(c.disabledReason.length).toBeGreaterThan(3);
  });
  it('titles are distinct', () => {
    expect(new Set(ALL.map((f) => STEP_COPY[f].title)).size).toBe(ALL.length);
  });
  it.each(ALL)('%s: a disabled primary always states why; enabled states none', (f) => {
    expect(disabledReason(f, EMPTY_ANSWERS, false)).toBe(STEP_COPY[f].disabledReason);
    expect(disabledReason(f, { ...EMPTY_ANSWERS, [f]: '   ' }, false)).not.toBeNull();
    expect(disabledReason(f, { ...EMPTY_ANSWERS, [f]: 'x' }, false)).toBeNull();
  });
  it('after a city request the reason says to pick the nearest city', () => {
    expect(disabledReason('based_city_id', EMPTY_ANSWERS, true)).toBe(CITY_REQUESTED_DISABLED_REASON);
    expect(disabledReason('based_city_id', { ...EMPTY_ANSWERS, based_city_id: 'c1' }, true)).toBeNull();
  });
});

describe('buildDancer4Save', () => {
  const answers = { first_name: ' Marta ', based_city_id: 'c1', dance_role: 'Follower', avatar_url: '' };
  it('sends trimmed values for the fields settled so far', () => {
    expect(buildDancer4Save(['first_name', 'based_city_id'], answers, {})).toEqual({ first_name: 'Marta', based_city_id: 'c1' });
  });
  it('does not resend what already landed', () => {
    expect(buildDancer4Save(['first_name', 'based_city_id', 'dance_role'], answers, { first_name: 'Marta', based_city_id: 'c1' })).toEqual({ dance_role: 'Follower' });
  });
  it('a changed answer after Back is sent again', () => {
    expect(buildDancer4Save(['first_name'], { ...answers, first_name: 'Maria' }, { first_name: 'Marta' })).toEqual({ first_name: 'Maria' });
  });
  it('an untouched record sends no command', () => {
    expect(buildDancer4Save(ALL, EMPTY_ANSWERS, {})).toBeNull();
    expect(buildDancer4Save(['avatar_url'], answers, {})).toBeNull();
  });
});

describe('city request name', () => {
  it.each([
    ['  Bath  ', 'Bath'],
    ['Santa   Cruz', 'Santa Cruz'],
    ['A', null],
    ['   ', null],
    ['x'.repeat(81), null],
    ['x'.repeat(80), 'x'.repeat(80)],
  ])('%j', (raw, expected) => {
    expect(normaliseCityRequest(raw)).toBe(expected);
  });
});

describe('pickChipCities', () => {
  it('keeps named cities in the listed order and drops ambiguous names', () => {
    const rows = [
      { id: '3', name: 'Madrid' },
      { id: '1', name: 'London' },
      { id: '4', name: 'Birmingham' },
      { id: '5', name: 'Birmingham' },
      { id: '9', name: 'Elsewhere' },
    ];
    expect(pickChipCities(rows)).toEqual([{ id: '1', name: 'London' }, { id: '3', name: 'Madrid' }]);
  });
  it.each([
    ['inactive city', { is_active: false }],
    ['active city', { is_active: true }],
    ['no flag read', {}],
  ])('chips do not depend on the active flag (%s): the gate only needs a city id', (_l, extra) => {
    expect(pickChipCities([{ id: '1', name: 'Madrid', ...extra }])).toEqual([{ id: '1', name: 'Madrid' }]);
  });
  it('is empty when the read gave nothing', () => {
    expect(pickChipCities([])).toEqual([]);
  });
});
